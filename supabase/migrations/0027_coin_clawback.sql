-- Estorno de créditos após refund ou chargeback.
--
-- POR QUE ISTO EXISTE: num sistema de créditos, a fraude mais provável não é
-- forjar um webhook (isso a assinatura HMAC já barra) — é a legítima:
-- comprar R$ 10 de créditos, gastar tudo em transcrição (que nos custa
-- dinheiro de verdade em API), e então abrir um chargeback no cartão. Sem
-- estorno automático, o prejuízo é 100% nosso e passa despercebido.
--
-- clawback_coins() reverte o crédito de uma origem específica (uma fatura ou
-- uma sessão de checkout), identificada pelo PREFIXO do external_ref usado no
-- crédito original:
--   'invoice:in_xxx:'   → linhas de uma fatura de assinatura
--   'checkout:cs_xxx:'  → itens de uma compra avulsa
--
-- Regras:
--   * Nunca deixa o saldo negativo. Se o usuário já gastou, deduzimos o que
--     ainda houver e registramos a diferença no log — a perda existe, mas fica
--     visível em vez de silenciosa.
--   * Idempotente: o lançamento de estorno usa external_ref
--     'clawback:<prefixo>', que é UNIQUE. Reentrega do evento não deduz de novo.
--   * starts_with() em vez de LIKE: ids do Stripe contêm '_', que em LIKE é
--     curinga de um caractere. starts_with compara literalmente.

create or replace function public.clawback_coins(
  p_user_id    uuid,
  p_ref_prefix text,
  p_reason     text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_granted  int;
  v_balance  int;
  v_deduct   int;
begin
  if p_user_id is null or p_ref_prefix is null or length(p_ref_prefix) < 8 then
    raise exception 'invalid_clawback_args';
  end if;

  select coalesce(sum(amount), 0) into v_granted
    from public.coin_transactions
   where user_id = p_user_id
     and amount > 0
     and external_ref is not null
     and starts_with(external_ref, p_ref_prefix);

  if v_granted <= 0 then
    select coin_balance into v_balance from public.profiles where id = p_user_id;
    return coalesce(v_balance, 0);
  end if;

  select coin_balance into v_balance from public.profiles where id = p_user_id;
  if v_balance is null then
    raise exception 'profile_not_found';
  end if;

  -- Nunca abaixo de zero: o saldo não é uma dívida.
  v_deduct := least(v_granted, greatest(v_balance, 0));

  -- Trava de idempotência: um lançamento por origem estornada. Registrado
  -- mesmo quando v_deduct = 0, para que a reentrega não tente de novo e para
  -- que o estorno fique no histórico.
  insert into public.coin_transactions (user_id, amount, reason, external_ref)
  values (p_user_id, -greatest(v_deduct, 0), p_reason, 'clawback:' || p_ref_prefix)
  on conflict (external_ref) do nothing;

  if not found then
    return v_balance; -- já estornado
  end if;

  if v_deduct > 0 then
    update public.profiles
       set coin_balance = greatest(coin_balance - v_deduct, 0)
     where id = p_user_id
     returning coin_balance into v_balance;
  end if;

  return v_balance;
end;
$$;

revoke all on function public.clawback_coins(uuid, text, text) from public;
revoke all on function public.clawback_coins(uuid, text, text) from anon, authenticated;
grant execute on function public.clawback_coins(uuid, text, text) to service_role;

-- O ledger permite amount = 0 (estorno de origem já totalmente gasta). O
-- CHECK abaixo só garante que nada entre sem razão declarada.
alter table public.coin_transactions
  drop constraint if exists coin_transactions_reason_not_blank;
alter table public.coin_transactions
  add constraint coin_transactions_reason_not_blank check (length(trim(reason)) > 0);
