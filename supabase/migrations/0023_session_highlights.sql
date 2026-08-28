-- Session highlights: frases marcantes recicladas SEM IA a partir do próprio
-- feed do ao vivo (speakerCitation/speakerHighlight/speakerEcho) + quote
-- blocks do resumo final. Diferente das outras séries (practices/rereads/
-- reminders), aqui não há chamada de LLM — o extractor apenas prioriza,
-- deduplica e distribui as frases no tempo.
--
-- Cadência agendada: distribuição logarítmica entre 3 e 365 dias, calculada
-- em runtime a partir da quantidade N de frases coletadas (variável por
-- sessão). Assim uma pregação enxuta ainda cobre o tail de 1 ano, e uma
-- densa distribui naturalmente os cards ao longo do intervalo.
--
-- payload segue o schema HighlightsPayload em lib/domain/highlights.ts —
-- { items: HighlightItem[] }. Uma linha por sessão (unique session_id),
-- reprocess_summary sobrescreve.

create table if not exists public.session_highlights (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null unique references public.sessions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists session_highlights_user_id_idx
  on public.session_highlights (user_id);

alter table public.session_highlights enable row level security;

drop policy if exists session_highlights_select_own on public.session_highlights;
drop policy if exists session_highlights_insert_own on public.session_highlights;
drop policy if exists session_highlights_update_own on public.session_highlights;
drop policy if exists session_highlights_delete_own on public.session_highlights;

create policy session_highlights_select_own on public.session_highlights
  for select using (user_id = auth.uid());
create policy session_highlights_insert_own on public.session_highlights
  for insert with check (user_id = auth.uid());
create policy session_highlights_update_own on public.session_highlights
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy session_highlights_delete_own on public.session_highlights
  for delete using (user_id = auth.uid());
