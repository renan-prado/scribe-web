"use client";

import { Banknote, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { COMMISSION_HOLD_DAYS, PAYOUT_MINIMUM_CENTS } from "@/lib/partners/economics";
import { CopyButton } from "./CopyButton";
import { PartnerDialog } from "./PartnerDialog";
import { PayoutDialog } from "./PayoutDialog";

/**
 * Lista de parceiros com o funil e o dinheiro de cada um.
 *
 * As três colunas de dinheiro são o mesmo valor em três estágios, e ler uma
 * pela outra é o erro fácil:
 *
 *   A liberar  — comissão nascida há menos de 30 dias. O pagamento que a
 *                originou ainda pode ser contestado, então o dinheiro existe
 *                mas não pode sair.
 *   Disponível — passou a carência e ainda não foi paga. É EXATAMENTE o que
 *                sai no próximo PIX, e é a única coluna que o operador precisa
 *                olhar para pagar.
 *   Pago       — já quitada por um `partner_payouts`.
 *
 * O botão de PIX aparece com QUALQUER valor disponível. O mínimo de saque é
 * política do pagamento de rotina, não uma trava: quem sai do programa com
 * R$ 12 tem direito ao dinheiro, e o operador precisa conseguir pagá-lo. O
 * aviso de "abaixo do mínimo" mora no diálogo, onde é lido antes de confirmar
 * — escondendo o botão, a única saída seria mexer no banco à mão.
 */

type Props = {
  initialPartners: AdminPartnerWithStats[];
  costPerThousandCoinsCents: number;
  /** Prefixo do link de indicação, já com o domínio (ex.: https://scriba.cc/r). */
  linkBase: string;
};

const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;

export function PartnersManager({ initialPartners, costPerThousandCoinsCents, linkBase }: Props) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminPartnerWithStats | null>(null);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<AdminPartnerWithStats | null>(null);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, código ou e-mail"
          className="w-full sm:max-w-[320px]"
        />
        <Button onClick={() => setCreating(true)} className="self-start sm:self-auto">
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
        <div className="admin-table admin-card-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parceiro</TableHead>
                <TableHead className="text-right">Visitas</TableHead>
                <TableHead className="text-right">Cadastros</TableHead>
                <TableHead className="text-right">Assinantes</TableHead>
                <TableHead className="text-right" title="Comissões dentro da carência de 30 dias">
                  A liberar
                </TableHead>
                <TableHead
                  className="text-right"
                  title="Já fora da carência e ainda não pago — é o que sai no próximo PIX"
                >
                  Disponível
                </TableHead>
                <TableHead className="text-right" title="Total já quitado por PIX">
                  Pago
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((p) => {
                const link = `${linkBase}/${p.slug}`;
                // O botão aparece com qualquer valor disponível. O mínimo de
                // saque é política de rotina, não trava: o caso que ele mais
                // atrapalharia é o parceiro que sai do programa com R$ 12 —
                // esse dinheiro é dele, e o operador precisa conseguir pagar.
                const canPay = p.stats.availableCents > 0;
                const belowMinimum = p.stats.availableCents < PAYOUT_MINIMUM_CENTS;
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
                            onClick={() => setPaying(p)}
                            title={
                              belowMinimum
                                ? `Registrar PIX enviado — abaixo do mínimo de ${formatBrl(PAYOUT_MINIMUM_CENTS)}`
                                : "Registrar PIX enviado"
                            }
                            className={belowMinimum ? "text-scriba-ink-mute" : undefined}
                          >
                            <Banknote className="size-4" />
                            <span className="sr-only">Registrar pagamento</span>
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

      <p className="text-[11.5px] font-light leading-[1.6] text-scriba-ink-mute">
        <strong className="font-semibold">A liberar</strong> são comissões dentro da carência de{" "}
        {COMMISSION_HOLD_DAYS} dias — o prazo em que o pagamento que as gerou ainda pode ser
        contestado. <strong className="font-semibold">Disponível</strong> é o que já venceu a
        carência e ainda não foi pago: é esse o valor que sai no próximo PIX, e é o que o botão de
        pagamento registra. O mínimo de {formatBrl(PAYOUT_MINIMUM_CENTS)} é a regra do pagamento
        mensal de rotina — abaixo dele o valor normalmente acumula, mas o botão continua ali e avisa
        antes de confirmar, para quando pagar valer a pena mesmo assim.
      </p>

      {paying ? (
        <PayoutDialog
          partner={paying}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null);
            router.refresh();
          }}
        />
      ) : null}

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
