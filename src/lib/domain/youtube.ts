/**
 * O que o produto entende por "um link do YouTube". Client-safe de propósito:
 * o diálogo de nova gravação precisa recusar um link ruim ANTES de criar linha
 * no banco e gastar uma chamada de provedor, e a rota precisa recusar o mesmo
 * link com a mesma régua, as duas leem daqui.
 *
 * Nada aqui fala com o YouTube. Isto é parse de string; quem busca a legenda é
 * `lib/youtube/` (server-only).
 */

/**
 * Teto de duração de um vídeo importável.
 *
 * **2 horas, e o motivo é o preço ser FIXO.** O modo YouTube cobra
 * `COIN_COSTS.youtubeImport` por vídeo, não por minuto: o custo do resumo
 * cresce com a transcrição na entrada, e a receita não. Aos 30 min a margem
 * fecha ~70%, aos 60 ~65%, aos 120 ~56%, e a partir daí ela desce rápido.
 * O teto é o que impede uma live de seis horas de ser importada pelo preço de
 * um sermão de meia hora.
 *
 * Não é um limite técnico: `gpt-4o` aguenta a transcrição de duas horas com
 * folga de contexto. Se um dia o preço virar escalonado por faixa, este número
 * sobe junto, os dois andam sempre no mesmo passo.
 */
export const YOUTUBE_MAX_DURATION_MS = 2 * 60 * 60 * 1000;

/**
 * Piso de tamanho da legenda para valer um resumo.
 *
 * Um vídeo de 40 segundos tem legenda válida e transcrição de trinta palavras.
 * O resumo sai, custa o mesmo que qualquer outro, e não diz nada, e a pessoa
 * pagou o preço cheio por ele. Recusar antes de cobrar é mais honesto que
 * entregar um resumo vazio.
 */
export const YOUTUBE_MIN_TRANSCRIPT_CHARS = 600;

/** Hosts que o parser aceita. Qualquer outro não é um vídeo do YouTube. */
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

/** 11 caracteres do alfabeto base64url, o formato do id de vídeo. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Segmentos de caminho que precedem o id numa URL de vídeo. `watch` sai daqui
 * porque naquele formato o id vem na query (`?v=`), não no caminho.
 */
const PATH_PREFIXES = ["embed", "shorts", "live", "v"];

export type ParsedYoutubeUrl = {
  videoId: string;
  /** Forma canônica, guardada em `sessions.source_url`. */
  canonicalUrl: string;
};

/**
 * Extrai o id de vídeo de qualquer forma de link que uma pessoa cola: `watch?v=`,
 * `youtu.be/`, `/shorts/`, `/live/`, `/embed/`, com ou sem esquema, com ou sem
 * parâmetros de playlist e rastreamento pendurados.
 *
 * Devolve `null` para tudo o que não for um vídeo, inclusive URLs de canal e
 * de playlist, que são links legítimos do YouTube e não são o que este modo
 * importa. Quem chama transforma o `null` na mensagem de erro.
 */
export function parseYoutubeUrl(raw: string): ParsedYoutubeUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Gente cola "youtube.com/watch?v=..." sem esquema o tempo todo. Sem este
  // remendo o `new URL` estoura e o link válido é recusado.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const isShortHost = url.hostname.toLowerCase().endsWith("youtu.be");

  // youtu.be/<id>, o id é o primeiro (e único) segmento.
  // youtube.com/<embed|shorts|live|v>/<id>, o id vem depois do prefixo.
  // youtube.com/watch?v=<id>, o id vem da query.
  const candidate = isShortHost
    ? segments[0]
    : segments.length >= 2 && PATH_PREFIXES.includes(segments[0].toLowerCase())
      ? segments[1]
      : (url.searchParams.get("v") ?? undefined);

  if (!candidate || !VIDEO_ID_RE.test(candidate)) return null;

  return {
    videoId: candidate,
    canonicalUrl: `https://www.youtube.com/watch?v=${candidate}`,
  };
}

/** `true` quando o texto é um link de vídeo importável. Para o diálogo. */
export function isYoutubeVideoUrl(raw: string): boolean {
  return parseYoutubeUrl(raw) !== null;
}

/**
 * O título do vídeo separado nas três coisas que ele carrega coladas. Os três
 * campos são independentemente opcionais: um vídeo pode ter tema sem pregador
 * nomeado, pregador sem igreja, ou nada além de data e rótulo.
 */
export type YoutubeMetadata = {
  /** O nome da PREGAÇÃO, sem data, sem igreja, sem "AO VIVO". */
  title: string | null;
  /** O pregador, sem título eclesiástico. */
  speakerName: string | null;
  /** A igreja ou ministério. */
  speakerLocation: string | null;
};

/** Limite por campo. O banco aceita 200 em `speaker_name`/`speaker_location`;
 * um título de vídeo do YouTube não passa de 100 caracteres, e o que voltar
 * maior que isto é o modelo devolvendo a entrada inteira em vez de extrair. */
const MAX_FIELD_CHARS = 200;

/**
 * Sanitiza um campo: corta espaço, recusa vazio, recusa os "nulos escritos por
 * extenso" que um modelo devolve quando não achou nada, e recusa o que passa do
 * limite.
 *
 * A lista de nulos textuais não é preciosismo. O prompt pede `null` e a maior
 * parte das vezes recebe `null`, mas `"null"`, `"N/A"` e `"desconhecido"`
 * aparecem, e cada um deles gravado vira um cartão em `/recordings` anunciando
 * que o autor do sermão se chama "Desconhecido".
 */
const TEXTUAL_NULLS = new Set([
  "null",
  "undefined",
  "n/a",
  "na",
  "-",
  "desconhecido",
  "desconhecida",
  "não informado",
  "nao informado",
  "sem título",
  "sem titulo",
]);

function cleanField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_FIELD_CHARS) return null;
  if (TEXTUAL_NULLS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/**
 * Parseia a saída de `YOUTUBE_METADATA_SYSTEM_PROMPT`.
 *
 * Nunca lança e nunca devolve parcial-inválido: cada campo que não sobrevive
 * vira `null` em silêncio, independentemente dos outros. É o comportamento
 * certo aqui porque os três são ENFEITE, quem chama já tem o título cru do
 * oEmbed como alternativa, e o resumo sabe gerar um título sozinho. Nada nesta
 * função pode ser motivo para uma importação falhar.
 */
export function parseYoutubeMetadataFromLLM(content: string): YoutubeMetadata {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return { title: null, speakerName: null, speakerLocation: null };
  }
  if (!obj || typeof obj !== "object") {
    return { title: null, speakerName: null, speakerLocation: null };
  }
  const rec = obj as Record<string, unknown>;
  return {
    title: cleanField(rec.title),
    speakerName: cleanField(rec.speakerName),
    speakerLocation: cleanField(rec.speakerLocation),
  };
}
