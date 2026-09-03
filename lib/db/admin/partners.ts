import "server-only";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

const log = createLogger("admin/partners");

/**
 * CRUD e agregados de parceiros para o admin.
 *
 * Tudo pelo service-role, depois de `requireAdmin()`. As tabelas de parceiro
 * têm policy só de SELECT (e só das próprias linhas) — não existe policy de
 * escrita em nenhuma delas, o que é a forma mais forte de dizer que o cliente
 * nunca escreve aqui.
 *
 * Sobre o pagamento: `registerPayout` é o passo que faz o "a receber" do
 * painel voltar a zero. Sem ele, o total devido seria um SUM() de comissões
 * que nunca diminui, e o primeiro PIX pago deixaria o número mentindo para
 * sempre — a mesma razão pela qual o saldo de moedas é derivado do ledger em
 * vez de contado à mão.
 */

export type AdminPartner = {
  id: string;
  userId: string | null;
  invitedEmail: string;
  slug: string;
  displayName: string;
  socials: Record<string, string>;
  doc: string | null;
  pixKey: string | null;
  commissionRateBps: number;
  signupBonusCoins: number;
  monthlyCoins: number;
  bonusBudgetCoins: number | null;
  bonusGrantedCoins: number;
  status: "active" | "suspended";
  createdAt: string;
};

/** Números do funil e do dinheiro de UM parceiro. Só agregados. */
export type PartnerStats = {
  clicks: number;
  uniqueVisitors: number;
  signups: number;
  subscribers: number;
  /** Comissões dentro da carência de 30 dias. */
  pendingCents: number;
  /** Já fora da carência e ainda não pagas — é o que entra no próximo PIX. */
  availableCents: number;
  paidCents: number;
  reversedCents: number;
  /** Conversão cadastro → assinante deste parceiro. */
  conversionRate: number;
};

export type AdminPartnerWithStats = AdminPartner & { stats: PartnerStats };

type PartnerRow = {
  id: string;
  user_id: string | null;
  invited_email: string;
  slug: string;
  display_name: string;
  socials: Record<string, string> | null;
  doc: string | null;
  pix_key: string | null;
  commission_rate_bps: number;
  signup_bonus_coins: number;
  monthly_coins: number;
  bonus_budget_coins: number | null;
  bonus_granted_coins: number;
  status: "active" | "suspended";
  created_at: string;
};

const SELECT =
  "id, user_id, invited_email, slug, display_name, socials, doc, pix_key, commission_rate_bps, signup_bonus_coins, monthly_coins, bonus_budget_coins, bonus_granted_coins, status, created_at";

function toPartner(row: PartnerRow): AdminPartner {
  return {
    id: row.id,
    userId: row.user_id,
    invitedEmail: row.invited_email,
    slug: row.slug,
    displayName: row.display_name,
    socials: row.socials ?? {},
    doc: row.doc,
    pixKey: row.pix_key,
    commissionRateBps: row.commission_rate_bps,
    signupBonusCoins: row.signup_bonus_coins,
    monthlyCoins: row.monthly_coins ?? 0,
    bonusBudgetCoins: row.bonus_budget_coins,
    bonusGrantedCoins: row.bonus_granted_coins,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listPartners(): Promise<AdminPartnerWithStats[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("partners")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listPartners failed: ${error.message}`);

  const partners = ((data ?? []) as PartnerRow[]).map(toPartner);
  if (partners.length === 0) return [];

  const ids = partners.map((p) => p.id);
  const [clicks, signups, commissions, subscribers] = await Promise.all([
    loadClicks(admin, ids),
    loadSignups(admin, ids),
    loadCommissionTotals(admin, ids),
    loadSubscribers(admin, ids),
  ]);

  return partners.map((p) => {
    const signupCount = signups.get(p.id) ?? 0;
    const subscriberCount = subscribers.get(p.id) ?? 0;
    return {
      ...p,
      stats: {
        ...(clicks.get(p.id) ?? { clicks: 0, uniqueVisitors: 0 }),
        signups: signupCount,
        subscribers: subscriberCount,
        ...(commissions.get(p.id) ?? {
          pendingCents: 0,
          availableCents: 0,
          paidCents: 0,
          reversedCents: 0,
        }),
        conversionRate: signupCount > 0 ? subscriberCount / signupCount : 0,
      },
    };
  });
}

export async function getPartner(id: string): Promise<AdminPartner | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("partners").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`getPartner failed: ${error.message}`);
  return data ? toPartner(data as PartnerRow) : null;
}

export type PartnerInput = {
  invitedEmail: string;
  slug: string;
  displayName: string;
  socials?: Record<string, string>;
  doc?: string | null;
  pixKey?: string | null;
  commissionRateBps?: number;
  signupBonusCoins?: number;
  monthlyCoins?: number;
  bonusBudgetCoins?: number | null;
  status?: "active" | "suspended";
};

export async function createPartner(input: PartnerInput): Promise<AdminPartner> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partners")
    .insert({
      invited_email: input.invitedEmail,
      slug: input.slug,
      display_name: input.displayName,
      socials: input.socials ?? {},
      doc: input.doc ?? null,
      pix_key: input.pixKey ?? null,
      commission_rate_bps: input.commissionRateBps,
      signup_bonus_coins: input.signupBonusCoins,
      monthly_coins: input.monthlyCoins,
      bonus_budget_coins: input.bonusBudgetCoins ?? null,
      status: input.status ?? "active",
    })
    .select(SELECT)
    .single();
  if (error) throw new Error(`createPartner failed: ${error.message}`);
  return toPartner(data as PartnerRow);
}

export async function updatePartner(
  id: string,
  input: Partial<PartnerInput>
): Promise<AdminPartner> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.invitedEmail !== undefined) patch.invited_email = input.invitedEmail;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.displayName !== undefined) patch.display_name = input.displayName;
  if (input.socials !== undefined) patch.socials = input.socials;
  if (input.doc !== undefined) patch.doc = input.doc;
  if (input.pixKey !== undefined) patch.pix_key = input.pixKey;
  if (input.commissionRateBps !== undefined) patch.commission_rate_bps = input.commissionRateBps;
  if (input.signupBonusCoins !== undefined) patch.signup_bonus_coins = input.signupBonusCoins;
  if (input.monthlyCoins !== undefined) patch.monthly_coins = input.monthlyCoins;
  if (input.bonusBudgetCoins !== undefined) patch.bonus_budget_coins = input.bonusBudgetCoins;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await admin
    .from("partners")
    .update(patch)
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw new Error(`updatePartner failed: ${error.message}`);
  return toPartner(data as PartnerRow);
}

/**
 * Liga a linha do parceiro a uma conta do app, casando pelo e-mail do convite.
 * Chamada quando o admin quer resolver o vínculo sem esperar o primeiro login.
 */
export async function linkPartnerToUserByEmail(id: string, email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (!profile) return false;
  const { error } = await admin.from("partners").update({ user_id: profile.id }).eq("id", id);
  if (error) throw new Error(`linkPartnerToUser failed: ${error.message}`);
  return true;
}

/**
 * O carimbo das comissões falhou DEPOIS de a linha de pagamento existir.
 *
 * É o único estado inconsistente que `registerPayout` consegue produzir, e o
 * que a interface precisa saber para não piorá-lo: repetir a operação criaria
 * um SEGUNDO pagamento sobre as mesmas comissões, ou seja, pagaria em dobro.
 * Uma classe própria em vez de um texto de erro porque essa distinção decide o
 * que o operador faz em seguida.
 */
export class PayoutStampError extends Error {
  constructor(
    readonly payoutId: string,
    cause: string
  ) {
    super(`registerPayout stamp failed (payout ${payoutId}): ${cause}`);
    this.name = "PayoutStampError";
  }
}

/**
 * Registra um pagamento e CARIMBA as comissões que ele quitou.
 *
 * As duas coisas andam juntas: criar a linha de pagamento sem marcar as
 * comissões deixaria o "a receber" do painel intacto, e o parceiro veria o
 * mesmo valor pendente depois de já ter recebido.
 *
 * Só comissões fora da carência e ainda não quitadas entram. O valor pago é o
 * que estava disponível NO MOMENTO — não um número digitado à mão — para que
 * a linha de pagamento e as comissões que ela quita sempre fechem.
 */
export async function registerPayout(args: {
  partnerId: string;
  period: string;
  note?: string | null;
  /** Link externo do comprovante (Drive, etc). Não é storage nosso. */
  receiptUrl?: string | null;
}): Promise<{ amountCents: number; commissions: number } | null> {
  const admin = createAdminClient();

  const { data: due, error: dueErr } = await admin
    .from("partner_commissions")
    .select("id, commission_cents")
    .eq("partner_id", args.partnerId)
    .in("status", ["pending", "available"])
    .is("payout_id", null)
    .lte("available_at", new Date().toISOString());
  if (dueErr) throw new Error(`registerPayout lookup failed: ${dueErr.message}`);
  if (!due || due.length === 0) return null;

  const amountCents = due.reduce((acc, r) => acc + (r.commission_cents as number), 0);

  const { data: payout, error: payoutErr } = await admin
    .from("partner_payouts")
    .insert({
      partner_id: args.partnerId,
      period: args.period,
      amount_cents: amountCents,
      note: args.note ?? null,
      receipt_url: args.receiptUrl ?? null,
    })
    .select("id")
    .single();
  if (payoutErr) throw new Error(`registerPayout insert failed: ${payoutErr.message}`);

  const { error: stampErr } = await admin
    .from("partner_commissions")
    .update({ status: "paid", payout_id: payout.id })
    .in(
      "id",
      due.map((r) => r.id as string)
    );
  if (stampErr) {
    // O pagamento existe mas as comissões não foram carimbadas: o valor
    // apareceria como devido de novo no mês seguinte. Log em `error` porque
    // exige conserto manual — e o id do payout é o que permite achá-lo.
    log.error("payout created but commissions NOT stamped", {
      payoutId: payout.id,
      partnerId: args.partnerId,
      error: stampErr.message,
    });
    throw new PayoutStampError(payout.id, stampErr.message);
  }

  return { amountCents, commissions: due.length };
}

// --- agregados ---------------------------------------------------------------

type AdminClient = ReturnType<typeof createAdminClient>;

async function loadClicks(
  admin: AdminClient,
  ids: string[]
): Promise<Map<string, { clicks: number; uniqueVisitors: number }>> {
  const { data, error } = await admin
    .from("partner_clicks")
    .select("partner_id, clicks, uniques")
    .in("partner_id", ids);
  if (error) throw new Error(`loadClicks failed: ${error.message}`);
  const map = new Map<string, { clicks: number; uniqueVisitors: number }>();
  for (const row of data ?? []) {
    const key = row.partner_id as string;
    const prev = map.get(key) ?? { clicks: 0, uniqueVisitors: 0 };
    map.set(key, {
      clicks: prev.clicks + (row.clicks as number),
      uniqueVisitors: prev.uniqueVisitors + (row.uniques as number),
    });
  }
  return map;
}

async function loadSignups(admin: AdminClient, ids: string[]): Promise<Map<string, number>> {
  const { data, error } = await admin.from("profiles").select("partner_id").in("partner_id", ids);
  if (error) throw new Error(`loadSignups failed: ${error.message}`);
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const key = row.partner_id as string;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

/**
 * Assinantes por parceiro.
 *
 * Conta quem TEM comissão registrada, e não quem tem assinatura ativa. São
 * perguntas diferentes: a comissão é sobre a primeira assinatura e não some
 * quando a pessoa cancela — que é justamente o número que o parceiro precisa
 * ver, porque é o que ele foi pago para trazer.
 */
async function loadSubscribers(admin: AdminClient, ids: string[]): Promise<Map<string, number>> {
  const { data, error } = await admin
    .from("partner_commissions")
    .select("partner_id, status")
    .in("partner_id", ids)
    .neq("status", "reversed");
  if (error) throw new Error(`loadSubscribers failed: ${error.message}`);
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const key = row.partner_id as string;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

type CommissionTotals = {
  pendingCents: number;
  availableCents: number;
  paidCents: number;
  reversedCents: number;
};

/**
 * Totais por situação. A distinção pendente × disponível é resolvida em QUERY
 * (`available_at <= now()`), não por um cron que promove linhas: menos peça
 * móvel, e o estado é sempre verdadeiro no instante em que se olha.
 */
async function loadCommissionTotals(
  admin: AdminClient,
  ids: string[]
): Promise<Map<string, CommissionTotals>> {
  const { data, error } = await admin
    .from("partner_commissions")
    .select("partner_id, commission_cents, status, available_at, payout_id")
    .in("partner_id", ids);
  if (error) throw new Error(`loadCommissionTotals failed: ${error.message}`);

  const now = Date.now();
  const map = new Map<string, CommissionTotals>();
  for (const row of data ?? []) {
    const key = row.partner_id as string;
    const totals = map.get(key) ?? {
      pendingCents: 0,
      availableCents: 0,
      paidCents: 0,
      reversedCents: 0,
    };
    const cents = row.commission_cents as number;
    const status = row.status as string;

    if (status === "reversed") totals.reversedCents += cents;
    else if (status === "paid" || row.payout_id) totals.paidCents += cents;
    else if (Date.parse(row.available_at as string) <= now) totals.availableCents += cents;
    else totals.pendingCents += cents;

    map.set(key, totals);
  }
  return map;
}
