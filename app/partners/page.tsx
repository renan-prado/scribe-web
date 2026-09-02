import type { Metadata } from "next";
import { CoinMark } from "@/components/icons/CoinMark";
import { ReferralLinkCard } from "@/features/partners/components/ReferralLinkCard";
import { getCurrentPartner } from "@/lib/auth/require-partner";
import { formatBrl } from "@/lib/billing/plans";
import { appUrl } from "@/lib/billing/stripe";
import { loadPartnerPanel } from "@/lib/db/partner-panel";
import { COMMISSION_HOLD_DAYS, PAYOUT_MINIMUM_CENTS } from "@/lib/partners/economics";

export const metadata: Metadata = { title: "Painel" };
export const dynamic = "force-dynamic";

const INT = new Intl.NumberFormat("pt-BR");
const MONTH_FMT = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/**
 * O painel que o parceiro vê.
 *
 * Só números. Nenhuma linha aqui identifica uma pessoa que se cadastrou — nem
 * nome, nem e-mail, nem data. Ele vê "12 cadastros", nunca "estes 12".
 *
 * A nota sobre defasagem no rodapé do funil não é enfeite: uma visita de hoje
 * vira cadastro amanhã e assinatura daqui a duas semanas, e sem essa ressalva
 * o mês corrente é lido como fracasso pelo parceiro que acabou de publicar.
 */
export default async function PartnerDashboardPage() {
  // O layout já garantiu que existe parceiro; esta chamada reaproveita a
  // resolução e é barata perto de renderizar a página inteira.
  const partner = await getCurrentPartner();
  if (!partner) return null;

  const { summary, monthly, payouts } = await loadPartnerPanel(partner.id);
  const link = appUrl(`/r/${partner.slug}`);
  const totalEarned = summary.pendingCents + summary.availableCents + summary.paidCents;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight text-scriba-ink-strong">
          Olá, {partner.displayName.split(" ")[0]}
        </h1>
        <p className="text-[13.5px] font-light text-scriba-ink-soft">
          Seus resultados e o que há a receber.
        </p>
      </header>

      <ReferralLinkCard
        link={link}
        code={partner.slug}
        bonusCoins={partner.signupBonusCoins}
        ratePct={partner.commissionRateBps / 100}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Money
          label="A liberar"
          value={formatBrl(summary.pendingCents)}
          hint={`Dentro da carência de ${COMMISSION_HOLD_DAYS} dias`}
        />
        <Money
          label="Disponível"
          value={formatBrl(summary.availableCents)}
          hint={
            summary.availableCents >= PAYOUT_MINIMUM_CENTS
              ? "Entra no próximo pagamento"
              : `Mínimo de ${formatBrl(PAYOUT_MINIMUM_CENTS)} para sacar`
          }
          strong
        />
        <Money
          label="Já recebido"
          value={formatBrl(summary.paidCents)}
          hint={`${formatBrl(totalEarned)} no total acumulado`}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5">
        <h2 className="text-[14px] font-semibold text-scriba-ink-strong">Seu funil</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Step
            label="Visitas"
            value={INT.format(summary.uniqueVisitors)}
            hint={`${INT.format(summary.clicks)} aberturas no total`}
          />
          <Step
            label="Cadastros"
            value={INT.format(summary.signups)}
            hint="Criaram conta pelo seu link ou código"
          />
          <Step
            label="Assinantes"
            value={INT.format(summary.subscribers)}
            hint={
              summary.signups > 0
                ? `${(summary.conversionRate * 100).toFixed(1).replace(".", ",")}% dos cadastros`
                : "Ainda sem cadastros"
            }
          />
        </div>
        <p className="text-[11.5px] font-light leading-[1.5] text-scriba-ink-mute">
          Os números têm defasagem natural: uma visita de hoje pode virar cadastro amanhã e
          assinatura daqui a duas semanas. O mês em curso quase sempre parece menor do que vai ser.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Por mês">
          {monthly.length === 0 ? (
            <Empty>Nenhuma comissão ainda. Compartilhe seu link para começar.</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-scriba-hairline">
              {monthly.map((m) => (
                <li key={m.month} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-[13px] text-scriba-ink first-letter:uppercase">
                    {MONTH_FMT.format(new Date(`${m.month}-01T12:00:00Z`))}
                  </span>
                  <span className="text-right">
                    <span className="font-mono text-[12px] font-semibold text-scriba-ink-strong">
                      {formatBrl(m.cents)}
                    </span>
                    <span className="ml-2 text-[11px] font-light text-scriba-ink-mute">
                      {m.commissions} {m.commissions === 1 ? "assinante" : "assinantes"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Pagamentos recebidos">
          {payouts.length === 0 ? (
            <Empty>Nenhum pagamento ainda.</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-scriba-hairline">
              {payouts.map((p) => (
                <li
                  key={`${p.paidAt}-${p.amountCents}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="text-[13px] text-scriba-ink">
                    {DATE_FMT.format(new Date(p.paidAt))}
                  </span>
                  <span className="font-mono text-[12px] font-semibold text-scriba-ink-strong">
                    {formatBrl(p.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {partner.pixKey ? null : (
            <p className="rounded-xl bg-scriba-cream px-3 py-2 text-[12px] leading-[1.5] text-scriba-cream-body">
              Falta cadastrar sua chave PIX. Sem ela não conseguimos pagar — fale com a equipe do
              Scriba.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Money({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex flex-col gap-1 rounded-2xl border border-scriba-hairline-soft bg-scriba-mint p-5"
          : "flex flex-col gap-1 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5"
      }
    >
      <span
        className={
          strong
            ? "text-[10px] font-semibold uppercase tracking-[0.12em] text-scriba-mint-accent"
            : "text-[10px] font-semibold uppercase tracking-[0.12em] text-scriba-ink-mute"
        }
      >
        {label}
      </span>
      <span
        className={
          strong
            ? "text-[26px] font-semibold tracking-tight text-scriba-mint-dark"
            : "text-[26px] font-semibold tracking-tight text-scriba-ink-strong"
        }
      >
        {value}
      </span>
      <span
        className={
          strong
            ? "text-[11.5px] font-light text-scriba-mint-body"
            : "text-[11.5px] font-light text-scriba-ink-mute"
        }
      >
        {hint}
      </span>
    </div>
  );
}

function Step({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-scriba-ink-mute">
        {label}
      </span>
      <span className="text-[24px] font-semibold tracking-tight text-scriba-ink-strong">
        {value}
      </span>
      <span className="text-[11.5px] font-light leading-[1.4] text-scriba-ink-soft">{hint}</span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5">
      <h2 className="flex items-center gap-2 text-[14px] font-semibold text-scriba-ink-strong">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[13px] font-light text-scriba-ink-mute">
      <CoinMark size={16} />
      {children}
    </p>
  );
}
