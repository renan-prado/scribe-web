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
 * Aceita o UUID cru OU a URL da gravação colada do navegador, que é como o id
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
    /*
     * O campo e os botões vivem na MESMA linha, e o texto de ajuda desce
     * inteiro por baixo dos dois.
     *
     * A versão anterior era um `items-end` sobre duas colunas, e a coluna da
     * esquerda tinha rótulo + campo + ajuda: alinhar pelo fim dela punha os
     * botões na altura do PARÁGRAFO, uns 18px abaixo do campo. Parecia
     * desalinhamento aleatório e não era, era o alinhamento pedido, sobre a
     * caixa errada. Compensar com margem no botão só teria escondido isso até
     * o texto de ajuda mudar de altura (ele muda: o aviso de ID inválido é
     * mais longo e quebra em duas linhas no celular).
     *
     * `size` padrão nos botões, e não `sm`: o padrão é `h-8`, a mesma altura
     * do `Input`. Com `sm` (`h-7`) eles ficariam centralizados mas visivelmente
     * mais baixos que a caixa ao lado.
     */
    <form
      className="flex flex-col gap-1.5 rounded-xl border border-scriba-hairline bg-scriba-paper p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (found) go(found);
      }}
    >
      <Label htmlFor="session-run-lookup" className="text-xs">
        Inspecionar uma sessão
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="session-run-lookup"
          className="min-w-64 flex-1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ID da sessão ou a URL da gravação"
          spellCheck={false}
          autoComplete="off"
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button type="submit" disabled={!found || isPending}>
            {isPending ? "Abrindo…" : "Ver execuções"}
          </Button>
          {current ? (
            <Button
              type="button"
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
      </div>
      <p
        className={
          invalid
            ? "text-[11px] font-light text-destructive"
            : "text-[11px] font-light text-scriba-ink-mute"
        }
      >
        {invalid
          ? "Não achei um ID aqui, cole a URL da gravação ou o UUID."
          : "Cada reprocessamento aparece como uma execução separada."}
      </p>
    </form>
  );
}
