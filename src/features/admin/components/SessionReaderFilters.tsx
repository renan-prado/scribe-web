"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
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

/**
 * A barra de filtros de `/admin/sessions`.
 *
 * O filtro por PESSOA é o que a tela existe para servir: validar qualidade nos
 * primeiros usuários é ler tudo o que UMA pessoa recebeu, e não uma amostra
 * espalhada por várias. É por isso que ele vem primeiro.
 *
 * O estado mora na URL, como no resto do painel: um recorte interessante é
 * colável num chat, e o botão voltar do navegador desfaz o filtro.
 */

type Props = {
  users: { id: string; displayName: string | null; email: string | null }[];
  current: { userId: string; mode: string; q: string };
};

const ANY = "__any__";

// Cada Select declara suas opções UMA vez e passa a mesma lista para o `items`
// do Root e para o map dos itens. Sem o `items`, o gatilho mostra o valor cru
// ("audio_only") em vez do rótulo, ver o cabeçalho de shared/ui/select.
const MODE_OPTIONS: SelectOption[] = [
  { value: ANY, label: "Todos" },
  { value: "live", label: "Com live" },
  { value: "audio_only", label: "Sem live" },
  { value: "transcript_only", label: "Transcrição" },
  { value: "youtube", label: "YouTube" },
];

export function SessionReaderFilters({ users, current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState(current.userId || ANY);
  const [mode, setMode] = useState(current.mode || ANY);
  const [q, setQ] = useState(current.q);
  const [isPending, startTransition] = useTransition();

  const userOptions: SelectOption[] = [
    { value: ANY, label: "Todos" },
    ...users.map((u) => ({
      value: u.id,
      label: u.displayName?.trim() || u.email || u.id.slice(0, 8),
    })),
  ];

  function push(next: { userId: string; mode: string; q: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.userId && next.userId !== ANY) params.set("userId", next.userId);
    else params.delete("userId");
    if (next.mode && next.mode !== ANY) params.set("mode", next.mode);
    else params.delete("mode");
    if (next.q.trim()) params.set("q", next.q.trim());
    else params.delete("q");

    const qs = params.toString();
    startTransition(() => router.push(qs ? `/admin/sessions?${qs}` : "/admin/sessions"));
  }

  function reset() {
    setUserId(ANY);
    setMode(ANY);
    setQ("");
    startTransition(() => router.push("/admin/sessions"));
  }

  const dirty = userId !== ANY || mode !== ANY || q.trim().length > 0;

  return (
    <form
      className="admin-card-surface flex flex-col gap-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        push({ userId, mode, q });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 xl:items-end">
        <div className="flex flex-col gap-1.5">
          <Label>Pessoa</Label>
          <Select items={userOptions} value={userId} onValueChange={(v) => setUserId(v ?? ANY)}>
            <SelectTrigger className="w-full">
              <SelectValue />
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
          <Label>Modo</Label>
          <Select items={MODE_OPTIONS} value={mode} onValueChange={(v) => setMode(v ?? ANY)}>
            <SelectTrigger className="w-full">
              <SelectValue />
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-sessions-q">Título</Label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-scriba-ink-mute"
            />
            <Input
              id="admin-sessions-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="parte do título"
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          Aplicar
        </Button>
        {dirty ? (
          <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={isPending}>
            <X className="size-3.5" />
            Limpar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
