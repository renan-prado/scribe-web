"use client";

import { Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import type { AdminUser } from "@/lib/db/admin/users";
import { EditUserDialog } from "./EditUserDialog";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DATE_FMT.format(d);
}

type Props = {
  initialUsers: AdminUser[];
  currentUserId: string;
};

export function UsersManager({ initialUsers, currentUserId }: Props) {
  const [users] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [_isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q) ||
      u.id.includes(q)
    );
  });

  async function handleDelete(user: AdminUser) {
    if (user.id === currentUserId) {
      toast.error("Você não pode deletar a própria conta.");
      return;
    }
    const label = user.displayName || user.email || user.id.slice(0, 8);
    if (!window.confirm(`Deletar ${label}? Todas as sessões serão removidas.`)) return;

    setPendingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "delete_failed");
      }
      toast.success(`${label} removido.`);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(`Falha ao deletar: ${(err as Error).message}`);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscar por nome, email ou id"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} de {users.length} usuários
        </span>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Último login</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const label = u.displayName?.trim() || u.email?.split("@")[0] || "—";
                const isMe = u.id === currentUserId;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2 font-medium">
                          {label}
                          {isMe ? (
                            <Badge variant="outline" className="text-[0.65rem]">
                              você
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">{u.email || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.role === "admin" ? (
                        <Badge className="gap-1">
                          <ShieldCheck className="size-3" />
                          admin
                        </Badge>
                      ) : (
                        <Badge variant="outline">user</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          ativo
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">desativado</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(u.lastSignInAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditing(u)}
                          aria-label={`Editar ${label}`}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(u)}
                          disabled={pendingId === u.id || isMe}
                          aria-label={`Deletar ${label}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {editing ? (
        <EditUserDialog
          user={editing}
          currentUserId={currentUserId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            startTransition(() => router.refresh());
          }}
        />
      ) : null}
    </div>
  );
}
