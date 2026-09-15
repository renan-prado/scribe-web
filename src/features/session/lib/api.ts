import type { HallucinationReview } from "@/lib/domain/hallucination";
import type { SessionMode } from "@/lib/domain/session";
import type { SummaryPayload } from "@/lib/domain/summary";
import { type PassagePayload, parseVerseResponse } from "@/lib/domain/verse";

/**
 * Client-side wrappers around the session's API routes. They centralize URL,
 * headers and body shapes so the page + hooks only speak in typed helpers.
 */

/**
 * POST /api/final-summary. Uma chamada só, depois que a gravação para: manda a
 * transcrição inteira e recebe de volta o `SummaryPayload` que o `SummaryView`
 * desenha.
 */
export async function requestFinalSummary(body: {
  sessionId: string;
  text: string;
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
   * `parseYoutubeUrl`, a rota revalida com a mesma régua. */
  sourceUrl?: string | null;
  /** Só o modo youtube, e só quando a pessoa pediu um trecho do vídeo. Em ms;
   * a rota revalida com `parseClipRange`, o mesmo do formulário. */
  startMs?: number | null;
  endMs?: number | null;
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
 * POST /api/hallucination-report. O usuário avisou que o Scriba entendeu
 * errado e escreveu uma nota curta. A resposta traz o veredito da auditoria
 * sobre o resumo já salvo.
 */
export async function requestHallucinationReview(body: {
  sessionId: string;
  note: string;
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
      },
    };
  } catch {
    return { ok: false, message: "Falha de conexão ao enviar o alerta." };
  }
}

export type EntitySuggestion = { id: string; name: string; count: number };

/**
 * GET /api/speakers?q=..., search the current user's speakers, ordered by
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
 * GET /api/sessions/search?q=..., a metade da busca das listas que não roda no
 * cliente: o texto da pregação e os versículos citados, que não vão para a
 * lista e não devem ir.
 *
 * As duas vias voltam separadas porque o cartão precisa DIZER por que está ali.
 * "Trecho na transcrição" e "Jonas 1:1-17" são explicações diferentes, e um
 * cartão que aparece sem nenhuma, num termo que não bate com nada visível
 * nele, parece defeito.
 *
 * Devolve `null`, e não vazio, quando a rota não procurou (termo curto
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
 * Busca UMA passagem inteira, todos os versículos da faixa numa chamada só.
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
 * POST /api/youtube/import. Busca a legenda do vídeo em `source_url`, cobra as
 * moedas e roda o resumo inteiro. A resposta demora, é a mesma espera de um
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
    // depois de uma queda de rede e cai exatamente aqui, tratá-lo como falha
    // mostraria um erro em cima de uma importação que deu certo.
    if (res.status === 409 && raw?.error === "session_already_imported") return { ok: true };

    return { ok: false, error: raw?.error || `http_${res.status}`, status: res.status };
  } catch (err) {
    return { ok: false, error: (err as Error).message || "network_error", status: 0 };
  }
}
