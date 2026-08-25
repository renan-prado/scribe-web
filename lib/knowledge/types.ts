/**
 * Shared knowledge-base (RAG) types. Mirrors the enums declared in
 * supabase/migrations/0013_knowledge_sources.sql. When adding a new
 * source_type or license, add it in BOTH places or the CHECK
 * constraint will reject inserts.
 */

export const SOURCE_TYPES = [
  "bible",
  "commentary",
  "systematic_theology",
  "article",
  "book",
  "sermon",
  "editorial",
  "session_summary",
  "session_deepening",
  "session_highlight",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const LICENSES = [
  "public_domain",
  "cc_by",
  "cc_by_sa",
  "editorial_original",
  "licensed_agreement",
  "user_content",
] as const;
export type License = (typeof LICENSES)[number];

export const SOURCE_STATUSES = ["draft", "processing", "indexed", "failed"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export type OwnerScope = "global" | "owner" | "both";

/**
 * Metadata attached to bible chunks. Kept intentionally minimal so
 * the guard-fed metadata filter can round-trip (see lib/bible/guard.ts).
 * `book` is the canonical JSON abbrev used across lib/bibles/*
 * ("Rm", "1Co", "Jo", "Jó", …). `bookDisplay` is the pt-BR name for UI.
 */
export type BibleChunkMetadata = {
  kind: "bible";
  translation: string;
  book: string;
  bookDisplay: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  testament: "OT" | "NT";
};

export type EditorialChunkMetadata = {
  kind: "editorial";
  paragraphs?: number;
};

export type ChunkMetadata = BibleChunkMetadata | EditorialChunkMetadata | Record<string, unknown>;

export type PreparedChunk = {
  content: string;
  section?: string;
  metadata?: Record<string, unknown>;
};

export type KnowledgeSourceRow = {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  source_type: SourceType;
  license: License;
  license_notes: string | null;
  tags: string[];
  content: string | null;
  content_summary: string | null;
  status: SourceStatus;
  error_message: string | null;
  embedding_model: string | null;
  embedding_dimensions: number | null;
  chunker_version: string | null;
  indexed_at: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SearchResult = {
  chunkId: number;
  sourceId: string;
  sourceTitle: string;
  sourceType: SourceType;
  section: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};
