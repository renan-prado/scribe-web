-- Aplica a recompensa nova (20) a quem já estava cadastrado no padrão antigo.
--
-- A 0052 mudou só o DEFAULT da coluna, de propósito: `signup_reward_coins` é
-- negociado por parceiro, e mexer nela retroativamente altera um combinado de
-- quem já está divulgando. Aquela cautela foi levada ao usuário e a decisão
-- veio: o valor novo vale para todos, e o painel de quem já existe tinha de
-- parar de anunciar 50.
--
-- SÓ QUEM ESTAVA EM 50, e não `set = 20` em todo mundo. 50 era o padrão: quem
-- está nele nunca negociou nada, herdou o número. Um parceiro em 100 ou em 0
-- tem um acordo ESCRITO à mão no admin, e sobrescrevê-lo aqui apagaria a única
-- coisa que a coluna existe para guardar. Se um dia o padrão mudar de novo, é
-- o `where` desta migração que muda junto, nunca a ausência dele.
--
-- Idempotente na prática: rodar de novo não acha mais nenhuma linha em 50, a
-- não ser que alguém volte um parceiro para o valor antigo à mão, o que seria
-- uma decisão deliberada e não deve ser desfeita por migração.
--
-- Não mexe em recompensa JÁ CREDITADA. `referral_rewards` guarda o valor em
-- moedas de cada crédito no momento em que ele aconteceu, e é assim que tem de
-- ser: o extrato do parceiro conta o que ele recebeu, não o que receberia pela
-- regra de hoje.

update public.partners
  set signup_reward_coins = 20
  where signup_reward_coins = 50;
