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
 *
 * **Ele mede o que é IMPORTADO, não a fita.** Com recorte (ver `YoutubeClip`),
 * um culto de três horas do qual se pede a meia hora da pregação passa: a
 * legenda custou o mesmo 1 crédito fixo, e o resumo vê meia hora de texto.
 * Medir o vídeo inteiro seria recusar pelo tamanho da fita, não pelo tamanho
 * da conta.
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

/**
 * Piso de um trecho recortado. Um minuto.
 *
 * Existe para o dedo errado, não para o abuso: quem escreve `12:00` no início
 * e `12:30` no fim quis dizer outra coisa, e o preço é fechado por vídeo. O
 * piso de CONTEÚDO continua sendo `YOUTUBE_MIN_TRANSCRIPT_CHARS`, medido sobre
 * o texto que o recorte devolveu, que é o que pega o trecho de dez minutos em
 * que ninguém fala.
 */
export const YOUTUBE_MIN_CLIP_MS = 60 * 1000;

/**
 * O recorte: importar só um pedaço do vídeo.
 *
 * Ele existe porque a transmissão de um culto inteiro tem duas horas e a
 * pregação tem trinta minutos no meio. Sem isto a saída era "procure o corte
 * só da pregação" — uma tarefa que o canal pode nunca ter feito.
 *
 * **O que o teto de duração mede passa a ser ISTO, o trecho, e não o vídeo.**
 * É a leitura certa da regra que criou o teto: ele existe porque o custo do
 * resumo cresce com a transcrição na ENTRADA, e a legenda custa 1 crédito por
 * vídeo, fixo, independente da duração. Um culto de três horas recortado em
 * quarenta minutos custa menos que uma pregação de duas horas inteira, e
 * recusá-lo seria recusar pelo tamanho da fita, não pelo tamanho da conta.
 * Ver `docs/youtube.md` §5.
 */
export type YoutubeClip = {
  startMs: number;
  /** Fim exclusivo. `null` = "até o fim do vídeo". */
  endMs: number | null;
};

export type ClipRangeError = "clip_invalid" | "clip_too_short" | "clip_too_long";

/**
 * Valida um par início/fim vindo de fora (formulário, query da URL, corpo de
 * rota). Devolve `null` quando NÃO há recorte — os dois vazios é o caso comum,
 * e não é erro.
 */
export function parseClipRange(
  startMs: number | null | undefined,
  endMs: number | null | undefined
): { ok: true; clip: YoutubeClip | null } | { ok: false; error: ClipRangeError } {
  const start =
    typeof startMs === "number" && Number.isFinite(startMs) ? Math.trunc(startMs) : null;
  const end = typeof endMs === "number" && Number.isFinite(endMs) ? Math.trunc(endMs) : null;

  if (start === null && end === null) return { ok: true, clip: null };
  if (start !== null && start < 0) return { ok: false, error: "clip_invalid" };
  if (end !== null && end <= 0) return { ok: false, error: "clip_invalid" };

  const from = start ?? 0;
  if (end !== null) {
    if (end <= from) return { ok: false, error: "clip_invalid" };
    if (end - from < YOUTUBE_MIN_CLIP_MS) return { ok: false, error: "clip_too_short" };
    if (end - from > YOUTUBE_MAX_DURATION_MS) return { ok: false, error: "clip_too_long" };
  }

  return { ok: true, clip: { startMs: from, endMs: end } };
}

/**
 * `"12:30"`, `"1:02:30"`, `"12"` → ms. Devolve `null` para o que não é um
 * tempo, e `0` é uma resposta válida (o começo do vídeo).
 *
 * **Um número solto é lido como MINUTOS**, não segundos: o campo é o minuto em
 * que a pregação começa, e quem digita `12` num campo cujo exemplo é `12:30`
 * está dizendo doze minutos. Ler como segundos devolveria os doze primeiros
 * segundos do culto, um erro silencioso que só aparece no resumo pronto.
 */
export function parseTimecode(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  const parts = value.split(":");
  if (parts.length > 3) return null;
  if (!parts.every((part) => /^\d{1,3}$/.test(part))) return null;

  const numbers = parts.map((part) => Number.parseInt(part, 10));
  // Um número solto são minutos; dois são mm:ss; três são h:mm:ss.
  const [hours, minutes, seconds] =
    numbers.length === 1
      ? [0, numbers[0], 0]
      : numbers.length === 2
        ? [0, numbers[0], numbers[1]]
        : [numbers[0], numbers[1], numbers[2]];

  if (minutes > 59 && numbers.length === 3) return null;
  if (seconds > 59) return null;

  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

/** ms → `"12:30"` ou `"1:02:30"`. A forma em que o campo é digitado de volta. */
export function formatTimecode(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours > 0 ? `${hours}:` : ""}${mm}:${String(seconds).padStart(2, "0")}`;
}

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
  /**
   * O instante que o link apontava (`?t=90`, `?t=1h2m3s`, `?start=90`), em ms,
   * ou `null`. **Não vai para o banco**: ele só SUGERE o início do trecho no
   * formulário, porque quem compartilha um link parado no minuto 12 quase
   * sempre está apontando onde a pregação começa. Guardá-lo na URL canônica
   * faria duas linhas do mesmo vídeo em instantes diferentes parecerem vídeos
   * diferentes, que é justamente o que a canonização existe para evitar.
   */
  startMs: number | null;
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
    startMs: parseYoutubeTimeParam(url.searchParams.get("t") ?? url.searchParams.get("start")),
  };
}

/**
 * O `t=` de um link do YouTube, nas duas formas que ele tem: segundos crus
 * (`t=930`, `t=930s`) e a composta (`t=1h2m3s`, `t=15m30s`).
 */
function parseYoutubeTimeParam(raw: string | null): number | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  if (/^\d+s?$/.test(value)) {
    const seconds = Number.parseInt(value, 10);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
  }

  const composed = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!composed || (!composed[1] && !composed[2] && !composed[3])) return null;
  const ms =
    (Number(composed[1] ?? 0) * 3600 + Number(composed[2] ?? 0) * 60 + Number(composed[3] ?? 0)) *
    1000;
  return ms > 0 ? ms : null;
}

/**
 * Acha o primeiro link de vídeo dentro de um TEXTO qualquer.
 *
 * Existe por causa do compartilhamento: o que o Android entrega no
 * `share_target` (e o que uma pessoa cola do WhatsApp) quase nunca é só a URL,
 * é "Assista: Pr. Fulano — Romanos 8 https://youtu.be/xxxx". Passar isso por
 * `parseYoutubeUrl` devolve `null`, e a tela apareceria vazia com o link na
 * mão. Aqui a string é quebrada em pedaços e o primeiro que for um vídeo
 * ganha.
 *
 * É só para a ENTRADA por URL/compartilhamento. O que a pessoa digita no campo
 * continua passando por `parseYoutubeUrl` direto, com a régua estrita.
 */
export function extractYoutubeUrl(text: string): ParsedYoutubeUrl | null {
  const direct = parseYoutubeUrl(text);
  if (direct) return direct;

  for (const token of text.split(/\s+/)) {
    if (!token) continue;
    const parsed = parseYoutubeUrl(token);
    if (parsed) return parsed;
  }
  return null;
}

/**
 * A miniatura de um vídeo, derivada do id. Não é chamada de rede nem de API:
 * `i.ytimg.com` serve este caminho para todo vídeo público, e `hqdefault`
 * (480×360) é o único tamanho que SEMPRE existe — `maxresdefault` volta 404 em
 * vídeo que nunca foi enviado em HD, o que daria um quadrado quebrado na tela
 * de espera.
 *
 * Quem consome é o `/importar/:id`, por `next/image` (ver o `remotePatterns`
 * do `next.config.ts`): host externo em `<img>` cru é proibido, ver
 * `src/app/AGENTS.md`.
 */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
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
