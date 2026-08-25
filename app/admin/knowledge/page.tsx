import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { ADMIN_TABLE_SURFACE } from "@/features/admin/lib/surfaces";
import { SOURCE_STATUSES, SOURCE_TYPES } from "@/lib/knowledge/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Biblioteca" };
export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  processing: "Indexando…",
  indexed: "Indexado",
  failed: "Falhou",
};

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  draft: { bg: "#F4F1EA", fg: "#7B6748" },
  processing: { bg: "#FDF3DD", fg: "#C79B2A" },
  indexed: { bg: "#E4EFEA", fg: "#4E8570" },
  failed: { bg: "#FAEAE5", fg: "#A8715C" },
};

type SearchParams = {
  search?: string;
  status?: string;
  sourceType?: string;
};

type SourceRow = {
  id: string;
  title: string;
  author: string | null;
  source_type: string;
  license: string;
  status: string;
  chunk_count: number;
  indexed_at: string | null;
  created_at: string;
};

async function loadSources(sp: SearchParams): Promise<SourceRow[]> {
  const admin = createAdminClient();
  let q = admin
    .from("knowledge_sources")
    .select("id,title,author,source_type,license,status,indexed_at,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (sp.search) q = q.ilike("title", `%${sp.search}%`);
  if (sp.status && (SOURCE_STATUSES as readonly string[]).includes(sp.status)) {
    q = q.eq("status", sp.status);
  }
  if (sp.sourceType && (SOURCE_TYPES as readonly string[]).includes(sp.sourceType)) {
    q = q.eq("source_type", sp.sourceType);
  }
  const { data } = await q;
  const rows = (data ?? []) as Omit<SourceRow, "chunk_count">[];
  if (rows.length === 0) return [];

  const { data: chunkRows } = await admin
    .from("knowledge_chunks")
    .select("source_id")
    .in(
      "source_id",
      rows.map((r) => r.id)
    );
  const counts = new Map<string, number>();
  for (const r of chunkRows ?? []) {
    const id = r.source_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return rows.map((r) => ({ ...r, chunk_count: counts.get(r.id) ?? 0 }));
}

export default async function AdminKnowledgePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const sources = await loadSources(sp);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Biblioteca"
        subtitle="Fontes indexadas para RAG (Bíblia + editorial). Escrita apenas via admin."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/knowledge/playground">
              <Button variant="outline">Playground</Button>
            </Link>
            <Link href="/admin/knowledge/new">
              <Button>+ Nova fonte</Button>
            </Link>
          </div>
        }
      />

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border p-3"
        style={{ borderColor: "var(--scriba-hairline)" }}
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="knowledge-search"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--scriba-ink-mute)]"
          >
            Busca (título)
          </label>
          <Input
            id="knowledge-search"
            name="search"
            defaultValue={sp.search ?? ""}
            className="w-64"
            placeholder="ex.: NAA — Romanos"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="knowledge-status"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--scriba-ink-mute)]"
          >
            Status
          </label>
          <select
            id="knowledge-status"
            name="status"
            defaultValue={sp.status ?? ""}
            className="h-9 rounded-md border bg-white px-3 text-sm"
            style={{ borderColor: "var(--scriba-hairline)" }}
          >
            <option value="">todos</option>
            {SOURCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="knowledge-type"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--scriba-ink-mute)]"
          >
            Tipo
          </label>
          <select
            id="knowledge-type"
            name="sourceType"
            defaultValue={sp.sourceType ?? ""}
            className="h-9 rounded-md border bg-white px-3 text-sm"
            style={{ borderColor: "var(--scriba-hairline)" }}
          >
            <option value="">todos</option>
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <div className={ADMIN_TABLE_SURFACE}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Licença</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Chunks</TableHead>
              <TableHead>Indexado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Nenhuma fonte encontrada.
                </TableCell>
              </TableRow>
            ) : (
              sources.map((s) => {
                const tone = STATUS_TONE[s.status] ?? STATUS_TONE.draft;
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/admin/knowledge/${s.id}`}
                        className="text-[color:var(--scriba-ink)] hover:text-[color:var(--scriba-blue)]"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{s.title}</span>
                          {s.author ? (
                            <span className="text-[0.7rem] text-[color:var(--scriba-ink-mute)]">
                              {s.author}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.source_type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.license}</TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                        style={{ background: tone.bg, color: tone.fg }}
                      >
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {s.chunk_count.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.indexed_at ? DATE_FMT.format(new Date(s.indexed_at)) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
