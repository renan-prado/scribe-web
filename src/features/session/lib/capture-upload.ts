import type { SummaryPayload } from "@/lib/domain/summary";
import { isOnline } from "@/shared/hooks/use-network-status";
import {
  type CaptureChunk,
  type CaptureFailure,
  type CaptureMeta,
  chunkBlob,
  chunkBodyBytes,
  loadChunks,
  splitChunk,
} from "./capture-store";
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

/**
 * A frase do passo, com a CONTAGEM quando a transcrição tem mais de um pedaço.
 *
 * Ela mora aqui, e não na tela, porque as telas são DUAS — o cartão da
 * Biblioteca e a própria tela de gravação — e elas guardavam cada uma a sua
 * cópia das mesmas três strings. Duas cópias de um texto é uma que um dia não
 * é atualizada.
 *
 * "(3 de 9)" é a diferença entre esperar e achar que travou: uma pregação de
 * uma hora que caiu numa parte só vira oito ou nove chamadas em fila, e vários
 * minutos de uma frase parada são indistinguíveis de um app travado. A
 * contagem só aparece quando há mais de um pedaço — no caminho normal, o de
 * uma chamada só, "(1 de 1)" seria ruído sobre uma frase que já estava certa.
 */
const PHASE_LABEL: Record<UploadPhase, string> = {
  creating: "Guardando a gravação…",
  transcribing: "Transcrevendo o áudio…",
  summarizing: "Montando o resumo…",
};

export function phaseLabel(
  phase: UploadPhase,
  chunk: { done: number; total: number } | null
): string {
  const label = PHASE_LABEL[phase];
  if (phase !== "transcribing" || !chunk) return label;
  return `${label} (${chunk.done} de ${chunk.total})`;
}

type UploadFailure = { ok: false; failure: CaptureFailure; message: string };

export type UploadResult = { ok: true; sessionId: string; summary: SummaryPayload } | UploadFailure;

type Options = {
  onPhase?: (phase: UploadPhase) => void;
  /**
   * Em que pedaço a transcrição está, quando ela tem mais de um.
   *
   * Uma pregação de uma hora que caiu numa parte só vira oito ou nove POSTs
   * em fila, e cada um leva o seu tempo. Sem isto, a tela mostra
   * "Transcrevendo o áudio…" parado por vários minutos, que é
   * indistinguível de travado — e a pessoa que acha que travou fecha a aba,
   * que é a única coisa que realmente estraga o resultado. O total CRESCE
   * quando um pedaço precisa ser partido, e isso é honesto: ele é o que
   * ainda falta, não uma promessa feita no começo.
   */
  onChunk?: (done: number, total: number) => void;
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

function offline(): UploadFailure {
  return { ok: false, failure: "offline", message: OFFLINE_MESSAGE };
}

/**
 * De um status HTTP para o que a pessoa tem de fazer.
 *
 * 402 é saldo (ver `requireBalance`). 5xx, 429 e 408 passam: é do nosso lado e
 * retentar resolve. O resto dos 4xx cai em `server` de propósito: um 401 de
 * sessão expirada se resolve com a pessoa reabrindo o app, e tratá-lo como
 * fatal mandaria baixar o arquivo por causa de um login vencido.
 *
 * **413 não aparece aqui de propósito.** O tamanho do POST de áudio deixou de
 * ser uma resposta ao usuário e virou uma conta do cliente: `loadChunks` corta
 * a gravação antes de enviar, e um 413 que ainda assim volte faz o pedaço ser
 * partido e reenviado (ver `transcribeChunks`), não vira aviso na tela.
 */
function fromStatus(status: number, detail: string): UploadFailure {
  if (status === 402) return { ok: false, failure: "balance", message: BALANCE_MESSAGE };
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

/**
 * O teto de bytes de um POST de transcrição, com folga sobre os 8 MB que
 * `/api/transcribe` aceita. A folga cobre o cabeçalho repetido no começo de
 * cada pedaço e o resto do multipart.
 *
 * **Ele é o teto do CLIENTE, e é por isso que ele existe.** O gravador já corta
 * a gravação em partes de ~7 MB enquanto grava, mas esse corte depende de um
 * `requestAnimationFrame` para achar o silêncio, e `requestAnimationFrame` não
 * roda com a aba em segundo plano — que é exatamente o que quem apoia o celular
 * no banco faz durante a pregação. O resultado era uma parte única de 30, 40
 * minutos, recusada com 413 no fim, com o áudio inteiro gravado e nenhuma
 * transcrição. Aqui o corte acontece na HORA DE ENVIAR, quando o arquivo já
 * está pronto e o tamanho dele é um fato e não uma previsão.
 */
const TRANSCRIBE_MAX_BYTES = 7 * 1024 * 1024;

type TranscribeResult = { ok: true; text: string } | UploadFailure;

/**
 * Transcreve os pedaços em ordem e emenda o texto.
 *
 * O `prevText` de um pedaço é a cauda do anterior: é o que dá contexto ao
 * modelo na emenda. Entre partes a emenda cai num silêncio (o gravador
 * procurou um antes de rodar), entre pedaços da MESMA parte ela cai onde o
 * fragmento acabou, que é onde ela mais precisa da cauda.
 *
 * **Um 413 aqui não é o fim: o pedaço é partido em dois e a fila continua.**
 * O corte por bytes trabalha com o tamanho no disco, e o multipart que sai
 * daqui é um pouco maior; um pedaço que encostar no teto do servidor volta
 * para a fila metade por vez, sem custo nenhum — a rota recusa pelo tamanho
 * ANTES de falar com o provedor. Só quando o pedaço é um fragmento só é que
 * não há mais o que partir, e aí a falha é honesta.
 */
async function transcribeChunks(
  chunks: CaptureChunk[],
  meta: CaptureMeta,
  sessionId: string,
  onChunk?: (done: number, total: number) => void
): Promise<TranscribeResult> {
  // A duração de cada POST é proporcional ao áudio NOVO que ele carrega, e não
  // à divisão igual pelo número de pedaços: é ela que vira custo no
  // `/admin/custos`, e o cabeçalho repetido não é minuto de sermão.
  const totalBytes = chunks.reduce((sum, c) => sum + chunkBodyBytes(c), 0);
  const queue = [...chunks];
  const texts: string[] = [];
  let index = 0;

  while (queue.length > 0) {
    const chunk = queue.shift() as CaptureChunk;
    // `index` são os que já voltaram, mais este, mais os que esperam. A conta
    // é refeita a cada volta porque um 413 acrescenta um pedaço à fila.
    onChunk?.(index + 1, index + 1 + queue.length);
    const share = totalBytes > 0 ? chunkBodyBytes(chunk) / totalBytes : 1 / chunks.length;
    const form = new FormData();
    form.append("file", chunkBlob(chunk, meta.mimeType), `gravacao-${index}.${meta.extension}`);
    form.append("extension", meta.extension);
    form.append("chunkIndex", String(index));
    form.append("sessionId", sessionId);
    form.append("durationMs", String(Math.round(meta.durationMs * share)));
    if (index > 0) form.append("prevText", tailSentences(texts.join(" "), 2));

    const res = await fetch("/api/transcribe", { method: "POST", body: form });

    if (res.status === 413) {
      const halves = splitChunk(chunk);
      if (!halves) {
        return {
          ok: false,
          failure: "fatal",
          message:
            "Não consegui preparar um trecho desta gravação para a transcrição. O áudio continua guardado neste aparelho.",
        };
      }
      queue.unshift(...halves);
      continue;
    }

    if (!res.ok) return fromStatus(res.status, await errorOf(res));
    const raw = (await res.json()) as { text?: string };
    texts.push((raw.text ?? "").trim());
    index += 1;
  }

  return { ok: true, text: texts.join(" ").replace(/\s+/g, " ").trim() };
}

export async function uploadCapture(
  meta: CaptureMeta,
  { onPhase, onSession, onChunk }: Options = {}
): Promise<UploadResult> {
  // A pergunta barata antes de qualquer trabalho: remontar os blobs de uma
  // pregação de uma hora custa memória, e no avião a resposta já é conhecida.
  if (!isOnline()) return offline();

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
    const chunks = await loadChunks(meta.id, TRANSCRIBE_MAX_BYTES);
    if (chunks.length === 0) {
      return {
        ok: false,
        failure: "fatal",
        message: "Não encontrei o áudio guardado desta gravação neste aparelho.",
      };
    }

    const transcribed = await transcribeChunks(chunks, meta, sessionId, onChunk);
    if (!transcribed.ok) return transcribed;
    const transcript = transcribed.text;
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
      body: JSON.stringify({
        sessionId,
        text: transcript,
        durationMs: meta.durationMs,
        // As notas escritas durante a pregação. Elas viajam na LINHA da
        // gravação, então uma retentativa de dois dias depois as leva junto.
        notes: meta.notes,
      }),
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
