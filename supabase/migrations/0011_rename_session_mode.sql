-- Rename sessions.mode → sessions.capture_mode.
--
-- PostgREST parses `select=mode` as a call to the Postgres ordered-set
-- aggregate `mode()`, which fails with "WITHIN GROUP is required for
-- ordered-set aggregate mode". Renaming the physical column sidesteps the
-- conflict — the JS/TS surface still exposes the field as `mode`, but the
-- underlying column is unambiguous to the parser.

alter table public.sessions rename column mode to capture_mode;

alter table public.sessions drop constraint if exists sessions_mode_check;
alter table public.sessions
  add constraint sessions_capture_mode_check
  check (capture_mode in ('live', 'audio_only'));

drop index if exists sessions_mode_idx;
create index if not exists sessions_capture_mode_idx
  on public.sessions (capture_mode);
