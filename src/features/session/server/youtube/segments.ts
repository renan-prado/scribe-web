import "server-only";

/**
 * O SEGMENTO de legenda, e as duas coisas que se fazem com uma lista deles:
 * dobrá-la num texto (aplicando o recorte) e guardá-la no cache.
 *
 * ## Por que isto saiu de dentro do `supadata.ts`
 *
 * O `foldSegments` morava lá, e enquanto o provedor era a única fonte de
 * segmentos isso era o lugar certo. Com o cache (`cache.ts`) passaram a ser
 * duas fontes, e uma legenda vinda do banco precisa virar texto pela MESMA
 * régua de uma legenda vinda da rede, senão o mesmo vídeo com o mesmo recorte
 * produz transcrições diferentes conforme tenha havido acerto de cache, que é
 * o tipo de diferença que ninguém procura porque ninguém imagina.
 *
 * O provedor agora devolve segmentos crus e nada mais. Quem dobra é
 * `transcript.ts`, uma vez, depois de decidir de onde vieram.
 */

import type { YoutubeClip } from "@/lib/domain/youtube";

/** Um trecho de fala com onde ele começa e quanto dura, em ms. */
export type CaptionSegment = {
  offsetMs: number;
  durationMs: number;
  text: string;
};

/**
 * A forma guardada no banco: `[offsetMs, durationMs, texto]`.
 *
 * **Tupla e não objeto, e a razão é o tamanho da linha.** Um culto de duas
 * horas tem uns dois mil segmentos; em objetos, `{"offsetMs":…,"durationMs":…,
 * "text":…}` repete 34 bytes de nome de chave duas mil vezes, o que é mais que
 * o próprio texto de vários deles. A tupla é ilegível para quem abre a tabela
 * no painel do Supabase, e essa é a troca aceita: ninguém lê legenda crua no
 * painel, e o que se ganha é uma linha que cabe sem discussão.
 */
type StoredSegment = [number, number, string];

/** Teto do que se aceita guardar, ver `cache.ts`. */
export const MAX_STORED_SEGMENTS_BYTES = 2_000_000;

export function encodeSegments(segments: CaptionSegment[]): StoredSegment[] {
  return segments.map((s) => [s.offsetMs, s.durationMs, s.text]);
}

/**
 * Lê de volta o que `encodeSegments` escreveu. Devolve `null` para qualquer
 * coisa que não seja a forma esperada, e quem chama trata isso como ausência
 * de cache, e não como erro: uma linha estragada (formato antigo, escrita à
 * mão no painel, jsonb truncado) tem de custar uma ida ao provedor, nunca uma
 * importação paga que falha.
 */
export function decodeSegments(raw: unknown): CaptionSegment[] | null {
  if (!Array.isArray(raw)) return null;

  const segments: CaptionSegment[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 3) return null;
    const [offsetMs, durationMs, text] = entry;
    if (typeof offsetMs !== "number" || !Number.isFinite(offsetMs)) return null;
    if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) return null;
    if (typeof text !== "string") return null;
    segments.push({ offsetMs, durationMs, text });
  }
  return segments;
}

/**
 * Junta os segmentos num texto corrido e mede onde o último termina.
 *
 * **É do `offset + duration` do último segmento que sai a duração do vídeo**,
 * que é o que decide se ele cabe no teto e o que vai para
 * `sessions.duration_ms`. A alternativa era uma chamada de metadados, custando
 * um segundo crédito por vídeo para saber algo que já veio junto com a
 * legenda.
 *
 * **E é o mesmo tempo que faz o RECORTE existir de graça.** Pedir "do minuto
 * 12 ao 45" não é uma opção do provedor nem uma segunda chamada: a legenda
 * inteira já veio (ou já estava no cache), e o recorte é um filtro sobre a
 * lista que está na memória. Um segmento entra quando ele TOCA a janela, não
 * quando cabe inteiro nela, a frase que começa em 11:58 e termina em 12:02
 * pertence à pregação, e descartá-la cortaria a abertura no meio.
 *
 * `fullDurationMs` é sempre o vídeo todo (é o que o log e um diagnóstico
 * futuro querem saber); `durationMs` é o que foi de fato importado, e é ele
 * que a rota compara com o teto e grava em `sessions.duration_ms`.
 */
export function foldSegments(
  segments: CaptionSegment[],
  clip: YoutubeClip | null
): { text: string; durationMs: number; fullDurationMs: number } {
  const parts: string[] = [];
  let fullDurationMs = 0;
  let firstMs: number | null = null;
  let lastMs = 0;

  const from = clip?.startMs ?? 0;
  const to = clip?.endMs ?? Number.POSITIVE_INFINITY;

  for (const segment of segments) {
    const start = segment.offsetMs;
    const end = start + segment.durationMs;
    if (end > fullDurationMs) fullDurationMs = end;

    if (end <= from || start >= to) continue;

    const trimmed = segment.text.trim();
    if (trimmed) parts.push(trimmed);
    if (firstMs === null) firstMs = start;
    if (end > lastMs) lastMs = end;
  }

  // A duração do trecho é medida pelos segmentos que SOBRARAM, não pela janela
  // pedida: quem escreve "até 2:00:00" num vídeo de 50 minutos importou 50
  // minutos, e é esse número que deve ir para a sessão e para o teto.
  const durationMs = clip
    ? firstMs === null
      ? 0
      : Math.max(0, lastMs - Math.max(from, firstMs))
    : fullDurationMs;

  return {
    text: parts.join(" ").replace(/\s+/g, " ").trim(),
    durationMs,
    fullDurationMs,
  };
}
