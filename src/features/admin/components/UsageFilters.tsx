"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ADMIN_CARD_SURFACE } from "@/features/admin/lib/surfaces";

type Props = {
  users: { id: string; displayName: string | null; email: string | null }[];
  routes: string[];
  current: { range: string; userId: string; route: string; sessionId: string; mode: string };
};

const RANGE_LABELS: Record<string, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  all: "Todo o histórico",
};

const MODE_LABELS: Record<string, string> = {
  live: "Com live",
  audio_only: "Sem live",
};

const ANY = "__any__";

export function UsageFilters({ users, routes, current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [range, setRange] = useState(current.range);
  const [userId, setUserId] = useState(current.userId || ANY);
  const [route, setRoute] = useState(current.route || ANY);
  const [mode, setMode] = useState(current.mode || ANY);
  const [isPending, startTransition] = useTransition();

  const activeSessionId = current.sessionId?.trim() ?? "";

  function apply() {
    const params = new URLSearchParams(searchParams.toString());
    if (range && range !== "30d") params.set("range", range);
    else params.delete("range");
    if (userId && userId !== ANY) params.set("userId", userId);
    else params.delete("userId");
    if (route && route !== ANY) params.set("route", route);
    else params.delete("route");
    if (mode && mode !== ANY) params.set("mode", mode);
    else params.delete("mode");
    // Session filter is set from the Sessions table row, not from an input here.

    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/admin/usage?${qs}` : "/admin/usage");
    });
  }

  function reset() {
    setRange("30d");
    setUserId(ANY);
    setRoute(ANY);
    setMode(ANY);
    startTransition(() => router.push("/admin/usage"));
  }

  function clearSessionFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("sessionId");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/admin/usage?${qs}` : "/admin/usage");
    });
  }

  return (
    <div className={`flex flex-col gap-4 p-5 ${ADMIN_CARD_SURFACE}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div className="flex flex-col gap-1.5">
          <Label>Período</Label>
          <Select value={range} onValueChange={(v) => setRange(v ?? "30d")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RANGE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Usuário</Label>
          <Select
            value={userId === ANY ? undefined : userId}
            onValueChange={(v) => setUserId(v ?? ANY)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.displayName?.trim() || u.email || u.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Rota</Label>
          <Select
            value={route === ANY ? undefined : route}
            onValueChange={(v) => setRoute(v ?? ANY)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas</SelectItem>
              {routes.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Modo</Label>
          <Select value={mode === ANY ? undefined : mode} onValueChange={(v) => setMode(v ?? ANY)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {Object.entries(MODE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button onClick={apply} disabled={isPending} className="flex-1">
            {isPending ? "Aplicando…" : "Aplicar"}
          </Button>
          <Button variant="outline" onClick={reset} disabled={isPending}>
            Limpar
          </Button>
        </div>
      </div>

      {activeSessionId ? (
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{ background: "var(--scriba-blue-soft)" }}
        >
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--scriba-blue)" }}
          >
            Sessão
          </span>
          <span className="truncate font-mono text-[11px]" style={{ color: "var(--scriba-ink)" }}>
            {activeSessionId}
          </span>
          <button
            type="button"
            onClick={clearSessionFilter}
            aria-label="Remover filtro de sessão"
            className="ml-auto inline-flex size-5 items-center justify-center rounded-full transition-colors"
            style={{ color: "var(--scriba-blue)" }}
          >
            <X className="size-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
