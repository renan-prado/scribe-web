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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminPartnerWithStats } from "@/lib/db/admin/partners";
import { DEFAULT_COMMISSION_BPS, DEFAULT_SIGNUP_BONUS_COINS } from "@/lib/partners/economics";
import { CommissionSimulator } from "./CommissionSimulator";

/**
 * Cadastro e edição de parceiro.
 *
 * A taxa de comissão fica ao lado do simulador de propósito: ela é o único
 * campo aqui que decide quanto sai do caixa, e é negociável caso a caso.
 * Digitar 70% e ver na hora "você fica R$ 1,10 negativo no primeiro mês,
 * recuperado em 3 dias" é diferente de descobrir isso no fechamento do mês.
 */

type Props = {
  partner: AdminPartnerWithStats | null;
  costPerThousandCoinsCents: number;
  onClose: () => void;
  onSaved: () => void;
};

const ERROR_MESSAGES: Record<string, string> = {
  slug_or_email_taken: "Já existe um parceiro com esse código ou e-mail.",
  create_failed: "Não consegui criar o parceiro.",
  update_failed: "Não consegui salvar as alterações.",
};

export function PartnerDialog({ partner, costPerThousandCoinsCents, onClose, onSaved }: Props) {
  const isNew = partner === null;

  const [displayName, setDisplayName] = useState(partner?.displayName ?? "");
  const [invitedEmail, setInvitedEmail] = useState(partner?.invitedEmail ?? "");
  const [slug, setSlug] = useState(partner?.slug ?? "");
  const [instagram, setInstagram] = useState(partner?.socials.instagram ?? "");
  const [tiktok, setTiktok] = useState(partner?.socials.tiktok ?? "");
  const [youtube, setYoutube] = useState(partner?.socials.youtube ?? "");
  const [doc, setDoc] = useState(partner?.doc ?? "");
  const [pixKey, setPixKey] = useState(partner?.pixKey ?? "");
  const [ratePct, setRatePct] = useState(
    String((partner?.commissionRateBps ?? DEFAULT_COMMISSION_BPS) / 100)
  );
  const [bonusCoins, setBonusCoins] = useState(
    String(partner?.signupBonusCoins ?? DEFAULT_SIGNUP_BONUS_COINS)
  );
  const [budget, setBudget] = useState(
    partner?.bonusBudgetCoins != null ? String(partner.bonusBudgetCoins) : ""
  );
  const [status, setStatus] = useState<"active" | "suspended">(partner?.status ?? "active");
  const [saving, setSaving] = useState(false);

  // Clamp para a simulação não quebrar enquanto o campo está vazio ou no meio
  // de uma digitação ("3" a caminho de "30").
  const rateBps = Math.min(10_000, Math.max(0, Math.round(Number(ratePct || 0) * 100)));
  const bonus = Math.max(0, Math.round(Number(bonusCoins || 0)));

  // Conversão medida só existe quando já houve cadastros por este parceiro.
  const measuredConversion =
    partner && partner.stats.signups > 0 ? partner.stats.conversionRate : null;

  async function handleSave() {
    setSaving(true);
    try {
      const body = {
        invitedEmail: invitedEmail.trim(),
        slug: slug.trim(),
        displayName: displayName.trim(),
        socials: Object.fromEntries(
          [
            ["instagram", instagram.trim()],
            ["tiktok", tiktok.trim()],
            ["youtube", youtube.trim()],
          ].filter(([, v]) => v)
        ),
        doc: doc.trim() || null,
        pixKey: pixKey.trim() || null,
        commissionRateBps: rateBps,
        signupBonusCoins: bonus,
        bonusBudgetCoins: budget.trim() ? Math.max(0, Math.round(Number(budget))) : null,
        status,
      };

      const res = await fetch(isNew ? "/api/admin/partners" : `/api/admin/partners/${partner.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(ERROR_MESSAGES[payload.error] ?? payload.error ?? `HTTP ${res.status}`);
      }
      toast.success(isNew ? "Parceiro cadastrado." : "Parceiro atualizado.");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo parceiro" : "Editar parceiro"}</DialogTitle>
          <DialogDescription>
            O código vira o link <code className="font-mono">/r/&lt;código&gt;</code> e também pode
            ser digitado na tela de entrada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field label="Nome" id="p-name">
            <Input
              id="p-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="João Silva"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Código / link"
              id="p-slug"
              hint="a-z, 0-9 e hífen. É o que ele vai ditar em vídeo."
            >
              <Input
                id="p-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                autoCapitalize="none"
                spellCheck={false}
                placeholder="joao"
              />
            </Field>
            <Field label="E-mail do convite" id="p-email" hint="Precisa ser a conta Google dele.">
              <Input
                id="p-email"
                type="email"
                value={invitedEmail}
                onChange={(e) => setInvitedEmail(e.target.value)}
                placeholder="joao@gmail.com"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Instagram" id="p-ig">
              <Input id="p-ig" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
            </Field>
            <Field label="TikTok" id="p-tt">
              <Input id="p-tt" value={tiktok} onChange={(e) => setTiktok(e.target.value)} />
            </Field>
            <Field label="YouTube" id="p-yt">
              <Input id="p-yt" value={youtube} onChange={(e) => setYoutube(e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CPF / CNPJ" id="p-doc">
              <Input id="p-doc" value={doc} onChange={(e) => setDoc(e.target.value)} />
            </Field>
            <Field label="Chave PIX" id="p-pix" hint="Sem ela não há como pagar.">
              <Input id="p-pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Comissão (%)" id="p-rate">
              <Input
                id="p-rate"
                type="number"
                min={0}
                max={100}
                step={1}
                value={ratePct}
                onChange={(e) => setRatePct(e.target.value)}
              />
            </Field>
            <Field label="Bônus (moedas)" id="p-bonus">
              <Input
                id="p-bonus"
                type="number"
                min={0}
                step={10}
                value={bonusCoins}
                onChange={(e) => setBonusCoins(e.target.value)}
              />
            </Field>
            <Field label="Teto de bônus" id="p-budget" hint="Vazio = sem teto.">
              <Input
                id="p-budget"
                type="number"
                min={0}
                step={100}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="sem teto"
              />
            </Field>
          </div>

          <CommissionSimulator
            rateBps={rateBps}
            bonusCoins={bonus}
            costPerThousandCoinsCents={costPerThousandCoinsCents}
            measuredConversionRate={measuredConversion}
          />

          <Field label="Situação" id="p-status">
            <Select value={status} onValueChange={(v) => setStatus(v as "active" | "suspended")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {status === "suspended" ? (
            <p className="text-[11.5px] font-light text-scriba-ink-mute">
              Suspenso: o link para de vincular e novas assinaturas não geram comissão. As
              indicações já feitas continuam valendo.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !displayName.trim() || !slug.trim()}>
            {saving ? "Salvando…" : isNew ? "Cadastrar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-[11px] font-light text-scriba-ink-mute">{hint}</p> : null}
    </div>
  );
}
