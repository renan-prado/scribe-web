-- Chunks produced from a knowledge_source by the chunker of record,
-- each carrying its embedding vector alongside the raw content and a
-- flexible metadata blob (used by chunkers to encode
-- domain-specific facets — bible book/chapter/verse range,
-- editorial section, etc.).
--
-- POC uses `text-embedding-3-small@512` uniformly; the embedding
-- column dimension is therefore fixed at 512. Coexistence with
-- other embedding models is deferred (see todos-futuros #9).
--
-- No vector index yet — sequential scan is fast enough under 20k
-- chunks. HNSW/IVFFlat comes later (todos-futuros #10).

create table public.knowledge_chunks (
  id bigint primary key generated always as identity,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  section text,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(512),
  embedding_model text,
  embedding_dimensions integer,
  tokens_estimated integer,
  created_at timestamptz not null default now(),
  unique (source_id, chunk_index)
);

create index knowledge_chunks_source_idx
  on public.knowledge_chunks (source_id);

create index knowledge_chunks_metadata_gin
  on public.knowledge_chunks using gin (metadata jsonb_path_ops);
