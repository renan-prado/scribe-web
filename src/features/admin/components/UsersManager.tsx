"use client";

import { Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
import type { AdminUser, AdminUserBilling, PayingStatus } from "@/features/admin/server/db/users";
import { formatBrl, PLANS } from "@/features/billing/plans";
import { EditUserDialog } from "./EditUserDialog";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Mês/ano, para o intervalo em que a conta pagou. "03/2026". */
const MONTH_FMT = new Intl.DateTimeFormat("pt-BR", { month: "2-digit", year: "numeric" });

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : DATE_FMT.format(d);
}

function formatMonth(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : MONTH_FMT.format(d);
}

/**
 * Duração em texto. Abaixo de um mês não vira "0 meses": uma conta que pagou
 * ontem não é uma conta que pagou por zero tempo, e o zero se lê como defeito.
 */
function formatSpan(days: number | null): string {
  if (days === null) return "-";
  if (days < 30) return "menos de 1 mês";
  const months = Math.floor(days / 30.44);
  if (months < 12) return months === 1 ? "1 mês" : `${months} meses`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (rest === 0) return years === 1 ? "1 ano" : `${years} anos`;
  return `${years}a ${rest}m`;
}

/**
 * Os status crus do Stripe, em português. A coluna mostra o CRU traduzido e
 * não uma simplificação em "ativa/inativa": `past_due` e `canceled` levam a
 * conversas opostas (um é cobrança falhando agora, o outro é alguém que saiu),
 * e as duas cairiam no mesmo balde.
 */
const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  active: "ativa",
  trialing: "em teste",
  past_due: "pagamento atrasado",
  canceled: "cancelada",
  incomplete: "checkout incompleto",
  incomplete_expired: "checkout expirado",
  unpaid: "não paga",
  paused: "pausada",
  inactive: "sem assinatura",
};

/**
 * Os cinco recortes da lista. Os quatro últimos são EXCLUDENTES e cobrem a base
 * inteira, então a soma deles é o total — é o que permite ler as contagens como
 * uma resposta, e não como quatro filtros que talvez se sobreponham.
 *
 * Nenhum deles publica MRR nem receita total: esses números já têm dono em
 * `/admin/metricas` e `/admin/financeiro`, e um segundo lugar publicando o
 * mesmo número faz quem lê conferir se batem em vez de ler a tela.
 */
const FILTERS: { key: "todos" | PayingStatus; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "assinante", label: "Assinantes" },
  { key: "ex_assinante", label: "Ex-assinantes" },
  { key: "avulso", label: "Só avulso" },
  { key: "nunca", label: "Nunca pagaram" },
];

type Props = {
  initialUsers: AdminUser[];
  currentUserId: string;
};

export function UsersManager({ initialUsers, currentUserId }: Props) {
  const [users] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | PayingStatus>("todos");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [_isPending, startTransition] = useTransition();
  const router = useRouter();

  const counts = useMemo(() => {
    const acc: Record<string, number> = { todos: users.length };
    for (const u of users) acc[u.billing.status] = (acc[u.billing.status] ?? 0) + 1;
    return acc;
  }, [users]);

  const filtered = users.filter((u) => {
    if (filter !== "todos" && u.billing.status !== filter) return false;
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
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="ml-1.5 tabular-nums opacity-70">{counts[f.key] ?? 0}</span>
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscar por nome, email ou id"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 rounded-xl border-scriba-hairline-soft bg-scriba-paper px-4 sm:max-w-sm"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} de {users.length} usuários
        </span>
      </div>

      <div className="admin-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assinatura</TableHead>
              <TableHead>Pagante</TableHead>
              <TableHead className="text-right">Pagamentos</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Último login</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const label = u.displayName?.trim() || u.email?.split("@")[0] || "-";
                const isMe = u.id === currentUserId;
                const b = u.billing;
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
                        <span className="text-xs text-muted-foreground">{u.email || "-"}</span>
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
                        <Badge variant="success">ativo</Badge>
                      ) : (
                        <Badge variant="destructive">desativado</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <SubscriptionCell billing={b} />
                    </TableCell>
                    <TableCell>
                      <PayingCell billing={b} />
                    </TableCell>
                    <TableCell className="text-right">
                      {b.invoices === 0 && b.topups === 0 ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="text-xs tabular-nums">
                            {b.invoices} {b.invoices === 1 ? "fatura" : "faturas"}
                          </span>
                          {b.topups > 0 ? (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {b.topups} {b.topups === 1 ? "avulso" : "avulsos"}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {b.revenueCents > 0 ? (
                        <span
                          title={
                            b.unmappedCredits > 0
                              ? `${b.unmappedCredits} crédito(s) fora do catálogo não entraram neste total.`
                              : undefined
                          }
                        >
                          {formatBrl(b.revenueCents)}
                          {b.unmappedCredits > 0 ? "*" : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
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

/**
 * Plano e estado. O plano de quem SAIU continua aparecendo, em pastilha
 * apagada: "cancelou" sem dizer de qual plano não responde a pergunta que faz
 * alguém abrir esta tela, que é de onde o dinheiro saiu.
 */
function SubscriptionCell({ billing }: { billing: AdminUserBilling }) {
  if (billing.status === "avulso") {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="outline">avulso</Badge>
        <span className="text-xs text-muted-foreground">nunca assinou</span>
      </div>
    );
  }
  if (!billing.plan || billing.plan === "free") {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const active = billing.status === "assinante";
  const raw = billing.subscriptionStatus ?? "";

  // "ativa" embaixo de [Estudioso] é ruído em dois sentidos. A pastilha ACESA
  // já quer dizer assinatura viva — repeti-la por extenso é dizer duas vezes a
  // mesma coisa. E a coluna Status, ao lado, usa a palavra "ativo" para outra
  // coisa (a conta ligada ou desligada), então as duas juntas convidam a ler
  // uma como consequência da outra. A legenda só aparece quando o estado
  // PRECISA ser explicado: teste, cobrança falhando, saída agendada, cancelada.
  // O `active` no primeiro teste não é redundante: o Stripe pode deixar
  // `cancel_at_period_end` ligado numa assinatura que JÁ terminou, e a célula
  // anunciaria uma saída futura para quem saiu mês passado.
  const note =
    billing.cancelAtPeriodEnd && active
      ? "sai no fim do período"
      : raw === "active"
        ? null
        : (SUBSCRIPTION_STATUS_LABEL[raw] ?? (raw || null));

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant={active ? "default" : "outline"}>{PLANS[billing.plan].name}</Badge>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </div>
  );
}

/**
 * Há quanto tempo a conta paga, e entre quais meses.
 *
 * O intervalo é o que separa um assinante de um ex-assinante numa olhada: o
 * primeiro termina em "hoje", o segundo termina no mês em que parou. A duração
 * sozinha ("5 meses") não diz qual dos dois é.
 */
function PayingCell({ billing }: { billing: AdminUserBilling }) {
  if (!billing.firstPaidAt) {
    return (
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">-</span>
        {billing.status === "assinante" ? (
          <span className="text-xs text-muted-foreground">sem fatura ainda</span>
        ) : null}
      </div>
    );
  }
  const active = billing.status === "assinante";
  return (
    <div className="flex flex-col">
      <span className="text-sm">{formatSpan(billing.paidSpanDays)}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatMonth(billing.firstPaidAt)} – {active ? "hoje" : formatMonth(billing.lastPaidAt)}
      </span>
    </div>
  );
}
