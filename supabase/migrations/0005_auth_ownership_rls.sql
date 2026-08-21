-- Auth ownership + Row Level Security.
--
-- Adds user_id (nullable) to sessions/speakers/locations/session_feed_items,
-- creates a public.profiles mirror of auth.users, and turns on RLS with
-- self-scoped policies on all six tables (profiles + 5 domain tables).
--
-- Ownership is nullable so the 2 pre-existing sessions rows (created before
-- auth existed) don't get orphaned mid-migration. Once the user signs in
-- once, they can claim them with:
--
--   update public.sessions
--     set user_id = auth.uid()
--     where user_id is null;
--
--   -- Trigger below re-fires on user_id changes, so session_feed_items
--   -- inherits automatically. No manual sync needed after the claim.
--
-- With RLS on and user_id NULL, those rows are invisible to every request
-- until claimed — no data leak.

-- 1) Ownership columns ------------------------------------------------------

alter table public.sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.speakers
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.locations
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.session_feed_items
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists sessions_user_id_idx           on public.sessions           (user_id);
create index if not exists speakers_user_id_idx           on public.speakers           (user_id);
create index if not exists locations_user_id_idx          on public.locations          (user_id);
create index if not exists session_feed_items_user_id_idx on public.session_feed_items (user_id);

-- 2) Profiles table (mirror of auth.users) ---------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  email        text,
  created_at   timestamptz not null default now()
);

-- Auto-provision a profile row when a new auth user signs up. Runs as
-- SECURITY DEFINER so the insert bypasses profiles RLS (the user does not
-- yet own a session at signup time).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- 3) Extend the explode function to carry sessions.user_id ------------------
-- Signature unchanged (session_id, feed_items) — the user_id lookup is done
-- inside so no callers need to change. Runs SECURITY DEFINER so the trigger
-- can write to session_feed_items regardless of the invoker's RLS.

create or replace function public._explode_session_feed_items(
  p_session_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id from public.sessions where id = p_session_id;

  delete from public.session_feed_items where session_id = p_session_id;

  insert into public.session_feed_items
    (session_id, user_id, position, kind, payload,
     verse_book, verse_chapter, verse_start, verse_end,
     citation_author, text_normalized)
  select
    p_session_id,
    v_user_id,
    (ord - 1)::int,
    item->>'kind',
    item,
    case when item->>'kind' = 'citedVerse'
         then lower(regexp_replace(
                trim((regexp_match(item->>'reference', '^(.+?)\s+\d+(?::\d+(?:-\d+)?)?\s*$'))[1]),
                '[.,]', '', 'g'))
    end,
    case when item->>'kind' = 'citedVerse'
         then nullif((regexp_match(item->>'reference', '^.+?\s+(\d+)'))[1], '')::int
    end,
    case when item->>'kind' = 'citedVerse'
         then nullif((regexp_match(item->>'reference', ':(\d+)'))[1], '')::int
    end,
    case when item->>'kind' = 'citedVerse'
         then coalesce(
                nullif((regexp_match(item->>'reference', '-(\d+)\s*$'))[1], '')::int,
                nullif((regexp_match(item->>'reference', ':(\d+)'))[1], '')::int
              )
    end,
    case when item->>'kind' = 'speakerCitation' then item->>'author' end,
    lower(regexp_replace(trim(coalesce(item->>'text','')), '\s+', ' ', 'g'))
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(item, ord)
  where item->>'kind' in ('citedVerse','speakerHighlight','speakerEcho','speakerCitation');
end;
$$;

-- Also mark the wrapper as SECURITY DEFINER so it can call the (also
-- definer) helper cleanly.
create or replace function public.sync_session_feed_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._explode_session_feed_items(new.id, new.feed_items);
  return new;
end;
$$;

-- Recreate the update trigger to ALSO fire when user_id changes so the
-- ownership claim on legacy rows propagates to session_feed_items.
drop trigger if exists sync_session_feed_items_upd on public.sessions;
create trigger sync_session_feed_items_upd
after update of feed_items, user_id on public.sessions
for each row
when (
  new.feed_items is distinct from old.feed_items
  or new.user_id is distinct from old.user_id
)
execute function public.sync_session_feed_items();

-- 4) Row Level Security -----------------------------------------------------

alter table public.profiles           enable row level security;
alter table public.sessions           enable row level security;
alter table public.speakers           enable row level security;
alter table public.locations          enable row level security;
alter table public.session_feed_items enable row level security;

-- Profiles: user reads + updates own row. Insert is done by the SECURITY
-- DEFINER trigger; there's no policy for it because clients never insert.
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Sessions: full CRUD on rows the user owns.
drop policy if exists sessions_select_own on public.sessions;
drop policy if exists sessions_insert_own on public.sessions;
drop policy if exists sessions_update_own on public.sessions;
drop policy if exists sessions_delete_own on public.sessions;
create policy sessions_select_own on public.sessions
  for select using (user_id = auth.uid());
create policy sessions_insert_own on public.sessions
  for insert with check (user_id = auth.uid());
create policy sessions_update_own on public.sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sessions_delete_own on public.sessions
  for delete using (user_id = auth.uid());

-- Speakers + Locations: same pattern.
drop policy if exists speakers_select_own on public.speakers;
drop policy if exists speakers_insert_own on public.speakers;
drop policy if exists speakers_update_own on public.speakers;
drop policy if exists speakers_delete_own on public.speakers;
create policy speakers_select_own on public.speakers
  for select using (user_id = auth.uid());
create policy speakers_insert_own on public.speakers
  for insert with check (user_id = auth.uid());
create policy speakers_update_own on public.speakers
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy speakers_delete_own on public.speakers
  for delete using (user_id = auth.uid());

drop policy if exists locations_select_own on public.locations;
drop policy if exists locations_insert_own on public.locations;
drop policy if exists locations_update_own on public.locations;
drop policy if exists locations_delete_own on public.locations;
create policy locations_select_own on public.locations
  for select using (user_id = auth.uid());
create policy locations_insert_own on public.locations
  for insert with check (user_id = auth.uid());
create policy locations_update_own on public.locations
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy locations_delete_own on public.locations
  for delete using (user_id = auth.uid());

-- Session feed items: SELECT scoped to the denormalized user_id column so
-- the query plan uses the (user_id) index directly. Writes go via the
-- SECURITY DEFINER trigger, so no INSERT/UPDATE/DELETE policies are needed.
drop policy if exists session_feed_items_select_own on public.session_feed_items;
create policy session_feed_items_select_own on public.session_feed_items
  for select using (user_id = auth.uid());
