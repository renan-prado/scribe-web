-- Enables pgvector for the knowledge base (RAG) feature.
--
-- Supabase installs pgvector into the `extensions` schema by default;
-- knowledge tables in `public` reference the type as `extensions.vector`.

create extension if not exists vector with schema extensions;
