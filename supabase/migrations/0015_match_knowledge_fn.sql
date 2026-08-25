-- Retrieval RPC. Consumed by lib/knowledge/search.ts and by the
-- admin playground. Uses cosine distance (`<=>`), returns
-- `similarity = 1 - distance` so higher is better and results are
-- naturally sortable descending.
--
-- Filters:
--   * filter_source_types: whitelist of source_type values.
--   * filter_metadata: jsonb `@>` containment against chunk metadata
--     (e.g. `{"kind":"bible","bibleBook":"rm","chapter":8}`).
--   * filter_owner_scope: 'global' | 'owner' | 'both'
--       - global: only chunks whose source has owner_user_id IS NULL
--       - owner:  only chunks whose source owner matches filter_owner_id
--       - both:   union of the two
--   * filter_owner_id: uuid used together with owner_scope='owner'|'both'.
--
-- Only sources with status='indexed' are considered, so
-- in-progress/failed sources never leak into results.

create or replace function public.match_knowledge(
  query_embedding extensions.vector(512),
  match_count integer default 10,
  filter_source_types text[] default null,
  filter_metadata jsonb default null,
  filter_owner_scope text default 'global',
  filter_owner_id uuid default null
)
returns table (
  chunk_id bigint,
  source_id uuid,
  source_title text,
  source_type text,
  section text,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.id as chunk_id,
    c.source_id,
    s.title as source_title,
    s.source_type,
    c.section,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks c
  join public.knowledge_sources s on s.id = c.source_id
  where c.embedding is not null
    and s.status = 'indexed'
    and (filter_source_types is null or s.source_type = any(filter_source_types))
    and (filter_metadata is null or c.metadata @> filter_metadata)
    and (
      filter_owner_scope = 'global' and s.owner_user_id is null
      or filter_owner_scope = 'owner' and s.owner_user_id = filter_owner_id
      or filter_owner_scope = 'both' and (s.owner_user_id is null or s.owner_user_id = filter_owner_id)
    )
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_knowledge(
  extensions.vector(512),
  integer,
  text[],
  jsonb,
  text,
  uuid
) to authenticated, service_role;
