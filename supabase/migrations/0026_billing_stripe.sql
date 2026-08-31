-- Stripe billing: assinaturas, pacotes avulsos e a superfície de crédito de
-- moedas. Contraparte do débito já existente em 0017_coin_balance.sql.
--
-- MODELO (decidido com o usuário):
--   * Saldo ÚNICO em profiles.coin_balance. Créditos ACUMULAM (rollover):
--     toda fatura paga soma a franquia do plano ao saldo, sem reset e sem teto.
--   * Cancelar/falhar pagamento NÃO zera nada — o usuário gasta o que tem,
--     só para de receber a recarga mensal.
--   * Plano gratuito = os 50 créditos de boas-vindas do cadastro. Não é uma
--     assinatura no Stripe; é só a ausência de uma.
--
-- SUPERFÍCIE DE ATAQUE — o que este arquivo fecha:
--   1. Crédito forjado pelo cliente. `grant_coins()` é SECURITY DEFINER com
--      EXECUTE revogado de public/anon/authenticated: só o service_role (que
--      vive exclusivamente no servidor, atrás da verificação de assinatura do
--      webhook) consegue chamar.
--   2. Replay de webhook. `stripe_events` tem o id do evento como PK — a
--      segunda entrega do mesmo evento colide e é descartada. Em segunda
--      camada, `coin_transactions.external_ref` é UNIQUE, então mesmo dois
--      eventos distintos que apontem para a mesma fatura creditam uma vez só.
--   3. **Auto-crédito via PostgREST.** Esta era uma porta REALMENTE aberta:
--      a policy `profiles_update_own` (0005/0007) permite UPDATE na própria
--      linha, e o WITH CHECK de 0007 só trava `role` e `is_active`. Com o
--      anon key e um JWT válido, qualquer usuário podia rodar
--      `update profiles set coin_balance = 999999 where id = auth.uid()`.
--      Corrigido abaixo com GRANT em nível de coluna: `authenticated` só pode
--      escrever display_name/avatar_url/email. coin_balance,
--      stripe_customer_id, role e is_active ficam fora do alcance do cliente,
--      independentemente da policy.

-- 1) Boas-vindas: 50 moedas (era 100) -------------------------------------
-- Só muda o DEFAULT: contas existentes mantêm o saldo que têm.

alter table public.profiles
  alter column coin_balance set default 50;

-- 2) Vínculo com o customer do Stripe --------------------------------------

alter table public.profiles
  add column if not exists stripe_customer_id text;

create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- 3) Column-level grants em profiles ---------------------------------------
-- RLS não sabe restringir colunas; privilégio de coluna sabe. As duas coisas
-- somadas: a policy diz QUAIS LINHAS, o grant diz QUAIS COLUNAS.

revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, email) on public.profiles to authenticated;

-- 4) Assinaturas ------------------------------------------------------------
-- Espelho local do estado do Stripe, mantido pelo webhook. A aplicação nunca
-- decide sozinha que alguém é assinante: ela lê esta tabela, que só é escrita
-- por service_role a partir de um evento assinado.

create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text not null,
  stripe_subscription_id text unique,
  -- Chave do plano no catálogo do servidor (lib/billing/plans.ts):
  -- 'free' | 'pessoal' | 'estudioso'.
  plan                   text not null default 'free',
  -- Status cru do Stripe: active | trialing | past_due | canceled |
  -- incomplete | incomplete_expired | unpaid | paused.
  status                 text not null default 'inactive',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

-- Leitura da própria assinatura. SEM policy de insert/update/delete: o
-- webhook escreve com service_role, que ignora RLS.
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select using (user_id = auth.uid());

-- 5) Log de eventos do Stripe (idempotência) --------------------------------
-- RLS ligada e ZERO policies = invisível para anon/authenticated. Só o
-- service_role enxerga.

create table if not exists public.stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now()
);

alter table public.stripe_events enable row level security;

-- 6) Ledger: referência externa para idempotência ---------------------------
-- external_ref carrega a origem canônica do crédito no Stripe
-- (ex.: 'in_1A2B3C:si_xxx' para uma linha de fatura, 'cs_test_xxx' para um
-- pacote avulso). UNIQUE simples — no Postgres NULL nunca colide com NULL,
-- então os débitos existentes (que não têm ref) continuam livres.

alter table public.coin_transactions
  add column if not exists external_ref text;

create unique index if not exists coin_transactions_external_ref_key
  on public.coin_transactions (external_ref);

-- 7) grant_coins(): o único caminho de crédito ------------------------------
-- Insere o lançamento no ledger ANTES de mexer no saldo. Se o external_ref já
-- existir, o insert não acontece, a função sai cedo e devolve o saldo atual —
-- o crédito nunca é aplicado duas vezes, mesmo com duas entregas simultâneas
-- do mesmo webhook (o índice UNIQUE serializa a corrida).

create or replace function public.grant_coins(
  p_user_id      uuid,
  p_amount       int,
  p_reason       text,
  p_external_ref text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  if p_user_id is null then
    raise exception 'invalid_user';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then
    raise exception 'invalid_amount';
  end if;

  insert into public.coin_transactions (user_id, amount, reason, external_ref)
  values (p_user_id, p_amount, p_reason, p_external_ref)
  on conflict (external_ref) do nothing;

  if not found then
    -- Já creditado por uma entrega anterior deste mesmo evento.
    select coin_balance into v_balance from public.profiles where id = p_user_id;
    return coalesce(v_balance, 0);
  end if;

  update public.profiles
     set coin_balance = coin_balance + p_amount
   where id = p_user_id
   returning coin_balance into v_balance;

  if v_balance is null then
    raise exception 'profile_not_found';
  end if;

  return v_balance;
end;
$$;

-- Funções nascem com EXECUTE para PUBLIC. Revogar é o passo que importa.
revoke all on function public.grant_coins(uuid, int, text, text) from public;
revoke all on function public.grant_coins(uuid, int, text, text) from anon, authenticated;
grant execute on function public.grant_coins(uuid, int, text, text) to service_role;
