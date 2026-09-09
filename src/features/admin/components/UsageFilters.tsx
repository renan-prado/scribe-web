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
  type SelectOption,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  users: { id: string; displayName: string | null; email: string | null }[];
  routes: string[];
  /** Da mais nova para a mais antiga — a ordem já vem pronta do servidor. */
  versions: string[];
  current: {
    range: string;
    userId: string;
    route: string;
    sessionId: string;
    mode: string;
    version: string;
  };
};

const ANY = "__any__";

// Cada Select declara suas opções UMA vez e passa a mesma lista para o `items`
// do Root e para o map dos itens. Sem o `items`, o gatilho mostra o valor cru
// ("30d", "audio_only") em vez do rótulo — ver o cabeçalho de shared/ui/select.
const RANGE_OPTIONS: SelectOption[] = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o histórico" },
];

const MODE_OPTIONS: SelectOption[] = [
  { value: ANY, label: "Todos" },
  { value: "live", label: "Com live" },
  { value: "audio_only", label: "Sem live" },
  { value: "transcript_only", label: "Transcrição" },
];

export function UsageFilters({ users, routes, versions, current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [range, setRange] = useState(current.range);
  const [userId, setUserId] = useState(current.userId || ANY);
  const [route, setRoute] = useState(current.route || ANY);
  const [mode, setMode] = useState(current.mode || ANY);
  const [version, setVersion] = useState(current.version || ANY);
  const [isPending, startTransition] = useTransition();

  const activeSessionId = current.sessionId?.trim() ?? "";

  const userOptions: SelectOption[] = [
    { value: ANY, label: "Todos" },
    ...users.map((u) => ({
      value: u.id,
      label: u.displayName?.trim() || u.email || u.id.slice(0, 8),
    })),
  ];
  const routeOptions: SelectOption[] = [
    { value: ANY, label: "Todas" },
    ...routes.map((r) => ({ value: r, label: r })),
  ];
  const versionOptions: SelectOption[] = [
    { value: ANY, label: "Todas" },
    ...versions.map((v) => ({ value: v, label: `v${v}` })),
  ];

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
    if (version && version !== ANY) params.set("version", version);
    else params.delete("version");
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
    setVersion(ANY);
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
    <div className="flex flex-col gap-4 p-5 admin-card-surface">
      {/* Três colunas só em xl. Em `lg`, com a sidebar aberta, cada select
          ficava com ~130px e o nome do usuário truncava antes da arroba — o
          filtro deixava de dizer quem ele estava filtrando. Com o sexto campo
          (versão) as cinco de antes passariam do mesmo limite, então a barra
          vira duas fileiras de três em vez de uma de seis. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 xl:items-end">
        <div className="flex flex-col gap-1.5">
          <Label>Período</Label>
          <Select items={RANGE_OPTIONS} value={range} onValueChange={(v) => setRange(v ?? "30d")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Usuário</Label>
          <Select
            items={userOptions}
            value={userId === ANY ? undefined : userId}
            onValueChange={(v) => setUserId(v ?? ANY)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {userOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Rota</Label>
          <Select
            items={routeOptions}
            value={route === ANY ? undefined : route}
            onValueChange={(v) => setRoute(v ?? ANY)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {routeOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Modo</Label>
          <Select
            items={MODE_OPTIONS}
            value={mode === ANY ? undefined : mode}
            onValueChange={(v) => setMode(v ?? ANY)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* A versão fica ao lado da rota de propósito: a leitura que este
            filtro existe para permitir é "uma rota, versão contra versão".
            Sem fixar a rota, o custo médio por chamada muda só porque a
            MISTURA de rotas mudou entre um deploy e outro. */}
        <div className="flex flex-col gap-1.5">
          <Label>Versão</Label>
          <Select
            items={versionOptions}
            value={version === ANY ? undefined : version}
            onValueChange={(v) => setVersion(v ?? ANY)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {versionOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
          <Button onClick={apply} disabled={isPending} className="flex-1">
            {isPending ? "Aplicando…" : "Aplicar"}
          </Button>
          <Button variant="outline" onClick={reset} disabled={isPending}>
            Limpar
          </Button>
        </div>
      </div>

      {activeSessionId ? (
        <div className="flex items-center gap-2 rounded-full bg-scriba-blue-soft px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-scriba-blue-ink">
            Sessão
          </span>
          <span className="min-w-0 truncate font-mono text-[11px] text-scriba-ink">
            {activeSessionId}
          </span>
          <button
            type="button"
            onClick={clearSessionFilter}
            aria-label="Remover filtro de sessão"
            className="ml-auto inline-flex size-5 shrink-0 items-center justify-center rounded-full text-scriba-blue-ink transition-colors hover:bg-scriba-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-blue"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
