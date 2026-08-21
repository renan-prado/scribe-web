"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  users: { id: string; displayName: string | null; email: string | null }[];
  routes: string[];
  current: { range: string; userId: string; route: string; sessionId: string };
};

const RANGE_LABELS: Record<string, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  all: "Todo o histórico",
};

const ANY = "__any__";

export function UsageFilters({ users, routes, current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [range, setRange] = useState(current.range);
  const [userId, setUserId] = useState(current.userId || ANY);
  const [route, setRoute] = useState(current.route || ANY);
  const [sessionId, setSessionId] = useState(current.sessionId);
  const [isPending, startTransition] = useTransition();

  function apply() {
    const params = new URLSearchParams(searchParams.toString());
    if (range && range !== "30d") params.set("range", range);
    else params.delete("range");
    if (userId && userId !== ANY) params.set("userId", userId);
    else params.delete("userId");
    if (route && route !== ANY) params.set("route", route);
    else params.delete("route");
    if (sessionId.trim()) params.set("sessionId", sessionId.trim());
    else params.delete("sessionId");

    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/backstage/usage?${qs}` : "/backstage/usage");
    });
  }

  function reset() {
    setRange("30d");
    setUserId(ANY);
    setRoute(ANY);
    setSessionId("");
    startTransition(() => router.push("/backstage/usage"));
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
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
        <Select value={userId} onValueChange={(v) => setUserId(v ?? ANY)}>
          <SelectTrigger className="w-full">
            <SelectValue />
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
        <Select value={route} onValueChange={(v) => setRoute(v ?? ANY)}>
          <SelectTrigger className="w-full">
            <SelectValue />
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
        <Label htmlFor="filter-session">Sessão (UUID)</Label>
        <Input
          id="filter-session"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder="opcional"
        />
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
  );
}
