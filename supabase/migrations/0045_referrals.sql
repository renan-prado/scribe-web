-- Indique a um amigo: o programa de indicação ABERTO, irmão muito mais barato
-- do programa de parceiros (0029).
--
-- Regras de negócio em docs/indicacao.md. O resumo do que este arquivo
-- materializa:
--
--   * Todo usuário tem um código próprio (`profiles.referral_code`), gerado
--     na primeira vez que ele abre /indicar. O link é `scriba.cc/i/<codigo>`.
--   * Quem INDICA ganha moedas duas vezes por pessoa: no cadastro dela e, uma
--     única vez, quando ela assina. Quem é indicado NÃO ganha nada além das
--     50 de boas-vindas, é o que mantém o link do parceiro (150 moedas) como
--     a melhor oferta da casa.
--   * O parceiro passa a ganhar moedas por cadastro também
--     (`partners.signup_reward_coins`), para não ficar sem nada enquanto traz
--     gente que ainda não assinou.
--
-- AS INVARIANTES, e nenhuma delas é um `if` no servidor:
--
--   1. `referral_rewards.external_ref` é UNIQUE, e o valor deriva do
--      INDICADO, `referral-signup:<uuid>` e `referral-subscription:<uuid>`.
--      É assim que "uma vez por pessoa, para sempre" existe: cancelar e
--      reassinar seis meses depois colide e não credita nada. Mesma filosofia
--      de `partner_commissions.referred_user_id` e de
--      `coin_transactions.external_ref`.
--   2. A ATRIBUIÇÃO É EXCLUSIVA E PERMANENTE. Uma conta pertence a um
--      parceiro OU a um amigo, nunca aos dois, e nunca troca de dono. As duas
--      funções conferem a coluna da outra antes de gravar a sua.
--   3. As colunas novas de `profiles` nascem FORA do alcance do cliente: 0026
--      revogou UPDATE de `authenticated` e reconcedeu só
--      (display_name, avatar_url, email). `referred_by_user_id` decide para
--      quem vão moedas, e `referral_code` é a identidade pública do link.
--   4. Toda moeda passa por `grant_coins`. Nenhuma linha aqui escreve em
--      `coin_balance`.
--
-- POR QUE OS VALORES VÊM POR PARÂMETRO. `attach_referrer` recebe as moedas e
-- o teto mensal em vez de lê-los de uma tabela de configuração. A régua do
-- programa aberto é global (ao contrário da do parceiro, que é negociada por
-- pessoa e por isso é COLUNA), e duplicá-la aqui criaria a segunda cópia de um
-- número que a tela também precisa mostrar. A fonte única é
-- `lib/referrals/economics.ts`; estas funções só executam. É seguro porque
-- elas têm EXECUTE revogado de anon/authenticated, quem passa o valor é o
-- nosso servidor, nunca um navegador.

-- 1) O código de cada usuário ------------------------------------------------
-- Sete caracteres de um alfabeto sem ambiguidade visual (sem 0/O, sem 1/l/i):
-- este código é ditado em conversa e digitado à mão na tela de entrada, e um
-- "zero ou ó?" custa uma indicação. 31^7 ≈ 27 bilhões de combinações, a
-- colisão é tratada por retry na geração, não por sorte.

alter table public.profiles
  add column if not exists referral_code text;

create unique index if not exists profiles_referral_code_key
  on public.profiles (referral_code);

alter table public.profiles
  drop constraint if exists profiles_referral_code_format;
alter table public.profiles
  add constraint profiles_referral_code_format
  check (referral_code is null or referral_code ~ '^[a-hjkmnp-z2-9]{7}$');

-- 2) A atribuição ------------------------------------------------------------
-- Espelha exatamente as três colunas de parceiro criadas em 0029. Duas
-- famílias de colunas em vez de uma polimórfica porque as FKs apontam para
-- tabelas diferentes (auth.users e partners) e porque a exclusividade fica
-- legível: `partner_id is null and referred_by_user_id is null` é "conta sem
-- dono", em uma linha, sem decodificar um campo `kind`.

alter table public.profiles
  add column if not exists referred_by_user_id uuid references auth.users(id) on delete set null;
alter table public.profiles
  add column if not exists referred_by_at timestamptz;
alter table public.profiles
  add column if not exists referral_source text
    check (referral_source is null or referral_source in ('link', 'code'));

-- Serve a única pergunta do painel: "quantas pessoas eu trouxe?".
create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by_user_id)
  where referred_by_user_id is not null;

-- 3) O livro-razão das recompensas -------------------------------------------
-- Uma linha por fato econômico, no mesmo espírito de `coin_transactions` e
-- `partner_commissions`: valores congelados, nada de contador incrementado.
--
-- UMA tabela para os DOIS programas porque a pergunta que ela responde é a
-- mesma ("quanto o programa de indicação já custou, e por quê"), e porque a
-- exclusividade da atribuição garante que uma pessoa indicada nunca gere linha
-- nos dois. O beneficiário é um usuário OU um parceiro:
--
--   * amigo    → `beneficiary_user_id`, creditado na hora.
--   * parceiro → `beneficiary_partner_id`, ACUMULADO. `partners.user_id` nasce
--     NULL (o parceiro é cadastrado antes de existir como conta), então no
--     momento do cadastro do indicado pode não haver ninguém para creditar.
--     A linha nasce com `credited_at` nulo e é liberada na primeira visita do
--     parceiro ao app, mesmo caminho preguiçoso da mesada, e sem perda: moeda
--     só serve dentro do app de qualquer forma.

create table if not exists public.referral_rewards (
  id                     uuid primary key default gen_random_uuid(),
  -- Quem foi indicado. Não é exibido a ninguém: existe para derivar o
  -- external_ref e para o admin auditar. O painel só mostra contagem.
  referred_user_id       uuid not null references auth.users(id) on delete cascade,
  program                text not null check (program in ('friend', 'partner')),
  event                  text not null check (event in ('signup', 'subscription')),
  beneficiary_user_id    uuid references auth.users(id) on delete set null,
  beneficiary_partner_id uuid references public.partners(id) on delete cascade,
  coins                  int  not null check (coins > 0),
  -- A trava de idempotência, e a expressão de "uma vez por pessoa, por
  -- evento, para sempre". Deriva do INDICADO, nunca de quem recebe.
  external_ref           text not null unique,
  -- Nulo = acumulado, ainda não virou moeda. Só o programa de parceiros
  -- produz linhas assim.
  credited_at            timestamptz,
  created_at             timestamptz not null default now(),
  constraint referral_rewards_has_beneficiary check (
    (beneficiary_user_id is not null) <> (beneficiary_partner_id is not null)
  )
);

create index if not exists referral_rewards_beneficiary_idx
  on public.referral_rewards (beneficiary_user_id, created_at desc)
  where beneficiary_user_id is not null;

-- O índice que a liberação preguiçosa consulta em toda visita de parceiro.
-- Parcial: no caso normal (tudo creditado) ele é minúsculo.
create index if not exists referral_rewards_pending_idx
  on public.referral_rewards (beneficiary_partner_id)
  where credited_at is null and beneficiary_partner_id is not null;

-- 4) A recompensa por cadastro do parceiro -----------------------------------
-- Coluna, e não constante, pelo mesmo motivo de `signup_bonus_coins` e
-- `commission_rate_bps`: o acordo com o parceiro é negociado no convite. 50 é
-- o padrão do programa.

alter table public.partners
  add column if not exists signup_reward_coins int not null default 50
    check (signup_reward_coins between 0 and 100000);

-- 5) generate_referral_code() ------------------------------------------------
-- O alfabeto é espelhado em `lib/referrals/economics.ts`, que é quem valida a
-- entrada digitada antes de ela vir ao banco. Se um dia mudar, mudam os dois,
-- mesma relação de `lib/coins/pricing.ts` com as migrações de cobrança.

create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_code text := '';
  i int;
begin
  for i in 1..7 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  return v_code;
end;
$$;

-- 6) ensure_referral_code() --------------------------------------------------
-- Preguiçosa, como a mesada: o código nasce quando alguém abre /indicar, não
-- no trigger de criação do perfil. Duas razões, não mexer no trigger de
-- `auth.users` (que roda dentro do Supabase Auth e é o caminho mais caro de
-- depurar quando quebra), e não gerar código para contas que nunca vão indicar
-- ninguém.
--
-- O loop de colisão existe porque UNIQUE + random é uma aposta, não uma
-- garantia. Cinco tentativas sobre 27 bilhões de combinações é folga absurda;
-- a sexta levanta, e é melhor levantar do que devolver o código de outra
-- pessoa.

create or replace function public.ensure_referral_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text;
  v_attempt int := 0;
begin
  if p_user_id is null then
    raise exception 'invalid_user';
  end if;

  select referral_code into v_code from public.profiles where id = p_user_id;
  if v_code is not null then
    return v_code;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := public.generate_referral_code();
    begin
      update public.profiles
         set referral_code = v_code
       where id = p_user_id
         and referral_code is null;
      if found then
        return v_code;
      end if;
      -- Não atualizou: outra requisição gerou o código entre o SELECT e o
      -- UPDATE. O dela vale.
      select referral_code into v_code from public.profiles where id = p_user_id;
      return v_code;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

-- 7) attach_referrer() -------------------------------------------------------
-- O irmão de `attach_partner`, e deliberadamente igual a ele onde pode ser:
-- mesma trava de conta nova, mesmo `for update` no perfil, mesmos códigos de
-- retorno, mesma recusa em lançar exceção por um "não" que é normal.
--   ok | already_attributed | not_new | unknown_code | self_referral | capped
--
-- `capped` VINCULA MAS NÃO CREDITA. O teto mensal existe para que uma conta
-- que traz 40 cadastros num mês seja tratada como o que ela é, um divulgador,
-- que deveria estar no programa de parceiros, sem que a atribuição se perca
-- pelo caminho: a recompensa por ASSINATURA continua valendo para todas essas
-- pessoas, porque assinatura sempre paga a própria conta.

create or replace function public.attach_referrer(
  p_user_id    uuid,
  p_code       text,
  p_source     text default 'link',
  p_coins      int  default 0,
  p_month_cap  int  default 0
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_partner  uuid;
  v_existing_referrer uuid;
  v_created_at        timestamptz;
  v_referrer          uuid;
  v_month_count       int;
  v_ref               text;
begin
  if p_user_id is null or coalesce(trim(p_code), '') = '' then
    return 'unknown_code';
  end if;
  if p_source is null or p_source not in ('link', 'code') then
    p_source := 'link';
  end if;

  -- Trava o perfil antes de decidir: duas abas terminando o login juntas
  -- serializam aqui, e a segunda enxerga a atribuição da primeira.
  select partner_id, referred_by_user_id, created_at
    into v_existing_partner, v_existing_referrer, v_created_at
    from public.profiles
   where id = p_user_id
     for update;

  if v_created_at is null then
    return 'unknown_code';
  end if;
  -- A exclusividade das duas atribuições, conferida dos dois lados.
  if v_existing_partner is not null or v_existing_referrer is not null then
    return 'already_attributed';
  end if;
  if v_created_at < now() - interval '30 minutes' then
    return 'not_new';
  end if;

  select id into v_referrer
    from public.profiles
   where referral_code = lower(trim(p_code))
     and is_active is not false;

  if v_referrer is null then
    return 'unknown_code';
  end if;
  if v_referrer = p_user_id then
    return 'self_referral';
  end if;

  update public.profiles
     set referred_by_user_id = v_referrer,
         referred_by_at      = now(),
         referral_source     = p_source
   where id = p_user_id;

  if p_coins <= 0 then
    return 'ok';
  end if;

  -- O teto do mês, contado no próprio livro-razão. Não há contador em coluna
  -- para desandar: a contagem é derivada, como todo saldo neste banco.
  if p_month_cap > 0 then
    select count(*) into v_month_count
      from public.referral_rewards
     where beneficiary_user_id = v_referrer
       and program = 'friend'
       and event   = 'signup'
       and created_at >= date_trunc('month', now());
    if v_month_count >= p_month_cap then
      return 'capped';
    end if;
  end if;

  v_ref := 'referral-signup:' || p_user_id::text;

  insert into public.referral_rewards (
    referred_user_id, program, event, beneficiary_user_id, coins, external_ref, credited_at
  ) values (
    p_user_id, 'friend', 'signup', v_referrer, p_coins, v_ref, now()
  )
  on conflict (external_ref) do nothing;

  if not found then
    return 'ok';  -- já creditado por uma passagem anterior
  end if;

  perform public.grant_coins(v_referrer, p_coins, 'referral_signup', v_ref);

  return 'ok';
end;
$$;

-- 8) award_referral_subscription() -------------------------------------------
-- A segunda recompensa: paga UMA vez, quando o indicado paga a PRIMEIRA
-- fatura. Chamada de dentro de `creditInvoice` (lib/billing/fulfill.ts), no
-- mesmo ponto e pelo mesmo motivo da comissão do parceiro, é por ali que
-- passam os quatro caminhos de crédito, e pendurá-la em um deles faria uma
-- compra recuperada pelos outros três não recompensar ninguém.
--
-- Devolve as moedas creditadas AGORA; 0 quando não havia o que fazer (a
-- pessoa não veio de indicação, ou a recompensa dela já foi paga). Nenhum dos
-- dois é erro: o primeiro é o caso comum.

create or replace function public.award_referral_subscription(
  p_referred_user_id uuid,
  p_coins            int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
  v_ref      text;
begin
  if p_referred_user_id is null or p_coins is null or p_coins <= 0 then
    return 0;
  end if;

  select referred_by_user_id into v_referrer
    from public.profiles
   where id = p_referred_user_id;

  if v_referrer is null or v_referrer = p_referred_user_id then
    return 0;
  end if;

  v_ref := 'referral-subscription:' || p_referred_user_id::text;

  insert into public.referral_rewards (
    referred_user_id, program, event, beneficiary_user_id, coins, external_ref, credited_at
  ) values (
    p_referred_user_id, 'friend', 'subscription', v_referrer, p_coins, v_ref, now()
  )
  on conflict (external_ref) do nothing;

  if not found then
    return 0;
  end if;

  perform public.grant_coins(v_referrer, p_coins, 'referral_subscription', v_ref);
  return p_coins;
end;
$$;

-- 9) flush_partner_signup_rewards() ------------------------------------------
-- Libera o que o parceiro acumulou. Preguiçosa, disparada por
-- `getCurrentPartner()` junto da mesada: é o único caminho por onde todo
-- parceiro passa.
--
-- Um `grant_coins` por linha, e não um pelo total, porque é o `external_ref`
-- de cada linha que torna a operação idempotente. Somar tudo num crédito só
-- exigiria inventar uma chave nova para a soma, e chave inventada é
-- exatamente onde o crédito duplo mora.
--
-- `skip locked` porque duas abas do parceiro abrindo o app no mesmo segundo
-- não podem esperar uma pela outra num caminho de renderização: a segunda
-- pula o que a primeira já está creditando e segue.

create or replace function public.flush_partner_signup_rewards(
  p_partner_id uuid,
  p_user_id    uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   record;
  v_total int := 0;
begin
  if p_partner_id is null or p_user_id is null then
    return 0;
  end if;

  for v_row in
    select id, coins, external_ref
      from public.referral_rewards
     where beneficiary_partner_id = p_partner_id
       and credited_at is null
     order by created_at
     for update skip locked
  loop
    perform public.grant_coins(p_user_id, v_row.coins, 'partner_signup_reward', v_row.external_ref);
    update public.referral_rewards
       set credited_at = now()
     where id = v_row.id;
    v_total := v_total + v_row.coins;
  end loop;

  return v_total;
end;
$$;

-- 10) attach_partner(), agora com a recompensa do parceiro -------------------
-- Recriada INTEIRA (a 0029 é a versão anterior) por duas mudanças:
--
--   a) confere `referred_by_user_id` além de `partner_id`, a atribuição é
--      exclusiva, e quem chegou por um amigo não vira indicado de parceiro
--      num segundo login;
--   b) acumula a recompensa por cadastro do parceiro no livro-razão novo.
--
-- A recompensa NÃO passa pelo `bonus_budget_coins`: aquele teto foi criado
-- para limitar o custo do brinde ao INDICADO, e misturar as duas contas faria
-- um orçamento estourado calar a remuneração do parceiro sem que ele
-- entendesse por quê. Se um teto para esta ponta for necessário, ele nasce
-- como coluna própria.

create or replace function public.attach_partner(
  p_user_id uuid,
  p_slug    text,
  p_source  text default 'link'
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner    public.partners%rowtype;
  v_existing   uuid;
  v_referrer   uuid;
  v_created_at timestamptz;
  v_bonus      int;
begin
  if p_user_id is null or coalesce(trim(p_slug), '') = '' then
    return 'unknown_slug';
  end if;
  if p_source is null or p_source not in ('link', 'code') then
    p_source := 'link';
  end if;

  select partner_id, referred_by_user_id, created_at
    into v_existing, v_referrer, v_created_at
    from public.profiles
   where id = p_user_id
     for update;

  if v_created_at is null then
    return 'unknown_slug';  -- perfil ainda não existe; nada a vincular
  end if;
  if v_existing is not null or v_referrer is not null then
    return 'already_attributed';
  end if;
  if v_created_at < now() - interval '30 minutes' then
    return 'not_new';
  end if;

  select * into v_partner
    from public.partners
   where lower(slug) = lower(trim(p_slug))
     and status = 'active'
     for update;

  if v_partner.id is null then
    return 'unknown_slug';
  end if;
  if v_partner.user_id is not null and v_partner.user_id = p_user_id then
    return 'self_referral';
  end if;

  update public.profiles
     set partner_id            = v_partner.id,
         partner_attributed_at = now(),
         attribution_source    = p_source
   where id = p_user_id;

  -- Orçamento estourado: vincula sem bônus. O parceiro continua ganhando a
  -- comissão se a pessoa assinar, o teto limita o custo do brinde, não o
  -- programa.
  v_bonus := v_partner.signup_bonus_coins;
  if v_partner.bonus_budget_coins is not null
     and v_partner.bonus_granted_coins + v_bonus > v_partner.bonus_budget_coins then
    v_bonus := 0;
  end if;

  if v_bonus > 0 then
    perform public.grant_coins(
      p_user_id,
      v_bonus,
      'partner_bonus',
      'partner-bonus:' || p_user_id::text
    );
    update public.partners
       set bonus_granted_coins = bonus_granted_coins + v_bonus,
           updated_at = now()
     where id = v_partner.id;
  end if;

  -- A recompensa do parceiro por ter trazido a pessoa. Acumula; vira moeda na
  -- próxima visita dele ao app (ver flush_partner_signup_rewards).
  if v_partner.signup_reward_coins > 0 then
    insert into public.referral_rewards (
      referred_user_id, program, event, beneficiary_partner_id, coins, external_ref
    ) values (
      p_user_id, 'partner', 'signup', v_partner.id, v_partner.signup_reward_coins,
      'partner-signup-reward:' || p_user_id::text
    )
    on conflict (external_ref) do nothing;
  end if;

  return 'ok';
end;
$$;

-- 11) Permissões -------------------------------------------------------------
-- Funções nascem com EXECUTE para PUBLIC; revogar é o passo que importa.
-- Mesmo tratamento de grant_coins e attach_partner: só o service_role chama, e
-- ele vive exclusivamente no servidor.

revoke all on function public.generate_referral_code() from public;
revoke all on function public.generate_referral_code() from anon, authenticated;

revoke all on function public.ensure_referral_code(uuid) from public;
revoke all on function public.ensure_referral_code(uuid) from anon, authenticated;
grant execute on function public.ensure_referral_code(uuid) to service_role;

revoke all on function public.attach_referrer(uuid, text, text, int, int) from public;
revoke all on function public.attach_referrer(uuid, text, text, int, int) from anon, authenticated;
grant execute on function public.attach_referrer(uuid, text, text, int, int) to service_role;

revoke all on function public.award_referral_subscription(uuid, int) from public;
revoke all on function public.award_referral_subscription(uuid, int) from anon, authenticated;
grant execute on function public.award_referral_subscription(uuid, int) to service_role;

revoke all on function public.flush_partner_signup_rewards(uuid, uuid) from public;
revoke all on function public.flush_partner_signup_rewards(uuid, uuid) from anon, authenticated;
grant execute on function public.flush_partner_signup_rewards(uuid, uuid) to service_role;

-- 12) RLS --------------------------------------------------------------------
-- RLS ligado e NENHUMA policy: é a forma mais forte de dizer que o cliente não
-- toca nesta tabela. O painel de /indicar monta os contadores no servidor, com
-- service-role, e devolve só números, mesma regra do painel do parceiro, pela
-- mesma razão: `referred_user_id` é uma pessoa, e não há motivo de negócio
-- para quem indicou saber quem ela é além do que já sabe.

alter table public.referral_rewards enable row level security;
