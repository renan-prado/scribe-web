-- Session mode: distinguishes recordings that run the live enrichment pipelines
-- (bible / insights / echo) from "audio-only" recordings that skip everything
-- during capture and only produce the final summary on stop.
--
-- Kept as a small text enum (checked, not a real enum type) so future modes can
-- be added without a schema-migration ceremony. Default is 'live' so every
-- existing row keeps its historical behaviour.

alter table public.sessions
  add column if not exists mode text not null default 'live';

alter table public.sessions
  drop constraint if exists sessions_mode_check;

alter table public.sessions
  add constraint sessions_mode_check
  check (mode in ('live', 'audio_only'));

create index if not exists sessions_mode_idx
  on public.sessions (mode);
