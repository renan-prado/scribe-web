"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  type SelectOption,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * O seletor de versão do cabeçalho, ao lado das pílulas de período.
 *
 * Navega no ato, sem botão de aplicar, porque é vizinho de controles que já
 * são links: um "Aplicar" ali seria a única coisa da faixa que exige dois
 * cliques.
 *
 * Ele preserva o resto da query (`sessionId`, `range`) e usa o `pathname` da
 * própria tela, então serve qualquer página do painel sem saber qual é.
 *
 * A lista chega PRONTA do servidor, ordenada da mais nova para a mais antiga
 * por `sortVersionsDesc`, ordenar aqui daria "0.10.0" antes de "0.9.0", que é
 * o erro que a comparação inteira existe para não cometer.
 */
export function VersionPicker({ versions, current }: { versions: string[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const ANY = "__any__";
  const options: SelectOption[] = [
    { value: ANY, label: "Todas as versões" },
    ...versions.map((v) => ({ value: v, label: `v${v}` })),
  ];

  function pick(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== ANY) params.set("version", value);
    else params.delete("version");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  // Sem nenhuma versão gravada, ele aparece DESABILITADO, nunca escondido.
  //
  // A primeira versão deste componente sumia da tela nesse caso, com o
  // argumento de que um seletor de uma opção só não controla nada. O efeito era
  // o oposto: a funcionalidade desaparecia exatamente quando alguém ia
  // procurá-la pela primeira vez (antes da medição começar, que é o estado de
  // TODO ambiente no dia em que isto sobe), e a leitura era "não foi feito",
  // não "ainda não há o que comparar". Some com o controle e some com a
  // explicação junto.
  //
  // Desabilitado com o motivo no `title` diz as duas coisas ao mesmo tempo:
  // existe, e ainda não tem o que oferecer. É também o que a barra de filtros
  // de /admin/usage já fazia, lá o campo sempre esteve na tela.
  const empty = versions.length === 0;

  return (
    <Select
      items={options}
      value={current || undefined}
      onValueChange={(v) => pick(v ?? ANY)}
      disabled={isPending || empty}
    >
      {/* `size` padrão = `h-8`, a mesma altura da faixa de pílulas ao lado. */}
      <SelectTrigger
        className="w-[168px]"
        title={
          empty
            ? "Nenhuma chamada carimbada ainda. A comparação por versão começa no próximo deploy depois de um npm run release."
            : undefined
        }
      >
        <SelectValue placeholder={empty ? "Sem versões ainda" : "Todas as versões"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
