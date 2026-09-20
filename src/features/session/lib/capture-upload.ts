import type { SummaryPayload } from "@/lib/domain/summary";
import { type CaptureFailure, type CaptureMeta, loadParts } from "./capture-store";
import { tailSentences } from "./text";

/**
 * O caminho de uma gravação guardada até virar resumo: sessão, transcrição,
 * resumo. UM lugar só, e é o ponto da mudança.
 *
 * Ele morava dentro do `AudioStudio`, o que significava que só existia enquanto
 * a tela de gravação estivesse montada. Sair dela no meio de uma falha de rede
 * era abandonar o áudio num canto do IndexedDB que nenhuma outra tela olhava:
 * ele continuava lá (o gravador sempre guardou), mas nada no app voltava a
 * tentar, e nada em lugar nenhum dizia que ele existia. Quem saiu da tela achou
 * que tinha perdido a pregação, e para efeito prático tinha.
 *
 * Aqui ele é uma função pura sobre uma `CaptureMeta`, então a tela de gravação
 * e a fila de fundo (`capture-queue.ts`) percorrem exatamente o mesmo caminho.
 *
 * ## Retentar é seguro, e por quê
 *
 * **Moeda não é cobrada aqui.** A cobrança sai do navegador por minuto GRAVADO
 * (`useCoinTick`, `reason: "recording_minute"`), durante a pregação. As rotas
 * desta pipeline só exigem saldo positivo (`requireBalance`), nunca debitam.
 * Uma quinta tentativa de enviar custa o provedor, não a carteira de quem
 * gravou.
 *
 * **A sessão é criada UMA vez.** `sessionId` é gravado na linha da gravação
 * assim que o `POST /api/sessions` responde, então a tentativa seguinte reusa a
 * mesma sessão em vez de espalhar linhas vazias pelo banco. Elas nem
 * apareceriam na Biblioteca (`listSessions` filtra `ended_at is not null`), mas
 * seriam lixo silencioso crescendo a cada domingo sem sinal.
 *
 * ## A taxonomia da falha é o produto deste arquivo
 *
 * "Não consegui" não é resposta: a pessoa precisa saber se espera a rede voltar,
 * se espera o Scriba, se recarrega moedas, ou se baixa o arquivo porque nada
 * disso vai resolver. Cada saída daqui sai classificada (ver `CaptureFailure`),
 * e é a classificação que decide se a fila retenta sozinha.
 */
export type UploadPhase = "creating" | "transcribing" | "summarizing";

export type UploadResult =
  | { ok: true; sessionId: string; summary: SummaryPayload }
  | { ok: false; failure: CaptureFailure; message: string };

type Options = {
  onPhase?: (phase: UploadPhase) => void;
  /** Chamado assim que a sessão nasce, para quem chama gravar o id antes da
   *  transcrição começar. Uma falha depois daqui não pode criar outra sessão. */
  onSession?: (sessionId: string) => void | Promise<void>;
};

/**
 * A falha que não chegou ao servidor.
 *
 * `fetch` rejeita com `TypeError` tanto no avião quanto no DNS que não resolve
 * quanto no cabo arrancado, e nenhum desses distingue "sua internet caiu" de
 * "nossa internet caiu" do lado de cá. Para quem gravou é a mesma instrução
 * ("espere a conexão voltar, a gravação está aqui"), e prometer mais precisão
 * do que o navegador dá seria inventar.
 *
 * `navigator.onLine` só desempata a FRASE, nunca a decisão de retentar: ele
 * mente para os dois lados (diz `true` num wifi de hotel sem saída, diz `false`
 * em VPN), então é dica, não fato.
 */
const OFFLINE_MESSAGE =
  "Sem internet. Sua gravação está guardada neste aparelho e o Scriba vai enviar sozinho assim que a conexão voltar.";
const SERVER_MESSAGE =
  "O Scriba não conseguiu processar sua gravação agora. Ela está guardada neste aparelho e vou tentar de novo sozinho.";
const BALANCE_MESSAGE =
  "Suas moedas acabaram antes de o resumo ficar pronto. Sua gravação está guardada aqui: recarregue e toque em Tentar agora.";

function offline(): UploadResult {
  return { ok: false, failure: "offline", message: OFFLINE_MESSAGE };
}

/**
 * De um status HTTP para o que a pessoa tem de fazer.
 *
 * 402 é saldo (ver `requireBalance`). 5xx, 429 e 408 passam: é do nosso lado e
 * retentar resolve. 413 é o arquivo grande demais para a rota, e nenhuma espera
 * conserta isso. O resto dos 4xx cai em `server` de propósito: um 401 de sessão
 * expirada se resolve com a pessoa reabrindo o app, e tratá-lo como fatal
 * mandaria baixar o arquivo por causa de um login vencido.
 */
function fromStatus(status: number, detail: string): UploadResult {
  if (status === 402) return { ok: false, failure: "balance", message: BALANCE_MESSAGE };
  if (status === 413) {
    return {
      ok: false,
      failure: "fatal",
      message:
        "Uma parte da gravação ficou grande demais para a transcrição. O áudio não foi perdido: baixe o arquivo e nos avise.",
    };
  }
  return { ok: false, failure: "server", message: detail || SERVER_MESSAGE };
}

/** `true` quando o `fetch` nem chegou a falar com o servidor. */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof DOMException && err.name === "AbortError");
}

async function errorOf(res: Response): Promise<string> {
  const raw = (await res.json().catch(() => ({}))) as { error?: string };
  return raw?.error ? `${SERVER_MESSAGE} (${raw.error})` : SERVER_MESSAGE;
}

export async function uploadCapture(
  meta: CaptureMeta,
  { onPhase, onSession }: Options = {}
): Promise<UploadResult> {
  // A pergunta barata antes de qualquer trabalho: remontar os blobs de uma
  // pregação de uma hora custa memória, e no avião a resposta já é conhecida.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return offline();

  let sessionId = meta.sessionId;

  try {
    if (!sessionId) {
      onPhase?.("creating");
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "audio" }),
      });
      if (!res.ok) return fromStatus(res.status, await errorOf(res));
      const raw = (await res.json()) as { id?: string };
      if (!raw?.id) return { ok: false, failure: "server", message: SERVER_MESSAGE };
      sessionId = raw.id;
      await onSession?.(sessionId);
    }

    onPhase?.("transcribing");
    const parts = await loadParts(meta.id, meta.mimeType);
    if (parts.length === 0) {
      return {
        ok: false,
        failure: "fatal",
        message: "Não encontrei o áudio guardado desta gravação neste aparelho.",
      };
    }

    // O `prevText` de uma parte é a cauda da anterior: é o que dá contexto ao
    // modelo na emenda, que já caiu num silêncio (ver `useAudioCapture`).
    const texts: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const form = new FormData();
      form.append("file", parts[i], `gravacao-${i}.${meta.extension}`);
      form.append("extension", meta.extension);
      form.append("chunkIndex", String(i));
      form.append("sessionId", sessionId);
      form.append("durationMs", String(Math.round(meta.durationMs / parts.length)));
      if (i > 0) form.append("prevText", tailSentences(texts.join(" "), 2));

      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) return fromStatus(res.status, await errorOf(res));
      const raw = (await res.json()) as { text?: string };
      texts.push((raw.text ?? "").trim());
    }

    const transcript = texts.join(" ").replace(/\s+/g, " ").trim();
    if (!transcript) {
      return {
        ok: false,
        failure: "fatal",
        message:
          "A transcrição voltou vazia, não consegui ouvir fala nenhuma neste áudio. Baixe o arquivo para conferir.",
      };
    }

    onPhase?.("summarizing");
    const res = await fetch("/api/final-summary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, text: transcript, durationMs: meta.durationMs }),
    });
    if (!res.ok) return fromStatus(res.status, await errorOf(res));
    const raw = (await res.json()) as Partial<SummaryPayload> & { error?: string };
    // A rota responde 200 com `error` no corpo em alguns caminhos, e um resumo
    // que não existe não pode apagar o áudio que o geraria.
    if (raw?.error) return { ok: false, failure: "server", message: SERVER_MESSAGE };

    return {
      ok: true,
      sessionId,
      summary: {
        thinking: typeof raw.thinking === "string" ? raw.thinking : "",
        title: typeof raw.title === "string" ? raw.title : "",
        shortSummary: typeof raw.shortSummary === "string" ? raw.shortSummary : "",
        blocks: Array.isArray(raw.blocks) ? raw.blocks : [],
      },
    };
  } catch (err) {
    if (isNetworkError(err)) return offline();
    return { ok: false, failure: "server", message: SERVER_MESSAGE };
  }
}
