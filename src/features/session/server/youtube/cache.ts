import "server-only";

/**
 * O cache de legenda por VÍDEO (tabela `youtube_transcripts`, migração 0072).
 *
 * A legenda de um vídeo do YouTube é pública, não muda, e custa 1 crédito de
 * provedor mais 1-3s toda vez que é buscada. Três situações rotineiras buscam
 * a mesma legenda de novo: o link que circula no grupo da igreja e é importado
 * por várias pessoas, a sessão apagada e reimportada, e, a mais comum de
 * todas, a mesma pessoa reimportando OUTRO TRECHO do mesmo culto. Ver o
 * cabeçalho da migração.
 *
 * ## Ele guarda SEGMENTOS
 *
 * É o que faz o terceiro caso funcionar. O recorte é um filtro sobre
 * `offset`/`duration`, então guardar o texto corrido serviria só a uma
 * reimportação idêntica; guardando os segmentos, "do 10 ao 45" depois de "do
 * 12 ao 45" sai do banco, sem provedor nenhum.
 *
 * ## Nada aqui pode quebrar uma importação
 *
 * Mesma postura de `db/usage.ts` e `db/fx-rates.ts`: nenhuma função lança,
 * falha de banco vira `warn` e o caminho segue para o provedor. O pior desfecho
 * de um cache indisponível é a importação custar o que ela custava antes dele
 * existir; qualquer desfecho pior que esse seria trocar dinheiro por
 * disponibilidade, o que é exatamente o negócio que não se quer fazer.
 *
 * Service-role porque a tabela não tem policy nenhuma. A legenda é pública e
 * não há segredo a proteger na leitura, mas quem pudesse ESCREVER aqui
 * escolheria o texto que vira o sermão de outra pessoa, e o resumo pago sairia
 * de um conteúdo plantado.
 */

import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type CaptionSegment,
  decodeSegments,
  encodeSegments,
  MAX_STORED_SEGMENTS_BYTES,
} from "./segments";

const log = createLogger("youtube-cache");

/**
 * 90 dias.
 *
 * A legenda de um vídeo publicado não muda mais, então em tese o cache podia
 * ser eterno. Em tese: o canal pode trocar a legenda automática por uma
 * revisada à mão (que tem pontuação e nomes próprios certos, e portanto gera
 * um resumo melhor), e o vídeo pode ser reeditado. Nos dois casos o cache
 * eterno serviria para sempre a versão pior, em silêncio.
 *
 * Noventa dias é longo o bastante para cobrir a janela em que um sermão
 * circula (dias, no máximo semanas) e curto o bastante para que a legenda
 * revisada apareça antes de o vídeo virar acervo. Vencer custa 1 crédito de
 * provedor, que é o preço de não ficar preso na primeira versão para sempre.
 */
export const YOUTUBE_TRANSCRIPT_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type CachedTranscript = {
  segments: CaptionSegment[];
  lang: string;
  fullDurationMs: number;
  /** Quando a legenda foi buscada do provedor. Só para log. */
  fetchedAt: string;
};

/**
 * A legenda guardada deste vídeo, ou `null` para "busque do provedor".
 *
 * `null` cobre os quatro casos de uma vez, e de propósito: não existe linha, a
 * linha venceu, a linha está num formato que este código não entende, ou o
 * banco não respondeu. Quem chama faz a mesma coisa nos quatro, e distinguir
 * só multiplicaria caminhos que terminam no mesmo lugar. O log separa.
 */
export async function readCachedTranscript(videoId: string): Promise<CachedTranscript | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("youtube_transcripts")
      .select("segments, lang, full_duration_ms, fetched_at")
      .eq("video_id", videoId)
      .maybeSingle();

    if (error) {
      log.warn("leitura falhou", { videoId, error: error.message });
      return null;
    }
    if (!data) return null;

    const fetchedAt = data.fetched_at as string;
    const age = Date.now() - new Date(fetchedAt).getTime();
    if (!Number.isFinite(age) || age > YOUTUBE_TRANSCRIPT_TTL_MS) {
      log.debug("vencido", { videoId, fetchedAt });
      return null;
    }

    const segments = decodeSegments(data.segments);
    if (!segments || segments.length === 0) {
      log.warn("linha ilegível", { videoId });
      return null;
    }

    return {
      segments,
      lang: typeof data.lang === "string" ? data.lang : "pt",
      fullDurationMs: Number(data.full_duration_ms) || 0,
      fetchedAt,
    };
  } catch (err) {
    log.warn("leitura lançou", { videoId, error: (err as Error).message });
    return null;
  }
}

/**
 * Guarda a legenda recém-buscada. Sobrescreve a linha do mesmo vídeo, que é o
 * que renova um TTL vencido.
 *
 * Só é chamada com uma legenda que TEM texto: recusa (`no_captions`, vídeo
 * privado, trecho vazio) não escreve linha nenhuma, ver o cabeçalho da
 * migração.
 */
export async function saveCachedTranscript(input: {
  videoId: string;
  segments: CaptionSegment[];
  lang: string;
  fullDurationMs: number;
  provider: string;
}): Promise<void> {
  const { videoId, segments, lang, fullDurationMs, provider } = input;
  if (segments.length === 0) return;

  const encoded = encodeSegments(segments);
  // O teto existe para o vídeo que ninguém previu (uma live de doze horas): a
  // importação dele funciona igual, só não deixa rastro. Guardar é otimização,
  // e uma otimização não tem licença para criar uma linha de vários megabytes.
  const bytes = JSON.stringify(encoded).length;
  if (bytes > MAX_STORED_SEGMENTS_BYTES) {
    log.warn("legenda grande demais para o cache", { videoId, bytes });
    return;
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("youtube_transcripts").upsert(
      {
        video_id: videoId,
        segments: encoded,
        lang,
        full_duration_ms: Math.max(0, Math.round(fullDurationMs)),
        provider,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "video_id" }
    );
    if (error) log.warn("upsert falhou", { videoId, error: error.message });
    else log.debug("guardado", { videoId, segments: segments.length, bytes });
  } catch (err) {
    log.warn("upsert lançou", { videoId, error: (err as Error).message });
  }
}
