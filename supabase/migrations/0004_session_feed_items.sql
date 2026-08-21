-- Normalize speaker-sourced feed items (citedVerse, speakerHighlight,
-- speakerEcho, speakerCitation) into rows so we can query across sessions
-- (all verses cited by a speaker, all citations of a given author, etc.).
--
-- Purely additive: sessions.feed_items (jsonb) stays exactly as it is and
-- the current prod app keeps writing it unchanged. A trigger on sessions
-- keeps session_feed_items in sync from the jsonb, so no app-code change
-- is required to start populating this table. When the app is ready to own
-- the writes directly, drop the trigger and switch saveSession to insert
-- rows here instead.
--
-- AI-authored items (relatedVerse, context, suggestedQuote) stay in the
-- jsonb only — those are one-shot enrichment we don't filter across
-- sessions. Feed item shapes live in lib/domain/feed.ts.

create table if not exists public.session_feed_items (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.sessions(id) on delete cascade,
  position         integer not null,
  kind             text not null check (kind in ('citedVerse','speakerHighlight','speakerEcho','speakerCitation')),
  payload          jsonb not null,
  -- Structured columns, populated per-kind for indexed queries:
  verse_book       text,       -- normalized: lowercase, punctuation stripped
  verse_chapter    integer,
  verse_start      integer,    -- null when the ref is chapter-only (e.g., "João 4")
  verse_end        integer,    -- equals verse_start when the ref has no range
  citation_author  text,
  text_normalized  text,       -- lowercased, whitespace-collapsed
  created_at       timestamptz not null default now(),
  unique (session_id, position)
);

create index if not exists sfi_session_idx           on public.session_feed_items (session_id, position);
create index if not exists sfi_kind_idx              on public.session_feed_items (kind);
create index if not exists sfi_verse_lookup_idx      on public.session_feed_items (verse_book, verse_chapter)
  where kind = 'citedVerse';
create index if not exists sfi_citation_author_idx   on public.session_feed_items (lower(citation_author))
  where kind = 'speakerCitation';

-- Explode helper: rebuilds session_feed_items rows for one session from its
-- feed_items jsonb. Shared by the trigger and the initial backfill so the
-- parsing logic lives in exactly one place.
--
-- Reference parsing mirrors parseVerseReference in lib/domain/feed.ts:
--   "Tiago 1:1"     -> book=tiago, chapter=1, start=1,    end=1
--   "Tiago 1:1-4"   -> book=tiago, chapter=1, start=1,    end=4
--   "João 4"        -> book=joão,  chapter=4, start=null, end=null
create or replace function public._explode_session_feed_items(
  p_session_id uuid,
  p_items jsonb
)
returns void
language plpgsql
as $$
begin
  delete from public.session_feed_items where session_id = p_session_id;

  insert into public.session_feed_items
    (session_id, position, kind, payload,
     verse_book, verse_chapter, verse_start, verse_end,
     citation_author, text_normalized)
  select
    p_session_id,
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

create or replace function public.sync_session_feed_items()
returns trigger
language plpgsql
as $$
begin
  perform public._explode_session_feed_items(new.id, new.feed_items);
  return new;
end;
$$;

drop trigger if exists sync_session_feed_items_ins on public.sessions;
drop trigger if exists sync_session_feed_items_upd on public.sessions;

create trigger sync_session_feed_items_ins
after insert on public.sessions
for each row execute function public.sync_session_feed_items();

create trigger sync_session_feed_items_upd
after update of feed_items on public.sessions
for each row
when (new.feed_items is distinct from old.feed_items)
execute function public.sync_session_feed_items();

-- Backfill the 2 existing rows (and any other rows already in the table).
select public._explode_session_feed_items(id, feed_items) from public.sessions;
