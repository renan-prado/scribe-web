-- Editorial sources indexed for RAG (bible books, commentaries,
-- systematic theology, articles, editorial original content, and
-- eventually user-owned sermon derivatives).
--
-- `owner_user_id IS NULL` means a global source (visible to any
-- authenticated user). Non-null means a personal source owned by
-- that user (auto-indexed session summaries/deepenings — deferred
-- to a later phase, see docs/scriba-rag-todos-futuros.md item #1).
--
-- Writes are performed exclusively by the service-role client from
-- `/api/admin/*` server routes — RLS therefore only defines READ
-- policies (see 0016). This matches the existing admin-role pattern
-- established in 0007_admin_role.sql.

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  publisher text,
  source_type text not null check (source_type in (
    'bible',
    'commentary',
    'systematic_theology',
    'article',
    'book',
    'sermon',
    'editorial',
    'session_summary',
    'session_deepening',
    'session_highlight'
  )),
  license text not null check (license in (
    'public_domain',
    'cc_by',
    'cc_by_sa',
    'editorial_original',
    'licensed_agreement',
    'user_content'
  )),
  license_notes text,
  tags text[] not null default '{}',
  content text,
  content_summary text,
  status text not null default 'draft'
    check (status in ('draft', 'processing', 'indexed', 'failed')),
  error_message text,
  embedding_model text,
  embedding_dimensions integer,
  chunker_version text,
  indexed_at timestamptz,
  owner_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_sources_source_type_idx
  on public.knowledge_sources (source_type);
create index knowledge_sources_status_idx
  on public.knowledge_sources (status);
create index knowledge_sources_tags_gin
  on public.knowledge_sources using gin (tags);
create index knowledge_sources_owner_idx
  on public.knowledge_sources (owner_user_id);

create or replace function public.set_knowledge_sources_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger knowledge_sources_updated_at
  before update on public.knowledge_sources
  for each row
  execute function public.set_knowledge_sources_updated_at();
