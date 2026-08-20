-- Sessions: one row per recording. Everything the app needs to reopen or list
-- a session lives here. feed_items is a jsonb array of FeedItem (see
-- lib/domain/feed.ts). final_summary is the SummaryPayload (see
-- lib/domain/summary.ts). title / short_summary are denormalized off
-- final_summary so listing views don't have to parse the jsonb.
--
-- RLS is intentionally NOT enabled yet — the app runs single-user in local
-- testing with the anon key. BEFORE exposing this to any other user, enable
-- RLS and add policies keyed on auth.uid().

create extension if not exists "pgcrypto";

create table if not exists public.sessions (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  ended_at       timestamptz,
  duration_ms    integer,
  title          text,
  short_summary  text,
  transcript     text not null,
  feed_items     jsonb not null default '[]'::jsonb,
  final_summary  jsonb
);

create index if not exists sessions_created_at_idx
  on public.sessions (created_at desc);
