-- Conta de Backoffice: a conta interna, que usa o produto sem entrar na conta.
--
-- O PROBLEMA QUE ELA FECHA. Quem escreve o Scriba é também quem mais o usa:
-- grava para ver se o resumo saiu bom, importa um vídeo para conferir o
-- recorte, assina o próprio produto para ver o checkout de pé. Sem um jeito de
-- marcar essas contas, cada uma dessas coisas entra no painel como se fosse
-- mercado. No dia em que esta migração foi escrita, em PRODUÇÃO:
--
--   * 435 das 1.004 chamadas de LLM (43%) eram de duas contas do autor, e
--     portanto 43% do custo que decide se `recordingMinute` continua em 5;
--   * as DUAS únicas assinaturas ativas eram dele, uma delas criada à mão
--     (`stripe_subscription_id` nulo), somando um MRR de R$ 89,80 que nunca
--     foi dinheiro de ninguém;
--   * o funil dizia 2 convertidos de 16 cadastros.
--
-- Nenhum desses números estava ERRADO pelo caminho que o produziu. Eles
-- estavam errados na pergunta: "quanto custa atender um cliente" e "quantos
-- clientes pagam" não admitem o operador dentro da amostra.
--
-- POR QUE UMA COLUNA EM `profiles` E NÃO UM PLANO NOVO. A tentação é
-- acrescentar 'backoffice' a PLAN_KEYS e pronto. Mas `PLAN_ORDER` é uma ESCADA
-- de degraus comprados e `PLANS[plan].priceCents` alimenta o MRR: um degrau
-- novo obriga uns quinze lugares a aprender a ignorá-lo, e cada um que
-- esquecer erra em silêncio. Pior, o plano mora em `subscriptions`, que é o
-- ESPELHO do Stripe — o webhook sobrescreve a linha inteira no dia em que a
-- conta interna assinar de verdade para testar um checkout, que é exatamente
-- o que ela existe para fazer.
--
-- "Moedas infinitas" e "fora da medição" não são um degrau de plano: são duas
-- propriedades da CONTA. Por isso uma coluna em `profiles`, que nenhum webhook
-- reescreve. O plano continua sendo o do Stripe, e quem libera as
-- funcionalidades é `lib/entitlements/` (a coluna entra lá como contexto, do
-- mesmo jeito que `feature_overrides`).
--
-- QUEM PODE ESCREVER. Ninguém, do lado do cliente. A migração 0026 revogou
-- `update` em `profiles` de `anon`/`authenticated` e reconcedeu coluna a
-- coluna (`display_name`, `avatar_url`, `email`); uma coluna nova NASCE fora
-- desse grant, então não há o que revogar aqui — e é justamente por isso que
-- o grant de 0026 não é repetido abaixo: reemiti-lo por hábito é o gesto que
-- um dia inclui a coluna errada na lista. Quem marca a conta é o admin, por
-- `PATCH /api/admin/users/[id]`, com service_role.

alter table public.profiles
  add column if not exists is_internal boolean not null default false;

comment on column public.profiles.is_internal is
  'Conta de Backoffice: gasta sem debitar saldo e fica fora de toda medição de custo, margem e funil. Só o admin marca (service_role).';

-- Índice parcial: a pergunta é sempre "quais são as internas?", nunca "esta é
-- interna?" — quem faz a segunda já tem a linha na mão. São poucas linhas, e o
-- índice existe para que a lista de exclusão do /admin não vire varredura de
-- `profiles` a cada carga de tela.
create index if not exists profiles_internal_idx
  on public.profiles (id) where is_internal;

-- charge_coins: a conta interna REGISTRA e não PAGA -------------------------
--
-- As duas alternativas eram piores. Não gravar nada no ledger deixaria o
-- consumo dos testes sem registro nenhum, e é justamente esse número que
-- responde "quanto me custa por mês testar o meu próprio produto". Creditar um
-- saldo gigante colocaria um crédito falso em `coin_transactions`, que é a
-- fonte da RECEITA MEDIDA (`features/admin/finance/measured.ts`) e do passivo
-- de moedas: dinheiro inventado nas duas telas que existem para não inventar
-- dinheiro.
--
-- Então a linha do ledger é escrita como a de qualquer um, com o motivo e o
-- valor de sempre, e só o decremento do saldo é pulado. O painel exclui essas
-- contas pelo `is_internal`; o ledger continua podendo somá-las quando a
-- pergunta for essa.
--
-- O saldo devolvido é o que está lá, PARADO. Ele não significa mais nada para
-- esta conta — a UI mostra ∞ no lugar do número —, mas a função continua
-- devolvendo um `int`, que é o contrato de quem chama.
--
-- A checagem de saldo pulada é também a de EXISTÊNCIA do perfil: para a conta
-- normal, um `p_user_id` sem linha em `profiles` faz o UPDATE não achar nada e
-- levanta `insufficient_balance`, e isso segue igual. Para a interna a
-- pergunta nem se coloca: só há `is_internal = true` onde há linha.

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
  v_internal    boolean;
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
  -- custo por sessão que /admin/costs soma. Sessão que não é do pagador (ou o
  -- uuid-zero que o cliente manda quando ainda não há sessão) vira null.
  select s.id into v_session_id
    from public.sessions s
   where s.id = p_session_id
     and s.user_id = p_user_id;

  select p.is_internal into v_internal
    from public.profiles p
   where p.id = p_user_id;

  if coalesce(v_internal, false) then
    select p.coin_balance into v_new_balance
      from public.profiles p
     where p.id = p_user_id;
  else
    update public.profiles
       set coin_balance = coin_balance - p_amount
     where id = p_user_id
       and coin_balance >= p_amount
     returning coin_balance into v_new_balance;

    if v_new_balance is null then
      raise exception 'insufficient_balance';
    end if;
  end if;

  insert into public.coin_transactions (user_id, amount, reason, session_id)
  values (p_user_id, -p_amount, p_reason, v_session_id);

  return v_new_balance;
end;
$$;

-- Os grants de 0037 valem para esta versão (o `create or replace` preserva os
-- privilégios da função), mas são reafirmados: uma função que debita saldo é o
-- último lugar onde vale confiar na memória de quem lê.
revoke all on function public.charge_coins(uuid, int, text, uuid) from public;
revoke all on function public.charge_coins(uuid, int, text, uuid) from anon, authenticated;
grant execute on function public.charge_coins(uuid, int, text, uuid) to service_role;
