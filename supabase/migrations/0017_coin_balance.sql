-- Coin balance ("moedas") — a per-account spendable balance used to gate
-- recording and aprofundar. Initial grant is 100 for every profile; there is
-- no top-up flow yet (this is a mechanism-testing pass).
--
-- Pricing (source of truth mirrored in @/lib/coins/pricing.ts):
--   * live recording:       10 coins per started minute
--   * audio_only recording:  3 coins per started minute
--   * aprofundamento:       10 coins flat, single-shot on POST /api/deepening
--
-- Recording modes tick every 60s from the client. Debits are atomic via
-- charge_coins() below — the balance check + decrement happens inside a
-- single UPDATE with a `coin_balance >= amount` predicate so two concurrent
-- ticks can't drop below zero.
--
-- coin_transactions is an append-only ledger so a future admin/replay tool
-- can reconstruct the balance. `amount` is signed (negative for spends);
-- `reason` is a free-form string but the API only ever writes one of the
-- three known values.

alter table public.profiles
  add column if not exists coin_balance int not null default 100;

create table if not exists public.coin_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      int  not null,
  reason      text not null,
  session_id  uuid references public.sessions(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists coin_transactions_user_id_created_at_idx
  on public.coin_transactions (user_id, created_at desc);

alter table public.coin_transactions enable row level security;

drop policy if exists coin_transactions_select_own on public.coin_transactions;
create policy coin_transactions_select_own on public.coin_transactions
  for select using (user_id = auth.uid());

-- Atomic charge: check balance >= amount and decrement in the same UPDATE.
-- Raises 'insufficient_balance' if no row matched (i.e. balance was too low).
-- SECURITY DEFINER so the ledger insert bypasses the (absent) INSERT policy
-- on coin_transactions — writes only ever happen through this function.
create or replace function public.charge_coins(
  p_amount     int,
  p_reason     text,
  p_session_id uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_new_balance int;
  v_session_id  uuid := case
    when p_session_id is null
      or p_session_id = '00000000-0000-0000-0000-000000000000'::uuid
    then null
    else p_session_id
  end;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  update public.profiles
     set coin_balance = coin_balance - p_amount
   where id = v_uid
     and coin_balance >= p_amount
   returning coin_balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'insufficient_balance';
  end if;

  insert into public.coin_transactions (user_id, amount, reason, session_id)
  values (v_uid, -p_amount, p_reason, v_session_id);

  return v_new_balance;
end;
$$;

grant execute on function public.charge_coins(int, text, uuid) to authenticated;
