import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { KnowledgeReindexButton } from "@/features/admin/knowledge/KnowledgeReindexButton";
import { ADMIN_CARD_SURFACE, ADMIN_TABLE_SURFACE } from "@/features/admin/lib/surfaces";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Detalhes da fonte" };
export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type RouteParams = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

const TABS = ["conteudo", "chunks", "metadata", "indexing"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  conteudo: "Conteúdo",
  chunks: "Chunks",
  metadata: "Metadados",
  indexing: "Indexação",
};

export default async function AdminKnowledgeSourcePage({ params, searchParams }: RouteParams) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? "")
    ? (rawTab as Tab)
    : "conteudo";

  const admin = createAdminClient();
  const { data: source } = await admin
    .from("knowledge_sources")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!source) notFound();

  const { count: chunkCount } = await admin
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true })
    .eq("source_id", id);

  const showChunks = tab === "chunks";
  const chunkRows = showChunks
    ? ((
        await admin
          .from("knowledge_chunks")
          .select("id,chunk_index,section,content,metadata,tokens_estimated")
          .eq("source_id", id)
          .order("chunk_index", { ascending: true })
          .limit(500)
      ).data ?? [])
    : [];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={source.title}
        subtitle={`${source.source_type} · ${source.license} · ${chunkCount ?? 0} chunks`}
        actions={
          <Link href="/admin/knowledge">
            <Button variant="outline">← voltar</Button>
          </Link>
        }
      />

      <nav className="flex gap-1 border-b" style={{ borderColor: "var(--scriba-hairline)" }}>
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/knowledge/${id}?tab=${t}`}
            className={`inline-flex items-center border-b-2 px-3 py-2 text-sm ${
              t === tab
                ? "border-[color:var(--scriba-blue)] font-medium text-[color:var(--scriba-blue)]"
                : "border-transparent text-[color:var(--scriba-ink-mute)] hover:text-[color:var(--scriba-ink)]"
            }`}
          >
            {TAB_LABEL[t]}
          </Link>
        ))}
      </nav>

      {tab === "conteudo" && (
        <div className={`whitespace-pre-wrap p-5 text-sm ${ADMIN_CARD_SURFACE}`}>
          {source.content ?? <span className="text-muted-foreground">Sem conteúdo salvo.</span>}
        </div>
      )}

      {tab === "chunks" && (
        <div className={ADMIN_TABLE_SURFACE}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-right">#</TableHead>
                <TableHead className="w-56">Section</TableHead>
                <TableHead>Content</TableHead>
                <TableHead className="w-24 text-right">Tokens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chunkRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Ainda sem chunks — a fonte precisa ser indexada.
                  </TableCell>
                </TableRow>
              ) : (
                chunkRows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-right font-mono text-xs">{c.chunk_index}</TableCell>
                    <TableCell className="font-mono text-xs">{c.section ?? "—"}</TableCell>
                    <TableCell className="max-w-[600px] whitespace-pre-wrap text-sm">
                      {c.content.length > 500 ? `${c.content.slice(0, 500)}…` : c.content}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {c.tokens_estimated ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {chunkRows.length >= 500 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              Mostrando os primeiros 500 chunks.
            </p>
          ) : null}
        </div>
      )}

      {tab === "metadata" && (
        <pre className={`overflow-auto whitespace-pre p-5 text-xs ${ADMIN_CARD_SURFACE}`}>
          {JSON.stringify(
            {
              id: source.id,
              title: source.title,
              author: source.author,
              publisher: source.publisher,
              source_type: source.source_type,
              license: source.license,
              license_notes: source.license_notes,
              tags: source.tags,
              status: source.status,
              error_message: source.error_message,
              owner_user_id: source.owner_user_id,
              content_summary: source.content_summary,
              created_at: source.created_at,
              updated_at: source.updated_at,
            },
            null,
            2
          )}
        </pre>
      )}

      {tab === "indexing" && (
        <div className={`flex flex-col gap-4 p-5 ${ADMIN_CARD_SURFACE}`}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-[color:var(--scriba-ink-mute)]">Status</dt>
            <dd className="font-mono">{source.status}</dd>
            <dt className="text-[color:var(--scriba-ink-mute)]">Modelo de embedding</dt>
            <dd className="font-mono">{source.embedding_model ?? "—"}</dd>
            <dt className="text-[color:var(--scriba-ink-mute)]">Dimensões</dt>
            <dd className="font-mono">{source.embedding_dimensions ?? "—"}</dd>
            <dt className="text-[color:var(--scriba-ink-mute)]">Chunker</dt>
            <dd className="font-mono">{source.chunker_version ?? "—"}</dd>
            <dt className="text-[color:var(--scriba-ink-mute)]">Indexado em</dt>
            <dd className="font-mono">
              {source.indexed_at ? DATE_FMT.format(new Date(source.indexed_at)) : "—"}
            </dd>
            <dt className="text-[color:var(--scriba-ink-mute)]">Total de chunks</dt>
            <dd className="font-mono">{chunkCount ?? 0}</dd>
            <dt className="text-[color:var(--scriba-ink-mute)]">Erro (última tentativa)</dt>
            <dd className="font-mono whitespace-pre-wrap">{source.error_message ?? "—"}</dd>
          </dl>

          {source.source_type === "bible" ? (
            <p className="text-xs text-muted-foreground">
              Bíblias são (re)indexadas apenas pela CLI:{" "}
              <code>npm run index:bible -- --translation NAA</code>.
            </p>
          ) : (
            <KnowledgeReindexButton sourceId={source.id} />
          )}
        </div>
      )}
    </div>
  );
}
