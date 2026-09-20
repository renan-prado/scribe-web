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
import type { AdminUser } from "@/features/admin/server/db/users";
import { formatCoins } from "@/features/billing/plans";

/**
 * Creditar um pacote avulso de moedas na conta de alguém.
 *
 * Ele substitui o gesto que existia antes: abrir o Supabase Studio e somar um
 * número na coluna `coin_balance` à mão. Aquilo não deixava lançamento no
 * ledger, não dizia quem tinha dado nem por quê, e acontecia a uma tecla de
 * distância de editar a linha errada. Aqui o crédito passa pela mesma porta de
 * todo crédito do produto (ver a rota, e `grantCoins` atrás dela).
 *
 * ## Três decisões da TELA
 *
 * **O saldo atual fica à vista, e o resultado também.** "Dar 200 moedas" não é
 * uma decisão que se tome no vácuo: ela depende de quanto já existe na conta.
 * A linha de baixo mostra a soma antes de ela acontecer, que é o que transforma
 * um zero a mais digitado por engano em algo que se vê antes de confirmar.
 *
 * **Os atalhos são o caminho comum.** Cortesia de suporte é quase sempre um
 * número redondo, e quatro pastilhas resolvem o caso normal sem teclado —
 * especialmente porque este painel também é aberto do celular.
 *
 * **O motivo é opcional e vai para o LOG, não para o ledger.** A coluna
 * `reason` de `coin_transactions` é um vocabulário fechado, e texto livre nela
 * faria toda consulta que agrupa por motivo ganhar uma cauda de frases únicas.
 * O campo existe porque "por que demos 500 moedas àquela pessoa em março?" é
 * uma pergunta real, e a resposta tem de estar em algum lugar.
 */
type Props = {
  user: AdminUser;
  onClose: () => void;
  onDone: () => void;
};

/** Os valores que um suporte dá sem pensar duas vezes. */
const PRESETS = [50, 200, 500, 1000];

export function GrantCoinsDialog({ user, onClose, onDone }: Props) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const label = user.displayName || user.email || user.id.slice(0, 8);
  const parsed = Number.parseInt(amount, 10);
  const valid = Number.isInteger(parsed) && parsed > 0 && parsed <= 50_000;
  const current = user.coinBalance ?? 0;

  async function handleGrant() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/coins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, note: note.trim() || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { balance?: number; error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      toast.success(
        `${formatCoins(parsed)} moedas creditadas. ${label} está com ${formatCoins(body.balance ?? current + parsed)}.`
      );
      onDone();
    } catch (err) {
      toast.error(`Falha ao creditar: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Creditar moedas</DialogTitle>
          <DialogDescription>
            O crédito entra na hora, com lançamento no extrato de {label} e o seu nome registrado.
            Não dá para desfazer por aqui.
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
            {/* A soma ANTES de acontecer. Ver o cabeçalho: é o que deixa um zero
                a mais visível enquanto ainda dá para apagá-lo. */}
            {valid ? (
              <p className="pt-1 text-xs text-muted-foreground tabular-nums">
                Fica com {formatCoins(current + parsed)}.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grant-note">Motivo (opcional)</Label>
            <Input
              id="grant-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 280))}
              placeholder="Cortesia por gravação perdida"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleGrant} disabled={!valid || saving}>
            {saving ? "Creditando…" : "Creditar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
