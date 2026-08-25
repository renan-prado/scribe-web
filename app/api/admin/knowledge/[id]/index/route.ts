import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { chunkBibleChapter, chunkEditorialText } from "@/lib/knowledge/chunk";
import { reindexKnowledgeSource } from "@/lib/knowledge/ingest";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * (Re)index a source. Reads its stored content, runs the appropriate
 * chunker for its source_type, and replaces all chunks + refreshes
 * indexing metadata. Non-bible source types share the editorial
 * chunker for now (todos-futuros #21 for a specialized bible chunker
 * fed by imported perícope delimiters).
 *
 * Bible sources cannot be reindexed here — they are produced by the
 * `scripts/index-bible.ts` CLI which knows how to slice verses from
 * lib/bibles/*.json. Attempting to reindex a bible source via the
 * admin API returns 409.
 */
export async function POST(_req: Request, { params }: RouteParams) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;
  const { id } = await params;

  const admin = createAdminClient();
  const { data: source, error } = await admin
    .from("knowledge_sources")
    .select("id,source_type,content")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!source) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (source.source_type === "bible") {
    return NextResponse.json({ error: "bible_reindex_via_cli_only" }, { status: 409 });
  }
  if (!source.content || source.content.trim().length === 0) {
    return NextResponse.json({ error: "empty_content" }, { status: 400 });
  }

  const startedAt = performance.now();
  try {
    const chunks = chunkEditorialText(source.content);
    if (chunks.length === 0) {
      return NextResponse.json({ error: "no_chunks_produced" }, { status: 400 });
    }
    const result = await reindexKnowledgeSource(id, chunks);
    const latencyMs = Math.round(performance.now() - startedAt);
    console.log(
      JSON.stringify({
        tag: "[admin/knowledge]",
        event: "indexed",
        sourceId: id,
        chunkCount: result.chunkCount,
        tokens: result.tokensUsed,
        latencyMs,
      })
    );
    return NextResponse.json({
      sourceId: id,
      chunkCount: result.chunkCount,
      tokens: result.tokensUsed,
      latencyMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      JSON.stringify({
        tag: "[admin/knowledge]",
        event: "index_error",
        sourceId: id,
        error: message,
      })
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Silence "unused import" warnings in environments where the type
// checker is aggressive about tree-shaking. chunkBibleChapter is
// intentionally NOT called here — kept in scope so a future admin
// action can dispatch to it.
void chunkBibleChapter;
