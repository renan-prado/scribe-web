import "server-only";

/**
 * Título e canal de um vídeo, pelo oEmbed público do YouTube.
 *
 * **É ENFEITE, e o código inteiro depende de isso ser verdade.** Toda falha
 * daqui devolve `null` e a importação segue: sem título, o resumo gera um; sem
 * canal, `speaker_name` fica nulo, exatamente como numa gravação em que
 * ninguém digitou o nome do pregador. Nada nesta função pode virar motivo para
 * recusar um vídeo, se um dia virar, o modo passa a quebrar por causa de um
 * campo decorativo.
 *
 * ## Por que este endpoint funciona onde o `timedtext` não funciona
 *
 * O oEmbed é serviço de metadado público, pensado para ser chamado por
 * servidor de terceiro (é o que monta o preview de um link colado em qualquer
 * lugar). Ele não passa pelo antifraude que fechou o `timedtext` para IP de
 * datacenter, medido daqui, 200 com título e canal. Não custa chave nem
 * crédito, e é por isso que a duração do vídeo NÃO vem dele: o oEmbed não
 * devolve duração, e a resposta para essa pergunta sai de graça do último
 * segmento da legenda (ver `supadata.ts`).
 *
 * Se um dia ele endurecer também, o sintoma correto é sessão importada com
 * título gerado pelo resumo, não erro na tela.
 */

import { createLogger } from "@/lib/log";

const log = createLogger("youtube-oembed");

/** Curto de propósito: é enfeite, e não pode segurar a fila de uma importação. */
const TIMEOUT_MS = 5_000;

export type YoutubeVideoInfo = {
  /** Título do vídeo, como aparece no YouTube. */
  title: string;
  /** Nome do canal. Vira o `speaker_name` da sessão. */
  channel: string | null;
};

export async function fetchYoutubeVideoInfo(videoUrl: string): Promise<YoutubeVideoInfo | null> {
  const url = new URL("https://www.youtube.com/oembed");
  url.searchParams.set("url", videoUrl);
  url.searchParams.set("format", "json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return null;

    const body = (await response.json()) as { title?: unknown; author_name?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return null;

    const channel = typeof body.author_name === "string" ? body.author_name.trim() : "";
    return { title, channel: channel || null };
  } catch (err) {
    log.debug("unavailable", { message: (err as Error).message });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
