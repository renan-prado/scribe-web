-- Session deepenings: one optional per-session "aprofundamento" — a denser,
-- more theological pass over the same transcript + feed items + already-
-- generated final_summary. Produced on-demand from /summary at a fixed cost
-- (10 coins, enforced client-side/UI for now). One aprofundamento per session
-- max — the unique(session_id) constraint below is what makes "só pode ser
-- aprofundado uma vez" a hard rule, not just a UI convention.
--
-- payload has the same shape as sessions.final_summary (SummaryPayload — see
-- lib/domain/summary.ts), so the same BlockRenderer/SummaryView can render it
-- with no branching.

create table if not exists public.session_deepenings (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null unique references public.sessions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  payload      jsonb not null,
  created_at   timestamptz not null default now()
);

create index if not exists session_deepenings_user_id_idx
  on public.session_deepenings (user_id);

alter table public.session_deepenings enable row level security;

drop policy if exists session_deepenings_select_own on public.session_deepenings;
drop policy if exists session_deepenings_insert_own on public.session_deepenings;
drop policy if exists session_deepenings_delete_own on public.session_deepenings;

create policy session_deepenings_select_own on public.session_deepenings
  for select using (user_id = auth.uid());
create policy session_deepenings_insert_own on public.session_deepenings
  for insert with check (user_id = auth.uid());
create policy session_deepenings_delete_own on public.session_deepenings
  for delete using (user_id = auth.uid());
