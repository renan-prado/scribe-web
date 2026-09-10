-- Pré-parceiro: quem chega por /parceiros, cria conta SEM COMPROMISSO e ganha
-- moedas para conhecer o produto antes de decidir se quer divulgá-lo.
--
-- POR QUE UMA TABELA NOVA, E NÃO UM STATUS EM `partners`.
-- Uma linha em `partners` tem slug (que é o link público), taxa de comissão,
-- chave PIX e orçamento de bônus, ou seja, ela EXISTE para pagar alguém. Um
-- pré-parceiro não tem nada disso: ele é um candidato que ainda não foi
-- avaliado, e emitir um slug para cada visitante que clicou num botão encheria
-- o espaço de links públicos (que é único) de gente que nunca vai divulgar.
-- Promover é o passo que cria a linha de `partners`, e ele continua sendo
-- manual, no admin.
--
-- POR QUE `user_id` É A CHAVE PRIMÁRIA.
-- Mesma filosofia de `partner_commissions.referred_user_id UNIQUE`: "uma vez
-- por pessoa na vida" é uma CONSTRAINT, não um `if` no servidor. Quem já foi
-- pré-parceiro não vira pré-parceiro de novo, nem apagando cookie, nem em duas
-- abas simultâneas, nem num caminho de código que ainda não existe.
--
-- O TETO É GLOBAL, e é o ponto mais importante deste arquivo.
-- `/parceiros` é uma página PÚBLICA: qualquer pessoa com uma conta Google nova
-- pode passar por ela e pedir as moedas. Diferente do bônus de indicação, que
-- só existe se um parceiro real divulgou um link e tem `bonus_budget_coins`
-- para segurá-lo, aqui não há ninguém do outro lado limitando nada. Sem um
-- teto, isto é uma torneira aberta: cada conta nova vale moedas de graça, e o
-- único custo do atacante é criar contas Google.
--
-- O teto vive em `lib/partners/economics.ts` e chega aqui como PARÂMETRO, não
-- como número gravado na migração, é decisão de produto que muda sem deploy de
-- schema. A função é service_role-only, então o valor sempre vem do nosso
-- servidor. Estourado o teto, a pessoa AINDA vira pré-parceiro (queremos saber
-- quem se interessou); só não recebe as moedas.

create table if not exists public.partner_prospects (
  -- Uma linha por pessoa, para sempre. Ver o cabeçalho.
  user_id       uuid primary key references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  -- De onde veio o interesse. Hoje só a landing; fica como texto para o dia em
  -- que houver um segundo caminho (um convite direto por e-mail, por exemplo).
  source        text not null default 'landing',
  -- Quanto foi efetivamente creditado. 0 quando o teto global já estava cheio.
  -- É a coluna que o teto SOMA, e por isso ela é o registro de controle, o
  -- livro-razão continua sendo `coin_transactions`.
  coins_granted int not null default 0 check (coins_granted >= 0),
  status        text not null default 'new'
    check (status in ('new', 'promoted', 'declined')),
  -- Preenchidos quando o admin promove a pessoa a parceiro de verdade.
  partner_id    uuid references public.partners(id) on delete set null,
  promoted_at   timestamptz
);

comment on table public.partner_prospects is
  'Candidatos a parceiro que criaram conta por /parceiros. Sem slug, sem comissão, sem PIX, ver 0050.';
comment on column public.partner_prospects.coins_granted is
  'Moedas de cortesia efetivamente creditadas. 0 = teto global estourado. Controle, não ledger.';

create index if not exists partner_prospects_status_idx
  on public.partner_prospects (status, created_at desc);

-- attach_partner_prospect() ---------------------------------------------------
-- Irmã de `attach_partner()`, e escrita no mesmo molde: valida, grava e credita
-- na MESMA transação, devolvendo um código em vez de lançar exceção, porque
-- quase todo "não" aqui é normal e não pode derrubar o login de ninguém.
--
--   ok | already_prospect | not_new | already_partner | already_attributed | capped
--
-- A JANELA DE CONTA NOVA (30 min) é a mesma de `attach_partner`, e pelo mesmo
-- motivo: sem ela, um usuário de um ano atrás que abrisse /parceiros ganharia
-- as moedas no login seguinte, e de novo a cada vez que limpasse o cookie.
--
-- `already_attributed` recusa quem JÁ ganhou bônus por ter entrado pelo link de
-- um parceiro ou de um amigo. Não é mesquinhez: são dois brindes de boas-vindas
-- para a mesma conta nova, e empilhá-los transforma "conheça o produto" em
-- "junte cupons". Quem indicou continua com a comissão intacta, o que esta
-- linha recusa é o SEGUNDO bônus, não a atribuição.

create or replace function public.attach_partner_prospect(
  p_user_id      uuid,
  p_coins        int,
  p_budget_coins int
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_at  timestamptz;
  v_partner_id  uuid;
  v_referrer_id uuid;
  v_spent       int;
  v_coins       int;
begin
  if p_user_id is null then
    return 'not_new';
  end if;

  -- Trava a linha do perfil antes de decidir: duas abas terminando o login no
  -- mesmo instante serializam aqui, e a segunda enxerga o que a primeira fez.
  select created_at, partner_id, referred_by_user_id
    into v_created_at, v_partner_id, v_referrer_id
    from public.profiles
   where id = p_user_id
     for update;

  if v_created_at is null then
    return 'not_new';  -- perfil ainda não existe
  end if;
  if v_created_at < now() - interval '30 minutes' then
    return 'not_new';
  end if;
  if v_partner_id is not null or v_referrer_id is not null then
    return 'already_attributed';
  end if;
  if exists (select 1 from public.partners where user_id = p_user_id) then
    return 'already_partner';
  end if;
  if exists (select 1 from public.partner_prospects where user_id = p_user_id) then
    return 'already_prospect';
  end if;

  -- O teto global. `for update` na soma não existe em SQL, então a serialização
  -- vem da trava do perfil acima somada ao PRIMARY KEY da tabela: dois cadastros
  -- diferentes podem ler a mesma soma e furar o teto em uma linha, no pior caso.
  -- É aceitável, o teto existe para conter ordem de grandeza, não centavos.
  select coalesce(sum(coins_granted), 0) into v_spent from public.partner_prospects;

  v_coins := greatest(coalesce(p_coins, 0), 0);
  if p_budget_coins is not null and v_spent + v_coins > p_budget_coins then
    v_coins := 0;
  end if;

  insert into public.partner_prospects (user_id, coins_granted)
  values (p_user_id, v_coins);

  if v_coins > 0 then
    -- Pela porta única de crédito, como todo o resto do dinheiro. O
    -- external_ref por usuário torna isto idempotente mesmo que este caminho
    -- seja percorrido duas vezes.
    perform public.grant_coins(
      p_user_id,
      v_coins,
      'partner_prospect_bonus',
      'partner-prospect:' || p_user_id::text
    );
    return 'ok';
  end if;

  return 'capped';
end;
$$;

-- Permissões ------------------------------------------------------------------
-- Funções nascem com EXECUTE para PUBLIC; revogar é o passo que importa. Mesmo
-- tratamento de `grant_coins` e `attach_partner`: só o service_role chama, e ele
-- vive exclusivamente no servidor. Sem isto, qualquer visitante com o anon key
-- chamaria a função e emitiria moedas para si mesmo.

revoke all on function public.attach_partner_prospect(uuid, int, int) from public;
revoke all on function public.attach_partner_prospect(uuid, int, int) from anon, authenticated;
grant execute on function public.attach_partner_prospect(uuid, int, int) to service_role;

-- RLS -------------------------------------------------------------------------
-- Ninguém lê esta tabela pelo anon key. Ela é lista de candidatos: quem está
-- nela, quando entrou e quanto custou. Só o admin (service_role, que ignora RLS)
-- enxerga. Habilitar RLS sem nenhuma policy é a forma mais forte de dizer isso.

alter table public.partner_prospects enable row level security;
