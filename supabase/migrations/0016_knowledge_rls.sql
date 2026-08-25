-- RLS for knowledge tables.
--
-- Mirrors the admin pattern from 0007_admin_role.sql: user-facing
-- writes are always performed through the service-role client from
-- server routes (`createAdminClient()`), which bypasses RLS entirely.
-- We therefore do NOT define WRITE policies here — anon/authenticated
-- roles cannot mutate knowledge tables by default (deny-by-default
-- once RLS is enabled without a matching policy).
--
-- Read policies:
--   * knowledge_sources: authenticated users may read GLOBAL sources
--     (owner_user_id IS NULL) always; they may read their OWN sources
--     (owner_user_id = auth.uid()) once we start auto-indexing
--     session-derived content (deferred, todos-futuros #1).
--   * knowledge_chunks:  visible iff the parent source is visible.

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;

create policy knowledge_sources_read_global_or_own
  on public.knowledge_sources
  for select
  to authenticated
  using (
    owner_user_id is null
    or owner_user_id = auth.uid()
  );

create policy knowledge_chunks_read_via_source
  on public.knowledge_chunks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.knowledge_sources s
      where s.id = knowledge_chunks.source_id
        and (s.owner_user_id is null or s.owner_user_id = auth.uid())
    )
  );
