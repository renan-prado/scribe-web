-- Programa de parceiros divulgadores: atribuição, bônus de indicação e
-- comissão sobre a primeira assinatura.
--
-- Regras de negócio em docs/parceiros.md; plano técnico em
-- docs/parceiros-plano.md. O resumo do que este arquivo materializa:
--
--   * Uma pessoa é vinculada a um parceiro por LINK (cookie de 30 dias) ou
--     por CÓDIGO digitado no cadastro. O vínculo é permanente: gravado uma
--     vez, nunca reescrito.
--   * O indicado ganha um bônus de moedas no cadastro (150 por padrão), que
--     SOMA às 50 de boas-vindas.
--   * O parceiro ganha um percentual da PRIMEIRA mensalidade paga por cada
--     indicado — uma vez por pessoa, para sempre.
--
-- DUAS INVARIANTES ESTRUTURAIS, e nenhuma delas depende de `if` no
-- servidor:
--
--   1. `partner_commissions.referred_user_id` é UNIQUE. É assim que "uma
--      comissão por pessoa na vida" existe: se o indicado cancelar e
--      reassinar seis meses depois, o INSERT colide com a constraint e nada
--      é creditado. Mesma filosofia do `coin_transactions.external_ref`.
--   2. `commission_cents` e `rate_bps` são CONGELADOS na linha no momento em
--      que a comissão nasce. A taxa é editável por parceiro, e mudá-la
--      amanhã não pode reescrever o que ele já ganhou.
--
-- SUPERFÍCIE DE ATAQUE — o que este arquivo fecha:
--   * Auto-atribuição via PostgREST. As três colunas novas em `profiles`
--     ficam fora do GRANT de coluna concedido a `authenticated` em 0026
--     (que lista display_name/avatar_url/email e mais nada). Um usuário com
--     o anon key não consegue apontar o próprio perfil para outro parceiro,
--     nem carimbar uma atribuição que nunca houve.
--   * Bônus forjado. `attach_partner()` é SECURITY DEFINER com EXECUTE
--     revogado de anon/authenticated, exatamente como `grant_coins()`. E ela
--     credita CHAMANDO `grant_coins`, não escrevendo no saldo: o bônus entra
--     pela mesma porta única de crédito que todo o resto do dinheiro.
--   * Bônus retroativo. A função recusa contas que não são novas — sem isso,
--     qualquer usuário antigo que abrisse um link de parceiro seria vinculado
--     e ganharia moedas de graça, quantas vezes quisesse trocar de link.
--   * Auto-indicação. O parceiro não gera comissão para si mesmo.
--   * Vazamento de dados dos indicados. As policies abaixo dão ao parceiro
--     acesso às PRÓPRIAS linhas de clique, comissão e pagamento. Nenhuma
--     delas expõe `profiles`: o parceiro nunca vê quem se cadastrou, só
--     quantos.

-- 1) Parceiros ---------------------------------------------------------------
-- `user_id` nasce NULL: o parceiro é cadastrado pelo admin a partir do e-mail
-- do convite, e a linha só é ligada a uma conta no primeiro login (o e-mail
-- do Google tem de bater com `invited_email`). Duas consequências úteis: dá
-- para preparar o cadastro antes de a pessoa existir no sistema, e um
-- parceiro sem conta ainda acumula cliques e comissões normalmente.

create table if not exists public.partners (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid unique references auth.users(id) on delete set null,
  invited_email         text not null,
  -- Serve ao mesmo tempo como caminho do link (/r/<slug>) e como código
  -- digitável no cadastro. Guardado sempre em minúsculas — a resolução
  -- normaliza a entrada antes de comparar, para "JOAO" e "joao" serem o
  -- mesmo parceiro.
  slug                  text not null,
  display_name          text not null,
  -- {instagram, tiktok, youtube, ...}. jsonb em vez de colunas fixas porque
  -- a lista de redes muda mais rápido que o schema.
  socials               jsonb not null default '{}'::jsonb,
  doc                   text,
  pix_key               text,
  -- Basis points: 3000 = 30,00%. Inteiro em vez de numeric para que a
  -- aritmética de dinheiro seja exata. Editável por parceiro — o simulador
  -- do admin mostra o efeito no mês 1 antes de salvar.
  commission_rate_bps   int  not null default 3000
    check (commission_rate_bps between 0 and 10000),
  signup_bonus_coins    int  not null default 150
    check (signup_bonus_coins between 0 and 100000),
  -- Teto opcional de moedas de bônus. NULL = sem teto. Estourado o
  -- orçamento, o vínculo continua acontecendo (o parceiro não perde a
  -- comissão) mas o bônus para de ser creditado.
  bonus_budget_coins    int  check (bonus_budget_coins is null or bonus_budget_coins >= 0),
  -- Contador de controle do teto acima. NÃO é o livro-razão: o registro
  -- canônico de cada crédito continua sendo `coin_transactions`. Existe
  -- porque a alternativa (somar o ledger a cada cadastro) exigiria amarrar
  -- parceiro à linha de crédito só para uma checagem de orçamento.
  bonus_granted_coins   int  not null default 0,
  status                text not null default 'active'
    check (status in ('active', 'suspended')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Slug e e-mail do convite são chaves de resolução: únicos, sem depender de
-- caixa. `lower()` no índice porque a entrada vem de URL e de campo digitado.
create unique index if not exists partners_slug_key
  on public.partners (lower(slug));
create unique index if not exists partners_invited_email_key
  on public.partners (lower(invited_email));

-- Formato do slug: é uma URL pública e um código que alguém vai ditar em
-- vídeo. Sem espaço, sem acento, sem maiúscula, sem ambiguidade.
alter table public.partners
  drop constraint if exists partners_slug_format;
alter table public.partners
  add constraint partners_slug_format
  check (slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$');

-- 2) Cliques no link ---------------------------------------------------------
-- Rollup diário, não evento cru. O painel só mostra agregado e o volume não
-- justifica uma linha por visita — mas a distinção clicks/uniques importa: um
-- link em stories é reaberto várias vezes pela mesma pessoa, e sem a coluna
-- `uniques` o funil do parceiro vira ficção otimista.

create table if not exists public.partner_clicks (
  partner_id  uuid not null references public.partners(id) on delete cascade,
  day         date not null,
  clicks      int  not null default 0,
  uniques     int  not null default 0,
  primary key (partner_id, day)
);

-- 3) Pagamentos ao parceiro --------------------------------------------------
-- Feitos à mão, por PIX. A tabela existe para que "quanto devo ao João" seja
-- derivável em vez de lembrado: sem ela, o total a pagar seria um SUM() das
-- comissões que nunca diminui, e o primeiro PIX pago já deixaria o número
-- mentindo para sempre.
--
-- Declarada ANTES de partner_commissions porque é o alvo da FK payout_id.

create table if not exists public.partner_payouts (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  -- Primeiro dia do mês de referência. Só rótulo: o que define o que foi
  -- quitado é o carimbo de payout_id nas comissões, não este campo.
  period       date not null,
  amount_cents int  not null check (amount_cents > 0),
  paid_at      timestamptz not null default now(),
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists partner_payouts_partner_idx
  on public.partner_payouts (partner_id, paid_at desc);

-- 4) Comissões ---------------------------------------------------------------
-- Livro-razão, no mesmo espírito de coin_transactions: uma linha por fato
-- econômico, valores congelados, saldo derivado por SUM(). Nunca um contador
-- incrementado.
--
-- Ciclo de vida:
--   pending   → nasce assim; dentro da carência de 30 dias
--   available → available_at venceu (resolvido em query, não por cron)
--   paid      → carimbada com um payout_id
--   reversed  → o pagamento foi estornado ou contestado

create table if not exists public.partner_commissions (
  id                uuid primary key default gen_random_uuid(),
  partner_id        uuid not null references public.partners(id) on delete cascade,
  -- A regra "uma comissão por pessoa na vida", expressa como constraint.
  referred_user_id  uuid not null unique references auth.users(id) on delete cascade,
  -- Idempotência no mesmo padrão de coin_transactions.external_ref: os quatro
  -- caminhos de crédito (webhook, reconcile, summary, sweep) podem tentar
  -- criar a mesma comissão, e só o primeiro consegue.
  external_ref      text not null unique,
  stripe_invoice_id text,
  plan              text,
  gross_cents       int  not null check (gross_cents >= 0),
  -- Congelados no momento em que a comissão nasce. Ver o cabeçalho.
  commission_cents  int  not null check (commission_cents >= 0),
  rate_bps          int  not null check (rate_bps between 0 and 10000),
  status            text not null default 'pending'
    check (status in ('pending', 'available', 'paid', 'reversed')),
  available_at      timestamptz not null,
  payout_id         uuid references public.partner_payouts(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists partner_commissions_partner_idx
  on public.partner_commissions (partner_id, created_at desc);
-- Serve a pergunta que o admin faz toda vez que vai pagar: o que já está
-- disponível e ainda não foi quitado?
create index if not exists partner_commissions_payable_idx
  on public.partner_commissions (partner_id, available_at)
  where status in ('pending', 'available') and payout_id is null;

-- 5) Atribuição no perfil ----------------------------------------------------
-- Escrito UMA vez, por attach_partner(), e nunca reescrito.
--
-- Estas colunas ficam fora do alcance do cliente de graça: 0026 revogou
-- UPDATE de `authenticated` em profiles e reconcedeu apenas
-- (display_name, avatar_url, email). Toda coluna nova nasce, portanto, não
-- escrevível pelo anon key — que é exatamente o que queremos aqui, já que
-- `partner_id` decide para quem vai dinheiro.

alter table public.profiles
  add column if not exists partner_id uuid references public.partners(id) on delete set null;
alter table public.profiles
  add column if not exists partner_attributed_at timestamptz;
alter table public.profiles
  add column if not exists attribution_source text
    check (attribution_source is null or attribution_source in ('link', 'code'));

create index if not exists profiles_partner_id_idx
  on public.profiles (partner_id)
  where partner_id is not null;

-- 6) record_partner_click() --------------------------------------------------
-- Um upsert no rollup do dia. `p_unique` vem do cookie de visita de 24h
-- decidido na rota /r/<slug>.
--
-- Slug desconhecido é silenciosamente ignorado: um link velho ou digitado
-- errado deve levar a pessoa para a landing page, nunca virar erro na cara
-- de um visitante que não tem nada com isso.

create or replace function public.record_partner_click(
  p_slug   text,
  p_unique boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
begin
  select id into v_partner_id
    from public.partners
   where lower(slug) = lower(trim(coalesce(p_slug, '')))
     and status = 'active';

  if v_partner_id is null then
    return;
  end if;

  insert into public.partner_clicks (partner_id, day, clicks, uniques)
  values (v_partner_id, current_date, 1, case when p_unique then 1 else 0 end)
  on conflict (partner_id, day) do update
    set clicks  = public.partner_clicks.clicks + 1,
        uniques = public.partner_clicks.uniques + case when p_unique then 1 else 0 end;
end;
$$;

-- 7) attach_partner() --------------------------------------------------------
-- O vínculo inteiro em uma ida ao banco: valida, grava a atribuição e credita
-- o bônus, tudo na mesma transação. Chamada no /auth/callback logo após o
-- exchange do código do OAuth.
--
-- Devolve um código de resultado em vez de lançar exceção, porque quase todos
-- os "não" são normais e não devem quebrar o login: quem já tem parceiro, ou
-- clicou num link velho, ou é um usuário antigo, simplesmente entra no app.
--   ok | already_attributed | not_new | unknown_slug | self_referral
--
-- A JANELA DE CONTA NOVA é o detalhe que mais fácil se esqueceria. Sem ela,
-- um usuário de um ano atrás que abrisse /r/joao seria vinculado no login
-- seguinte e ganharia 150 moedas — de novo a cada link diferente que abrisse.
-- Trinta minutos cobrem com folga o roundtrip do OAuth e o consentimento.

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
  v_created_at timestamptz;
  v_bonus      int;
begin
  if p_user_id is null or coalesce(trim(p_slug), '') = '' then
    return 'unknown_slug';
  end if;
  if p_source is null or p_source not in ('link', 'code') then
    p_source := 'link';
  end if;

  -- Trava a linha do perfil antes de decidir qualquer coisa: dois callbacks
  -- simultâneos (duas abas terminando o login juntas) serializam aqui, e o
  -- segundo enxerga a atribuição que o primeiro acabou de gravar.
  select partner_id, created_at into v_existing, v_created_at
    from public.profiles
   where id = p_user_id
     for update;

  if v_created_at is null then
    return 'unknown_slug';  -- perfil ainda não existe; nada a vincular
  end if;
  if v_existing is not null then
    return 'already_attributed';
  end if;
  if v_created_at < now() - interval '30 minutes' then
    return 'not_new';
  end if;

  -- FOR UPDATE também aqui: o contador de bônus é lido e incrementado, e dois
  -- cadastros no mesmo instante poderiam furar o teto lendo o mesmo valor.
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
  -- comissão se a pessoa assinar — o teto limita o custo do brinde, não o
  -- programa.
  v_bonus := v_partner.signup_bonus_coins;
  if v_partner.bonus_budget_coins is not null
     and v_partner.bonus_granted_coins + v_bonus > v_partner.bonus_budget_coins then
    v_bonus := 0;
  end if;

  if v_bonus > 0 then
    -- Pela porta única de crédito. O external_ref por usuário torna o bônus
    -- idempotente mesmo que este caminho seja percorrido duas vezes.
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

  return 'ok';
end;
$$;

-- 8) Permissões das funções --------------------------------------------------
-- Funções nascem com EXECUTE para PUBLIC; revogar é o passo que importa.
-- Mesmo tratamento de grant_coins/clawback_coins: só o service_role chama, e
-- ele vive exclusivamente no servidor.

revoke all on function public.attach_partner(uuid, text, text) from public;
revoke all on function public.attach_partner(uuid, text, text) from anon, authenticated;
grant execute on function public.attach_partner(uuid, text, text) to service_role;

revoke all on function public.record_partner_click(text, boolean) from public;
revoke all on function public.record_partner_click(text, boolean) from anon, authenticated;
grant execute on function public.record_partner_click(text, boolean) to service_role;

-- 9) RLS ---------------------------------------------------------------------
-- O parceiro lê as PRÓPRIAS linhas. Escrita é toda por service_role (que
-- ignora RLS): não há policy de INSERT/UPDATE/DELETE em nenhuma destas
-- tabelas, o que é a forma mais forte de dizer que o cliente não escreve.
--
-- Nenhuma policy aqui expõe `profiles`. O painel do parceiro monta o funil
-- com count(*) do lado do servidor; o parceiro nunca recebe uma linha que
-- represente uma pessoa.

alter table public.partners            enable row level security;
alter table public.partner_clicks      enable row level security;
alter table public.partner_commissions enable row level security;
alter table public.partner_payouts     enable row level security;

drop policy if exists partners_select_own on public.partners;
create policy partners_select_own on public.partners
  for select using (user_id = auth.uid());

drop policy if exists partner_clicks_select_own on public.partner_clicks;
create policy partner_clicks_select_own on public.partner_clicks
  for select using (
    partner_id in (select id from public.partners where user_id = auth.uid())
  );

drop policy if exists partner_commissions_select_own on public.partner_commissions;
create policy partner_commissions_select_own on public.partner_commissions
  for select using (
    partner_id in (select id from public.partners where user_id = auth.uid())
  );

drop policy if exists partner_payouts_select_own on public.partner_payouts;
create policy partner_payouts_select_own on public.partner_payouts
  for select using (
    partner_id in (select id from public.partners where user_id = auth.uid())
  );
