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
import type { AdminUser } from "@/lib/db/admin/users";

// `items` no Root é o que faz o gatilho mostrar o rótulo em vez do valor cru
// — sem ele, "Situação" exibia "active". Ver shared/ui/select.
const ROLE_OPTIONS: SelectOption[] = [
  { value: "user", label: "Usuário" },
  { value: "admin", label: "Administrador" },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Desativado" },
];

type Props = {
  user: AdminUser;
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function EditUserDialog({ user, currentUserId, onClose, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [role, setRole] = useState<"user" | "admin">(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
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

      if (Object.keys(patch).length === 0) {
        onClose();
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
      onSaved();
    } catch (err) {
      toast.error(`Falha ao salvar: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            Alterações são aplicadas imediatamente. Trocas de email disparam confirmação no
            Supabase.
          </DialogDescription>
        </DialogHeader>

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
              <p className="text-xs text-muted-foreground">
                Você não pode alterar o próprio papel.
              </p>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
