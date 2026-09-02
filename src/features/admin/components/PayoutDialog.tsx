"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBrl } from "@/lib/billing/plans";
import type { AdminPartnerWithStats } from "@/lib/db/admin/partners";
import { PAYOUT_MINIMUM_CENTS } from "@/lib/partners/economics";

/**
 * Registro do PIX já enviado.
 *
 * Substitui um `window.confirm`, e não é preciosismo: o confirm não tinha onde
 * receber o link do comprovante, e o comprovante é a única prova de que o
 * pagamento saiu — hoje ele vive no Drive de quem pagou, o que quer dizer que
 * some quando essa pessoa não está por perto.
 *
 * O VALOR NÃO É EDITÁVEL, aqui nem na rota. Ele é a soma das comissões
 * disponíveis no instante da chamada, calculada no servidor: um campo de valor
 * abriria a possibilidade de o total pago divergir do total quitado, e essa
 * diferença não teria onde aparecer depois.
 *
 * Abaixo do mínimo de saque o diálogo AVISA e segue. A regra do mínimo existe
 * para o pagamento mensal de rotina — um PIX de R$ 4 custa mais trabalho do
 * que vale —, mas ela não pode virar uma trava: o parceiro que deixa o
 * programa recebe o saldo integral, e esse pagamento é sempre pequeno.
 */

type Props = {
  partner: AdminPartnerWithStats;
  onClose: () => void;
  onDone: () => void;
};

/**
 * Toast de erro é a única coisa que o operador vai ler, e ele acabou de
 * mandar dinheiro por PIX. Cada mensagem responde a única pergunta que
 * importa nesse instante: **o que eu faço agora?**
 *
 * Por isso nenhuma delas é um código, e a de `payout_stamp_failed` diz
 * explicitamente para NÃO tentar de novo — repetir criaria um segundo
 * pagamento sobre as mesmas comissões.
 */
const ERROR_MESSAGES: Record<string, string> = {
  nothing_due:
    "Nada disponível para pagar agora. Se você acabou de registrar, o valor já saiu da fila — atualize a página para conferir.",
  payout_stamp_failed:
    "O pagamento foi gravado, mas as comissões NÃO foram marcadas como pagas. Não registre de novo (pagaria em dobro) — avise o time para corrigir à mão.",
  payout_failed:
    "Não consegui gravar o pagamento, e nada foi marcado como pago. O PIX que você enviou continua valendo: tente registrar de novo.",
  invalid_input: "O link do comprovante precisa ser um endereço https válido.",
  invalid_json: "Não consegui enviar os dados. Tente de novo.",
  invalid_id: "Parceiro não encontrado. Recarregue a página.",
  forbidden: "Sua sessão de admin expirou. Recarregue a página e entre de novo.",
  rate_limited: "Muitas ações seguidas. Espere alguns segundos e tente de novo.",
};

function messageFor(status: number, code: unknown): string {
  if (typeof code === "string" && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (status === 401 || status === 403) return ERROR_MESSAGES.forbidden;
  if (status === 429) return ERROR_MESSAGES.rate_limited;
  return "Não consegui registrar o pagamento. Confira o log do servidor antes de tentar de novo.";
}

export function PayoutDialog({ partner, onClose, onDone }: Props) {
  const [receiptUrl, setReceiptUrl] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const trimmedReceipt = receiptUrl.trim();
  const receiptInvalid = trimmedReceipt.length > 0 && !trimmedReceipt.startsWith("https://");
  const belowMinimum = partner.stats.availableCents < PAYOUT_MINIMUM_CENTS;

  async function handleConfirm() {
    setSaving(true);
    try {
      const period = new Date();
      const res = await fetch(`/api/admin/partners/${partner.id}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, "0")}-01`,
          note: note.trim() || null,
          receiptUrl: trimmedReceipt || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(messageFor(res.status, payload.error));
      }
      const result = await res.json();
      toast.success(
        `Pagamento de ${formatBrl(result.amountCents)} registrado (${result.commissions} comissões).`
      );
      onDone();
    } catch (err) {
      // Duração longa de propósito: são instruções, não um "ops". O padrão do
      // sonner some antes de a frase ser lida.
      toast.error((err as Error).message, { duration: 12_000 });
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            Confirme apenas <strong>depois</strong> de enviar o PIX. As comissões correspondentes
            serão marcadas como pagas e saem do valor a receber.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-2xl bg-scriba-mint p-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-scriba-mint-accent">
              Valor
            </span>
            <span className="text-[26px] font-semibold tracking-tight text-scriba-mint-dark">
              {formatBrl(partner.stats.availableCents)}
            </span>
            <span className="text-[11.5px] font-light text-scriba-mint-body">
              para {partner.displayName}
              {partner.pixKey ? (
                <>
                  {" · "}
                  <code className="font-mono">{partner.pixKey}</code>
                </>
              ) : (
                " · sem chave PIX cadastrada"
              )}
            </span>
          </div>

          {belowMinimum ? (
            <div className="flex items-start gap-2.5 rounded-xl border-l-2 border-scriba-yellow bg-scriba-cream px-4 py-3">
              <TriangleAlert
                className="mt-px size-4 flex-none text-scriba-cream-accent"
                aria-hidden
              />
              <p className="text-[12px] font-light leading-[1.55] text-scriba-cream-body">
                Abaixo do mínimo de {formatBrl(PAYOUT_MINIMUM_CENTS)} do pagamento de rotina. Se não
                houver motivo para pagar agora — saída do programa, acerto pontual —, o valor
                acumula para o mês seguinte e não se perde.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payout-receipt">Link do comprovante</Label>
            <Input
              id="payout-receipt"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
              inputMode="url"
              autoComplete="off"
              aria-invalid={receiptInvalid || undefined}
            />
            {receiptInvalid ? (
              <p className="text-[11px] font-medium text-scriba-rose-ink">
                Precisa começar com https://
              </p>
            ) : (
              <p className="text-[11px] font-light text-scriba-ink-mute">
                Opcional. Um link do Drive já serve — o parceiro vê no painel dele.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payout-note">Observação</Label>
            <Input
              id="payout-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Opcional — só para nós"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || receiptInvalid}>
            {saving ? "Registrando…" : `Registrar ${formatBrl(partner.stats.availableCents)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
