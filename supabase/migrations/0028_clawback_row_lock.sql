-- Torna o clawback atômico frente a gasto concorrente.
--
-- A versão de 0027 lia o saldo (SELECT), calculava a dedução e então fazia o
-- UPDATE. Entre o SELECT e o UPDATE, um `charge_coins` concorrente (um tick de
-- gravação, por exemplo) podia baixar o saldo — e o lançamento no ledger
-- registrava uma dedução maior do que a efetivamente aplicada, descolando o
-- ledger do saldo real.
--
-- O conserto é uma cláusula: `FOR UPDATE` no SELECT trava a linha do perfil
-- até o fim da transação da função, serializando este fluxo contra qualquer
-- charge/grant concorrente (que também abrem com UPDATE na mesma linha).
-- Janela pequena e evento raro (chargeback), mas um livro-razão que pode
-- divergir do saldo deixa de ser um livro-razão.

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

  -- Trava a linha primeiro: tudo o que for lido/deduzido daqui em diante é
  -- consistente com o saldo que o UPDATE final vai encontrar.
  select coin_balance into v_balance
    from public.profiles
   where id = p_user_id
     for update;

  if v_balance is null then
    raise exception 'profile_not_found';
  end if;

  select coalesce(sum(amount), 0) into v_granted
    from public.coin_transactions
   where user_id = p_user_id
     and amount > 0
     and external_ref is not null
     and starts_with(external_ref, p_ref_prefix);

  if v_granted <= 0 then
    return v_balance;
  end if;

  -- Nunca abaixo de zero: o saldo não é uma dívida.
  v_deduct := least(v_granted, greatest(v_balance, 0));

  insert into public.coin_transactions (user_id, amount, reason, external_ref)
  values (p_user_id, -greatest(v_deduct, 0), p_reason, 'clawback:' || p_ref_prefix)
  on conflict (external_ref) do nothing;

  if not found then
    return v_balance; -- já estornado por uma entrega anterior
  end if;

  if v_deduct > 0 then
    update public.profiles
       set coin_balance = coin_balance - v_deduct
     where id = p_user_id
     returning coin_balance into v_balance;
  end if;

  return v_balance;
end;
$$;

revoke all on function public.clawback_coins(uuid, text, text) from public;
revoke all on function public.clawback_coins(uuid, text, text) from anon, authenticated;
grant execute on function public.clawback_coins(uuid, text, text) to service_role;
