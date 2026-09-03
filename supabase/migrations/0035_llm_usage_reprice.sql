-- Recalcula o custo GRAVADO das chamadas cujo preço interno estava errado.
--
-- `llm_usage_events` guarda o custo resolvido no momento da chamada, de
-- propósito: preço muda, e o histórico tem de refletir o que gastamos. A
-- exceção é quando o número nunca refletiu gasto nenhum — foi o caso aqui.
--
-- Três defeitos em `lib/llm/pricing.ts`, todos corrigidos no mesmo commit:
--
--   1. `gpt-5.1` NÃO ESTAVA na tabela. É o padrão das três etapas do estudo
--      (study-questions/answers/write) e do analista de /api/admin/insights
--      desde que essas rotas existem. `computeChatCost` devolve zero para
--      modelo desconhecido, então essas chamadas gravaram custo R$ 0,00 e
--      toda margem calculada sobre elas saiu inflada.
--   2. `gpt-5` (5/15) e `gpt-5-mini` (0,5/2) estavam com preços que a OpenAI
--      não cobra. O correto é 1,25/10 e 0,25/2. O `gpt-5-mini` roda o guardião
--      do estudo (study-guard), então o custo do estudo estava SUPERestimado
--      aqui — erro no sentido oposto ao de cima, na mesma tela.
--   3. O token de entrada em cache era cobrado a 50% do fresco para todo
--      modelo. Só o 4o cobra isso: a família 4.1 cobra 25% e a família 5
--      cobra 10%. Afeta as rotas de prompt grande e estável, que são as do
--      feed ao vivo — de novo, superestimando.
--
-- Só linhas de CHAT entram (audio_seconds is null): a tabela de STT não mudou.
-- Modelos fora da lista abaixo ficam intocados, inclusive as duas variantes de
-- gpt-4o, cujo preço e cache sempre estiveram certos.
--
-- Idempotente: recalcular duas vezes dá o mesmo número.

with prices(model, input_per_1m, cached_per_1m, output_per_1m) as (
  values
    ('gpt-5.1',      1.25,  0.125, 10.0),
    ('gpt-5',        1.25,  0.125, 10.0),
    ('gpt-5-mini',   0.25,  0.025,  2.0),
    ('gpt-4.1',      2.00,  0.500,  8.0),
    ('gpt-4.1-mini', 0.40,  0.100,  1.6),
    ('gpt-4.1-nano', 0.10,  0.025,  0.4)
),
recomputed as (
  select
    e.id,
    -- cached_tokens é SUBCONJUNTO de prompt_tokens, nunca somado a ele; e é
    -- NULL nas linhas anteriores à 0008, que se lê como "não sabemos", não
    -- como zero. Tratar NULL como 0 aqui é a leitura conservadora: cobra o
    -- prompt inteiro a preço fresco, que é o que já estava gravado.
    round(
      (coalesce(e.prompt_tokens, 0) - least(coalesce(e.cached_tokens, 0), coalesce(e.prompt_tokens, 0)))
        / 1000000.0 * p.input_per_1m
      + least(coalesce(e.cached_tokens, 0), coalesce(e.prompt_tokens, 0))
        / 1000000.0 * p.cached_per_1m
    , 6) as input_cost,
    round(coalesce(e.completion_tokens, 0) / 1000000.0 * p.output_per_1m, 6) as output_cost
  from public.llm_usage_events e
  join prices p on p.model = e.model
  where e.audio_seconds is null
)
update public.llm_usage_events e
set
  input_cost_usd  = r.input_cost,
  output_cost_usd = r.output_cost,
  total_cost_usd  = r.input_cost + r.output_cost
from recomputed r
where r.id = e.id
  and (
    e.input_cost_usd  is distinct from r.input_cost
    or e.output_cost_usd is distinct from r.output_cost
    or e.total_cost_usd  is distinct from r.input_cost + r.output_cost
  );
