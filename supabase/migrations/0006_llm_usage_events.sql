-- LLM usage events: one row per upstream call (OpenAI chat / audio).
--
-- Written by the server routes after a successful upstream response so we can
-- compute per-session and per-user cost over time — how much a minute of live
-- transcription really costs, how much each pipeline contributes, and where
-- unexpected spikes come from.
--
-- Design notes:
--   * user_id is denormalized (RLS is scoped directly by it) so aggregate
--     queries hit the (user_id, created_at) index without joining sessions.
--   * session_id is nullable — on-demand routes (format-paragraphs, ad-hoc
--     verse lookups) run outside a recording, and we still want to see them.
--   * Costs (usd) are computed on the server against the model+usage at the
--     time of the call and STORED. Prices change; we want the historical
--     record to reflect what we actually spent, not what today's rates say.
--   * Writes happen from the same authenticated request that made the LLM
--     call, so a normal INSERT policy (user_id = auth.uid()) is enough — no
--     need for SECURITY DEFINER helpers.

create table if not exists public.llm_usage_events (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  session_id         uuid references public.sessions(id) on delete set null,
  route              text not null,     -- extract | suggest | sermon-echo | final-summary | transcribe | format-paragraphs
  model              text not null,
  prompt_tokens      integer,
  completion_tokens  integer,
  total_tokens       integer,
  audio_seconds      numeric(10,3),     -- populated for transcribe, null otherwise
  input_cost_usd     numeric(12,6) not null default 0,
  output_cost_usd    numeric(12,6) not null default 0,
  total_cost_usd     numeric(12,6) not null default 0,
  latency_ms         integer,
  created_at         timestamptz not null default now()
);

create index if not exists llm_usage_events_user_created_idx
  on public.llm_usage_events (user_id, created_at desc);

create index if not exists llm_usage_events_session_idx
  on public.llm_usage_events (session_id);

create index if not exists llm_usage_events_route_idx
  on public.llm_usage_events (user_id, route, created_at desc);

alter table public.llm_usage_events enable row level security;

drop policy if exists llm_usage_events_select_own on public.llm_usage_events;
drop policy if exists llm_usage_events_insert_own on public.llm_usage_events;

create policy llm_usage_events_select_own on public.llm_usage_events
  for select using (user_id = auth.uid());

create policy llm_usage_events_insert_own on public.llm_usage_events
  for insert with check (user_id = auth.uid());
