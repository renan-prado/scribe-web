-- Session practices ("Coloque em prática"): 5 sugestões acionáveis geradas
-- junto com o final_summary, focadas em como colocar o sermão em prática na
-- vida real. Cada item traz um dayOffset (0, 1, 3, 7, 15) que determina
-- quando a UI o surfaça no feed pós-sessão. O item de dayOffset=0 aparece
-- ao final do próprio resumo; os demais são revelados no feed home nos dias
-- indicados após o resumo (na fase de validação atual, todos ficam visíveis).
--
-- payload segue o schema PracticesPayload em lib/domain/practices.ts —
-- { items: PracticeItem[5] }. Uma prática por sessão (unique session_id),
-- reprocess_summary sobrescreve.

create table if not exists public.session_practices (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null unique references public.sessions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists session_practices_user_id_idx
  on public.session_practices (user_id);

alter table public.session_practices enable row level security;

drop policy if exists session_practices_select_own on public.session_practices;
drop policy if exists session_practices_insert_own on public.session_practices;
drop policy if exists session_practices_update_own on public.session_practices;
drop policy if exists session_practices_delete_own on public.session_practices;

create policy session_practices_select_own on public.session_practices
  for select using (user_id = auth.uid());
create policy session_practices_insert_own on public.session_practices
  for insert with check (user_id = auth.uid());
create policy session_practices_update_own on public.session_practices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy session_practices_delete_own on public.session_practices
  for delete using (user_id = auth.uid());
