-- Separa o token de RACIOCÍNIO do token escrito, dentro de completion_tokens.
--
-- A OpenAI devolve `usage.completion_tokens_details.reasoning_tokens` na
-- família de raciocínio (gpt-5*, o*), e ele já está DENTRO de
-- `completion_tokens` — não é uma parcela a somar. Por isso esta coluna não
-- muda nenhum custo: `input_cost_usd`, `output_cost_usd` e `total_cost_usd`
-- continuam certos, e nada precisa ser recalculado como em 0035.
--
-- Ela existe por uma pergunta que a tabela não respondia. O token de saída é
-- 85% do custo do estudo (medido: $0,193 de $0,227 por estudo gerado), e uma
-- etapa que aparece como "8,6 mil tokens de saída" pode estar escrevendo cinco
-- mil e pensando três mil — ao mesmo preço. `study-answers` é hoje a única
-- etapa do pipeline sem `reasoningEffort` explícito, rodando no padrão da API,
-- e sem esta coluna não há como saber se há raciocínio sobrando para cortar
-- ali nem se um corte pegou.
--
-- Nula nas linhas antigas e em todo modelo que não raciocina. Nulo aqui é
-- "não sabemos" (a chamada é anterior a esta migração) ou "não se aplica" —
-- nunca zero medido.

alter table public.llm_usage_events
  add column if not exists reasoning_tokens integer;

comment on column public.llm_usage_events.reasoning_tokens is
  'Subconjunto de completion_tokens (não somar). Só a família de raciocínio preenche; null = não medido ou não se aplica.';
