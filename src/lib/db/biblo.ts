import "server-only";
import type { BibloBilling, BibloRole, BibloSuggestion } from "@/lib/domain/biblo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * A conversa com o Biblo. Migração 0062.
 *
 * **Leitura pelo client do USUÁRIO, escrita pelo de service-role**, e a
 * assimetria é a segurança inteira desta tabela: `authenticated` tem `select` e
 * mais nada, então a RLS já responde "é sua?" em toda leitura, e nenhuma
 * escrita pode vir do navegador. Quem pudesse inserir escolheria o próprio
 * `billing` — e `'gift'` é o valor que não custa moeda — ou escreveria uma
 * linha `role = 'assistant'`, pondo palavras na boca do Biblo dentro do app.
 */

export type BibloRow = {
  id: string;
  role: BibloRole;
  content: string;
  chips: string[];
  suggestion: BibloSuggestion | null;
  /** Só em linha do assistente: o resumo do que ficou fora da janela. */
  thread: string | null;
  /** Só em linha do usuário. */
  billing: BibloBilling | null;
  createdAt: string;
};

type DbRow = {
  id: string;
  role: string;
  content: string;
  chips: unknown;
  suggestion: unknown;
  thread: string | null;
  billing: string | null;
  created_at: string;
};

const COLUMNS = "id, role, content, chips, suggestion, thread, billing, created_at";

/**
 * Teto de linhas trazidas numa leitura. Não é paginação: a janela que vai ao
 * modelo são os últimos 6 pares (`lib/biblo/window.ts`), e a gaveta mostra a
 * conversa inteira. 200 é o ponto em que "a conversa inteira" deixa de ser
 * verdade e vira um payload — e uma conversa de 200 mensagens numa sessão só
 * é um caso que ainda não aconteceu.
 */
const MAX_ROWS = 200;

function toRow(row: DbRow): BibloRow {
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    chips: Array.isArray(row.chips) ? (row.chips as string[]) : [],
    suggestion: (row.suggestion as BibloSuggestion | null) ?? null,
    thread: row.thread,
    billing: (row.billing as BibloBilling | null) ?? null,
    createdAt: row.created_at,
  };
}

/** A conversa de uma sessão, em ordem. RLS decide se ela é de quem pergunta. */
export async function listBibloRows(sessionId: string): Promise<BibloRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("biblo_messages")
    .select(COLUMNS)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(MAX_ROWS);
  if (error) throw new Error(`listBibloRows failed: ${error.message}`);
  return ((data ?? []) as DbRow[]).map(toRow);
}

/**
 * Quantas mensagens de PRESENTE esta conta já usou.
 *
 * Sai da própria tabela, e não de um contador em `profiles`, porque um
 * contador é um segundo lugar onde a verdade mora e um dia os dois discordam.
 * O índice parcial `biblo_messages_gift_idx` existe exatamente para esta
 * consulta.
 */
export async function countGiftMessages(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("biblo_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("billing", "gift");
  if (error) throw new Error(`countGiftMessages failed: ${error.message}`);
  return count ?? 0;
}

export type InsertBibloMessage = {
  sessionId: string;
  userId: string;
  role: BibloRole;
  content: string;
  chips?: string[];
  suggestion?: BibloSuggestion | null;
  thread?: string | null;
  billing?: BibloBilling | null;
};

export async function insertBibloMessage(input: InsertBibloMessage): Promise<BibloRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("biblo_messages")
    .insert({
      session_id: input.sessionId,
      user_id: input.userId,
      role: input.role,
      content: input.content,
      // `null` e não `[]`/`{}` nas linhas do usuário: o `check` da migração
      // amarra `billing` ao papel, e deixar as colunas do assistente
      // preenchidas com vazio faria uma pergunta parecer uma resposta sem
      // conteúdo numa leitura direta do banco.
      chips: input.role === "assistant" ? (input.chips ?? []) : null,
      suggestion: input.role === "assistant" ? (input.suggestion ?? null) : null,
      thread: input.role === "assistant" ? (input.thread ?? null) : null,
      billing: input.role === "user" ? (input.billing ?? null) : null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`insertBibloMessage failed: ${error.message}`);
  return toRow(data as DbRow);
}
