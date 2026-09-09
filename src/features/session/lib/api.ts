import type { FeedItem } from "@/lib/domain/feed";
import type { HallucinationReview, HallucinationScope } from "@/lib/domain/hallucination";
import type { ChunkEvent } from "@/lib/domain/recorder";
import type { SessionMode } from "@/lib/domain/session";
import type { SummaryPayload } from "@/lib/domain/summary";
import { type PassagePayload, parseVerseResponse } from "@/lib/domain/verse";

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
 * escolhe entre as pipelines ao vivo, a captura só-áudio e o modo transcrição.
 */
export async function requestCreateSession(body: {
  speakerName?: string | null;
  speakerLocation?: string | null;
  mode?: SessionMode;
  /** Só o modo youtube manda. A URL do vídeo, validada antes por
   * `parseYoutubeUrl` — a rota revalida com a mesma régua. */
  sourceUrl?: string | null;
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
 * PUT /api/sessions/:id/transcript. Fecha uma sessão do modo transcrição
 * gravando o texto capturado. Sem LLM: o corpo já é o transcript final que o
 * cliente montou a partir dos chunks.
 */
export async function requestSaveTranscript(body: {
  sessionId: string;
  transcript: string;
  durationMs?: number | null;
  title?: string | null;
  speakerName?: string | null;
  speakerLocation?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { sessionId, ...payload } = body;
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/transcript`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    const raw = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, message: raw?.error || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: (err as Error).message || "network error" };
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

/**
 * POST /api/hallucination-report. O usuário avisou que o Scriba entendeu
 * errado e escreveu uma nota curta. A resposta traz o veredito da auditoria
 * e, no escopo live, as chaves dos cards que devem sair do feed.
 */
export async function requestHallucinationReview(body: {
  sessionId: string;
  scope: HallucinationScope;
  note: string;
  text?: string;
  feedItems?: FeedItem[];
}): Promise<{ ok: true; review: HallucinationReview } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/hallucination-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = (await res.json().catch(() => ({}))) as Partial<HallucinationReview> & {
      error?: string;
    };
    if (!res.ok) {
      if (res.status === 429) {
        return { ok: false, message: "Muitos alertas seguidos. Aguarde um pouco e tente de novo." };
      }
      return { ok: false, message: "Não consegui analisar seu alerta agora. Tente novamente." };
    }
    return {
      ok: true,
      review: {
        verdict: raw.verdict ?? "acknowledged",
        message: typeof raw.message === "string" ? raw.message : "",
        removeKeys: Array.isArray(raw.removeKeys) ? raw.removeKeys : [],
      },
    };
  } catch {
    return { ok: false, message: "Falha de conexão ao enviar o alerta." };
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

/** O que a busca de conteúdo achou, e por qual das duas vias. */
export type ContentSearchResult = {
  /** Toda sessão que casou no servidor, pela transcrição ou pelo versículo. */
  ids: string[];
  /** sessionId → referência citada que casou. Vira a pastilha do cartão. */
  verses: Map<string, string>;
};

/**
 * GET /api/sessions/search?q=... — a metade da busca das listas que não roda no
 * cliente: o texto da pregação e os versículos citados, que não vão para a
 * lista e não devem ir.
 *
 * As duas vias voltam separadas porque o cartão precisa DIZER por que está ali.
 * "Trecho na transcrição" e "Jonas 1:1-17" são explicações diferentes, e um
 * cartão que aparece sem nenhuma — num termo que não bate com nada visível
 * nele — parece defeito.
 *
 * Devolve `null` — e não vazio — quando a rota não procurou (termo curto
 * demais) ou falhou. A distinção importa: com vazio a UI esconderia todos os
 * cartões que não casam pelo título, ou seja, uma falha de rede viraria "nada
 * encontrado".
 */
export async function requestContentSearch(q: string): Promise<ContentSearchResult | null> {
  try {
    const res = await fetch(`/api/sessions/search?q=${encodeURIComponent(q)}`, { method: "GET" });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      ids?: string[];
      verses?: { id?: string; reference?: string }[];
      skipped?: boolean;
    };
    if (body.skipped || !Array.isArray(body.ids)) return null;
    const verses = new Map<string, string>();
    for (const v of Array.isArray(body.verses) ? body.verses : []) {
      if (typeof v?.id === "string" && typeof v.reference === "string" && v.reference.trim()) {
        verses.set(v.id, v.reference.trim());
      }
    }
    return { ids: body.ids, verses };
  } catch {
    return null;
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

/**
 * Busca UMA passagem inteira — todos os versículos da faixa numa chamada só.
 *
 * A versão anterior pedia versículo a versículo, e um estudo com muitas
 * passagens estourava o rate limit: os versículos recusados voltavam vazios e
 * a tela ficava com números soltos sem texto.
 *
 * `res.ok` é conferido ANTES do corpo, e isso não é zelo: um 429 devolve
 * `{ error: "rate_limited" }`, que sem esta checagem virava uma passagem vazia
 * indistinguível de "esse versículo não existe".
 */
export async function requestPassage(
  reference: string
): Promise<{ ok: true; payload: PassagePayload } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/verse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, message: body.error || `HTTP ${res.status}` };
    }
    const parsedBody = parseVerseResponse(await res.json());
    const passage = parsedBody?.passages[0];
    if (!passage) return { ok: false, message: "passagem não encontrada" };
    return { ok: true, payload: passage };
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
): Promise<{ ok: true; text: string; suspect: boolean } | { ok: false; message: string }> {
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
}): Promise<{ ok: true; text: string; suspect: boolean } | { ok: false; message: string }> {
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
    return { ok: true, text: body.text ?? "", suspect: body.suspect === true };
  } catch (err) {
    return { ok: false, message: (err as Error).message ?? "network error" };
  }
}

/**
 * POST /api/youtube/import. Busca a legenda do vídeo em `source_url`, cobra as
 * moedas e roda o resumo inteiro. A resposta demora — é a mesma espera de um
 * resumo final sobre uma pregação de uma hora.
 *
 * Devolve o `error` cru da rota em vez de uma frase pronta: quem sabe traduzir
 * `no_captions` em português é a TELA, que tem espaço para explicar o que
 * fazer, e o mesmo código serve ao botão de tentar de novo.
 */
export async function requestYoutubeImport(body: {
  sessionId: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch("/api/youtube/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };

    const raw = (await res.json().catch(() => ({}))) as { error?: string };
    // 409 `session_already_imported` NÃO é erro para quem chama: significa que
    // um POST anterior chegou ao fim e a sessão está pronta. A página recarrega
    // depois de uma queda de rede e cai exatamente aqui — tratá-lo como falha
    // mostraria um erro em cima de uma importação que deu certo.
    if (res.status === 409 && raw?.error === "session_already_imported") return { ok: true };

    return { ok: false, error: raw?.error || `http_${res.status}`, status: res.status };
  } catch (err) {
    return { ok: false, error: (err as Error).message || "network_error", status: 0 };
  }
}
