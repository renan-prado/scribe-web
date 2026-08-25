import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { searchKnowledge } from "@/lib/knowledge/search";
import { SOURCE_TYPES } from "@/lib/knowledge/types";

const SearchBody = z.object({
  query: z.string().min(1).max(4000),
  topK: z.number().int().min(1).max(50).optional(),
  sourceTypes: z.array(z.enum(SOURCE_TYPES)).max(SOURCE_TYPES.length).optional(),
  metadataFilter: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = SearchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const startedAt = performance.now();
  try {
    const results = await searchKnowledge(parsed.data.query, {
      topK: parsed.data.topK ?? 10,
      sourceTypes: parsed.data.sourceTypes,
      metadataFilter: parsed.data.metadataFilter,
      admin: true,
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    console.log(
      JSON.stringify({
        tag: "[admin/knowledge]",
        event: "search",
        query: parsed.data.query.slice(0, 80),
        topK: parsed.data.topK ?? 10,
        results: results.length,
        latencyMs,
      })
    );
    return NextResponse.json({ results, latencyMs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      JSON.stringify({ tag: "[admin/knowledge]", event: "search_error", error: message })
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
