"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function KnowledgeReindexButton({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<{ chunks: number; tokens: number; ms: number } | null>(null);

  async function reindex() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/admin/knowledge/${sourceId}/index`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setOk({ chunks: data.chunkCount, tokens: data.tokens, ms: data.latencyMs });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button onClick={reindex} disabled={busy}>
          {busy ? "Indexando…" : "Reindexar este source"}
        </Button>
      </div>
      {ok ? (
        <p className="text-xs text-muted-foreground">
          Reindexado: {ok.chunks} chunks, {ok.tokens} tokens, {ok.ms}ms.
        </p>
      ) : null}
      {error ? (
        <div
          className="rounded-md border p-3 text-sm"
          style={{ borderColor: "#E5B5A1", background: "#FAEAE5", color: "#8B4A31" }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
