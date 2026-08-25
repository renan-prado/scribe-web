"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LICENSES, SOURCE_TYPES } from "@/lib/knowledge/types";

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

const EDITORIAL_TYPES = SOURCE_TYPES.filter(
  (t) =>
    t !== "bible" &&
    t !== "session_summary" &&
    t !== "session_deepening" &&
    t !== "session_highlight"
);

const LICENSE_LABEL: Record<string, string> = {
  public_domain: "Domínio público",
  cc_by: "CC BY",
  cc_by_sa: "CC BY-SA",
  editorial_original: "Editorial próprio",
  licensed_agreement: "Licenciado (contrato)",
  user_content: "Conteúdo do usuário",
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
      className="flex flex-col gap-5 rounded-2xl border bg-white p-6"
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
          <select
            id="source-type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="h-9 rounded-md border bg-white px-3 text-sm"
            style={{ borderColor: "var(--scriba-hairline)" }}
          >
            {EDITORIAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="license">Licença *</Label>
          <select
            id="license"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            className="h-9 rounded-md border bg-white px-3 text-sm"
            style={{ borderColor: "var(--scriba-hairline)" }}
            required
          >
            <option value="">— selecione —</option>
            {LICENSES.filter((l) => l !== "user_content").map((l) => (
              <option key={l} value={l}>
                {LICENSE_LABEL[l] ?? l}
              </option>
            ))}
          </select>
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
          <Label htmlFor="content">Conteúdo (markdown/texto)</Label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[300px] rounded-md border bg-white p-3 font-mono text-sm"
            style={{ borderColor: "var(--scriba-hairline)" }}
            placeholder="Cole o texto integral. O chunker divide em parágrafos, alvo ~1200 chars por chunk com overlap de 200."
          />
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
