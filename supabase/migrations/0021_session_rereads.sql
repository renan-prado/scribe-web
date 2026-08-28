-- Session rereads ("Releia este texto"): 10 versículos separados para o
-- usuário reler ao longo do tempo. Sempre que possível, reaproveita textos
-- que já foram citados durante a gravação (feed citedVerse), sugeridos pela
-- IA no live (feed relatedVerse) ou incluídos no final_summary
-- (bibleQuote/relatedVerse blocks). Só usa a IA para completar até 10 quando
-- o pool não cobre todos os slots.
--
-- Todos os itens são agendados no futuro — cadência:
--   1, 2, 4, 7, 16, 22, 30, 45, 60, 90 dias após a sessão.
-- Colisão intencional com "praticar" só nos dias 1 e 7; os demais offsets
-- ficam intercalados para variar o conteúdo do feed home.
--
-- payload segue o schema RereadsPayload em lib/domain/rereads.ts —
-- { items: RereadItem[10] }. Uma linha por sessão (unique session_id),
-- reprocess_summary sobrescreve.

create table if not exists public.session_rereads (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null unique references public.sessions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists session_rereads_user_id_idx
  on public.session_rereads (user_id);

alter table public.session_rereads enable row level security;

drop policy if exists session_rereads_select_own on public.session_rereads;
drop policy if exists session_rereads_insert_own on public.session_rereads;
drop policy if exists session_rereads_update_own on public.session_rereads;
drop policy if exists session_rereads_delete_own on public.session_rereads;

create policy session_rereads_select_own on public.session_rereads
  for select using (user_id = auth.uid());
create policy session_rereads_insert_own on public.session_rereads
  for insert with check (user_id = auth.uid());
create policy session_rereads_update_own on public.session_rereads
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy session_rereads_delete_own on public.session_rereads
  for delete using (user_id = auth.uid());
