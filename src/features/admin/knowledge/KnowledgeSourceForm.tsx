"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminSelect } from "@/features/admin/components/AdminSelect";
import { MarkdownEditor } from "@/features/admin/knowledge/MarkdownEditor";
import {
  EDITORIAL_SOURCE_TYPES,
  LICENSE_LABEL,
  SELECTABLE_LICENSES,
  SOURCE_TYPE_LABEL,
} from "@/lib/knowledge/labels";

type Props = {
  initial?: {
    id?: string;
    title?: string;
    author?: string | null;
    publisher?: string | null;
    sourceType?: string;
    license?: string;
    licenseNotes?: string | null;
    tags?: string[];
    content?: string | null;
  };
};

/**
 * CRUD form for editorial sources. `initial` shape supports editing a
 * loaded source (see [id]/edit — not yet built; form is create-first).
 * Save modes:
 *   - "Salvar rascunho" → POST /api/admin/knowledge (status=draft)
 *   - "Salvar e indexar" → POST then POST /api/admin/knowledge/[id]/index
 */
export function KnowledgeSourceForm({ initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [publisher, setPublisher] = useState(initial?.publisher ?? "");
  const [sourceType, setSourceType] = useState(initial?.sourceType ?? "editorial");
  const [license, setLicense] = useState(initial?.license ?? "");
  const [licenseNotes, setLicenseNotes] = useState(initial?.licenseNotes ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [content, setContent] = useState(initial?.content ?? "");
  const [submitting, setSubmitting] = useState<null | "draft" | "index">(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") setContent(text);
    };
    reader.readAsText(file, "utf-8");
    // Reset so the same file can be re-selected if needed
    e.target.value = "";
  }

  function addTagFromInput() {
    const value = tagInput.trim();
    if (!value) return;
    if (!tags.includes(value)) setTags([...tags, value]);
    setTagInput("");
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  async function submit(mode: "draft" | "index", e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!title.trim()) return setError("Título é obrigatório.");
    if (!license) return setError("Licença é obrigatória.");
    if (mode === "index" && !content.trim()) {
      return setError("Sem conteúdo, não há como indexar.");
    }

    setSubmitting(mode);
    try {
      const res = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim() || null,
          publisher: publisher.trim() || null,
          sourceType,
          license,
          licenseNotes: licenseNotes.trim() || null,
          tags,
          content: content.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const { sourceId } = (await res.json()) as { sourceId: string };

      if (mode === "index") {
        const idxRes = await fetch(`/api/admin/knowledge/${sourceId}/index`, { method: "POST" });
        if (!idxRes.ok) {
          const data = await idxRes.json().catch(() => ({}));
          throw new Error(data?.error ?? `HTTP ${idxRes.status}`);
        }
      }

      router.push(`/admin/knowledge/${sourceId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(null);
    }
  }

  return (
    <form
      className="flex flex-col gap-6 rounded-2xl border bg-white p-6"
      style={{ borderColor: "var(--scriba-hairline)" }}
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex.: Institutas da Religião Cristã — Livro III, cap. 21"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="author">Autor</Label>
          <Input
            id="author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="ex.: João Calvino"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="publisher">Editora</Label>
          <Input
            id="publisher"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            placeholder="ex.: Cultura Cristã"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="source-type">Tipo *</Label>
          <AdminSelect
            id="source-type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
          >
            {EDITORIAL_SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {SOURCE_TYPE_LABEL[t]}
              </option>
            ))}
          </AdminSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="license">Licença *</Label>
          <AdminSelect
            id="license"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            required
            placeholder="Escolha a licença…"
          >
            {SELECTABLE_LICENSES.map((l) => (
              <option key={l} value={l}>
                {LICENSE_LABEL[l]}
              </option>
            ))}
          </AdminSelect>
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="license-notes">Notas sobre a licença</Label>
          <Input
            id="license-notes"
            value={licenseNotes}
            onChange={(e) => setLicenseNotes(e.target.value)}
            placeholder="ex.: Contrato assinado 2026-01, permite indexação interna sem distribuição"
          />
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-[color:var(--scriba-surface)] px-2.5 py-1 text-xs"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="text-[color:var(--scriba-ink-mute)] hover:text-[color:var(--scriba-ink)]"
                  aria-label={`Remover tag ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTagFromInput();
                } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                  setTags(tags.slice(0, -1));
                }
              }}
              placeholder="digite e Enter"
              className="w-40"
            />
          </div>
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="content">Conteúdo</Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-[color:var(--scriba-blue)] hover:underline"
            >
              Importar .md
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            className="hidden"
            onChange={handleFileUpload}
          />
          <MarkdownEditor
            value={content}
            onChange={setContent}
            minHeight={420}
            placeholder="Cole o texto integral. O chunker divide em parágrafos, alvo ~1200 chars por chunk com overlap de 200."
          />
          <p className="text-[11px] text-muted-foreground">
            Aceita **negrito**, *itálico*, listas, títulos (## Título), citações (&gt; ...) e
            código. Os títulos viram `section` dos chunks quando o chunker roda.
          </p>
        </div>
      </div>

      {error ? (
        <div
          className="rounded-md border p-3 text-sm"
          style={{ borderColor: "#E5B5A1", background: "#FAEAE5", color: "#8B4A31" }}
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={(e) => submit("draft", e)}
          disabled={!!submitting}
        >
          {submitting === "draft" ? "Salvando…" : "Salvar rascunho"}
        </Button>
        <Button type="button" onClick={(e) => submit("index", e)} disabled={!!submitting}>
          {submitting === "index" ? "Indexando…" : "Salvar e indexar"}
        </Button>
      </div>
    </form>
  );
}
