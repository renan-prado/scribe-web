"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

/**
 * Os filtros FINOS de /admin/custos: usuário, rota e modo.
 *
 * Período e versão saíram daqui. Eles valem para as quatro abas e para os dois
 * lados da margem, então vivem no cabeçalho, ao lado do título, onde estão à
 * vista mesmo quando esta barra não é renderizada. Enquanto os seis campos
 * ficavam juntos, a mesma tela tinha duas maneiras de escolher período (as
 * pílulas do cabeçalho e este select) e elas podiam divergir na leitura de
 * quem chegava.
 *
 * Os três que sobraram são os que NÃO atravessam para a aba de preços: rota
 * recorta o custo e não a moeda, e uma margem assim é uma fatia dividida pelo
 * total do período. Ver `coinsScoped` em `features/admin/server/db/usage.ts`.
 *
 * O destino é o `pathname` atual e a query PRESERVA o que não é destes três
 * campos (`aba`, `range`, `version`), então a barra serve qualquer aba sem
 * saber em qual está.
 */
type Props = {
  users: { id: string; displayName: string | null; email: string | null }[];
  routes: string[];
  current: {
    userId: string;
    route: string;
    mode: string;
  };
};

const ANY = "__any__";

// Cada Select declara suas opções UMA vez e passa a mesma lista para o `items`
// do Root e para o map dos itens. Sem o `items`, o gatilho mostra o valor cru
// ("audio") em vez do rótulo, ver o cabeçalho de shared/ui/select.
const MODE_OPTIONS: SelectOption[] = [
  { value: ANY, label: "Todos" },
  { value: "audio", label: "Gravação" },
  { value: "youtube", label: "YouTube" },
];

export function UsageFilters({ users, routes, current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState(current.userId || ANY);
  const [route, setRoute] = useState(current.route || ANY);
  const [mode, setMode] = useState(current.mode || ANY);
  const [isPending, startTransition] = useTransition();

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

  function push(params: URLSearchParams) {
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function apply() {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of [
      ["userId", userId],
      ["route", route],
      ["mode", mode],
    ] as const) {
      if (value && value !== ANY) params.set(key, value);
      else params.delete(key);
    }
    push(params);
  }

  function reset() {
    setUserId(ANY);
    setRoute(ANY);
    setMode(ANY);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("userId");
    params.delete("route");
    params.delete("mode");
    push(params);
  }

  return (
    <div className="flex flex-col gap-4 p-5 admin-card-surface">
      {/* Três colunas só em xl. Em `lg`, com a sidebar aberta, cada select
          ficava com ~130px e o nome do usuário truncava antes da arroba, o
          filtro deixava de dizer quem ele estava filtrando. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
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

        {/* A rota é o filtro que a aba de versões PEDE: sem fixá-la, o custo
            médio por chamada muda só porque a MISTURA de rotas mudou entre um
            deploy e outro. */}
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

        <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
          <Button onClick={apply} disabled={isPending} className="flex-1">
            {isPending ? "Aplicando…" : "Aplicar"}
          </Button>
          <Button variant="outline" onClick={reset} disabled={isPending}>
            Limpar
          </Button>
        </div>
      </div>
    </div>
  );
}
