-- A leitura da IA do painel deixou de ser TRÊS e passou a ser UMA.
--
-- A migração 0034 criou `admin_insights` com uma linha por TELA de dinheiro
-- ('pricing', 'usage', 'metrics'): cada uma tinha o seu card lateral, e cada
-- card disparava a geração sozinho quando a linha passava de 24 horas. Duas
-- coisas não sobreviveram ao uso:
--
--   * as três leituras diziam quase a mesma coisa, porque saem dos MESMOS
--     eventos, recortados diferente. E nenhuma delas podia concluir sobre o
--     negócio, porque cada uma via um terço dele: uma rota cara é a margem de
--     uma ação, que é o preço de um plano, que é o passivo de moedas;
--   * ninguém as pedia. A chamada de LLM mais cara do produto rodava porque
--     alguém abriu /admin/metricas para conferir o MRR.
--
-- Hoje existe uma leitura geral, em /admin/insights, gerada só no clique, e a
-- linha dela tem `scope = 'general'` (ver `lib/admin/insights/store.ts`).
--
-- ESTE ARQUIVO SÓ APAGA DADO. Não há mudança de schema: `scope` continua sendo
-- a PK e continua sem CHECK, pela mesma razão de sempre (as chaves moram no
-- código, não no banco). As três linhas antigas ficariam invisíveis de todo
-- jeito, já que nenhum caminho de leitura as procura mais, e é exatamente por
-- isso que elas saem: payload de análise financeira guardado numa tabela que
-- ninguém lê é o tipo de coisa que reaparece daqui a um ano como se fosse
-- atual. O que se compara entre períodos são os NÚMEROS, e esses continuam em
-- `llm_usage_events` e `coin_transactions`.

delete from public.admin_insights where scope in ('pricing', 'usage', 'metrics');

comment on column public.admin_insights.scope is
  'Chave da linha. Hoje só "general": uma leitura geral do painel. Ver 0054.';
