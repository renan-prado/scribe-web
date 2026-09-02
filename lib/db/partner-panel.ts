import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Números do painel do parceiro.
 *
 * A regra que rege este arquivo inteiro: **só agregados**. Nenhuma função aqui
 * devolve uma linha que represente uma pessoa — sem e-mail, sem nome, sem id,
 * sem data que permita identificar quem se cadastrou. O parceiro vê "12
 * cadastros", nunca "estes 12". Dado exposto não desexpõe, e não há motivo de
 * negócio para ele saber quem são.
 *
 * Por isso as consultas usam `head: true` com `count: "exact"` sempre que só o
 * número interessa: assim nem trafega linha, e não há como um refactor
 * distraído passar a devolvê-las.
 */

export type PartnerPanelSummary = {
  clicks: number;
  uniqueVisitors: number;
  signups: number;
  subscribers: number;
  pendingCents: number;
  availableCents: number;
  paidCents: number;
  conversionRate: number;
};

export type PartnerMonthlyRow = {
  /** AAAA-MM. */
  month: string;
  commissions: number;
  cents: number;
};

export type PartnerPayoutRow = {
  paidAt: string;
  amountCents: number;
  note: string | null;
  /** Link externo do comprovante, quando quem pagou registrou um. */
  receiptUrl: string | null;
};

export async function loadPartnerPanel(partnerId: string): Promise<{
  summary: PartnerPanelSummary;
  monthly: PartnerMonthlyRow[];
  payouts: PartnerPayoutRow[];
}> {
  const admin = createAdminClient();

  const [clicksRes, signupsRes, commissionsRes, payoutsRes] = await Promise.all([
    admin.from("partner_clicks").select("clicks, uniques").eq("partner_id", partnerId),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("partner_id", partnerId),
    admin
      .from("partner_commissions")
      .select("commission_cents, status, available_at, payout_id, created_at")
      .eq("partner_id", partnerId),
    admin
      .from("partner_payouts")
      .select("paid_at, amount_cents, note, receipt_url")
      .eq("partner_id", partnerId)
      .order("paid_at", { ascending: false })
      .limit(24),
  ]);

  let clicks = 0;
  let uniqueVisitors = 0;
  for (const row of clicksRes.data ?? []) {
    clicks += row.clicks as number;
    uniqueVisitors += row.uniques as number;
  }

  const now = Date.now();
  const summary: PartnerPanelSummary = {
    clicks,
    uniqueVisitors,
    signups: signupsRes.count ?? 0,
    subscribers: 0,
    pendingCents: 0,
    availableCents: 0,
    paidCents: 0,
    conversionRate: 0,
  };

  const monthly = new Map<string, PartnerMonthlyRow>();

  for (const row of commissionsRes.data ?? []) {
    const cents = row.commission_cents as number;
    const status = row.status as string;

    // Estornada não conta como assinante nem como dinheiro: o pagamento
    // voltou atrás, e mostrá-la inflaria o funil com uma venda desfeita.
    if (status === "reversed") continue;

    summary.subscribers += 1;
    if (status === "paid" || row.payout_id) summary.paidCents += cents;
    else if (Date.parse(row.available_at as string) <= now) summary.availableCents += cents;
    else summary.pendingCents += cents;

    const month = (row.created_at as string).slice(0, 7);
    const entry = monthly.get(month) ?? { month, commissions: 0, cents: 0 };
    entry.commissions += 1;
    entry.cents += cents;
    monthly.set(month, entry);
  }

  summary.conversionRate = summary.signups > 0 ? summary.subscribers / summary.signups : 0;

  return {
    summary,
    monthly: [...monthly.values()].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12),
    payouts: (payoutsRes.data ?? []).map((p) => ({
      paidAt: p.paid_at as string,
      amountCents: p.amount_cents as number,
      note: (p.note as string | null) ?? null,
      receiptUrl: (p.receipt_url as string | null) ?? null,
    })),
  };
}
