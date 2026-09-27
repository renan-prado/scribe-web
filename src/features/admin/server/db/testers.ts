import "server-only";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A fila do teste fechado da Play Store, vista pelo painel.
 *
 * É a leitura irmã de `lib/db/testers.ts` (que é a ESCRITA, chamada pelo
 * formulário público) e mora aqui pela mesma razão que `db/admin/*` inteiro:
 * só o painel a lê. Tudo com service-role, porque `tester_signups` tem RLS
 * ligada e nenhuma policy, ver a migração 0078.
 *
 * **A tela existe para substituir um ritual de SQL.** Enquanto ela não
 * existia, convidar alguém era abrir o painel do Supabase, rodar um
 * `string_agg` à mão, colar no console do Google Play e rodar um `update`
 * para marcar quem entrou. Três passos manuais num banco de produção, com um
 * `where` digitado na hora entre eles.
 */

const log = createLogger("admin/testers");

/**
 * Teto da listagem, e ele é DITO na tela quando é atingido.
 *
 * Mesma régua de `ADMIN_SESSIONS_PAGE_SIZE` e do teto de `/admin/users`: 500
 * linhas cheias podem ser 500 de 500 ou 500 de cinco mil, e sem a linha do
 * rodapé as duas são a mesma tela. O dia em que a base passar disso precisa
 * ser visível, não a lista parando de crescer em silêncio.
 */
export const ADMIN_TESTERS_PAGE_SIZE = 500;

export type TesterSignupRow = {
  id: string;
  playEmail: string;
  whatsapp: string;
  displayName: string | null;
  /** Nulo enquanto o e-mail não foi para a lista do console do Google Play. */
  invitedAt: string | null;
  /** Nulo enquanto a pessoa não criou a conta no app. Ver a migração 0079. */
  giftedAt: string | null;
  createdAt: string;
};

export type AdminTesterSignups = {
  rows: TesterSignupRow[];
  /** Quantos ainda não foram para o console. É a fila de trabalho. */
  pending: number;
  /** Convidados que ainda não apareceram no app. */
  waiting: number;
  /** Convidados que já criaram a conta (o presente saiu). */
  joined: number;
  total: number;
  /** A listagem bateu no teto? Ver `ADMIN_TESTERS_PAGE_SIZE`. */
  capped: boolean;
};

type Row = {
  id: string;
  play_email: string;
  whatsapp: string;
  display_name: string | null;
  invited_at: string | null;
  gifted_at: string | null;
  created_at: string;
};

/**
 * A fila inteira, mais recentes por último.
 *
 * **Ordem CRESCENTE, ao contrário de toda outra lista do painel.** As outras
 * são leitura ("o que aconteceu?") e abrem pelo mais novo; esta é uma FILA, e
 * quem está esperando há mais tempo é quem precisa ser atendido primeiro. A
 * ordem da tela é a ordem em que os e-mails são colados no console.
 */
export async function loadAdminTesterSignups(): Promise<AdminTesterSignups> {
  const supabase = createAdminClient();
  const { data, error, count } = await supabase
    .from("tester_signups")
    .select("id, play_email, whatsapp, display_name, invited_at, gifted_at, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: true })
    .limit(ADMIN_TESTERS_PAGE_SIZE);

  if (error) {
    log.error("falha ao ler a fila de testadores", { error: error.message });
    throw new Error(`loadAdminTesterSignups failed: ${error.message}`);
  }

  const rows = (data ?? []).map((r) => {
    const row = r as Row;
    return {
      id: row.id,
      playEmail: row.play_email,
      whatsapp: row.whatsapp,
      displayName: row.display_name,
      invitedAt: row.invited_at,
      giftedAt: row.gifted_at,
      createdAt: row.created_at,
    };
  });

  // As contagens saem das LINHAS que vieram, e o `total` do `count` exato do
  // PostgREST. Com o teto atingido os dois discordam, e é o rodapé da tela que
  // conta isso: uma contagem parcial apresentada como total é exatamente o
  // tipo de número que ninguém confere.
  return {
    rows,
    pending: rows.filter((r) => r.invitedAt === null).length,
    waiting: rows.filter((r) => r.invitedAt !== null && r.giftedAt === null).length,
    joined: rows.filter((r) => r.giftedAt !== null).length,
    total: count ?? rows.length,
    capped: rows.length >= ADMIN_TESTERS_PAGE_SIZE,
  };
}

/**
 * Marca como convidado. Sem `ids`, marca a FILA INTEIRA.
 *
 * O `is("invited_at", null)` não é decoração nos dois casos: ele garante que
 * remarcar alguém não reescreva a data do convite que já aconteceu. A data é o
 * registro de QUANDO o endereço entrou no console, e sobrescrevê-la com o
 * `now()` de um clique distraído apagaria a única pista de há quanto tempo
 * aquela pessoa está esperando o Google propagar.
 */
export async function markTesterSignupsInvited(ids?: string[]): Promise<number> {
  const supabase = createAdminClient();
  let query = supabase
    .from("tester_signups")
    .update({ invited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .is("invited_at", null);
  if (ids && ids.length > 0) query = query.in("id", ids);

  const { data, error } = await query.select("id");
  if (error) {
    log.error("falha ao marcar testadores como convidados", { error: error.message });
    return 0;
  }
  const marked = data?.length ?? 0;
  log.info("testadores marcados como convidados", { marked });
  return marked;
}

/**
 * Devolve alguém para a fila, apagando a data do convite.
 *
 * Existe para o engano de um clique, e não como estado de produto: a pessoa
 * continua na lista do console do Google Play depois disto, porque quem manda
 * lá é o console, não esta coluna. O que ele desfaz é a nossa ANOTAÇÃO de que
 * o endereço já foi colado.
 */
export async function undoTesterSignupInvite(id: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("tester_signups")
    .update({ invited_at: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    log.error("falha ao desfazer convite de testador", { error: error.message });
    return false;
  }
  return true;
}
