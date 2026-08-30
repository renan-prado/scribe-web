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
 * Called from the "Nova gravação" dialog before the recorder mounts. `mode`
 * selects between the live enrichment pipelines and the audio-only capture.
 */
export async function requestCreateSession(body: {
  speakerName?: string | null;
  speakerLocation?: string | null;
  mode?: "live" | "audio_only";
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

/**
 * DELETE /api/sessions/:id. Discards a session row and its associated data —
 * used when the user stops a recording that captured zero transcribable speech
 * so the empty row created up-front doesn't linger in their history.
 */
export async function requestDeleteSession(id: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export type EntitySuggestion = { id: string; name: string; count: number };

/**
 * GET /api/speakers?q=... — search the current user's speakers, ordered by
 * how often they appear in past recordings.
 */
export async function requestSpeakerSuggestions(q: string): Promise<EntitySuggestion[]> {
  try {
    const url = `/api/speakers${q ? `?q=${encodeURIComponent(q)}` : ""}`;
    const res = await fetch(url, { method: "GET" });
    const body = (await res.json()) as { items?: EntitySuggestion[] };
    return Array.isArray(body?.items) ? body.items : [];
  } catch {
    return [];
  }
}

export async function requestLocationSuggestions(q: string): Promise<EntitySuggestion[]> {
  try {
    const url = `/api/locations${q ? `?q=${encodeURIComponent(q)}` : ""}`;
    const res = await fetch(url, { method: "GET" });
    const body = (await res.json()) as { items?: EntitySuggestion[] };
    return Array.isArray(body?.items) ? body.items : [];
  } catch {
    return [];
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
 * Legacy retry wrapper used by the audio-only recorder, which does not go
 * through the transcribe queue. Live mode uses {@link uploadChunk} directly
 * via `useTranscribeQueue`.
 */
export async function uploadChunkWithRetry(
  ev: ChunkEvent,
  prevText: string,
  sessionId?: string
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const backoffMs = [500, 1500];
  let last: { ok: false; message: string } = { ok: false, message: "unknown error" };
  for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
    const res = await uploadChunk({
      blob: ev.blob,
      index: ev.index,
      extension: ev.extension,
      durationMs: ev.durationMs,
      prevText,
      sessionId,
    });
    if (res.ok) return res;
    last = res;
    if (attempt < backoffMs.length) {
      await new Promise((r) => setTimeout(r, backoffMs[attempt]));
    }
  }
  return last;
}

/**
 * Upload a single recorder chunk to /api/transcribe. Single-attempt: the
 * transcribe queue (useTranscribeQueue) owns retry cadence, persistence, and
 * visibility/online triggers, so this helper stays a thin fetch wrapper.
 */
export async function uploadChunk(input: {
  blob: Blob;
  index: number;
  extension: string;
  durationMs: number;
  prevText: string;
  sessionId?: string;
}): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  try {
    const form = new FormData();
    const filename = `chunk-${input.index}.${input.extension}`;
    form.append("file", input.blob, filename);
    form.append("chunkIndex", String(input.index));
    form.append("extension", input.extension);
    form.append("prevText", input.prevText);
    form.append("durationMs", String(input.durationMs));
    if (input.sessionId) form.append("sessionId", input.sessionId);
    const res = await fetch("/api/transcribe", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) {
      return { ok: false, message: body?.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, text: body.text ?? "" };
  } catch (err) {
    return { ok: false, message: (err as Error).message ?? "network error" };
  }
}
