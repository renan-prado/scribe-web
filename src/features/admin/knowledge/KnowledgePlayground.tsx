"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminSelect } from "@/features/admin/components/AdminSelect";
import { SOURCE_TYPE_LABEL } from "@/lib/knowledge/labels";

type SearchResult = {
  chunkId: number;
  sourceId: string;
  sourceTitle: string;
  sourceType: string;
  section: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

type Usage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

type Props = {
  defaultSystemPrompt: string;
  sourceTypes: string[];
};

const STORAGE_KEY_PROMPT = "scribe.knowledge.playground.systemPrompt";
const STORAGE_KEY_MODEL = "scribe.knowledge.playground.model";

export function KnowledgePlayground({ defaultSystemPrompt, sourceTypes }: Props) {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(10);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [metadataFilter, setMetadataFilter] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompt);
  const [model, setModel] = useState<"gpt-4o-mini" | "gpt-4o">("gpt-4o-mini");

  const [searchBusy, setSearchBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searchMs, setSearchMs] = useState<number | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [chatMs, setChatMs] = useState<number | null>(null);

  // Restore saved system prompt / model.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = window.localStorage.getItem(STORAGE_KEY_PROMPT);
    if (p) setSystemPrompt(p);
    const m = window.localStorage.getItem(STORAGE_KEY_MODEL);
    if (m === "gpt-4o" || m === "gpt-4o-mini") setModel(m);
  }, []);

  function persistPrompt(value: string) {
    setSystemPrompt(value);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY_PROMPT, value);
  }

  function persistModel(value: "gpt-4o-mini" | "gpt-4o") {
    setModel(value);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY_MODEL, value);
  }

  function parseMetadataFilter(): Record<string, unknown> | null {
    if (!metadataFilter.trim()) return null;
    try {
      const parsed = JSON.parse(metadataFilter);
      if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
        throw new Error("metadata filter must be a JSON object");
      }
      return parsed as Record<string, unknown>;
    } catch (err) {
      throw new Error(`metadata filter inválido: ${(err as Error).message}`);
    }
  }

  async function runSearch() {
    if (!query.trim() || searchBusy) return;
    setError(null);
    setAnswer(null);
    setUsage(null);
    setChatMs(null);
    setSearchBusy(true);
    try {
      const meta = parseMetadataFilter();
      const res = await fetch("/api/admin/knowledge/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          topK,
          sourceTypes: selectedTypes.length ? selectedTypes : undefined,
          metadataFilter: meta,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setResults(data.results as SearchResult[]);
      setSearchMs(data.latencyMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearchBusy(false);
    }
  }

  async function runGenerate() {
    if (!query.trim() || genBusy) return;
    setError(null);
    setGenBusy(true);
    try {
      const meta = parseMetadataFilter();
      const res = await fetch("/api/admin/knowledge/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          topK,
          sourceTypes: selectedTypes.length ? selectedTypes : undefined,
          metadataFilter: meta,
          systemPrompt,
          model,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setResults(data.chunks as SearchResult[]);
      setAnswer(data.answer);
      setUsage(data.usage);
      setSearchMs(data.searchLatencyMs);
      setChatMs(data.chatLatencyMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenBusy(false);
    }
  }

  function toggleType(t: string) {
    setSelectedTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* controls */}
      <aside
        className="flex flex-col gap-4 rounded-2xl border bg-white p-5"
        style={{ borderColor: "var(--scriba-hairline)" }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pg-query">Query</Label>
          <textarea
            id="pg-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[80px] rounded-md border bg-white p-2 text-sm"
            style={{ borderColor: "var(--scriba-hairline)" }}
            placeholder="ex.: providência divina no sofrimento"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="pg-topk" className="text-xs">
              Nº de resultados
            </Label>
            <span className="font-mono text-xs text-[color:var(--scriba-ink-mute)]">{topK}</span>
          </div>
          <input
            id="pg-topk"
            type="range"
            min={1}
            max={30}
            value={topK}
            onChange={(e) => setTopK(Number.parseInt(e.target.value, 10))}
            className="w-full"
          />
          <p className="text-[11px] text-muted-foreground">
            Quantos trechos a busca vetorial retorna (e passa pro modelo, se você gerar resposta).
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Tipos de fonte</Label>
          <div className="flex flex-wrap gap-1.5">
            {sourceTypes.map((t) => {
              const active = selectedTypes.includes(t);
              const label = SOURCE_TYPE_LABEL[t as keyof typeof SOURCE_TYPE_LABEL] ?? t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className="rounded-full border px-2.5 py-0.5 text-xs"
                  style={{
                    borderColor: active ? "var(--scriba-blue)" : "var(--scriba-hairline)",
                    background: active ? "#EAF4FE" : "transparent",
                    color: active ? "var(--scriba-blue)" : "var(--scriba-ink-mute)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">Vazio = todos.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pg-meta" className="text-xs">
            Filtro de metadata (JSON)
          </Label>
          <Input
            id="pg-meta"
            value={metadataFilter}
            onChange={(e) => setMetadataFilter(e.target.value)}
            placeholder='{"kind":"bible","book":"Rm","chapter":8}'
            className="font-mono text-xs"
          />
        </div>

        <hr style={{ borderColor: "var(--scriba-hairline)" }} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pg-system" className="text-xs">
            System prompt (persistido no navegador)
          </Label>
          <textarea
            id="pg-system"
            value={systemPrompt}
            onChange={(e) => persistPrompt(e.target.value)}
            className="min-h-[140px] rounded-md border bg-white p-2 font-mono text-[11px]"
            style={{ borderColor: "var(--scriba-hairline)" }}
          />
          <button
            type="button"
            onClick={() => persistPrompt(defaultSystemPrompt)}
            className="self-end text-[11px] text-[color:var(--scriba-ink-mute)] hover:text-[color:var(--scriba-blue)]"
          >
            restaurar padrão
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pg-model" className="text-xs">
            Modelo (geração)
          </Label>
          <AdminSelect
            id="pg-model"
            value={model}
            onChange={(e) => persistModel(e.target.value as "gpt-4o-mini" | "gpt-4o")}
          >
            <option value="gpt-4o-mini">gpt-4o-mini</option>
            <option value="gpt-4o">gpt-4o</option>
          </AdminSelect>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={runSearch} disabled={searchBusy || genBusy || !query.trim()}>
            {searchBusy ? "Buscando…" : "Buscar"}
          </Button>
          <Button
            variant="outline"
            onClick={runGenerate}
            disabled={genBusy || searchBusy || !query.trim()}
          >
            {genBusy ? "Gerando…" : "Gerar resposta com estes chunks"}
          </Button>
        </div>

        {error ? (
          <div
            className="rounded-md border p-3 text-xs"
            style={{ borderColor: "#E5B5A1", background: "#FAEAE5", color: "#8B4A31" }}
          >
            {error}
          </div>
        ) : null}
      </aside>

      {/* results */}
      <section className="flex flex-col gap-4">
        {answer ? (
          <div
            className="rounded-2xl border bg-white p-5"
            style={{ borderColor: "var(--scriba-hairline)" }}
          >
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--scriba-ink-mute)]">
              Resposta ({model})
              {usage
                ? ` · ${usage.promptTokens ?? "?"} in / ${usage.completionTokens ?? "?"} out`
                : ""}
              {chatMs ? ` · chat ${chatMs}ms` : ""}
            </div>
            <div className="whitespace-pre-wrap text-sm">{answer}</div>
          </div>
        ) : null}

        <div className="text-xs text-muted-foreground">
          {results
            ? `${results.length} chunks retornados${searchMs ? ` em ${searchMs}ms` : ""}`
            : "Sem busca ainda."}
        </div>

        <div className="flex flex-col gap-3">
          {results?.map((r, i) => (
            <article
              key={r.chunkId}
              className="rounded-xl border bg-white p-4 text-sm"
              style={{ borderColor: "var(--scriba-hairline)" }}
            >
              <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="mr-2 inline-flex items-center rounded bg-[color:var(--scriba-surface)] px-1.5 py-0.5 font-mono text-[10px]">
                    #{i + 1}
                  </span>
                  <span className="font-medium">{r.sourceTitle}</span>
                  {r.section ? (
                    <span className="ml-2 text-[color:var(--scriba-ink-mute)]">{r.section}</span>
                  ) : null}
                </div>
                <span className="font-mono text-xs text-[color:var(--scriba-ink-mute)]">
                  sim {r.similarity.toFixed(3)} ·{" "}
                  {SOURCE_TYPE_LABEL[r.sourceType as keyof typeof SOURCE_TYPE_LABEL] ??
                    r.sourceType}
                </span>
              </header>
              <p className="whitespace-pre-wrap">
                {r.content.length > 700 ? `${r.content.slice(0, 700)}…` : r.content}
              </p>
              <details className="mt-2 text-[11px]">
                <summary className="cursor-pointer text-[color:var(--scriba-ink-mute)]">
                  metadata
                </summary>
                <pre className="overflow-auto whitespace-pre">
                  {JSON.stringify(r.metadata, null, 2)}
                </pre>
              </details>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
