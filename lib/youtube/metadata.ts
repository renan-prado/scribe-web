import "server-only";

/**
 * Limpa o título de um vídeo do YouTube — separa a pregação, o pregador e a
 * igreja do amontoado que os canais publicam.
 *
 * ## Por que existe
 *
 * A primeira versão do modo YouTube usava o oEmbed cru: `title` virava o
 * título da sessão e `author_name` virava o autor. O resultado real do
 * primeiro teste:
 *
 *     título:  "Pr. Yago Martins I Por seis vezes foi melhor ser pagão I 09.03.2025 - 17H"
 *     autor:   "batistadopovo"
 *
 * Duas coisas erradas de uma vez. O título é três informações coladas por uma
 * LETRA I usada como separador, e o "autor" é a IGREJA — o sermão é do Yago
 * Martins. Ver `lib/prompts/youtube-metadata.ts` para por que isto não é uma
 * regex.
 *
 * ## É ENFEITE, como o oEmbed
 *
 * Toda falha devolve o que já se tinha. O contrato desta função é que ela
 * NUNCA piora o resultado e NUNCA interrompe uma importação: sem chave, sem
 * rede, com JSON quebrado ou com o modelo fora do ar, a sessão nasce com o
 * título cru do YouTube, que é exatamente o que ela teria sem esta etapa.
 *
 * O corolário está no `fallback` abaixo: o título cru sobrevive, mas o CANAL
 * não vira `speakerName` em hipótese alguma. Aquele campo era o bug; devolvê-lo
 * num caminho de erro seria reintroduzi-lo justamente onde ninguém olha.
 */

import type { UsageRoute } from "@/lib/db/usage";
import { recordChatUsage } from "@/lib/db/usage";
import { parseYoutubeMetadataFromLLM, type YoutubeMetadata } from "@/lib/domain/youtube";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";
import { YOUTUBE_METADATA_SYSTEM_PROMPT } from "@/lib/prompts/youtube-metadata";

const log = createLogger("youtube-metadata");

const ROUTE: Extract<UsageRoute, "youtube-metadata"> = "youtube-metadata";

/**
 * 20s. Extração de três campos a partir de uma linha de texto mede 1-2s; vinte
 * segundos é o ponto em que ficar esperando custa mais do que o enfeite vale —
 * e esta chamada acontece DEPOIS da cobrança, na janela entre o débito e a
 * gravação da transcrição, que é a que interessa manter curta.
 */
const TIMEOUT_MS = 20_000;

export type CleanYoutubeMetadataInput = {
  userId: string;
  sessionId: string;
  /** O `title` cru do oEmbed. */
  rawTitle: string;
  /** O `author_name` cru do oEmbed — o nome do CANAL. */
  channel: string | null;
};

export async function cleanYoutubeMetadata(
  input: CleanYoutubeMetadataInput
): Promise<YoutubeMetadata> {
  const { userId, sessionId, rawTitle, channel } = input;

  /**
   * O canal, dito como canal.
   *
   * `speaker_location` quer dizer "onde isto foi pregado", e nos outros três
   * modos quem responde isso é uma PESSOA digitando. Aqui é suposição nossa: o
   * canal que publicou provavelmente é a igreja, mas o vídeo não afirmou isso
   * em lugar nenhum. O prefixo é o que separa o que sabemos do que deduzimos —
   * sem ele a tela mostra "Batista do Povo" com a mesma cara de um local que
   * alguém confirmou.
   */
  const channelAsLocation = channel ? `Canal ${channel}` : null;

  // O título cru vira o título da sessão; o canal NÃO vira o autor. Ver o
  // cabeçalho.
  const fallback: YoutubeMetadata = {
    title: rawTitle,
    speakerName: null,
    speakerLocation: channelAsLocation,
  };

  const model = serverEnv.OPENAI_YOUTUBE_METADATA_MODEL;
  const userMessage = `Título: ${JSON.stringify(rawTitle)}\nCanal: ${JSON.stringify(channel ?? "")}`;

  const result = await callChat({
    model,
    temperature: 0,
    maxTokens: 300,
    responseFormat: { type: "json_object" },
    timeoutMs: TIMEOUT_MS,
    messages: [
      { role: "system", content: YOUTUBE_METADATA_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: ROUTE, userId, sessionId }),
  });

  if (!result.ok) {
    log.warn("call failed", {
      sessionId,
      kind: result.error.kind,
      message: result.error.message,
    });
    return fallback;
  }

  await recordChatUsage({
    userId,
    sessionId,
    route: ROUTE,
    model,
    promptTokens: result.data.usage.promptTokens,
    completionTokens: result.data.usage.completionTokens,
    cachedTokens: result.data.usage.cachedTokens,
    reasoningTokens: result.data.usage.reasoningTokens,
    latencyMs: result.data.latencyMs,
  });

  const parsed = parseYoutubeMetadataFromLLM(result.data.content);

  // `title: null` do modelo é uma RESPOSTA, não uma falha: o prompt manda
  // devolver null quando o vídeo não tem tema próprio ("Culto de Domingo -
  // 09.03.2025"), e é o que faz o resumo gerar um título de verdade lá na
  // frente, a partir do conteúdo. Sobrescrevê-lo com o cru jogaria fora
  // exatamente o caso que a etapa existe para melhorar.
  //
  // O problema é que um JSON quebrado também chega aqui como null. O que separa
  // os dois é o resto do objeto: o parser devolve os TRÊS campos nulos quando
  // não conseguiu ler nada, enquanto uma resposta de verdade que abre mão do
  // título quase sempre traz pregador ou igreja. Três nulos = não houve
  // resposta, e aí o título cru é melhor que nada.
  const empty = !parsed.title && !parsed.speakerName && !parsed.speakerLocation;
  if (empty) {
    log.warn("unparseable response", { sessionId, snippet: result.data.content.slice(0, 200) });
    return fallback;
  }

  const metadata: YoutubeMetadata = {
    title: parsed.title,
    speakerName: parsed.speakerName,
    // O canal como igreja é um palpite bom o bastante para ser o padrão — o que
    // ele nunca pode ser é o AUTOR, que era o bug. Aqui ele entra CRU (sem
    // decapitalizar "batistadopovo") porque este ramo só roda quando o modelo
    // não devolveu local nenhum; quando ele devolve, já vem prefixado e
    // separado em palavras pelo prompt.
    speakerLocation: parsed.speakerLocation ?? channelAsLocation,
  };

  log.debug("cleaned", {
    sessionId,
    rawTitle,
    channel,
    title: metadata.title,
    speakerName: metadata.speakerName,
    speakerLocation: metadata.speakerLocation,
    // Marca o caso em que o vídeo não tinha tema próprio e o resumo vai criar
    // um. É o sinal que diz se o prompt está conservador demais, devolvendo
    // null onde havia título — se este número subir, o exemplo do "Culto de
    // Domingo" no prompt está pegando mais do que devia.
    titleFromSummary: metadata.title === null,
  });

  return metadata;
}
