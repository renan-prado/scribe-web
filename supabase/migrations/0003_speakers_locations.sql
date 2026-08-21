-- Reusable speaker + location entities so the same preacher / venue can be
-- linked to many sessions. Purely additive: sessions keeps every existing
-- column (speaker_name / speaker_location / feed_items) untouched so the
-- current prod app keeps writing exactly as it does today.
--
-- Ownership (user_id) and RLS are deferred to the auth phase.

create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.speakers (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  default_location_id  uuid references public.locations(id) on delete set null,
  bio                  text,
  created_at           timestamptz not null default now()
);

create index if not exists speakers_name_lower_idx  on public.speakers  (lower(name));
create index if not exists locations_name_lower_idx on public.locations (lower(name));

alter table public.sessions
  add column if not exists speaker_id  uuid references public.speakers(id)  on delete set null,
  add column if not exists location_id uuid references public.locations(id) on delete set null;

create index if not exists sessions_speaker_id_idx  on public.sessions (speaker_id);
create index if not exists sessions_location_id_idx on public.sessions (location_id);

-- Nothing to backfill: the 2 existing rows carry "Autor desconhecido" /
-- "Local desconhecido" (or null) in speaker_name / speaker_location, so no
-- real entities to create. Future rows populate the FKs from the UI once
-- the "select speaker / location" flow lands; the free-text columns stay
-- as the historical snapshot even after entities are linked.
