"use client";

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
import { Textarea } from "@/components/ui/textarea";
import type { AdminUser } from "@/features/admin/server/db/users";
import { formatCoins } from "@/features/billing/plans";

/**
 * Presentear alguém com um pacote de moedas.
 *
 * Ele substitui o gesto que existia antes: abrir o Supabase Studio e somar um
 * número na coluna `coin_balance` à mão. Aquilo não deixava lançamento no
 * ledger, não dizia quem tinha dado nem por quê, e acontecia a uma tecla de
 * distância de editar a linha errada. O crédito seguinte, direto pela porta de
 * todo crédito do produto, resolveu isso — mas era instantâneo, e um número
 * subindo sozinho no saldo de alguém não se sente como um presente.
 *
 * ## O que muda aqui: não credita. PRESENTEIA.
 *
 * O envio cria um presente PENDENTE (`POST .../coins` → `coin_gifts`), com o
 * título e a mensagem escritos abaixo. A pessoa vê um cartão na Biblioteca com
 * um botão "Resgatar X moedas", e só aí a moeda entra na conta — ver
 * `src/features/coins/server/gifts.ts` e a migração 0077.
 *
 * ## Três decisões da TELA
 *
 * **O saldo atual fica à vista.** "Dar 200 moedas" não é uma decisão que se
 * tome no vácuo: ela depende de quanto já existe na conta.
 *
 * **Os atalhos são o caminho comum.** Cortesia de suporte é quase sempre um
 * número redondo, e quatro pastilhas resolvem o caso normal sem teclado.
 *
 * **Título e mensagem nascem com um texto padrão**, editável antes de enviar:
 * a maioria das cortesias é a mesma frase de agradecimento, e um campo vazio
 * por padrão cobraria digitar a mesma coisa toda vez.
 */
type Props = {
  user: AdminUser;
  onClose: () => void;
  onDone: () => void;
};

/** Os valores que um suporte dá sem pensar duas vezes. */
const PRESETS = [50, 200, 500, 1000];

const DEFAULT_TITLE = "Obrigado por usar o Scriba!";
const DEFAULT_MESSAGE =
  "Estamos muito felizes por ter você usando o Scriba! Como forma de agradecimento, queremos te presentear com algumas moedas.";

export function GrantCoinsDialog({ user, onClose, onDone }: Props) {
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [saving, setSaving] = useState(false);

  const label = user.displayName || user.email || user.id.slice(0, 8);
  const parsed = Number.parseInt(amount, 10);
  const validAmount = Number.isInteger(parsed) && parsed > 0 && parsed <= 50_000;
  const validTitle = title.trim().length > 0 && title.trim().length <= 120;
  const validMessage = message.trim().length > 0 && message.trim().length <= 1000;
  const valid = validAmount && validTitle && validMessage;
  const current = user.coinBalance ?? 0;

  async function handleGrant() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/coins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsed,
          title: title.trim(),
          message: message.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      toast.success(`Presente de ${formatCoins(parsed)} moedas enviado para ${label}.`);
      onDone();
    } catch (err) {
      toast.error(`Falha ao presentear: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Presentear com moedas</DialogTitle>
          <DialogDescription>
            {label} vai ver um cartão na Biblioteca com este título e mensagem, e um botão para
            resgatar. O crédito só entra quando a pessoa resgatar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between rounded-lg bg-muted px-3 py-2">
            <span className="text-xs text-muted-foreground">Saldo atual</span>
            <span className="font-mono text-sm tabular-nums">{formatCoins(current)}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grant-amount">Quantas moedas</Label>
            <Input
              id="grant-amount"
              inputMode="numeric"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="0"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(String(preset))}
                >
                  +{formatCoins(preset)}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grant-title">Título do cartão</Label>
            <Input
              id="grant-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grant-message">Mensagem</Label>
            <Textarea
              id="grant-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleGrant} disabled={!valid || saving}>
            {saving ? "Enviando…" : "Enviar presente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
