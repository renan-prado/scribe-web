import "server-only";

/**
 * A implementação Supadata de `fetchYoutubeTranscript`. O único arquivo do
 * repositório que sabe o nome do provedor de legendas, ver `transcript.ts`
 * para o contrato e o porquê da indireção.
 *
 * ## Por que um provedor pago para algo que parece grátis
 *
 * A legenda do YouTube é pública e o endpoint `timedtext` é aberto. Não
 * funciona do servidor: desde o fim de 2024 o YouTube pune reputação de IP de
 * datacenter e continua servindo IP residencial normalmente. O efeito é o pior
 * possível de depurar, `youtube-transcript` e afins funcionam na máquina de
 * quem escreveu e devolvem 429 e página de bot-check depois de ~100 requisições
 * a partir da Vercel. A API oficial (`captions.download`) exige OAuth do DONO
 * do vídeo, então não serve. E o navegador esbarra em CORS.
 *
 * Sobravam proxy residencial próprio (custo recorrente, mais manutenção do
 * parser toda vez que o YouTube muda o formato da resposta) ou um provedor
 * hospedado. Para o tamanho do Scriba, hospedado.
 *
 * ## Preço, e o que ele obriga
 *
 * 1 crédito por vídeo com legenda existente, INDEPENDENTE da duração
 * (~R$ 0,03). É o que torna `COIN_COSTS.youtubeImport` fixo defensável: o
 * único custo que cresce com a duração do vídeo é a transcrição na entrada do
 * resumo, não esta chamada.
 *
 * O modo `generate` (Whisper deles, para vídeo sem legenda) custa 2 créditos
 * por MINUTO e volta assíncrono. Está fora, ver `transcript.ts`.
 */

import { serverEnv } from "@/lib/env/server";
import { createLogger } from "@/lib/log";
import type { YoutubeTranscriptResult } from "./transcript";

const log = createLogger("supadata");

const ENDPOINT = "https://api.supadata.ai/v1/transcript";

/**
 * 30s. A busca de legenda pronta mede 1-3s; um upstream que passa de trinta
 * segundos está com problema, e a rota que chama isto ainda tem um resumo
 * inteiro de LLM pela frente dentro do orçamento da função.
 */
const TIMEOUT_MS = 30_000;

/** Segmento da resposta quando `text=false`. */
type SupadataSegment = {
  text?: unknown;
  offset?: unknown;
  duration?: unknown;
};

type SupadataBody = {
  content?: unknown;
  lang?: unknown;
  error?: unknown;
  message?: unknown;
};

function asFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Junta os segmentos num texto corrido e mede onde o último termina.
 *
 * **Pedimos `text=false` de propósito, mesmo querendo texto corrido.** Com
 * `text=true` a Supadata devolve a string já montada e NENHUM tempo, e é do
 * `offset + duration` do último segmento que sai a duração do vídeo, que é o
 * que decide se ele cabe no teto e o que vai para `sessions.duration_ms`. A
 * alternativa era uma segunda chamada de metadados, custando um segundo
 * crédito por vídeo para saber algo que já veio junto.
 */
function foldSegments(segments: SupadataSegment[]): { text: string; durationMs: number } {
  const parts: string[] = [];
  let durationMs = 0;

  for (const segment of segments) {
    if (typeof segment?.text === "string") {
      const trimmed = segment.text.trim();
      if (trimmed) parts.push(trimmed);
    }
    const end = asFiniteNumber(segment?.offset) + asFiniteNumber(segment?.duration);
    if (end > durationMs) durationMs = end;
  }

  return { text: parts.join(" ").replace(/\s+/g, " ").trim(), durationMs };
}

export async function fetchSupadataTranscript(videoUrl: string): Promise<YoutubeTranscriptResult> {
  const apiKey = serverEnv.SUPADATA_API_KEY;
  if (!apiKey) {
    // Configuração ausente, não falha do usuário. A rota vira 503 e a tela diz
    // "importação indisponível", nunca "esse vídeo não tem legenda", que é a
    // mensagem errada e mandaria a pessoa tentar outro link para sempre.
    //
    // A `message` nomeia a VARIÁVEL de propósito: sem ela o log sai como
    // `provider_unavailable, message: undefined`, e quem estiver com o dev de
    // pé precisa abrir este arquivo para descobrir que o problema é uma linha
    // em branco no `.env`. O ambiente entra junto porque o erro mais provável
    // não é a chave não existir, é ela existir só no `.env.prod`, que é o
    // arquivo que `npm run dev` NÃO lê.
    return {
      ok: false,
      error: "provider_unavailable",
      message: `SUPADATA_API_KEY ausente (NODE_ENV=${process.env.NODE_ENV})`,
    };
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("url", videoUrl);
  // `pt` é preferência, não exigência: sem legenda em português a Supadata
  // devolve a que existe, e um sermão legendado só em espanhol ainda resume.
  url.searchParams.set("lang", "pt");
  url.searchParams.set("text", "false");
  url.searchParams.set("mode", "native");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "x-api-key": apiKey },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    const message = (err as Error).name === "AbortError" ? "timeout" : (err as Error).message;
    return { ok: false, error: "provider_failed", message };
  } finally {
    clearTimeout(timeout);
  }

  // Cabeçalho que a Supadata devolve com quantos créditos a chamada consumiu.
  // Vai para o log porque é a única forma de conciliar a fatura deles com o
  // número de importações do nosso ledger, se um dia divergir, é aqui que a
  // diferença aparece.
  const billed = response.headers.get("x-billable-requests");

  let body: SupadataBody = {};
  try {
    body = (await response.json()) as SupadataBody;
  } catch {
    // 200 com corpo ilegível é falha do provedor, não vídeo sem legenda.
    if (response.ok) {
      return { ok: false, error: "provider_failed", message: "resposta ilegível" };
    }
  }

  if (!response.ok) {
    // 206 é o código que a Supadata usa para "existe, mas não tem legenda", e
    // é a recusa que mais acontece. 404/403 são vídeo inexistente, privado ou
    // com restrição. Todo o resto é problema deles, e vale tentar de novo.
    if (response.status === 206) return { ok: false, error: "no_captions" };
    if (response.status === 404 || response.status === 403) {
      return { ok: false, error: "video_not_found" };
    }
    const detail =
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : `HTTP ${response.status}`;
    return { ok: false, error: "provider_failed", message: detail };
  }

  // 200 com jobId em vez de conteúdo é a resposta assíncrona do modo
  // `generate`. Pedimos `native`, então não deveria acontecer, mas se o
  // provedor mudar o default, o tratamento certo é recusar, e não seguir com
  // `content` indefinido e gravar uma transcrição vazia por cima da sessão.
  if (!Array.isArray(body.content)) {
    return {
      ok: false,
      error: "provider_failed",
      message: "resposta sem segmentos de legenda",
    };
  }

  const { text, durationMs } = foldSegments(body.content as SupadataSegment[]);
  if (!text) return { ok: false, error: "no_captions" };

  log.debug("ok", { chars: text.length, durationMs, billed, lang: body.lang });

  return {
    ok: true,
    text,
    lang: typeof body.lang === "string" ? body.lang : "pt",
    durationMs,
  };
}
