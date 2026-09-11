-- Exclusão de conta pelo próprio usuário (/profile/delete): o que MORRE com a
-- pessoa e o que SOBREVIVE anonimizado.
--
-- O caminho de exclusão já existia em código (`auth.admin.deleteUser`, usado
-- pelo /admin/users) e todo o conteúdo do usuário pendura nele por cascade:
-- sessões, transcrições, resumos, estudos, cards do feed, marcações,
-- lembretes, feedbacks, tours, cupom de convite. Isso está certo e não muda:
-- é dado PESSOAL, e é exatamente o que a LGPD e a regra 5.1.1(v) da Apple
-- mandam apagar.
--
-- Duas tabelas, porém, não são dado pessoal: são a CONTABILIDADE.
--
--   * `coin_transactions` é o extrato de dinheiro entrando. `lib/finance/`
--     calcula receita a partir dos créditos `subscription_grant` e
--     `topup_pack` (ver `lib/finance/measured.ts`), e o /admin/financeiro lê
--     dali. Com o cascade, cancelar a conta apagava a RECEITA que ela já
--     tinha gerado: o faturamento do mês passado encolhia sozinho, sem erro
--     nenhum na tela, que é o pior jeito de uma medição falhar.
--   * `llm_usage_events` é o custo de cada chamada de LLM, e o eixo da tabela
--     "Por versão" do /admin/usage (migração 0044). Mesmo problema: o custo
--     histórico de um deploy mudaria conforme gente vai saindo, e a pergunta
--     "depois daquela mudança ficou pior?" deixaria de ter resposta estável.
--
-- Então as duas passam a `on delete set null`: a LINHA fica, o VÍNCULO com a
-- pessoa some. É o que `docs/app-store-ios.md` (Portão 4) já previa, e é mais
-- protetivo que o cascade, não menos: um número agregado sem dono não é dado
-- pessoal.
--
-- Isso NÃO contradiz a 0046, que mandou `referral_rewards` para cascade. A
-- diferença é o que a linha significa: uma recompensa de indicação é "fulano
-- ganhou X por ter trazido sicrano", uma frase sobre pessoas, que sem o fulano
-- não diz nada. Um lançamento de R$ 29,90 e um custo de US$ 0,004 continuam
-- sendo verdade sobre o CAIXA depois que o pagador vai embora.
--
-- Efeito colateral em RLS: as duas tabelas têm policy de select por
-- `user_id = auth.uid()`, e `null = <uuid>` é NULL, nunca true. Linha órfã,
-- portanto, fica invisível para todo cliente autenticado e só o service-role
-- (o /admin) a enxerga. É o comportamento desejado e não precisou de policy
-- nova.
--
-- Do lado do TypeScript, quem agrega por usuário precisa pular o nulo:
-- `lib/db/admin/usage.ts` (as tabelas "Por usuário" e o ranking de moedas)
-- ignora essas linhas, que entram só nos totais, nas rotas, nos dias e nas
-- versões. É a leitura correta: o custo aconteceu, a conta não existe mais.

alter table public.llm_usage_events
  alter column user_id drop not null;

alter table public.llm_usage_events
  drop constraint if exists llm_usage_events_user_id_fkey;

alter table public.llm_usage_events
  add constraint llm_usage_events_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.coin_transactions
  alter column user_id drop not null;

alter table public.coin_transactions
  drop constraint if exists coin_transactions_user_id_fkey;

alter table public.coin_transactions
  add constraint coin_transactions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
