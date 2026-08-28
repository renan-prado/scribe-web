-- Session reminders ("Lembra disso?"): 10 mini-callbacks que resgatam
-- sub-ideias do sermão ao longo do tempo. Diferente de "praticar" (ação) e
-- "releia" (texto bíblico), aqui o card é uma volta a alguma IDEIA específica
-- que apareceu na pregação — pode ser verbatim (frase do pastor via
-- speakerHighlight/echo/citation do feed), paráfrase (contextCard/highlight
-- do resumo) ou uma sub-ideia gerada pela IA a partir do transcript.
--
-- Cadência agendada:
--   2, 5, 18, 33, 47, 62, 82, 120, 180, 260 dias após a sessão.
-- Colisão intencional apenas com "releia" no dia 2; os demais offsets ficam
-- espalhados para dar variedade ao feed. O tail longo (até 260 dias) serve
-- como gancho para o usuário voltar a revisitar sermões antigos.
--
-- payload segue o schema RemindersPayload em lib/domain/reminders.ts —
-- { items: ReminderItem[10] }. Uma linha por sessão (unique session_id),
-- reprocess_summary sobrescreve.

create table if not exists public.session_reminders (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null unique references public.sessions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists session_reminders_user_id_idx
  on public.session_reminders (user_id);

alter table public.session_reminders enable row level security;

drop policy if exists session_reminders_select_own on public.session_reminders;
drop policy if exists session_reminders_insert_own on public.session_reminders;
drop policy if exists session_reminders_update_own on public.session_reminders;
drop policy if exists session_reminders_delete_own on public.session_reminders;

create policy session_reminders_select_own on public.session_reminders
  for select using (user_id = auth.uid());
create policy session_reminders_insert_own on public.session_reminders
  for insert with check (user_id = auth.uid());
create policy session_reminders_update_own on public.session_reminders
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy session_reminders_delete_own on public.session_reminders
  for delete using (user_id = auth.uid());
