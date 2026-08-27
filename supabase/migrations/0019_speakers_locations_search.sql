-- Speakers/locations become first-class user assets: searchable by name,
-- ordered by how often the user has recorded with them. This migration:
--
--   1. Enforces per-user uniqueness by lower(name) so upsert-by-name has a
--      deterministic target (case-insensitive dedup).
--   2. Adds two SECURITY INVOKER views that surface the same rows as the
--      base tables PLUS a usage_count derived from sessions.speaker_id /
--      sessions.location_id. Views inherit base-table RLS, so a user only
--      ever sees their own rows through them.
--
-- No data changes: user_id already exists on both tables (migration 0005)
-- and rows without a user_id are legacy pre-auth (invisible under RLS
-- anyway).

-- 1) Per-user case-insensitive uniqueness on name --------------------------
-- Partial index (user_id is not null) so the two legacy rows created before
-- auth existed don't collide with anything.
create unique index if not exists speakers_user_name_lower_unique
  on public.speakers (user_id, lower(name))
  where user_id is not null;

create unique index if not exists locations_user_name_lower_unique
  on public.locations (user_id, lower(name))
  where user_id is not null;

-- 2) Views with usage_count ------------------------------------------------
-- SECURITY INVOKER (Postgres 15+ default) so RLS on speakers / sessions /
-- locations still applies when the view is queried.

create or replace view public.speakers_with_usage as
select
  s.id,
  s.name,
  s.default_location_id,
  s.bio,
  s.created_at,
  s.user_id,
  coalesce(u.usage_count, 0)::int as usage_count
from public.speakers s
left join lateral (
  select count(*)::int as usage_count
  from public.sessions sess
  where sess.speaker_id = s.id
) u on true;

create or replace view public.locations_with_usage as
select
  l.id,
  l.name,
  l.city,
  l.notes,
  l.created_at,
  l.user_id,
  coalesce(u.usage_count, 0)::int as usage_count
from public.locations l
left join lateral (
  select count(*)::int as usage_count
  from public.sessions sess
  where sess.location_id = l.id
) u on true;

grant select on public.speakers_with_usage  to authenticated;
grant select on public.locations_with_usage to authenticated;
