-- O presente de boas-vindas de quem entrou pelo teste fechado (ver 0078).
--
-- Quem se pré-cadastra em `/tester` recebe um presente de moedas ALÉM das de
-- boas-vindas de toda conta nova. Ele não é creditado aqui e não é creditado
-- no cadastro: ele nasce como uma linha PENDENTE em `coin_gifts` (0077), e
-- vira saldo no instante em que a pessoa toca "Resgatar" no cartão da
-- Biblioteca. A razão é a mesma que criou aquela tabela — cortesia creditada
-- em silêncio é cortesia que ninguém percebe ter recebido, e este presente
-- existe justamente para ser percebido por quem topou testar uma versão
-- instável.
--
-- POR QUE O PRESENTE NÃO NASCE JUNTO COM A LINHA DO PRÉ-CADASTRO. `coin_gifts`
-- referencia `auth.users`, e no momento do formulário não existe conta
-- nenhuma: a pessoa só vai se cadastrar no app depois de o Google liberar o
-- download, que é horas ou dias depois. O elo entre as duas pontas é o
-- E-MAIL, conferido no primeiro login por `applyWelcomeBonuses`.
--
-- AS DUAS COLUNAS SÃO UM TRINCO, e é ele que impede o presente de sair duas
-- vezes. `gifted_at` é marcado por um UPDATE condicional (`where gifted_at is
-- null`) ANTES de o presente ser inserido: duas abas fazendo login ao mesmo
-- tempo disputam aquele UPDATE, e só uma leva a linha. Marcar depois de
-- inserir deixaria a janela aberta exatamente onde ela importa.
--
-- `user_id` é `on delete set null` e não `cascade`: quem apagou a conta não
-- apaga o fato de ter pedido para testar. A linha continua valendo para a
-- lista do console e para a pergunta "quantos testadores chegaram a entrar".

alter table public.tester_signups
  add column if not exists user_id   uuid references auth.users(id) on delete set null,
  add column if not exists gifted_at timestamptz;

comment on column public.tester_signups.gifted_at is
  'Quando o presente de moedas foi emitido em coin_gifts. Trinco de idempotência: ver 0079.';
