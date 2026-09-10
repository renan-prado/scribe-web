/**
 * Modo de captura de uma sessão. Client-safe (a camada de DB é server-only,
 * mas o diálogo de nova gravação e os helpers de rota rodam no browser).
 *
 * - `live`: pipelines de enriquecimento ao vivo (bible/insights/echo)
 *                       + resumo final no stop.
 * - `audio_only`: só transcreve em segundo plano; resumo final no stop.
 * - `transcript_only`: só transcreve, mostrando cada chunk na tela conforme
 *                       ele volta do /api/transcribe. NENHUMA chamada de LLM
 *                       além do transcribe: sem cards ao vivo e sem resumo.
 * - `youtube`: NÃO CAPTURA NADA. A transcrição vem pronta das legendas
 *                       de um vídeo do YouTube e o resumo roda sobre ela.
 *
 * **`youtube` é o modo que não grava, e mora aqui assim mesmo.** A alternativa
 * era um conceito novo ao lado de sessão, e o que uma importação precisa ser
 * (linha em `/recordings`, transcrição, resumo, estudo, releia/lembra/frases)
 * é exatamente o que uma sessão já é. O preço dele é o único que não é por
 * minuto: um vídeo custa `COIN_COSTS.youtubeImport`, cobrado uma vez, porque
 * não há minuto de STT para contar. Ver `lib/coins/pricing.ts`.
 */
export const SESSION_MODES = ["live", "audio_only", "transcript_only", "youtube"] as const;

export type SessionMode = (typeof SESSION_MODES)[number];

export function parseSessionMode(value: unknown): SessionMode {
  return (SESSION_MODES as readonly string[]).includes(value as string)
    ? (value as SessionMode)
    : "live";
}

/**
 * Segmento de rota da PÁGINA DE GRAVAÇÃO de cada modo, /recording/{id}/{seg}.
 * Cada página redireciona para cá quando o modo da sessão não bate com ela.
 */
export function recordingRouteFor(mode: SessionMode): "live" | "audio" | "transcribe" | "youtube" {
  if (mode === "audio_only") return "audio";
  if (mode === "transcript_only") return "transcribe";
  // Não é uma página de gravação: é a da IMPORTAÇÃO, que busca a legenda e
  // roda o resumo. Ela ocupa o mesmo lugar no fluxo, é para onde o diálogo
  // empurra, e de onde a sessão sai pronta, então divide o mesmo helper.
  if (mode === "youtube") return "youtube";
  return "live";
}

/**
 * Segmento de rota da SESSÃO SALVA. Sessões transcript_only não têm resumo,
 * então moram numa página própria de leitura da transcrição.
 *
 * `hasSummary` cobre a exceção: uma sessão do modo transcrição pode GANHAR um
 * resumo depois, sob demanda (`/api/final-summary/from-transcript`), e a partir
 * daí a página que interessa é a do resumo. Quem não sabe responder (a maior
 * parte dos chamadores, que só tem o modo em mãos) omite o argumento e continua
 * caindo em `/transcript`, de onde o cabeçalho leva ao resumo em um toque.
 */
export function savedRouteFor(mode: SessionMode, hasSummary = false): "summary" | "transcript" {
  return mode === "transcript_only" && !hasSummary ? "transcript" : "summary";
}

/**
 * `true` para os modos que capturam áudio pelo microfone, os três originais.
 *
 * Existe porque `youtube` quebra suposições que estavam implícitas em "modo de
 * sessão" e nunca precisaram de nome: que há permissão de microfone a pedir,
 * que há um cronômetro correndo, e que o minuto é a unidade de cobrança. Quem
 * pergunta isso deve perguntar em voz alta, e não testar `mode !== "youtube"`
 * espalhado, no dia em que entrar um segundo modo importado, o teste solto
 * erra em silêncio e este aqui não.
 */
export function isCaptureMode(mode: SessionMode): mode is CaptureMode {
  return mode !== "youtube";
}

/**
 * Os modos que gravam pelo microfone, o subconjunto que o diálogo "Gravar"
 * oferece, e o único cujo preço é por minuto.
 *
 * Ele existe porque `youtube` entrou em `SESSION_MODES` e imediatamente virou
 * uma exceção em toda tela que iterava sobre a lista: o diálogo de gravação
 * mostraria um card que não grava, e o rodapé anunciaria "25/min" para um preço
 * que é por vídeo. Com o tipo separado, quem só sabe gravar declara isso no
 * tipo, e o compilador cobra quem esquecer.
 */
export const CAPTURE_MODES = ["live", "audio_only", "transcript_only"] as const;

export type CaptureMode = (typeof CAPTURE_MODES)[number];
