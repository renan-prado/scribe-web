import type { FeedItem } from "@/lib/domain/feed";
import type { ChunkEvent } from "@/lib/domain/recorder";
import type { SummaryPayload } from "@/lib/domain/summary";
import type { VersePayload } from "@/lib/domain/verse";

/**
 * Client-side wrappers around the session's API routes. They centralize URL,
 * headers and body shapes so the page + hooks only speak in typed helpers.
 */

/**
 * POST /api/extract. Pulls speaker-sourced feed items (cited verses, speaker
 * highlights, attributed citations) from the recent transcript tail. Also
 * returns a transient `thinking` note the session view surfaces at the
 * bottom while recording. Returns an empty result on network/parse errors
 * so effects can no-op cleanly.
 */
export async function requestExtract(body: {
  text: string;
  existingItems: FeedItem[];
  sermonAtMs?: number;
}): Promise<{
  items: FeedItem[];
  thinking: string;
  readingMode: boolean;
  translationHint: string;
}> {
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as {
      items?: FeedItem[];
      thinking?: string;
      readingMode?: boolean;
      translationHint?: string;
    };
    return {
      items: Array.isArray(payload?.items) ? payload.items : [],
      thinking: typeof payload?.thinking === "string" ? payload.thinking : "",
      readingMode: payload?.readingMode === true,
      translationHint: typeof payload?.translationHint === "string" ? payload.translationHint : "",
    };
  } catch {
    return { items: [], thinking: "", readingMode: false, translationHint: "" };
  }
}

/**
 * POST /api/suggest. AI-authored enrichment (related verses, context,
 * suggested quotes) grounded in the current transcript. Same error handling
 * shape as requestExtract.
 */
export async function requestSuggest(body: {
  text: string;
  existingItems: FeedItem[];
  sermonAtMs?: number;
}): Promise<FeedItem[]> {
  try {
    const res = await fetch("/api/suggest", {
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
  text: string;
  feedItems: FeedItem[];
  durationMs?: number;
  speakerName?: string;
  speakerLocation?: string;
}): Promise<{ payload: SummaryPayload; sessionId: string | null } | null> {
  try {
    const res = await fetch("/api/final-summary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = (await res.json()) as Partial<SummaryPayload> & {
      error?: string;
      sessionId?: string | null;
    };
    if (raw?.error) return null;
    return {
      payload: {
        thinking: typeof raw.thinking === "string" ? raw.thinking : "",
        title: typeof raw.title === "string" ? raw.title : "",
        shortSummary: typeof raw.shortSummary === "string" ? raw.shortSummary : "",
        blocks: Array.isArray(raw.blocks) ? raw.blocks : [],
      },
      sessionId: typeof raw.sessionId === "string" ? raw.sessionId : null,
    };
  } catch {
    return null;
  }
}

export async function requestVerse(
  reference: string,
  translation?: string | null
): Promise<{ ok: true; payload: VersePayload } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/verse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(translation ? { reference, translation } : { reference }),
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
