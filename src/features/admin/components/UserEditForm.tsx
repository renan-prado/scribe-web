"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import type { AdminUserDetail } from "@/features/admin/server/db/users";
import { BACKOFFICE_LABEL } from "@/features/billing/plans";

// `items` no Root é o que faz o gatilho mostrar o rótulo em vez do valor cru,
// sem ele, "Situação" exibia "active". Ver shared/ui/select.
const ROLE_OPTIONS: SelectOption[] = [
  { value: "user", label: "Usuário" },
  { value: "admin", label: "Administrador" },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Desativado" },
];

/**
 * A conta de Backoffice. É um campo à parte do "Papel" porque as duas coisas
 * são diferentes: papel diz quem ENTRA no painel, este diz quem não deve
 * APARECER nele.
 */
const KIND_OPTIONS: SelectOption[] = [
  { value: "client", label: "Cliente" },
  { value: "internal", label: BACKOFFICE_LABEL },
];

type Props = {
  user: AdminUserDetail;
  currentUserId: string;
  /**
   * Como esta ficha é enquadrada, e é o que decide para onde se sai dela.
   *
   * `modal`: `router.back()` desfaz a navegação que a abriu e devolve a lista
   * no estado exato em que estava — filtro, rolagem, tudo. `page`: não há o
   * que desfazer (foi um F5 ou um link colado), então a saída é um `push` para
   * a lista.
   */
  frame: "modal" | "page";
};

/**
 * O formulário da ficha de uma conta: nome, e-mail, papel e situação.
 *
 * **Ele não desenha diálogo nenhum**, e é essa a diferença para o
 * `EditUserDialog` que ele substituiu. O formulário tem dois donos — a rota
 * `/admin/users/[id]` em página cheia e o `@modal/(.)users/[id]` por cima da
 * lista — e uma casca embutida faria dele o dono do próprio enquadramento,
 * que é justamente a decisão que as duas rotas precisam tomar de forma
 * diferente.
 *
 * O `router.refresh()` depois de salvar é o que reconcilia a LISTA atrás:
 * ela é renderizada no servidor, e sem ele a linha continuaria com o nome
 * antigo até alguém recarregar a mão.
 */
export function UserEditForm({ user, currentUserId, frame }: Props) {
  const router = useRouter();
  const dismiss = () => {
    if (frame === "modal") router.back();
    else router.push("/admin/users");
  };
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [role, setRole] = useState<"user" | "admin">(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [isInternal, setIsInternal] = useState(user.isInternal);
  const [saving, setSaving] = useState(false);

  const isSelf = user.id === currentUserId;

  async function handleSave() {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      const trimmedName = displayName.trim();
      if ((user.displayName ?? "") !== trimmedName) {
        patch.displayName = trimmedName || null;
      }
      const trimmedEmail = email.trim();
      if (trimmedEmail && trimmedEmail !== (user.email ?? "")) {
        patch.email = trimmedEmail;
      }
      if (role !== user.role) patch.role = role;
      if (isActive !== user.isActive) patch.isActive = isActive;
      if (isInternal !== user.isInternal) patch.isInternal = isInternal;

      if (Object.keys(patch).length === 0) {
        dismiss();
        return;
      }

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      toast.success("Usuário atualizado.");
      router.refresh();
      dismiss();
    } catch (err) {
      toast.error(`Falha ao salvar: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-name">Nome</Label>
          <Input
            id="edit-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Sem nome"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-email">Email</Label>
          <Input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Papel</Label>
          <Select
            items={ROLE_OPTIONS}
            value={role}
            onValueChange={(v) => setRole(v as "user" | "admin")}
            disabled={isSelf}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSelf ? (
            <p className="text-xs text-muted-foreground">Você não pode alterar o próprio papel.</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select
            items={STATUS_OPTIONS}
            value={isActive ? "active" : "inactive"}
            onValueChange={(v) => setIsActive(v === "active")}
            disabled={isSelf}
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
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Tipo de conta</Label>
          <Select
            items={KIND_OPTIONS}
            value={isInternal ? "internal" : "client"}
            onValueChange={(v) => setIsInternal(v === "internal")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {isInternal
              ? "Créditos ilimitados, e fora de todo custo, margem e funil do painel. O gasto continua registrado no ledger."
              : "Conta comum: paga em créditos e entra na medição."}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={dismiss} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </>
  );
}
