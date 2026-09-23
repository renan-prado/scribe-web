import "server-only";
import { cache } from "react";
import { escapeLikeValue } from "@/lib/db/like";
import { type ReferenceQuery, referenceMatchesQuery } from "@/lib/domain/reference-query";
import { parseSessionMode, type SessionListItem, type SessionMode } from "@/lib/domain/session";
import type { SummaryPayload } from "@/lib/domain/summary";
import { createClient, getAuthUser } from "@/lib/supabase/server";

/**
 * Persistence for recording sessions. One row per stop-press: transcript and
 * the final summary.
 *
 * A coluna `feed_items` e a projeção `session_feed_items` NÃO existem mais:
 * foram dropadas na migração 0058, junto com os cards do feed ao vivo que as
 * alimentavam. A busca por referência bíblica passou a ler só o bloco
 * `bibleQuote` do resumo, que toda sessão tem — ver `searchSessionsByReference`.
 *
 * speaker_id / location_id (nullable FKs) link to the reusable entities in
 * @/lib/db/{speakers,locations}. speaker_name / speaker_location stay as
 * the historical snapshot of what was captured at recording time, so
 * renaming a speaker later never rewrites past sessions.
 */

export { SESSION_MODES } from "@/lib/domain/session";

export type SessionRow = {
  id: string;
  createdAt: string;
  endedAt: string | null;
  durationMs: number | null;
  title: string | null;
  shortSummary: string | null;
  speakerId: string | null;
  locationId: string | null;
  speakerName: string | null;
  speakerLocation: string | null;
  mode: SessionMode;
  /** Origem externa da transcrição, a URL do vídeo, no modo youtube. */
  sourceUrl: string | null;
  /** Recorte da origem, no modo youtube. Os dois nulos = vídeo inteiro.
   * Ver `parseClipRange` e a migração 0060. */
  sourceStartMs: number | null;
  sourceEndMs: number | null;
  transcript: string;
  finalSummary: SummaryPayload | null;
  /** A pasta da sessão, ou `null` para "sem pasta" (a raiz). Migração 0068. */
  folderId: string | null;
};

// Reexportado por compatibilidade: o tipo mudou de casa para `lib/domain/`
// quando a lista passou a atravessar a fronteira servidor/cliente. Ver o
// cabeçalho dele lá.
export type { SessionListItem } from "@/lib/domain/session";

/**
 * O cabeçalho de uma sessão, sem as três colunas pesadas.
 *
 * Existe porque a tela de gravação e a de estudo decidem rota e cabeçalho a
 * partir de `mode`, `endedAt`, `title` e o snapshot do orador, e nenhuma das
 * duas renderiza `transcript` ou `finalSummary`. Buscar tudo ali significava
 * trazer a transcrição inteira de um sermão de uma hora para abrir um gravador
 * vazio.
 */
export type SessionMeta = Omit<SessionRow, "transcript" | "finalSummary">;

/**
 * A sessão como a TELA do resumo precisa dela: tudo, menos a transcrição.
 *
 * `hasTranscript` ocupa o lugar dela. A tela só perguntava duas coisas ao
 * texto — se ele existe, para acender o item do menu e o aviso do resumo — e
 * a terceira, desenhá-lo, acontece dentro de um dialog que quase ninguém abre.
 * Mandar dezenas de KB em toda abertura para responder um booleano era o maior
 * peso morto do payload; ver a migração 0061 e `getSessionTranscript`.
 */
export type SessionView = Omit<SessionRow, "transcript"> & { hasTranscript: boolean };

export type CreateEmptySessionInput = {
  /**
   * O id da linha, quando quem chama já tem um.
   *
   * Só o `/summary/new` passa: lá o id é sorteado no APARELHO antes do primeiro
   * salvamento, porque o rascunho local precisa de uma chave e a URL precisa
   * de um endereço enquanto a rede ainda não entrou na história (ver
   * `escrever/draft-store.ts`). Deixar o banco sortear obrigaria o aparelho a
   * esperar a resposta para saber sob que nome guardar o que já foi digitado.
   *
   * Escolher a própria chave primária não abre porta nenhuma: a linha nasce
   * com `user_id = auth.uid()` do mesmo jeito, e um id já ocupado esbarra na
   * unicidade da tabela (quem chama traduz isso em 409). O risco seria
   * ADIVINHAR o uuid v4 de outra pessoa, e ele não é adivinhável.
   */
  id?: string;
  speakerName: string | null;
  speakerLocation: string | null;
  speakerId?: string | null;
  locationId?: string | null;
  mode?: SessionMode;
  /** Só o modo youtube preenche. Ver `sessions.source_url` (migração 0048). */
  sourceUrl?: string | null;
  /** Só o modo youtube, e só quando a pessoa recortou. Migração 0060. */
  sourceStartMs?: number | null;
  sourceEndMs?: number | null;
};

export type UpdateSessionFinalInput = {
  transcript: string;
  summary: SummaryPayload;
  durationMs: number | null;
  speakerName: string | null;
  speakerLocation: string | null;
  speakerId?: string | null;
  locationId?: string | null;
};

type DbRow = {
  id: string;
  created_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  title: string | null;
  short_summary: string | null;
  speaker_id: string | null;
  location_id: string | null;
  speaker_name: string | null;
  speaker_location: string | null;
  capture_mode: string | null;
  source_url: string | null;
  source_start_ms: number | null;
  source_end_ms: number | null;
  transcript: string;
  final_summary: SummaryPayload | null;
  folder_id: string | null;
};

// `mode` is a Postgres ordered-set aggregate function name, PostgREST tries
// to parse `select=mode` as a call to that aggregate ("WITHIN GROUP is
// required for ordered-set aggregate mode"). The column is physically named
// `capture_mode`; we keep the API-side field name as `mode` for callers.
const SELECT_LIST =
  "id, created_at, duration_ms, title, short_summary, speaker_id, location_id, speaker_name, speaker_location, capture_mode, source_url, folder_id";
const SELECT_FULL = `id, created_at, ended_at, duration_ms, title, short_summary, speaker_id, location_id, speaker_name, speaker_location, capture_mode, source_url, source_start_ms, source_end_ms, transcript, final_summary, folder_id`;
// O mesmo de SELECT_FULL menos transcript/final_summary.
const SELECT_META =
  "id, created_at, ended_at, duration_ms, title, short_summary, speaker_id, location_id, speaker_name, speaker_location, capture_mode, source_url, source_start_ms, source_end_ms, folder_id";
// O de SELECT_FULL com `has_transcript` (coluna gerada, migração 0061) no
// lugar de `transcript`: o mesmo conteúdo de tela por uma fração do payload.
const SELECT_VIEW = `${SELECT_META}, has_transcript, final_summary`;

type MetaRow = Omit<DbRow, "transcript" | "final_summary">;
type ViewRow = MetaRow & { has_transcript: boolean | null; final_summary: SummaryPayload | null };

function rowToMeta(row: MetaRow): SessionMeta {
  return {
    id: row.id,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    title: row.title,
    shortSummary: row.short_summary,
    speakerId: row.speaker_id,
    locationId: row.location_id,
    speakerName: row.speaker_name,
    speakerLocation: row.speaker_location,
    mode: parseSessionMode(row.capture_mode),
    sourceUrl: row.source_url,
    sourceStartMs: row.source_start_ms,
    sourceEndMs: row.source_end_ms,
    folderId: row.folder_id,
  };
}

function rowToSession(row: DbRow): SessionRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    title: row.title,
    shortSummary: row.short_summary,
    speakerId: row.speaker_id,
    locationId: row.location_id,
    speakerName: row.speaker_name,
    speakerLocation: row.speaker_location,
    mode: parseSessionMode(row.capture_mode),
    sourceUrl: row.source_url,
    sourceStartMs: row.source_start_ms,
    sourceEndMs: row.source_end_ms,
    transcript: row.transcript,
    finalSummary: row.final_summary,
    folderId: row.folder_id,
  };
}

function rowToView(row: ViewRow): SessionView {
  return {
    ...rowToMeta(row),
    hasTranscript: row.has_transcript === true,
    finalSummary: row.final_summary,
  };
}

/**
 * Create the row at the START of a recording so the URL /recording/{id}/live
 * is stable from the first second. Fills only what the user knows at that
 * point (speaker + location snapshot); transcript/summary land
 * later via updateSessionFinal on stop.
 *
 * user_id is pulled from the authenticated Supabase session, RLS then
 * enforces that only the owner can read/update this row.
 */
export async function createEmptySession(input: CreateEmptySessionInput): Promise<string> {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) throw new Error("createEmptySession: not authenticated");

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      user_id: user.id,
      speaker_id: input.speakerId ?? null,
      location_id: input.locationId ?? null,
      speaker_name: input.speakerName,
      speaker_location: input.speakerLocation,
      capture_mode: input.mode ?? "audio",
      source_url: input.sourceUrl ?? null,
      source_start_ms: input.sourceStartMs ?? null,
      source_end_ms: input.sourceEndMs ?? null,
      transcript: "",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`createEmptySession failed: ${error?.message ?? "no id returned"}`);
  }
  return data.id;
}

/**
 * Fill an existing session on stop with the final transcript, curated feed,
 * summary payload, and duration. RLS scopes the update to the owner, so no
 * explicit ownership check is needed here.
 */
export async function updateSessionFinal(
  id: string,
  input: UpdateSessionFinalInput
): Promise<void> {
  const supabase = await createClient();
  const endedAt = new Date().toISOString();
  const patch: Record<string, unknown> = {
    ended_at: endedAt,
    duration_ms: input.durationMs,
    title: input.summary.title || null,
    short_summary: input.summary.shortSummary || null,
    speaker_name: input.speakerName,
    speaker_location: input.speakerLocation,
    transcript: input.transcript,
    final_summary: input.summary,
  };
  if (input.speakerId !== undefined) patch.speaker_id = input.speakerId;
  if (input.locationId !== undefined) patch.location_id = input.locationId;

  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) throw new Error(`updateSessionFinal failed: ${error.message}`);
}

export type ListSessionsFilter = {
  speakerId?: string;
  locationId?: string;
};

type ListRow = {
  id: string;
  created_at: string;
  duration_ms: number | null;
  title: string | null;
  short_summary: string | null;
  speaker_id: string | null;
  location_id: string | null;
  speaker_name: string | null;
  speaker_location: string | null;
  capture_mode: string | null;
  source_url: string | null;
  folder_id: string | null;
};

function rowToListItem(r: ListRow): SessionListItem {
  return {
    id: r.id,
    createdAt: r.created_at,
    durationMs: r.duration_ms,
    title: r.title,
    shortSummary: r.short_summary,
    speakerId: r.speaker_id,
    locationId: r.location_id,
    speakerName: r.speaker_name,
    speakerLocation: r.speaker_location,
    mode: parseSessionMode(r.capture_mode),
    sourceUrl: r.source_url,
    folderId: r.folder_id,
  };
}

/**
 * Sessões CONCLUÍDAS. `ended_at` só é preenchido por updateSessionFinal /
 * updateSessionTranscript, ou seja, ao encerrar de verdade, filtrar por ele
 * tira da lista as gravações que ficaram no meio do caminho, que passam a
 * viver em `listUnfinishedSessions`.
 */
export async function listSessions(filter: ListSessionsFilter = {}): Promise<SessionListItem[]> {
  const supabase = await createClient();
  let q = supabase
    .from("sessions")
    .select(SELECT_LIST)
    .not("ended_at", "is", null)
    .order("created_at", { ascending: false });

  if (filter.speakerId) q = q.eq("speaker_id", filter.speakerId);
  if (filter.locationId) q = q.eq("location_id", filter.locationId);

  const { data, error } = await q;
  if (error) throw new Error(`listSessions failed: ${error.message}`);
  return (data ?? []).map((r) => rowToListItem(r as ListRow));
}

/**
 * Gravações EM ABERTO, a linha existe, mas nunca foi encerrada. Acontece
 * quando o navegador fecha no meio, quando a bateria acaba, ou quando a pessoa
 * sai da página com a gravação congelada por falta de crédito.
 *
 * Ficam listadas para que a gravação não vire um fantasma invisível: o usuário
 * decide se volta para ela ou se apaga. Abrir a sessão de novo reaproveita os
 * chunks de áudio que ficaram pendentes no IndexedDB (ver `useTranscribeQueue`,
 * TTL de 24h); o texto já transcrito antes do fechamento, porém, vivia só na
 * memória da aba e não volta.
 */
export async function listUnfinishedSessions(): Promise<SessionListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(SELECT_LIST)
    .is("ended_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listUnfinishedSessions failed: ${error.message}`);
  return (data ?? []).map((r) => rowToListItem(r as ListRow));
}

/**
 * A sessão inteira, incluindo transcrição, feed e resumo.
 *
 * Memoizada por render pass: as páginas de sessão chamam isto no
 * `generateMetadata` E no corpo, e o Next só deduplica `fetch()`, consulta
 * do Supabase, não. Eram duas leituras das colunas mais pesadas do banco por
 * page view, a segunda apenas para descobrir o `title` da aba.
 *
 * Quem não precisa de `transcript`/`finalSummary` deve chamar
 * `getSessionMeta`.
 */
export const getSession = cache(async (id: string): Promise<SessionRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(SELECT_FULL)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getSession failed: ${error.message}`);
  return data ? rowToSession(data as DbRow) : null;
});

/** Cabeçalho da sessão, sem as colunas pesadas. Ver {@link SessionMeta}. */
/**
 * A sessão para a TELA do resumo: tudo menos a transcrição, mais o booleano
 * que diz se ela existe.
 *
 * É o que `/summary/:id` e `/summary/:id/edit` leem. Quem precisa do TEXTO é o
 * pipeline do servidor — reprocessar resumo, gerar estudo, relatar alucinação,
 * importar do YouTube — e esse continua em `getSession`, que roda no servidor e
 * não manda nada pelo fio.
 *
 * Memoizada pela mesma razão que `getSession`: a página chama isto no
 * `generateMetadata` E no corpo.
 */
export const getSessionView = cache(async (id: string): Promise<SessionView | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(SELECT_VIEW)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getSessionView failed: ${error.message}`);
  return data ? rowToView(data as unknown as ViewRow) : null;
});

/**
 * Só a transcrição, e a duração que a tela usa para carimbar os tempos.
 *
 * Existe porque ela saiu do payload do resumo: quem abre o dialog "Transcrição"
 * paga por ela então, e só então. `null` quer dizer que a sessão não é da
 * pessoa ou não existe — a RLS resolve, e quem chama devolve 404.
 */
export async function getSessionTranscript(
  id: string
): Promise<{ transcript: string; durationMs: number | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("transcript, duration_ms")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getSessionTranscript failed: ${error.message}`);
  if (!data) return null;
  const row = data as { transcript: string | null; duration_ms: number | null };
  return { transcript: row.transcript ?? "", durationMs: row.duration_ms };
}

export const getSessionMeta = cache(async (id: string): Promise<SessionMeta | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(SELECT_META)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getSessionMeta failed: ${error.message}`);
  return data ? rowToMeta(data as MetaRow) : null;
});

export type UpdateSessionMetaInput = {
  title?: string | null;
  speakerName?: string | null;
  speakerLocation?: string | null;
  speakerId?: string | null;
  locationId?: string | null;
  /** `null` = "sem pasta" (a raiz). RLS confere que a pasta apontada é do
   *  próprio usuário (migração 0068), então um id de pasta alheia simplesmente
   *  não passa no UPDATE, o que aqui aparece como erro do Supabase. */
  folderId?: string | null;
};

export async function updateSessionMeta(id: string, input: UpdateSessionMetaInput): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.speakerName !== undefined) patch.speaker_name = input.speakerName;
  if (input.speakerLocation !== undefined) patch.speaker_location = input.speakerLocation;
  if (input.speakerId !== undefined) patch.speaker_id = input.speakerId;
  if (input.locationId !== undefined) patch.location_id = input.locationId;
  if (input.folderId !== undefined) patch.folder_id = input.folderId;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) throw new Error(`updateSessionMeta failed: ${error.message}`);
}

export async function deleteSession(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw new Error(`deleteSession failed: ${error.message}`);
}

/**
 * Overwrite only the final_summary payload (plus its derived title and
 * short_summary). Used by POST /api/final-summary/reprocess, transcript,
 * duration_ms is preserved as originally captured.
 *
 * `keepTitle` existe para o resumo gerado sobre uma sessão do modo
 * transcrição: ali o título na linha foi ESCOLHIDO pela pessoa no cabeçalho da
 * gravação (não há LLM naquele modo para gerar um), e sobrescrevê-lo com o do
 * resumo apagaria em silêncio o que ela digitou. Quem chama decide, a rota de
 * reprocessamento não passa nada, porque lá o título anterior já veio do
 * próprio resumo que está sendo refeito.
 */
export async function updateSessionSummary(
  id: string,
  summary: SummaryPayload,
  opts: { keepTitle?: boolean; markEnded?: boolean } = {}
): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    short_summary: summary.shortSummary || null,
    final_summary: summary,
  };
  if (!opts.keepTitle) patch.title = summary.title || null;
  // `markEnded` é do modo `manual`, e não tem nada a ver com reprocessar: uma
  // sessão escrita à mão nasce por esta função, não por `updateSessionFinal`,
  // e sem carimbar `ended_at` ela ficaria para sempre na faixa "Gravações em
  // aberto" do `/home`, oferecendo continuar ou apagar uma gravação que nunca
  // existiu. É `now()` a cada salvamento, e não só no primeiro, porque a
  // coluna responde "quando este texto ficou pronto", e cada salvamento move
  // essa resposta.
  if (opts.markEnded) patch.ended_at = new Date().toISOString();
  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) throw new Error(`updateSessionSummary failed: ${error.message}`);
}

/**
 * Quais destes ids já têm resumo. Espelha `listDeepenedSessionIds`: uma
 * consulta de chave a mais para o /recordings poder mandar uma sessão do modo
 * transcrição que GANHOU resumo direto para `/summary`, em vez de fazê-la
 * pousar em `/transcript` só para ser redirecionada.
 *
 * `SELECT_LIST` não traz `final_summary` de propósito, é uma das três colunas
 * pesadas, e trazer o resumo inteiro de cada sessão para desenhar um cartão
 * seria o oposto do que aquela projeção existe para evitar. Daí a consulta
 * separada, que lê só a chave: o filtro `not final_summary is null` roda no
 * Postgres e volta uma lista de uuids.
 */
/**
 * Ids das sessões CONCLUÍDAS cuja transcrição contém `term`.
 *
 * A busca das listas é do cliente (ver `src/features/session/lib/search.ts`),
 * e este é o único pedaço que não pode ser: o texto da pregação não vai para a
 * lista, e não deve ir. Aqui o `ilike` roda no Postgres, sobre as linhas que a
 * RLS já escopou ao dono, e volta só a chave, o que a UI faz com ela é
 * acender o cartão correspondente.
 *
 * `escapeLikeValue` porque o termo é digitado por gente: sem ele um `%` deixa
 * de ser texto e vira "qualquer coisa", e a busca passa a responder outra
 * pergunta sem avisar ninguém. `limit` existe para o pior caso, um termo de
 * três letras que casa com o acervo inteiro devolveria a lista toda, que é
 * exatamente o resultado sem valor.
 */
export async function searchSessionIdsByTranscript(term: string, limit = 200): Promise<string[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .not("ended_at", "is", null)
    .ilike("transcript", `%${escapeLikeValue(trimmed)}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`searchSessionIdsByTranscript failed: ${error.message}`);
  return (data ?? []).map((r) => r.id as string);
}

export type SessionVerseHit = { sessionId: string; reference: string };

/**
 * Sessões que CITARAM a referência procurada.
 *
 * A pergunta "onde eu ouvi Jonas 1?" não é uma pergunta de texto: o pregador
 * disse "no primeiro capítulo de Jonas", a transcrição não contém "Jonas 1", e
 * o `ilike` acima devolve vazio com toda a confiança do mundo. Quem sabe a
 * resposta são as REFERÊNCIAS gravadas, o card `citedVerse` e o bloco
 * `bibleQuote` do resumo, e compará-las com a busca exige entender as duas
 * como referência, não como string. Ver `lib/domain/reference-query.ts`.
 *
 * O trabalho é dividido de propósito: a RPC peneira por PREFIXO de livro (é o
 * que dá para fazer sem reescrever o parser em SQL) e `referenceMatchesQuery`
 * decide capítulo e faixa de versículos aqui. Uma regra, um lugar.
 *
 * `p_books` continua sendo enviado e a RPC não o usa mais: ele era a peneira da
 * projeção `session_feed_items`, que foi dropada na migração 0058 junto com os
 * cards do feed ao vivo. Hoje a única fonte de referência é o bloco
 * `bibleQuote` do resumo, e toda sessão tem resumo.
 *
 * Uma referência por sessão: a lista mostra a pastilha com a que casou, e a
 * segunda não caberia na tela nem acrescentaria nada, o cartão já está aceso.
 */
export async function searchSessionsByReference(
  query: ReferenceQuery,
  limit = 400
): Promise<SessionVerseHit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("session_verse_references", { p_books: query.books, p_prefixes: query.prefixes })
    .limit(limit);
  if (error) throw new Error(`searchSessionsByReference failed: ${error.message}`);

  const hits = new Map<string, string>();
  for (const row of (data ?? []) as { session_id: string; reference: string }[]) {
    if (hits.has(row.session_id)) continue;
    if (!referenceMatchesQuery(row.reference, query)) continue;
    hits.set(row.session_id, row.reference.trim());
  }
  return [...hits].map(([sessionId, reference]) => ({ sessionId, reference }));
}

export type UpdateSessionTranscriptInput = {
  transcript: string;
  durationMs: number | null;
  /** Título escolhido pelo usuário no header da gravação (ou o padrão
   * "Gravação dia N de mês"). Modo transcrição não roda LLM, então não há
   * título gerado, este é o único que a sessão terá. */
  title: string | null;
  /** Preview curto para o card da lista: as primeiras frases da própria
   * transcrição, cortadas no servidor. Não é um resumo, é um trecho. */
  shortSummary: string | null;
  speakerName: string | null;
  speakerLocation: string | null;
  speakerId?: string | null;
  locationId?: string | null;
};

/**
 * Fecha uma sessão do modo transcrição: grava o texto capturado, a duração e
 * o título. `final_summary` fica null de propósito, é o que distingue uma
 * sessão transcript_only salva de uma sessão com resumo, e o que faz a página
 * salva renderizar a transcrição em vez do SummaryView.
 */
export async function updateSessionTranscript(
  id: string,
  input: UpdateSessionTranscriptInput
): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    ended_at: new Date().toISOString(),
    duration_ms: input.durationMs,
    title: input.title,
    short_summary: input.shortSummary,
    speaker_name: input.speakerName,
    speaker_location: input.speakerLocation,
    transcript: input.transcript,
  };
  if (input.speakerId !== undefined) patch.speaker_id = input.speakerId;
  if (input.locationId !== undefined) patch.location_id = input.locationId;

  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) throw new Error(`updateSessionTranscript failed: ${error.message}`);
}
