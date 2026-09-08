"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useId } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  type SelectOption,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATE_RANGES, type DateRangeKey } from "@/features/session/lib/search";
import { cn } from "@/lib/utils";

/**
 * A barra de busca das duas listas — `/list` e `/studies`. Só DESENHA: quem
 * filtra é o browser de cada página, com os helpers de
 * `src/features/session/lib/search.ts`.
 *
 * ## Uma barra para as duas páginas
 *
 * As listas mostram coisas diferentes (gravações e estudos) mas se procuram
 * pelas mesmas chaves — quem pregou, onde, quando. Duas barras parecidas é
 * como duas telas de busca começam a divergir em detalhes que ninguém decidiu:
 * uma ganha o contador de resultados, a outra não; uma limpa os filtros com um
 * "×", a outra com um link. Os facetas ficam configuráveis (`/studies` não tem
 * local) e o resto é o mesmo componente.
 *
 * ## Por que os filtros ficam SEMPRE visíveis
 *
 * Não há "abrir filtros". Eles são três seletores curtos, e escondê-los atrás
 * de um botão trocaria um toque por dois em troca de três centímetros de tela.
 *
 * E a barra também não some quando a lista é curta. Havia um piso de quatro
 * itens em cada página, com o argumento de que rolar é mais rápido que
 * filtrar. O argumento vale para achar o CARTÃO, não para a busca: aqui ela
 * alcança a transcrição, que o cartão não mostra e a lista não carrega, então
 * mesmo duas gravações escondem uma frase que só a barra encontra. E uma barra
 * que aparece sozinha no quarto cartão é uma função que se descobre por
 * acidente, quando se descobre.
 *
 * O que some é uma FACETA vazia — um seletor que só oferece "todos os autores"
 * não filtra nada. UMA opção já basta para ele valer: quando parte dos itens
 * não tem autor, escolher o único nome disponível divide a lista.
 *
 * O contador à direita é a peça que fecha o ciclo — sem ele, uma combinação de
 * filtros que não devolve nada é indistinguível de uma lista que não carregou.
 */

/** O valor "sem filtro" de um faceta. Sentinela porque `""` no base-ui Select
 *  colide com o estado de placeholder do gatilho. */
export const FACET_ALL = "__all__";

export type Facet = {
  /** Rótulo curto, usado no `aria-label` e na opção "todos". */
  label: string;
  /** "Todos os autores" / "Todos os locais" — a opção neutra da lista. */
  allLabel: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  facets: Facet[];
  range: DateRangeKey;
  onRangeChange: (value: DateRangeKey) => void;
  /** "3 de 24 gravações" — já formatado por quem chama. */
  countLabel: string;
  /** Verdadeiro quando algo está filtrando; liga o botão "Limpar". */
  filtering: boolean;
  onClear: () => void;
};

const RANGE_OPTIONS: SelectOption<DateRangeKey>[] = DATE_RANGES.map((r) => ({
  value: r.value,
  label: r.label,
}));

export function CollectionSearch({
  query,
  onQueryChange,
  placeholder,
  facets,
  range,
  onRangeChange,
  countLabel,
  filtering,
  onClear,
}: Props) {
  const inputId = useId();

  return (
    <section
      aria-label="Buscar e filtrar"
      className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-3 sm:p-4"
    >
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-scriba-ink-mute"
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={cn(
            "w-full rounded-xl border border-input bg-transparent py-2.5 pl-9 pr-9 text-sm outline-none",
            "placeholder:text-scriba-ink-mute focus:border-ring focus:ring-2 focus:ring-ring/40",
            // O "×" nativo do type=search aparece só em alguns navegadores e
            // nunca combina com o resto; o nosso está sempre lá.
            "[&::-webkit-search-cancel-button]:appearance-none"
          )}
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-scriba-ink-mute outline-none transition-colors hover:bg-scriba-blue-soft/60 hover:text-scriba-ink focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal aria-hidden className="size-3.5 shrink-0 text-scriba-ink-mute" />

        {facets
          .filter((facet) => facet.options.length > 0)
          .map((facet) => {
            const options: SelectOption[] = [
              { value: FACET_ALL, label: facet.allLabel },
              ...facet.options.map((o) => ({ value: o, label: o })),
            ];
            return (
              <Select
                key={facet.label}
                items={options}
                value={facet.value}
                onValueChange={(v) => facet.onChange(String(v))}
              >
                <SelectTrigger
                  size="sm"
                  aria-label={facet.label}
                  className={cn(
                    "max-w-[46vw] sm:max-w-56",
                    facet.value !== FACET_ALL &&
                      "border-scriba-blue-soft bg-scriba-blue-soft/60 text-scriba-blue-ink"
                  )}
                >
                  <SelectValue />
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
          })}

        <Select
          items={RANGE_OPTIONS}
          value={range}
          onValueChange={(v) => onRangeChange(v as DateRangeKey)}
        >
          <SelectTrigger
            size="sm"
            aria-label="Período"
            className={cn(
              range !== "all" &&
                "border-scriba-blue-soft bg-scriba-blue-soft/60 text-scriba-blue-ink"
            )}
          >
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

        {filtering ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-scriba-ink-mute outline-none transition-colors hover:bg-scriba-blue-soft/60 hover:text-scriba-ink focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <X className="size-3" strokeWidth={2.5} />
            Limpar
          </button>
        ) : null}

        <span
          aria-live="polite"
          className="ml-auto shrink-0 text-[11px] font-light tabular-nums text-scriba-ink-mute"
        >
          {countLabel}
        </span>
      </div>
    </section>
  );
}
