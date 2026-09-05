-- charge_coins() sai do alcance do cliente.
--
-- O BURACO. A versão de 0017 tinha `grant execute ... to authenticated` e
-- recebia `p_amount` de quem chama. A rota /api/coins/charge é cuidadosa — ela
-- deriva o preço de COIN_COST_BY_REASON e nunca aceita um valor do corpo —
-- mas a rota nunca foi o único caminho até a função: o anon key é público, e
-- uma função com EXECUTE para `authenticated` está exposta em
-- POST /rest/v1/rpc/charge_coins. Qualquer sessão logada podia fazer
--
--   supabase.rpc('charge_coins', { p_amount: 1, p_reason: 'live_minute', ... })
--
-- e gravar no ledger um minuto de gravação `live` (7 moedas) pagando 1. Não
-- dava para creditar — `p_amount <= 0` sempre levantou exceção — então o
-- estrago era subfaturamento, e subfaturamento que deixa no banco uma linha
-- com cara de legítima.
--
-- A CORREÇÃO é a mesma regra que `grant_coins`, `clawback_coins` e
-- `attach_partner` já seguiam, e que supabase/AGENTS.md manda seguir: função
-- que escreve saldo tem EXECUTE revogado de anon/authenticated e só o
-- service_role chama. Quem passa a afirmar quem está pagando é o servidor,
-- depois de `requireAuth()` — por isso a assinatura ganha `p_user_id` e perde
-- o `auth.uid()`, que é sempre null sob service_role.
--
-- O preço continua morando em lib/coins/pricing.ts, e é essa a razão de não
-- termos resolvido isto movendo a tabela de preços para dentro do SQL: com a
-- função inalcançável, o mapa reason→preço só precisa existir uma vez, do lado
-- que já o tinha.
--
-- ORDEM DE IMPLANTAÇÃO. Esta migração DERRUBA a função de 3 argumentos, então
-- o código que a chamava para de funcionar no instante em que ela roda. Rode a
-- migração e publique o deploy juntos: entre os dois, /api/coins/charge
-- responde 500 e uma gravação em curso mostra erro de cobrança. Nada é perdido
-- (o ledger é append-only e o débito simplesmente não acontece), mas a janela
-- existe.

-- 1) A nova função ----------------------------------------------------------

create or replace function public.charge_coins(
  p_user_id    uuid,
  p_amount     int,
  p_reason     text,
  p_session_id uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance int;
  v_session_id  uuid;
begin
  if p_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- O id de sessão só ETIQUETA a linha do ledger; ele nunca autorizou nada.
  -- Ainda assim é conferido: sob service_role não há RLS para escopá-lo, e uma
  -- sessão de outra pessoa etiquetando meu débito envenena silenciosamente o
  -- custo por sessão que /admin/usage soma. Sessão que não é do pagador (ou o
  -- uuid-zero que o cliente manda quando ainda não há sessão) vira null.
  select s.id into v_session_id
    from public.sessions s
   where s.id = p_session_id
     and s.user_id = p_user_id;

  update public.profiles
     set coin_balance = coin_balance - p_amount
   where id = p_user_id
     and coin_balance >= p_amount
   returning coin_balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'insufficient_balance';
  end if;

  insert into public.coin_transactions (user_id, amount, reason, session_id)
  values (p_user_id, -p_amount, p_reason, v_session_id);

  return v_new_balance;
end;
$$;

revoke all on function public.charge_coins(uuid, int, text, uuid) from public;
revoke all on function public.charge_coins(uuid, int, text, uuid) from anon, authenticated;
grant execute on function public.charge_coins(uuid, int, text, uuid) to service_role;

-- 2) A versão antiga some ---------------------------------------------------
--
-- `drop` e não só `revoke`: uma função de débito alcançável por `authenticated`
-- é o tipo de coisa que volta a ser concedida por engano num `grant` futuro
-- escrito de memória. Sem a função, não há o que conceder.

revoke all on function public.charge_coins(int, text, uuid) from public;
revoke all on function public.charge_coins(int, text, uuid) from anon, authenticated;
drop function if exists public.charge_coins(int, text, uuid);
