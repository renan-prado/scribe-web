import "server-only";
import {
  aggregateMeasuredRevenue,
  type CoinCreditRow,
  REVENUE_CREDIT_REASONS,
  REVENUE_REVERSAL_REASONS,
} from "@/features/admin/finance/measured";
import { isActiveStatus, isPlanKey, type PlanKey } from "@/features/billing/plans";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

const log = createLogger("admin.users");

/**
 * Admin-side user management. All functions here assume the caller has
 * already been authorized via `requireAdmin`, they use the service-role
 * client and will happily return everyone's data.
 */

/**
 * Em que pé a conta está com o dinheiro. Quatro classes, EXCLUDENTES, e a
 * ordem delas é a da pergunta que a tela responde: quem paga, quem já pagou,
 * quem pagou sem nunca assinar, quem nunca pagou.
 */
export type PayingStatus =
  /** Assinatura viva agora: `active`, `trialing` ou `past_due`. */
  | "assinante"
  /** Pagou ao menos uma fatura e hoje não tem assinatura viva. */
  | "ex_assinante"
  /** Nunca assinou, mas comprou pacote avulso. Também é conta pagante. */
  | "avulso"
  | "nunca";

/**
 * O retrato financeiro de uma conta, e de onde cada metade dele sai.
 *
 * `subscriptions` é um ESPELHO mutável: uma linha por conta, sobrescrita pelo
 * webhook a cada mudança de estado. Ela responde bem "esta conta paga AGORA, e
 * por qual plano", e responde mal todo o resto. Quem cancelou e voltou tem uma
 * linha só; o `created_at` dela é a primeira assinatura, não o começo do
 * período atual; e quem abandonou o checkout no meio (`incomplete`) tem linha
 * igual a quem pagou, sem nunca ter pago nada.
 *
 * Quem tem HISTÓRICO é `coin_transactions`: cada fatura paga vira uma linha com
 * `external_ref` único (`features/billing/server/fulfill.ts`), e ela nunca é
 * reescrita. Daí a divisão: o PLANO vem do espelho, o TEMPO e o DINHEIRO vêm do
 * ledger. Perguntar "há quanto tempo é pagante" ao espelho devolveria a data de
 * uma intenção, não a de um pagamento.
 */
export type AdminUserBilling = {
  status: PayingStatus;
  /** Plano do espelho, mesmo quando a assinatura já morreu (é o último). */
  plan: PlanKey | null;
  /** Status cru do Stripe: active | canceled | past_due | incomplete | ... */
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  /** Primeiro e último dinheiro que entrou. `null` = nunca pagou nada. */
  firstPaidAt: string | null;
  lastPaidAt: string | null;
  /**
   * Quanto tempo de fato pagando, em dias: do primeiro pagamento ao último —
   * ou até HOJE, enquanto a assinatura está viva.
   *
   * Calculado aqui, no servidor, e não na tela: `UsersManager` é um componente
   * cliente que o servidor renderiza antes de hidratar, e um `Date.now()` lá
   * dentro produz dois valores para o mesmo HTML.
   */
  paidSpanDays: number | null;
  /** Faturas de assinatura pagas. */
  invoices: number;
  /** Compras de pacote avulso (uma por checkout, qualquer quantidade). */
  topups: number;
  /** Tudo que entrou menos estornos, em centavos de BRL. */
  revenueCents: number;
  /**
   * Créditos que não casaram com nenhum item do catálogo e portanto NÃO entram
   * em `revenueCents`. A tela precisa poder dizer que aquele total está
   * incompleto, ver o cabeçalho de `features/admin/finance/measured.ts`.
   */
  unmappedCredits: number;
};

export type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  /**
   * O saldo de moedas AGORA. Ele vem da mesma linha de `profiles` que o resto
   * desta lista, então não custa consulta nenhuma — e sem ele o diálogo de
   * crédito avulso pediria à pessoa que digitasse um número sem saber quanto
   * já existe na conta, que é a informação que decide se ela vai dar 50 ou 500.
   */
  coinBalance: number | null;
  billing: AdminUserBilling;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  role: "user" | "admin";
  is_active: boolean;
  created_at: string;
  coin_balance: number | null;
};

const SELECT = "id, display_name, avatar_url, email, role, is_active, created_at, coin_balance";

/**
 * Teto da listagem do /admin/users. Quando a base passar disto, a tela precisa
 * de paginação de verdade, e o número aparecer aqui é o que torna esse dia
 * visível, em vez de a lista simplesmente parar de crescer em silêncio.
 */
const ADMIN_USERS_PAGE_SIZE = 1000;

export async function listUsers(): Promise<AdminUser[]> {
  const admin = createAdminClient();

  // O teto é explícito e casa com o `perPage` do enriquecimento logo abaixo.
  // Sem ele, quem limitava a consulta era o `max-rows` que o Supabase configura
  // por padrão no PostgREST, um default de plataforma fazendo o papel de uma
  // decisão nossa, que é justamente o padrão que esta auditoria vem
  // desmontando. E os dois lados discordarem é pior que qualquer um dos dois:
  // com mais de mil contas, a lista traria perfis cujo "último acesso" viria
  // sempre vazio, sem nada na tela dizendo por quê.
  const { data: profiles, error } = await admin
    .from("profiles")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(ADMIN_USERS_PAGE_SIZE);
  if (error) throw new Error(`listUsers profiles failed: ${error.message}`);

  const lastSignIn = new Map<string, string | null>();
  const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: ADMIN_USERS_PAGE_SIZE,
  });
  if (authErr) {
    log.warn("listUsers auth enrichment failed", { error: authErr.message });
  } else {
    for (const u of authData.users) {
      lastSignIn.set(u.id, u.last_sign_in_at ?? null);
    }
  }

  const billing = await loadBilling(admin);

  return (profiles as ProfileRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastSignInAt: lastSignIn.get(row.id) ?? null,
    coinBalance: row.coin_balance,
    billing: billing.get(row.id) ?? NEVER_PAID,
  }));
}

type AdminClient = ReturnType<typeof createAdminClient>;

/** Teto das duas consultas de cobrança. Mesma razão do teto dos perfis. */
const BILLING_MAX_ROWS = 50_000;

const NEVER_PAID: AdminUserBilling = {
  status: "nunca",
  plan: null,
  subscriptionStatus: null,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  firstPaidAt: null,
  lastPaidAt: null,
  paidSpanDays: null,
  invoices: 0,
  topups: 0,
  revenueCents: 0,
  unmappedCredits: 0,
};

type SubscriptionRow = {
  user_id: string;
  plan: string | null;
  status: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
};

type LedgerRow = {
  user_id: string | null;
  reason: string;
  amount: number;
  created_at: string;
};

/**
 * O retrato financeiro de TODAS as contas, de uma vez.
 *
 * Duas consultas, sem `.in(userIds)`, e isso é deliberado: com mil perfis o
 * filtro viraria uma URL de mil UUIDs no PostgREST, e as duas tabelas aqui são
 * pequenas comparadas a `profiles` — uma linha por conta que já assinou, uma
 * linha por pagamento. O cruzamento sai em memória. De quebra, some a
 * pegadinha do `in([])`, que o PostgREST lê como "sem filtro" e responde com a
 * base inteira.
 *
 * O dinheiro em reais NÃO é calculado aqui: quem converte moedas creditadas em
 * centavos é `aggregateMeasuredRevenue`, a mesma função que desenha a receita
 * de `/admin/financeiro`. Uma segunda conversão aqui daria dois totais de
 * receita no mesmo painel, e um dia eles discordariam.
 */
async function loadBilling(admin: AdminClient): Promise<Map<string, AdminUserBilling>> {
  const [subs, ledger] = await Promise.all([
    admin
      .from("subscriptions")
      .select("user_id, plan, status, cancel_at_period_end, current_period_end")
      .limit(BILLING_MAX_ROWS),
    admin
      .from("coin_transactions")
      .select("user_id, reason, amount, created_at")
      .in("reason", [...REVENUE_CREDIT_REASONS, ...REVENUE_REVERSAL_REASONS])
      .order("created_at", { ascending: true })
      .limit(BILLING_MAX_ROWS),
  ]);

  if (subs.error) throw new Error(`listUsers subscriptions failed: ${subs.error.message}`);
  if (ledger.error) throw new Error(`listUsers ledger failed: ${ledger.error.message}`);

  const rowsByUser = new Map<string, LedgerRow[]>();
  for (const raw of (ledger.data ?? []) as LedgerRow[]) {
    // `user_id` nulo é conta APAGADA (migração 0056). O pagamento dela
    // continua contando na receita do painel financeiro; aqui não há a quem
    // somar, e inventar uma linha para ninguém seria pior que omiti-la.
    if (!raw.user_id) continue;
    const list = rowsByUser.get(raw.user_id);
    if (list) list.push(raw);
    else rowsByUser.set(raw.user_id, [raw]);
  }

  const out = new Map<string, AdminUserBilling>();
  const now = Date.now();
  const subsByUser = new Map<string, SubscriptionRow>();
  for (const sub of (subs.data ?? []) as SubscriptionRow[]) subsByUser.set(sub.user_id, sub);

  for (const userId of new Set([...subsByUser.keys(), ...rowsByUser.keys()])) {
    const sub = subsByUser.get(userId);
    const rows = rowsByUser.get(userId) ?? [];

    let invoices = 0;
    let topups = 0;
    let firstPaidAt: string | null = null;
    let lastPaidAt: string | null = null;
    for (const row of rows) {
      if (row.reason === "subscription_grant") invoices += 1;
      else if (row.reason === "topup_pack") topups += 1;
      else continue; // estorno: entra no dinheiro, não conta como pagamento
      firstPaidAt ??= row.created_at;
      lastPaidAt = row.created_at;
    }

    const credits: CoinCreditRow[] = rows.map((r) => ({
      reason: r.reason,
      amount: r.amount,
      createdAt: r.created_at,
    }));
    const revenue = aggregateMeasuredRevenue(credits);

    // Só conta como assinatura VIVA um plano pago: a linha `free` existe no
    // espelho de quem nunca chegou a pagar, e `status` nela pode ser qualquer
    // coisa que o Stripe tenha dito pelo caminho.
    const plan = isPlanKey(sub?.plan) ? sub.plan : null;
    const active = plan !== null && plan !== "free" && isActiveStatus(sub?.status);

    const status: PayingStatus = active
      ? "assinante"
      : invoices > 0
        ? "ex_assinante"
        : topups > 0
          ? "avulso"
          : "nunca";

    // A régua do tempo é o DINHEIRO, nos dois lados: começa no primeiro
    // pagamento e termina no último — ou em hoje, enquanto a assinatura vive.
    // Um ex-assinante medido até hoje apareceria como cliente de dois anos
    // tendo pago três meses e sumido.
    const from = firstPaidAt ? Date.parse(firstPaidAt) : Number.NaN;
    const to = active ? now : lastPaidAt ? Date.parse(lastPaidAt) : Number.NaN;
    const paidSpanDays =
      Number.isFinite(from) && Number.isFinite(to) && to >= from
        ? Math.floor((to - from) / 86_400_000)
        : null;

    out.set(userId, {
      status,
      plan,
      subscriptionStatus: sub?.status ?? null,
      cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
      currentPeriodEnd: sub?.current_period_end ?? null,
      firstPaidAt,
      lastPaidAt,
      paidSpanDays,
      invoices,
      topups,
      revenueCents: revenue.totalCents,
      unmappedCredits: revenue.unmapped,
    });
  }

  return out;
}

export type UpdateUserInput = {
  displayName?: string | null;
  role?: "user" | "admin";
  isActive?: boolean;
  email?: string;
};

export async function updateUser(id: string, input: UpdateUserInput): Promise<void> {
  const admin = createAdminClient();

  if (input.email !== undefined) {
    // O e-mail é IDENTIDADE aqui, não um campo de cadastro: `getCurrentPartner`
    // resolve o vínculo parceiro↔conta casando o e-mail do login com
    // `partners.invited_email`. Trocar o e-mail de uma conta pode, portanto,
    // torná-la parceira, e `updateUserById` grava sem pedir confirmação ao
    // dono do endereço. É poder legítimo de admin, mas é o tipo de mudança que
    // alguém precisa conseguir reconstruir depois, então o valor ANTIGO vai
    // para o log em `info` (a rota registra só os NOMES dos campos alterados).
    const { data: before } = await admin.auth.admin.getUserById(id);
    const { error } = await admin.auth.admin.updateUserById(id, { email: input.email });
    if (error) throw new Error(`updateUser email failed: ${error.message}`);
    log.info("e-mail trocado pelo admin", {
      id,
      from: before?.user?.email ?? null,
      to: input.email,
    });
  }

  const profilePatch: Record<string, unknown> = {};
  if (input.displayName !== undefined) profilePatch.display_name = input.displayName;
  if (input.role !== undefined) profilePatch.role = input.role;
  if (input.isActive !== undefined) profilePatch.is_active = input.isActive;
  if (input.email !== undefined) profilePatch.email = input.email;

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await admin.from("profiles").update(profilePatch).eq("id", id);
    if (error) throw new Error(`updateUser profile failed: ${error.message}`);
  }
}

export async function deleteUser(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(`deleteUser failed: ${error.message}`);
}
