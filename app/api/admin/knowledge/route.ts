import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { LICENSES, SOURCE_STATUSES, SOURCE_TYPES } from "@/lib/knowledge/types";
import { createAdminClient } from "@/lib/supabase/admin";

const CreateBody = z.object({
  title: z.string().min(1).max(500),
  author: z.string().max(500).optional().nullable(),
  publisher: z.string().max(500).optional().nullable(),
  sourceType: z.enum(SOURCE_TYPES),
  license: z.enum(LICENSES),
  licenseNotes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().min(1).max(80)).max(50).optional(),
  content: z.string().max(500_000).optional().nullable(),
  contentSummary: z.string().max(2000).optional().nullable(),
});

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const status = url.searchParams.get("status") ?? "";
  const sourceType = url.searchParams.get("sourceType") ?? "";
  const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);
  const offset = Math.max(Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

  const admin = createAdminClient();
  let query = admin
    .from("knowledge_sources")
    .select(
      "id,title,author,publisher,source_type,license,tags,status,error_message,embedding_model,embedding_dimensions,chunker_version,indexed_at,owner_user_id,created_at,updated_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike("title", `%${search}%`);
  if (status && (SOURCE_STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }
  if (sourceType && (SOURCE_TYPES as readonly string[]).includes(sourceType)) {
    query = query.eq("source_type", sourceType);
  }

  const { data, error, count } = await query;
  if (error) {
    console.log(
      JSON.stringify({ tag: "[admin/knowledge]", event: "list_error", error: error.message })
    );
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (data ?? []).map((r) => r.id);
  let chunkCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: rows } = await admin
      .from("knowledge_chunks")
      .select("source_id")
      .in("source_id", ids);
    chunkCounts = (rows ?? []).reduce<Record<string, number>>((acc, r) => {
      const id = r.source_id as string;
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
  }

  return NextResponse.json({
    total: count ?? 0,
    limit,
    offset,
    sources: (data ?? []).map((r) => ({ ...r, chunk_count: chunkCounts[r.id] ?? 0 })),
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_sources")
    .insert({
      title: parsed.data.title,
      author: parsed.data.author ?? null,
      publisher: parsed.data.publisher ?? null,
      source_type: parsed.data.sourceType,
      license: parsed.data.license,
      license_notes: parsed.data.licenseNotes ?? null,
      tags: parsed.data.tags ?? [],
      content: parsed.data.content ?? null,
      content_summary: parsed.data.contentSummary ?? null,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.log(
      JSON.stringify({
        tag: "[admin/knowledge]",
        event: "create_error",
        error: error?.message ?? "no row returned",
      })
    );
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }

  console.log(
    JSON.stringify({
      tag: "[admin/knowledge]",
      event: "created",
      sourceId: data.id,
      title: parsed.data.title,
    })
  );
  return NextResponse.json({ sourceId: data.id }, { status: 201 });
}
