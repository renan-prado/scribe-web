import type { FeedItem } from "@/lib/domain/feed";
import type { ChunkEvent } from "@/lib/domain/recorder";
import type { SummaryPayload } from "@/lib/domain/summary";
import type { VersePayload } from "@/lib/domain/verse";

/**
 * Client-side wrappers around the session's API routes. They centralize URL,
 * headers and body shapes so the page + hooks only speak in typed helpers.
 */

/**
 * POST /api/bible. Extrai APENAS citedVerse do trecho recente. O cliente
 * já filtrou via regex que há sinal de menção bíblica antes de chamar.
 */
export async function requestBible(body: {
  text: string;
  existingItems: FeedItem[];
  sermonAtMs?: number;
  sessionId?: string;
}): Promise<FeedItem[]> {
  try {
    const res = await fetch("/api/bible", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as { items?: FeedItem[] };
    return Array.isArray(payload?.items) ? payload.items : [];
  } catch {
    return [];
  }
}

/**
 * POST /api/insights. Enriquecimento (speakerHighlight, speakerCitation,
 * relatedVerse, context, suggestedQuote) sobre a transcrição corrente.
 * citedVerse fica com /api/bible.
 */
export async function requestInsights(body: {
  text: string;
  existingItems: FeedItem[];
  sermonAtMs?: number;
  sessionId?: string;
}): Promise<FeedItem[]> {
  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as { items?: FeedItem[] };
    return Array.isArray(payload?.items) ? payload.items : [];
  } catch {
    return [];
  }
}

/**
 * POST /api/sermon-echo. Picks ONE literal phrase the speaker just said from
 * the recent transcript tail, to break up runs of AI-authored cards in the
 * feed. May legitimately return an empty items array when nothing in the
 * recent tail qualifies.
 */
export async function requestEcho(body: {
  text: string;
  existingItems: FeedItem[];
  sermonAtMs?: number;
  sessionId?: string;
}): Promise<FeedItem[]> {
  try {
    const res = await fetch("/api/sermon-echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as { items?: FeedItem[] };
    return Array.isArray(payload?.items) ? payload.items : [];
  } catch {
    return [];
  }
}

/**
 * POST /api/final-summary. Single-shot after the recording stops: feeds the
 * full transcript and the curated live feed to the LLM and gets back the
 * definitive SummaryPayload rendered by SummaryView.
 */
export async function requestFinalSummary(body: {
  sessionId: string;
  text: string;
  feedItems: FeedItem[];
  durationMs?: number;
  speakerName?: string;
  speakerLocation?: string;
}): Promise<{ payload: SummaryPayload; saved: boolean } | null> {
  try {
    const res = await fetch("/api/final-summary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = (await res.json()) as Partial<SummaryPayload> & {
      error?: string;
      saved?: boolean;
    };
    if (raw?.error) return null;
    return {
      payload: {
        thinking: typeof raw.thinking === "string" ? raw.thinking : "",
        title: typeof raw.title === "string" ? raw.title : "",
        shortSummary: typeof raw.shortSummary === "string" ? raw.shortSummary : "",
        blocks: Array.isArray(raw.blocks) ? raw.blocks : [],
      },
      saved: raw?.saved === true,
    };
  } catch {
    return null;
  }
}

/**
 * POST /api/sessions. Creates the empty row that anchors /recording/{id}/live.
 * Called from the "Nova gravação" dialog before the recorder mounts.
 */
export async function requestCreateSession(body: {
  speakerName?: string | null;
  speakerLocation?: string | null;
}): Promise<{ id: string } | { error: string }> {
  try {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = (await res.json()) as { id?: string; error?: string };
    if (raw?.id) return { id: raw.id };
    return { error: raw?.error || `HTTP ${res.status}` };
  } catch (err) {
    return { error: (err as Error).message || "network error" };
  }
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
      error?: string;
    };
    if (body?.error) return { ok: false, message: body.error };
    return {
      ok: true,
      payload: {
        reference: body.reference || reference,
        text: body.text || "",
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
  prevText: string,
  sessionId?: string
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
      form.append("durationMs", String(ev.durationMs));
      if (sessionId) form.append("sessionId", sessionId);
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
