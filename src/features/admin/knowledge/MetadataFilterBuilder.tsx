"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminSelect } from "@/features/admin/components/AdminSelect";
import { KNOWN_BIBLE_BOOKS } from "@/lib/knowledge/chunk";
import { INDEXED_BIBLE_TRANSLATIONS } from "@/lib/knowledge/labels";

type Mode = "none" | "bible" | "raw";

type Props = {
  /**
   * Emits the built filter object (or `null` to signal "no filter").
   * Parent should treat `null` as "omit this key from the request body".
   */
  onChange: (filter: Record<string, unknown> | null) => void;
};

const MODES: Array<{ id: Mode; label: string; description: string }> = [
  { id: "none", label: "Nenhum", description: "Busca em toda a biblioteca." },
  { id: "bible", label: "Bíblia", description: "Restringe por tradução, livro, capítulo…" },
  { id: "raw", label: "JSON avançado", description: "Um objeto JSON qualquer, casado com `@>`." },
];

const OT_BOOKS = KNOWN_BIBLE_BOOKS.filter((b) => b.testament === "OT");
const NT_BOOKS = KNOWN_BIBLE_BOOKS.filter((b) => b.testament === "NT");

export function MetadataFilterBuilder({ onChange }: Props) {
  const [mode, setMode] = useState<Mode>("none");

  // Bible-mode fields
  const [translation, setTranslation] = useState<string>("");
  const [book, setBook] = useState<string>("");
  const [chapter, setChapter] = useState<string>("");
  const [verseStart, setVerseStart] = useState<string>("");
  const [verseEnd, setVerseEnd] = useState<string>("");

  // Raw JSON mode
  const [rawJson, setRawJson] = useState<string>("");
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);

  // Compute the JSON that will actually be sent.
  const built = useMemo<{
    filter: Record<string, unknown> | null;
    preview: string;
    error: string | null;
  }>(() => {
    if (mode === "none") return { filter: null, preview: "", error: null };

    if (mode === "bible") {
      const filter: Record<string, unknown> = { kind: "bible" };
      if (translation) filter.translation = translation;
      if (book) filter.book = book;
      const chapterNum = Number.parseInt(chapter, 10);
      if (chapter && Number.isFinite(chapterNum)) filter.chapter = chapterNum;
      const startNum = Number.parseInt(verseStart, 10);
      if (verseStart && Number.isFinite(startNum)) filter.verseStart = startNum;
      const endNum = Number.parseInt(verseEnd, 10);
      if (verseEnd && Number.isFinite(endNum)) filter.verseEnd = endNum;
      return { filter, preview: JSON.stringify(filter, null, 2), error: null };
    }

    // raw
    const trimmed = rawJson.trim();
    if (!trimmed) return { filter: null, preview: "", error: null };
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return {
          filter: null,
          preview: trimmed,
          error: 'O JSON deve ser um objeto (ex.: {"kind":"bible"}).',
        };
      }
      return {
        filter: parsed as Record<string, unknown>,
        preview: JSON.stringify(parsed, null, 2),
        error: null,
      };
    } catch (err) {
      return {
        filter: null,
        preview: trimmed,
        error: `JSON inválido: ${(err as Error).message}`,
      };
    }
  }, [mode, translation, book, chapter, verseStart, verseEnd, rawJson]);

  // Propagate parsed filter to parent whenever the derived value changes.
  useEffect(() => {
    setRawJsonError(built.error);
    onChange(built.filter);
  }, [built.filter, built.error, onChange]);

  function switchMode(next: Mode) {
    setMode(next);
    // Reset only when moving TO "none" so switching between bible <-> raw
    // preserves the user's in-progress input.
    if (next === "none") {
      setTranslation("");
      setBook("");
      setChapter("");
      setVerseStart("");
      setVerseEnd("");
      setRawJson("");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">Filtro de metadata</Label>

      <div
        role="tablist"
        aria-label="Modo do filtro"
        className="inline-flex w-fit rounded-lg border p-0.5"
        style={{ borderColor: "var(--scriba-hairline)" }}
      >
        {MODES.map((m) => {
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchMode(m.id)}
              className="rounded-md px-2.5 py-1 text-xs transition-colors"
              style={{
                background: active ? "var(--scriba-blue)" : "transparent",
                color: active ? "white" : "var(--scriba-ink-mute)",
              }}
              title={m.description}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {mode === "none" ? (
        <p className="text-[11px] text-muted-foreground">
          Sem filtro. A busca considera todos os chunks (Bíblia + editorial).
        </p>
      ) : null}

      {mode === "bible" ? (
        <div
          className="grid grid-cols-2 gap-2 rounded-lg border p-3"
          style={{ borderColor: "var(--scriba-hairline)" }}
        >
          <div className="col-span-2 flex flex-col gap-1">
            <Label htmlFor="mf-translation" className="text-[11px]">
              Tradução
            </Label>
            <AdminSelect
              id="mf-translation"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
            >
              <option value="">Qualquer</option>
              {INDEXED_BIBLE_TRANSLATIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </AdminSelect>
          </div>

          <div className="col-span-2 flex flex-col gap-1">
            <Label htmlFor="mf-book" className="text-[11px]">
              Livro
            </Label>
            <AdminSelect id="mf-book" value={book} onChange={(e) => setBook(e.target.value)}>
              <option value="">Qualquer</option>
              <optgroup label="Antigo Testamento">
                {OT_BOOKS.map((b) => (
                  <option key={b.abbrev} value={b.abbrev}>
                    {b.display}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Novo Testamento">
                {NT_BOOKS.map((b) => (
                  <option key={b.abbrev} value={b.abbrev}>
                    {b.display}
                  </option>
                ))}
              </optgroup>
            </AdminSelect>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="mf-chapter" className="text-[11px]">
              Capítulo
            </Label>
            <Input
              id="mf-chapter"
              inputMode="numeric"
              value={chapter}
              onChange={(e) => setChapter(e.target.value.replace(/\D/g, ""))}
              placeholder="ex.: 8"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[11px]">Versos (início / fim)</Label>
            <div className="flex items-center gap-1">
              <Input
                aria-label="Verso inicial"
                inputMode="numeric"
                value={verseStart}
                onChange={(e) => setVerseStart(e.target.value.replace(/\D/g, ""))}
                placeholder="—"
                className="w-16"
              />
              <span className="text-[color:var(--scriba-ink-mute)]">→</span>
              <Input
                aria-label="Verso final"
                inputMode="numeric"
                value={verseEnd}
                onChange={(e) => setVerseEnd(e.target.value.replace(/\D/g, ""))}
                placeholder="—"
                className="w-16"
              />
            </div>
          </div>
        </div>
      ) : null}

      {mode === "raw" ? (
        <div className="flex flex-col gap-1">
          <textarea
            id="mf-raw"
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            placeholder='{"kind":"bible","book":"Rm","chapter":8}'
            className="min-h-[90px] rounded-md border bg-white p-2 font-mono text-xs"
            style={{ borderColor: "var(--scriba-hairline)" }}
          />
          {rawJsonError ? (
            <p className="text-[11px] text-[color:#A8715C]">{rawJsonError}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Objeto JSON. Só chunks cujo `metadata` contém todas as chaves casam.
            </p>
          )}
        </div>
      ) : null}

      {built.preview && mode !== "raw" ? (
        <details className="mt-1 text-[11px]">
          <summary className="cursor-pointer text-[color:var(--scriba-ink-mute)]">
            JSON gerado
          </summary>
          <pre
            className="mt-1 overflow-auto rounded-md border bg-white p-2 font-mono"
            style={{ borderColor: "var(--scriba-hairline)" }}
          >
            {built.preview}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
