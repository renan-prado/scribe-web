import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { LICENSES, SOURCE_TYPES } from "@/lib/knowledge/types";
import { createAdminClient } from "@/lib/supabase/admin";

const PatchBody = z.object({
  title: z.string().min(1).max(500).optional(),
  author: z.string().max(500).nullable().optional(),
  publisher: z.string().max(500).nullable().optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  license: z.enum(LICENSES).optional(),
  licenseNotes: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().min(1).max(80)).max(50).optional(),
  content: z.string().max(500_000).nullable().optional(),
  contentSummary: z.string().max(2000).nullable().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;
  const { id } = await params;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_sources")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { count } = await admin
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true })
    .eq("source_id", id);

  return NextResponse.json({ source: data, chunk_count: count ?? 0 });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  // Guard: source_type cannot change once indexed — metadata schemas assume
  // a stable type. Content edits after indexing put the source into 'draft'
  // again so the admin knows a reindex is needed.
  const { data: current } = await admin
    .from("knowledge_sources")
    .select("status,source_type,content")
    .eq("id", id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (
    parsed.data.sourceType &&
    current.status === "indexed" &&
    parsed.data.sourceType !== current.source_type
  ) {
    return NextResponse.json({ error: "source_type_locked_after_index" }, { status: 409 });
  }

  const contentChanged =
    typeof parsed.data.content !== "undefined" && parsed.data.content !== current.content;

  const update: Record<string, unknown> = {};
  if (typeof parsed.data.title !== "undefined") update.title = parsed.data.title;
  if (typeof parsed.data.author !== "undefined") update.author = parsed.data.author;
  if (typeof parsed.data.publisher !== "undefined") update.publisher = parsed.data.publisher;
  if (typeof parsed.data.sourceType !== "undefined") update.source_type = parsed.data.sourceType;
  if (typeof parsed.data.license !== "undefined") update.license = parsed.data.license;
  if (typeof parsed.data.licenseNotes !== "undefined")
    update.license_notes = parsed.data.licenseNotes;
  if (typeof parsed.data.tags !== "undefined") update.tags = parsed.data.tags;
  if (typeof parsed.data.content !== "undefined") update.content = parsed.data.content;
  if (typeof parsed.data.contentSummary !== "undefined") {
    update.content_summary = parsed.data.contentSummary;
  }
  if (contentChanged && current.status === "indexed") {
    update.status = "draft";
    update.indexed_at = null;
  }

  const { error } = await admin.from("knowledge_sources").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  console.log(JSON.stringify({ tag: "[admin/knowledge]", event: "updated", sourceId: id }));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;
  const { id } = await params;

  const admin = createAdminClient();
  const { error } = await admin.from("knowledge_sources").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  console.log(JSON.stringify({ tag: "[admin/knowledge]", event: "deleted", sourceId: id }));
  return NextResponse.json({ ok: true });
}
