import type { Proposal } from "@/lib/domain/consolidate";
import type { Insight } from "@/lib/domain/insights";
import type { ChunkEvent } from "@/lib/domain/recorder";
import type { SummaryPayload, SummaryPhase } from "@/lib/domain/summary";
import type { VersePayload } from "@/lib/domain/verse";

/**
 * Client-side wrappers around the session's API routes. They centralize URL,
 * headers and body shapes so the page + hooks only speak in typed helpers.
 */

export type SummarizeRequest = {
  text: string;
  isFinal?: boolean;
  phase?: SummaryPhase;
  elapsedSec?: number;
  previous?: SummaryPayload;
};

/**
 * POST /api/summarize. Normalizes the response so the caller always gets a
 * `SummaryPayload` shape (empty blocks + strings when the model returned
 * nothing useful). Returns null on network/parse errors so effects can
 * short-circuit without throwing.
 */
export async function requestSummary(body: SummarizeRequest): Promise<SummaryPayload | null> {
  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as Partial<SummaryPayload> & { error?: string };
    if (payload?.error) return null;
    return {
      thinking: typeof payload.thinking === "string" ? payload.thinking : "",
      title: typeof payload.title === "string" ? payload.title : "",
      shortSummary: typeof payload.shortSummary === "string" ? payload.shortSummary : "",
      blocks: Array.isArray(payload.blocks) ? payload.blocks : [],
    };
  } catch {
    return null;
  }
}

export async function requestInsights(body: {
  text: string;
  blocks: SummaryPayload["blocks"];
  existingInsightIndices: number[];
}): Promise<Insight[]> {
  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as { insights?: Insight[] };
    return Array.isArray(payload?.insights) ? payload.insights : [];
  } catch {
    return [];
  }
}

export async function requestConsolidate(body: {
  blocks: SummaryPayload["blocks"];
  isFinal?: boolean;
}): Promise<Proposal[]> {
  const res = await fetch("/api/consolidate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as { proposals?: Proposal[] };
  return Array.isArray(payload?.proposals) ? payload.proposals : [];
}

export async function requestVerse(
  reference: string
): Promise<{ ok: true; payload: VersePayload } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/verse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference }),
    });
    const body = (await res.json()) as {
      reference?: string;
      text?: string;
      translation?: string;
      error?: string;
    };
    if (body?.error) return { ok: false, message: body.error };
    return {
      ok: true,
      payload: {
        reference: body.reference || reference,
        text: body.text || "",
        translation: body.translation || "",
      },
    };
  } catch (err) {
    return { ok: false, message: (err as Error).message || "falha ao buscar" };
  }
}

/**
 * Upload a single recorder chunk to /api/transcribe. Retries a couple of times
 * with backoff — chunks are the primary streaming unit, dropping one leaves a
 * visible hole in the transcript.
 */
export async function uploadChunkWithRetry(
  ev: ChunkEvent,
  prevText: string
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const backoffMs = [500, 1500];
  let lastMessage = "unknown error";
  for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
    try {
      const form = new FormData();
      const filename = `chunk-${ev.index}.${ev.extension}`;
      form.append("file", ev.blob, filename);
      form.append("chunkIndex", String(ev.index));
      form.append("extension", ev.extension);
      form.append("prevText", prevText);
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        lastMessage = body?.error ?? `HTTP ${res.status}`;
      } else {
        return { ok: true, text: body.text ?? "" };
      }
    } catch (err) {
      lastMessage = (err as Error).message ?? "network error";
    }
    if (attempt < backoffMs.length) {
      await new Promise((r) => setTimeout(r, backoffMs[attempt]));
    }
  }
  return { ok: false, message: lastMessage };
}
