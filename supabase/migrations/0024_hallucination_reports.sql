-- Alertas de alucinação: o usuário percebeu, durante ou depois da gravação,
-- que o Scriba entendeu algo errado, e escreveu uma nota curta explicando.
-- A nota é analisada por /api/hallucination-report, que decide entre remover
-- cards sem apoio na transcrição, sugerir encerrar a gravação, sugerir
-- reprocessar o resumo, ou apenas registrar.
--
-- Guardamos a nota E o veredito porque é a única fonte de verdade sobre
-- QUALIDADE PERCEBIDA que temos: os logs de qualidade por chunk
-- (lib/transcription/quality.ts) dizem quando o modelo estava inseguro, mas
-- só o usuário, que ouviu o pregador, sabe quando o resultado ficou errado.
-- Cruzar as duas fontes é o que permite calibrar os limiares de escalada.
--
-- scope: 'live' (durante a gravação) | 'summary' (sessão já salva).
-- verdict: ver HALLUCINATION_VERDICTS em lib/domain/hallucination.ts.

create table if not exists public.hallucination_reports (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  scope         text not null check (scope in ('live','summary')),
  note          text not null,
  verdict       text,
  message       text,
  removed_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists hallucination_reports_session_idx
  on public.hallucination_reports (session_id, created_at desc);
create index if not exists hallucination_reports_user_idx
  on public.hallucination_reports (user_id, created_at desc);

alter table public.hallucination_reports enable row level security;

drop policy if exists hallucination_reports_select_own on public.hallucination_reports;
drop policy if exists hallucination_reports_insert_own on public.hallucination_reports;
drop policy if exists hallucination_reports_delete_own on public.hallucination_reports;

create policy hallucination_reports_select_own on public.hallucination_reports
  for select using (user_id = auth.uid());
create policy hallucination_reports_insert_own on public.hallucination_reports
  for insert with check (user_id = auth.uid());
create policy hallucination_reports_delete_own on public.hallucination_reports
  for delete using (user_id = auth.uid());
