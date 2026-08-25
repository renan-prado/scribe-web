import { embedTexts } from "@/lib/ai/embeddings";
import { serverEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHUNKER_VERSION } from "./chunk";
import type { License, PreparedChunk, SourceType } from "./types";

export type IngestInput = {
  title: string;
  author?: string | null;
  publisher?: string | null;
  sourceType: SourceType;
  license: License;
  licenseNotes?: string | null;
  tags?: string[];
  content?: string | null;
  contentSummary?: string | null;
  ownerUserId?: string | null;
  chunks: PreparedChunk[];
};

export type IngestResult = {
  sourceId: string;
  chunkCount: number;
  tokensUsed: number;
  embedLatencyMs: number;
};

/**
 * Batch size for the embedding call. 50 keeps us well under the OpenAI
 * per-request cap (100) and produces short enough calls that the timeout
 * inside embedTexts is never in play.
 */
const EMBED_BATCH_SIZE = 50;

/**
 * Rough token estimate for pre-flight cost. Used by the CLI script to
 * abort early if the run is more expensive than expected. Not billed —
 * OpenAI's own count returned in `usage` is authoritative.
 */
export function estimateTokens(text: string): number {
  // Very rough: ~4 characters per token for English/Portuguese. Actual
  // tokenizer would be more accurate but adds a dep for a guard.
  return Math.ceil(text.length / 4);
}

/**
 * Persist a source + its chunks + their embeddings in one call.
 * Transactional-ish: the source row is created first with
 * status='processing'; on success we flip to 'indexed', on failure to
 * 'failed' with error_message. Chunk inserts happen in batches — a
 * mid-batch failure leaves the source in 'failed' with partially
 * inserted chunks, which is fine because match_knowledge filters on
 * status='indexed'. Retry with the same source_id overwrites via
 * `on conflict (source_id, chunk_index)`.
 */
export async function indexKnowledgeSource(input: IngestInput): Promise<IngestResult> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: source, error: createErr } = await admin
    .from("knowledge_sources")
    .insert({
      title: input.title,
      author: input.author ?? null,
      publisher: input.publisher ?? null,
      source_type: input.sourceType,
      license: input.license,
      license_notes: input.licenseNotes ?? null,
      tags: input.tags ?? [],
      content: input.content ?? null,
      content_summary: input.contentSummary ?? null,
      status: "processing",
      owner_user_id: input.ownerUserId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (createErr || !source) {
    throw new Error(`knowledge_sources insert failed: ${createErr?.message ?? "no row returned"}`);
  }
  const sourceId = source.id as string;

  if (input.chunks.length === 0) {
    await admin
      .from("knowledge_sources")
      .update({
        status: "indexed",
        indexed_at: now,
        embedding_model: serverEnv.OPENAI_EMBEDDING_MODEL,
        embedding_dimensions: serverEnv.OPENAI_EMBEDDING_DIMENSIONS,
        chunker_version: CHUNKER_VERSION,
      })
      .eq("id", sourceId);
    return { sourceId, chunkCount: 0, tokensUsed: 0, embedLatencyMs: 0 };
  }

  let tokensUsed = 0;
  let embedLatencyMs = 0;
  let nextIndex = 0;

  try {
    for (let i = 0; i < input.chunks.length; i += EMBED_BATCH_SIZE) {
      const slice = input.chunks.slice(i, i + EMBED_BATCH_SIZE);
      const contents = slice.map((c) => c.content);
      const res = await embedTexts(contents);
      if (!res.ok) {
        throw new Error(
          `embedding batch ${i}-${i + slice.length} failed: ${
            res.error.kind === "http" ? res.error.message : res.error.message
          }`
        );
      }
      tokensUsed += res.data.usage.totalTokens ?? 0;
      embedLatencyMs += res.data.latencyMs;

      const rows = slice.map((c, j) => ({
        source_id: sourceId,
        chunk_index: nextIndex + j,
        content: c.content,
        section: c.section ?? null,
        metadata: c.metadata ?? {},
        embedding: res.data.embeddings[j],
        embedding_model: res.data.model,
        embedding_dimensions: res.data.dimensions,
        tokens_estimated: estimateTokens(c.content),
      }));

      const { error: insertErr } = await admin.from("knowledge_chunks").upsert(rows, {
        onConflict: "source_id,chunk_index",
      });
      if (insertErr) {
        throw new Error(`knowledge_chunks upsert failed: ${insertErr.message}`);
      }
      nextIndex += slice.length;
    }

    await admin
      .from("knowledge_sources")
      .update({
        status: "indexed",
        indexed_at: new Date().toISOString(),
        embedding_model: serverEnv.OPENAI_EMBEDDING_MODEL,
        embedding_dimensions: serverEnv.OPENAI_EMBEDDING_DIMENSIONS,
        chunker_version: CHUNKER_VERSION,
        error_message: null,
      })
      .eq("id", sourceId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("knowledge_sources")
      .update({ status: "failed", error_message: message.slice(0, 500) })
      .eq("id", sourceId);
    throw err;
  }

  return { sourceId, chunkCount: input.chunks.length, tokensUsed, embedLatencyMs };
}

/**
 * Re-index an existing source in place. Deletes its chunks, then feeds
 * new PreparedChunks through the same pipeline. The source row keeps
 * its id, tags, license, etc. — only chunks + indexing metadata change.
 */
export async function reindexKnowledgeSource(
  sourceId: string,
  chunks: PreparedChunk[]
): Promise<IngestResult> {
  const admin = createAdminClient();
  await admin.from("knowledge_chunks").delete().eq("source_id", sourceId);
  await admin
    .from("knowledge_sources")
    .update({
      status: "processing",
      error_message: null,
      indexed_at: null,
    })
    .eq("id", sourceId);

  if (chunks.length === 0) {
    await admin
      .from("knowledge_sources")
      .update({
        status: "indexed",
        indexed_at: new Date().toISOString(),
        embedding_model: serverEnv.OPENAI_EMBEDDING_MODEL,
        embedding_dimensions: serverEnv.OPENAI_EMBEDDING_DIMENSIONS,
        chunker_version: CHUNKER_VERSION,
      })
      .eq("id", sourceId);
    return { sourceId, chunkCount: 0, tokensUsed: 0, embedLatencyMs: 0 };
  }

  let tokensUsed = 0;
  let embedLatencyMs = 0;

  try {
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const slice = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const res = await embedTexts(slice.map((c) => c.content));
      if (!res.ok) {
        throw new Error(
          `embedding batch ${i}-${i + slice.length} failed: ${
            res.error.kind === "http" ? res.error.message : res.error.message
          }`
        );
      }
      tokensUsed += res.data.usage.totalTokens ?? 0;
      embedLatencyMs += res.data.latencyMs;

      const rows = slice.map((c, j) => ({
        source_id: sourceId,
        chunk_index: i + j,
        content: c.content,
        section: c.section ?? null,
        metadata: c.metadata ?? {},
        embedding: res.data.embeddings[j],
        embedding_model: res.data.model,
        embedding_dimensions: res.data.dimensions,
        tokens_estimated: estimateTokens(c.content),
      }));

      const { error: insertErr } = await admin.from("knowledge_chunks").upsert(rows, {
        onConflict: "source_id,chunk_index",
      });
      if (insertErr) throw new Error(`knowledge_chunks upsert failed: ${insertErr.message}`);
    }

    await admin
      .from("knowledge_sources")
      .update({
        status: "indexed",
        indexed_at: new Date().toISOString(),
        embedding_model: serverEnv.OPENAI_EMBEDDING_MODEL,
        embedding_dimensions: serverEnv.OPENAI_EMBEDDING_DIMENSIONS,
        chunker_version: CHUNKER_VERSION,
        error_message: null,
      })
      .eq("id", sourceId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("knowledge_sources")
      .update({ status: "failed", error_message: message.slice(0, 500) })
      .eq("id", sourceId);
    throw err;
  }

  return { sourceId, chunkCount: chunks.length, tokensUsed, embedLatencyMs };
}
