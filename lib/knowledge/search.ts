import { embedText } from "@/lib/ai/embeddings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { OwnerScope, SearchResult, SourceType } from "./types";

export type SearchOpts = {
  topK?: number;
  sourceTypes?: SourceType[];
  metadataFilter?: Record<string, unknown>;
  /** 'global' = only owner_user_id IS NULL. 'owner' = only the given uuid.
   * 'both' = union of the two. Defaults to 'global'. */
  ownerScope?: OwnerScope;
  ownerId?: string | null;
  /**
   * When true, bypasses RLS via the service-role client. Only use from
   * server routes that have already asserted admin authorization.
   */
  admin?: boolean;
  signal?: AbortSignal;
};

/**
 * Semantic search against knowledge_chunks. Embeds the query using the same
 * model/dimensions as ingest and calls the `match_knowledge` SQL function.
 */
export async function searchKnowledge(
  query: string,
  opts: SearchOpts = {}
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const embed = await embedText(trimmed, { signal: opts.signal });
  if (!embed.ok) {
    const detail = embed.error.kind === "http" ? `${embed.error.status}` : embed.error.message;
    throw new Error(`searchKnowledge embed failed: ${detail}`);
  }

  const supabase = opts.admin ? createAdminClient() : await createSupabaseClient();

  const { data, error } = await supabase.rpc("match_knowledge", {
    query_embedding: embed.data.embedding,
    match_count: opts.topK ?? 10,
    filter_source_types: opts.sourceTypes ?? null,
    filter_metadata: opts.metadataFilter ?? null,
    filter_owner_scope: opts.ownerScope ?? "global",
    filter_owner_id: opts.ownerId ?? null,
  });

  if (error) {
    throw new Error(`match_knowledge rpc failed: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    chunk_id: number;
    source_id: string;
    source_title: string;
    source_type: SourceType;
    section: string | null;
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }>;

  return rows.map((r) => ({
    chunkId: r.chunk_id,
    sourceId: r.source_id,
    sourceTitle: r.source_title,
    sourceType: r.source_type,
    section: r.section,
    content: r.content,
    metadata: r.metadata ?? {},
    similarity: r.similarity,
  }));
}
