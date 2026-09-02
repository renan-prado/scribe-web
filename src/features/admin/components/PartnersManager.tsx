"use client";

import { Banknote, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBrl } from "@/lib/billing/plans";
import type { AdminPartnerWithStats } from "@/lib/db/admin/partners";
import { PAYOUT_MINIMUM_CENTS } from "@/lib/partners/economics";
import { CopyButton } from "./CopyButton";
import { PartnerDialog } from "./PartnerDialog";

/**
 * Lista de parceiros com o funil e o dinheiro de cada um.
 *
 * A coluna "disponível" é a que o operador olha para pagar. O botão de PIX só
 * aparece a partir do mínimo de saque — abaixo disso o valor acumula, e
 * oferecer o botão convidaria a pagar R$ 4 por PIX, que é o que o mínimo
 * existe para evitar.
 */

type Props = {
  initialPartners: AdminPartnerWithStats[];
  costPerThousandCoinsCents: number;
  appOrigin: string;
};

const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;

export function PartnersManager({ initialPartners, costPerThousandCoinsCents, appOrigin }: Props) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminPartnerWithStats | null>(null);
  const [creating, setCreating] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const router = useRouter();

  const term = search.trim().toLowerCase();
  const partners = term
    ? initialPartners.filter(
        (p) =>
          p.displayName.toLowerCase().includes(term) ||
          p.slug.includes(term) ||
          p.invitedEmail.toLowerCase().includes(term)
      )
    : initialPartners;

  async function handlePayout(partner: AdminPartnerWithStats) {
    const amount = formatBrl(partner.stats.availableCents);
    if (
      !window.confirm(
        `Registrar pagamento de ${amount} para ${partner.displayName}?\n\n` +
          "Confirme apenas DEPOIS de enviar o PIX. As comissões correspondentes " +
          "serão marcadas como pagas e saem do valor a receber."
      )
    ) {
      return;
    }
    setPayingId(partner.id);
    try {
      const period = new Date();
      const res = await fetch(`/api/admin/partners/${partner.id}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, "0")}-01`,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(
          payload.error === "nothing_due"
            ? "Nada disponível para pagar agora."
            : (payload.error ?? `HTTP ${res.status}`)
        );
      }
      const result = await res.json();
      toast.success(
        `Pagamento de ${formatBrl(result.amountCents)} registrado (${result.commissions} comissões).`
      );
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPayingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, código ou e-mail"
          className="max-w-[320px]"
        />
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Novo parceiro
        </Button>
      </div>

      {partners.length === 0 ? (
        <p className="rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-8 text-center text-sm font-light text-scriba-ink-mute">
          {initialPartners.length === 0
            ? "Nenhum parceiro cadastrado ainda."
            : "Nenhum parceiro corresponde à busca."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-scriba-hairline-soft bg-scriba-paper">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parceiro</TableHead>
                <TableHead className="text-right">Visitas</TableHead>
                <TableHead className="text-right">Cadastros</TableHead>
                <TableHead className="text-right">Assinantes</TableHead>
                <TableHead className="text-right">A liberar</TableHead>
                <TableHead className="text-right">Disponível</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((p) => {
                const link = `${appOrigin}/r/${p.slug}`;
                const canPay = p.stats.availableCents >= PAYOUT_MINIMUM_CENTS;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-scriba-ink-strong">
                            {p.displayName}
                          </span>
                          {p.status === "suspended" ? (
                            <Badge variant="secondary">suspenso</Badge>
                          ) : null}
                          {p.userId ? null : <Badge variant="outline">sem login</Badge>}
                        </div>
                        <div className="group flex items-center gap-1.5">
                          <code className="font-mono text-[11px] text-scriba-ink-mute">
                            /r/{p.slug}
                          </code>
                          <CopyButton value={link} />
                          <span className="text-[11px] text-scriba-ink-mute">
                            · {(p.commissionRateBps / 100).toLocaleString("pt-BR")}%
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-scriba-ink-soft">
                      {p.stats.uniqueVisitors}
                      <span className="ml-1 text-scriba-ink-mute">/{p.stats.clicks}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-scriba-ink-soft">
                      {p.stats.signups}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-scriba-ink-strong">
                      {p.stats.subscribers}
                      {p.stats.signups > 0 ? (
                        <span className="ml-1 font-normal text-scriba-ink-mute">
                          {pct(p.stats.conversionRate)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-scriba-ink-mute">
                      {formatBrl(p.stats.pendingCents)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-scriba-ink-strong">
                      {formatBrl(p.stats.availableCents)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-scriba-ink-mute">
                      {formatBrl(p.stats.paidCents)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canPay ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePayout(p)}
                            disabled={payingId === p.id}
                            title="Registrar PIX enviado"
                          >
                            <Banknote className="size-4" />
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11.5px] font-light text-scriba-ink-mute">
        &quot;A liberar&quot; são comissões dentro da carência de 30 dias — o prazo em que um
        pagamento ainda pode ser contestado. O botão de pagamento aparece a partir de{" "}
        {formatBrl(PAYOUT_MINIMUM_CENTS)}; abaixo disso o valor acumula para o mês seguinte.
      </p>

      {(creating || editing) && (
        <PartnerDialog
          partner={editing}
          costPerThousandCoinsCents={costPerThousandCoinsCents}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
