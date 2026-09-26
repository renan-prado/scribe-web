-- Presente de moedas pendente de resgate: o admin escolhe valor, título e
-- mensagem, e a pessoa vê um cartão na Biblioteca com um botão "Resgatar X
-- moedas" antes de qualquer moeda entrar na conta. Substitui o crédito
-- instantâneo que /admin/users fazia até aqui (ver 0017, `grant_coins`): dar
-- cortesia direto na conta era invisível para quem recebia, e o próprio ato de
-- dar perdia a chance de ser notado — ninguém repara em +200 moedas silenciosas
-- no meio de um saldo que já muda toda hora.
--
-- ESTA TABELA NÃO CREDITA NADA. `amount` é a promessa; o crédito de verdade só
-- acontece dentro de `redeem_coin_gift`, pela porta única (`grant_coins`), no
-- instante em que a PESSOA toca o botão.

create table if not exists public.coin_gifts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      int  not null check (amount > 0 and amount <= 50000),
  title       text not null check (char_length(title) between 1 and 120),
  message     text not null check (char_length(message) between 1 and 1000),
  status      text not null default 'pending' check (status in ('pending', 'redeemed')),
  granted_by  uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.coin_gifts is
  'Presentes de moedas emitidos pelo admin, pendentes até a pessoa resgatar. Ver 0077.';

create index if not exists coin_gifts_user_id_status_idx
  on public.coin_gifts (user_id, status, created_at desc);

alter table public.coin_gifts enable row level security;

-- Só leitura do PRÓPRIO presente. Escrita (emitir, resgatar) é sempre
-- service-role: emitir é ato do admin, e resgatar precisa da trava `for
-- update` que só a RPC abaixo faz. Mesma régua de `coin_transactions` (0017).
drop policy if exists coin_gifts_select_own on public.coin_gifts;
create policy coin_gifts_select_own on public.coin_gifts
  for select using (user_id = auth.uid());

-- redeem_coin_gift() ----------------------------------------------------------
-- Trava a linha do presente, confere dono e estado, credita pela porta única
-- e marca resgatado, tudo na mesma transação. Devolve um código em vez de
-- lançar: quase todo "não" aqui é rotina (duplo clique, aba duplicada).
--
--   ok | not_found | already_redeemed
--
-- Chamada SEMPRE por uma rota que já confirmou `requireAuth()`, com
-- service-role — `p_user_id` vem da SESSÃO do chamador, nunca do corpo. Mesmo
-- tratamento de `redeem_signup_coupon` (0055): EXECUTE fica só com
-- service_role, nunca com authenticated, e a transação roda atrás do gate da
-- rota, não do RPC.
create or replace function public.redeem_coin_gift(
  p_user_id uuid,
  p_gift_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gift public.coin_gifts%rowtype;
begin
  select * into v_gift
    from public.coin_gifts
   where id = p_gift_id
     and user_id = p_user_id
   for update;

  if v_gift.id is null then
    return 'not_found';
  end if;
  if v_gift.status <> 'pending' then
    return 'already_redeemed';
  end if;

  update public.coin_gifts
     set status = 'redeemed',
         redeemed_at = now()
   where id = p_gift_id;

  perform public.grant_coins(
    p_user_id,
    v_gift.amount,
    'admin_grant',
    'gift:' || p_gift_id::text
  );

  return 'ok';
end;
$$;

revoke all on function public.redeem_coin_gift(uuid, uuid) from public;
revoke all on function public.redeem_coin_gift(uuid, uuid) from anon, authenticated;
grant execute on function public.redeem_coin_gift(uuid, uuid) to service_role;
