-- Track cached input tokens on each LLM call.
--
-- OpenAI's response usage.prompt_tokens_details.cached_tokens tells us how
-- many of the prompt_tokens hit their automatic prompt cache (50% cheaper
-- for GPT-4o/4.1/5). We compute total_cost_usd correctly from it, and this
-- nullable column keeps the raw number around so future audits can slice
-- cost by cache-hit ratio.
--
-- Historical rows stay NULL — we didn't know the value before this
-- migration, so any dashboard filtering on cached_tokens should treat NULL
-- as "unknown", not zero.

alter table public.llm_usage_events
  add column if not exists cached_tokens integer;
