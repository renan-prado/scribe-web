"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * O campo que abre uma sessão execução por execução.
 *
 * Aceita o UUID cru OU a URL da gravação colada do navegador — que é como o id
 * chega até a mão de quem está testando. Exigir que a pessoa recorte o UUID de
 * dentro de `/recording/<id>/deepening` é atrito por nada.
 */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function SessionRunLookup({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(current);
  const [isPending, startTransition] = useTransition();

  const found = UUID.exec(value.trim())?.[0] ?? "";
  const invalid = value.trim().length > 0 && !found;

  function go(sessionId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (sessionId) params.set("sessionId", sessionId);
    else params.delete("sessionId");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/admin/precificacao?${qs}` : "/admin/precificacao"));
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-scriba-hairline bg-scriba-paper p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (found) go(found);
      }}
    >
      <div className="flex min-w-64 flex-1 flex-col gap-1.5">
        <Label htmlFor="session-run-lookup" className="text-xs">
          Inspecionar uma sessão
        </Label>
        <Input
          id="session-run-lookup"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ID da sessão ou a URL da gravação"
          spellCheck={false}
          autoComplete="off"
        />
        <p
          className={
            invalid
              ? "text-[11px] font-light text-destructive"
              : "text-[11px] font-light text-scriba-ink-mute"
          }
        >
          {invalid
            ? "Não achei um ID aqui — cole a URL da gravação ou o UUID."
            : "Cada reprocessamento aparece como uma execução separada."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!found || isPending}>
          {isPending ? "Abrindo…" : "Ver execuções"}
        </Button>
        {current ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setValue("");
              go("");
            }}
          >
            <X className="size-4" aria-hidden />
            Limpar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
