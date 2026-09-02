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
  type SelectOption,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDoc, isValidDoc, normalizeDoc, onlyDigits } from "@/lib/br/documento";
import type { AdminPartnerWithStats } from "@/lib/db/admin/partners";
import {
  DEFAULT_COMMISSION_BPS,
  DEFAULT_PARTNER_MONTHLY_COINS,
  DEFAULT_SIGNUP_BONUS_COINS,
} from "@/lib/partners/economics";
import { normalizeHandle, SOCIAL_LABELS, SOCIAL_NETWORKS } from "@/lib/partners/socials";
import { cn } from "@/lib/utils";
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
  invalid_doc: "CPF ou CNPJ inválido — confira os dígitos.",
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: "active", label: "Ativo" },
  { value: "suspended", label: "Suspenso" },
];

export function PartnerDialog({ partner, costPerThousandCoinsCents, onClose, onSaved }: Props) {
  const isNew = partner === null;

  const [displayName, setDisplayName] = useState(partner?.displayName ?? "");
  const [invitedEmail, setInvitedEmail] = useState(partner?.invitedEmail ?? "");
  const [slug, setSlug] = useState(partner?.slug ?? "");
  const [socials, setSocials] = useState<Record<string, string>>(() =>
    Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, partner?.socials[n] ?? ""]))
  );
  const [doc, setDoc] = useState(partner?.doc ? formatDoc(partner.doc) : "");
  const [pixKey, setPixKey] = useState(partner?.pixKey ?? "");
  const [ratePct, setRatePct] = useState(
    String((partner?.commissionRateBps ?? DEFAULT_COMMISSION_BPS) / 100)
  );
  const [bonusCoins, setBonusCoins] = useState(
    String(partner?.signupBonusCoins ?? DEFAULT_SIGNUP_BONUS_COINS)
  );
  const [monthlyCoins, setMonthlyCoins] = useState(
    String(partner?.monthlyCoins ?? DEFAULT_PARTNER_MONTHLY_COINS)
  );
  const [budget, setBudget] = useState(
    partner?.bonusBudgetCoins != null ? String(partner.bonusBudgetCoins) : ""
  );
  const [status, setStatus] = useState<"active" | "suspended">(partner?.status ?? "active");
  const [docBlurred, setDocBlurred] = useState(false);
  const [saving, setSaving] = useState(false);

  // Clamp para a simulação não quebrar enquanto o campo está vazio ou no meio
  // de uma digitação ("3" a caminho de "30").
  const rateBps = Math.min(10_000, Math.max(0, Math.round(Number(ratePct || 0) * 100)));
  const bonus = Math.max(0, Math.round(Number(bonusCoins || 0)));

  // O documento é opcional, mas um documento ERRADO é pior que nenhum: o PIX
  // sai, cai em lugar nenhum, e a gente só descobre pela reclamação. Vazio
  // passa; preenchido tem de fechar.
  const docDigits = onlyDigits(doc);
  const docComplete = docDigits.length === 11 || docDigits.length === 14;
  const docValid = docComplete && isValidDoc(doc);
  const docBlocking = docDigits.length > 0 && !docValid;
  // A mensagem só aparece quando já dá para julgar — ao completar os dígitos
  // ou ao sair do campo. Gritar "faltam 10 dígitos" na primeira tecla é ruído.
  const docError =
    docBlocking && (docComplete || docBlurred)
      ? docComplete
        ? "Dígitos não conferem — confira o número."
        : "Documento incompleto."
      : undefined;

  // Conversão medida só existe quando já houve cadastros por este parceiro.
  const measuredConversion =
    partner && partner.stats.signups > 0 ? partner.stats.conversionRate : null;

  async function handleSave() {
    if (docBlocking) {
      toast.error(ERROR_MESSAGES.invalid_doc);
      return;
    }
    setSaving(true);
    try {
      const body = {
        invitedEmail: invitedEmail.trim(),
        slug: slug.trim(),
        displayName: displayName.trim(),
        socials: Object.fromEntries(
          SOCIAL_NETWORKS.map((n) => [n, normalizeHandle(socials[n] ?? "")]).filter(([, v]) => v)
        ),
        doc: normalizeDoc(doc),
        pixKey: pixKey.trim() || null,
        commissionRateBps: rateBps,
        signupBonusCoins: bonus,
        monthlyCoins: Math.max(0, Math.round(Number(monthlyCoins || 0))),
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
            {SOCIAL_NETWORKS.map((network) => (
              <Field key={network} label={SOCIAL_LABELS[network]} id={`p-${network}`}>
                <HandleInput
                  id={`p-${network}`}
                  value={socials[network] ?? ""}
                  onChange={(v) => setSocials((prev) => ({ ...prev, [network]: v }))}
                />
              </Field>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="CPF / CNPJ"
              id="p-doc"
              hint="Opcional. Máscara e dígito verificador conferidos aqui."
              error={docError}
            >
              <Input
                id="p-doc"
                inputMode="numeric"
                autoComplete="off"
                value={doc}
                onChange={(e) => setDoc(formatDoc(e.target.value))}
                onBlur={() => setDocBlurred(true)}
                aria-invalid={docError ? true : undefined}
                placeholder="000.000.000-00"
              />
            </Field>
            <Field label="Chave PIX" id="p-pix">
              <Input id="p-pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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
            <Field
              label="Mesada (moedas/mês)"
              id="p-monthly"
              hint="Para ele usar o produto que divulga. 0 = sem mesada."
            >
              <Input
                id="p-monthly"
                type="number"
                min={0}
                step={50}
                value={monthlyCoins}
                onChange={(e) => setMonthlyCoins(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bônus ao indicado (moedas)" id="p-bonus">
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
            <Select
              items={STATUS_OPTIONS}
              value={status}
              onValueChange={(v) => setStatus(v as "active" | "suspended")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
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
          <Button
            onClick={handleSave}
            disabled={saving || !displayName.trim() || !slug.trim() || docBlocking}
          >
            {saving ? "Salvando…" : isNew ? "Cadastrar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Campo de @ com o arroba desenhado FORA do input.
 *
 * O arroba é parte do endereço na fala ("arroba joão") e não do dado — o que
 * guardamos é só o handle. Deixá-lo como afixo visual resolve os dois lados:
 * quem digita vê o formato certo, e quem cola a URL inteira do Instagram não
 * precisa saber que ela vai ser reduzida (a normalização faz isso ao salvar).
 */
function HandleInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex h-9 items-center rounded-lg border border-input bg-transparent pl-2.5 transition-colors",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
      )}
    >
      <span aria-hidden className="select-none pr-0.5 text-sm text-scriba-ink-mute">
        @
      </span>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoCapitalize="none"
        spellCheck={false}
        className="h-full border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
        placeholder="joao"
      />
    </div>
  );
}

function Field({
  label,
  id,
  hint,
  error,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-scriba-rose-ink">{error}</p>
      ) : hint ? (
        <p className="text-[11px] font-light text-scriba-ink-mute">{hint}</p>
      ) : null}
    </div>
  );
}
