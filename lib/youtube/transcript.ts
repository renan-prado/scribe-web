import "server-only";

/**
 * A INTERFACE de "buscar a legenda de um vídeo" — o contrato que a rota
 * conhece, sem nome de provedor dentro.
 *
 * Ela existe porque o provedor é a peça deste modo com maior chance de ser
 * trocada: o mercado de APIs de legenda do YouTube é jovem, os preços mudam
 * por trimestre, e a razão de existirem (o YouTube bloquear IP de datacenter)
 * é uma corrida que nenhum deles ganha para sempre. Trocar de fornecedor tem
 * de ser escrever um segundo arquivo ao lado de `supadata.ts` e mudar UMA
 * linha no `fetchYoutubeTranscript` do fim — não caçar `x-api-key` espalhado
 * por dentro de uma rota que também cobra moedas e chama a OpenAI.
 *
 * Os erros são um union FECHADO, e é ele que a rota traduz em status HTTP e em
 * frase na tela. Um provedor novo tem de encaixar as falhas dele aqui; se não
 * couber, o union cresce e o compilador aponta os dois lugares que precisam
 * saber disso.
 */

import { createLogger } from "@/lib/log";
import { fetchSupadataTranscript } from "./supadata";

const log = createLogger("youtube-transcript");

export type YoutubeTranscriptError =
  /** Falta `SUPADATA_API_KEY`. É configuração nossa, não erro do usuário. */
  | "provider_unavailable"
  /** O vídeo não existe, é privado, ou foi removido. */
  | "video_not_found"
  /** O vídeo existe e NÃO tem legenda nenhuma. A recusa mais comum. */
  | "no_captions"
  /** Rede, timeout, 5xx do provedor, cota estourada. Vale tentar de novo. */
  | "provider_failed";

export type YoutubeTranscriptResult =
  | {
      ok: true;
      /** A legenda inteira como um texto corrido. */
      text: string;
      /** Idioma que o provedor devolveu (ISO 639-1). */
      lang: string;
      /**
       * Duração do vídeo em ms, DERIVADA do fim do último segmento de legenda.
       *
       * É uma aproximação por baixo — a legenda acaba quando a fala acaba, e
       * o vídeo pode seguir com música por mais um minuto. Serve para as duas
       * coisas que precisam dela: recusar o que passa de
       * `YOUTUBE_MAX_DURATION_MS` e preencher `sessions.duration_ms`, e em
       * nenhuma das duas um minuto de vinheta muda a resposta.
       *
       * Vem daqui, e não de uma chamada de metadados, porque aquela chamada
       * custaria um segundo crédito por vídeo para responder o que a legenda
       * já respondeu de graça.
       */
      durationMs: number;
    }
  | { ok: false; error: YoutubeTranscriptError; message?: string };

/**
 * Busca a legenda de `videoUrl`. Nunca lança: toda falha vira um `ok: false`
 * com um motivo do union acima.
 *
 * **`mode: "native"` — só legenda que JÁ EXISTE no YouTube.** A Supadata sabe
 * transcrever o áudio com Whisper quando não há legenda, e essa porta está
 * fechada de propósito: ela custa 2 créditos por MINUTO (contra 1 por vídeo),
 * volta assíncrona (202 + jobId, com polling e uma tela de espera que precisa
 * sobreviver a um reload), e faria um vídeo de duas horas custar mais em
 * provedor do que as 25 moedas rendem inteiras. Vídeo sem legenda é recusado
 * ANTES da cobrança, com uma frase que diz o que houve.
 *
 * A cobertura disso é alta em canal de igreja: o YouTube gera legenda
 * automática em português para praticamente todo upload. O que ela não tem é
 * pontuação — o resumo aguenta, a leitura crua da transcrição sofre, e é por
 * isso que a sessão importada abre em `/summary`.
 */
export async function fetchYoutubeTranscript(videoUrl: string): Promise<YoutubeTranscriptResult> {
  const result = await fetchSupadataTranscript(videoUrl);
  if (!result.ok) {
    log.warn("fetch failed", { error: result.error, message: result.message });
  }
  return result;
}
