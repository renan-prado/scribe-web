-- O PLANO do estudo, guardado ao lado do estudo.
--
-- A partir de `docs/estudo-v2.md`, gerar um estudo deixou de ser uma chamada
-- única e virou um pipeline cuja PRIMEIRA etapa é uma decisão editorial: qual
-- é o tema real, quais 1-3 eixos merecem profundidade, e com qual disciplina
-- cada eixo deve ser tratado.
--
-- Essa decisão precisa ser PERSISTIDA, e não é sentimentalismo de log. Ela é o
-- que torna a qualidade do estudo avaliável: o critério 4 da §7 do documento —
-- "a abordagem escolhida era a melhor disponível?" — é impossível de julgar
-- sem ver a escolha. Antes, ela acontecia dentro de um forward pass e morria
-- ali; a única evidência sobre qualidade era a impressão de quem lia.
--
-- NULL é esperado e permanente para todo estudo gerado antes desta migração.
-- Nenhum backfill é possível: a decisão daqueles estudos nunca existiu como
-- dado.
--
-- Forma (ver `StudyPlan` em lib/domain/study.ts):
--   { theme, primaryPassages[], alreadyCovered[], depth, axes[
--       { title, approach, topics[], rationale, question, passages[] } ] }
--
-- jsonb e não colunas: o formato do plano vai mudar junto com o pipeline, e
-- nenhuma consulta filtra por dentro dele. Quando alguma passar a filtrar (por
-- `depth`, provavelmente, para comparar estudos rasos com densos), o caminho é
-- um índice de expressão — não normalizar.

alter table public.session_deepenings
  add column if not exists plan jsonb;

comment on column public.session_deepenings.plan is
  'Plano editorial (StudyPlan) que originou este estudo. NULL nos estudos anteriores ao pipeline de 5 etapas.';
