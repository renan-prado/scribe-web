"use client";

import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useId, useState } from "react";
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
 * A barra de busca das duas listas — `/recordings` e `/studies`. Só DESENHA:
 * quem filtra é o browser de cada página, com os helpers de
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
 * ## Os filtros ficam sempre visíveis NO DESKTOP, e recolhidos no celular
 *
 * No desktop não há "abrir filtros": são três seletores curtos numa fileira que
 * já tem espaço sobrando, e escondê-los trocaria um toque por dois em troca de
 * nada.
 *
 * No celular a conta se inverte. Ali eles não são uma fileira — são uma grade
 * de duas colunas com até três linhas, empilhada entre a busca e o primeiro
 * cartão, e é a primeira coisa que se vê ao abrir a lista. O custo deixa de ser
 * "três centímetros de tela" e passa a ser metade da primeira dobra gasta com
 * controles que a maioria das visitas não usa.
 *
 * Então abaixo de `sm` a grade fica atrás de um botão "Filtros", e TRÊS COISAS
 * continuam fora dele — são justamente as que tornam o estado recolhido
 * honesto:
 *
 *  - **a busca**, que é o que a barra existe para oferecer;
 *  - **o contador**, sem o qual uma lista filtrada é indistinguível de uma
 *    lista curta;
 *  - **"Limpar"**, para desfazer um filtro sem ter de abrir o painel que o
 *    escondeu.
 *
 * O botão CONTA os filtros ativos ("Filtros · 2") e o painel já nasce aberto
 * quando algum está ligado. Sem as duas coisas, recolher viraria esconder: a
 * pessoa volta para a lista, vê menos cartões do que esperava, e o motivo está
 * atrás de um toque que ela não sabe que precisa dar.
 *
 * O contador do botão ignora o texto da BUSCA de propósito — aquele campo está
 * visível e cheio, e somá-lo faria o botão acusar "1" apontando para um painel
 * onde nada está ligado.
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
 *
 * ## No celular a barra tem OUTRO layout, não o mesmo espremido
 *
 * A fileira única com `flex-wrap` é o desenho do desktop. No celular ela se
 * desmanchava: os gatilhos são `w-fit`, então cada um tinha a largura do
 * próprio texto, e o teto era `max-w-[46vw]` — medido no VIEWPORT, enquanto a
 * barra vive dentro de `px-4` da página mais `p-3` do cartão. Dois seletores de
 * 46vw não cabiam nos ~91% que sobram, então quebravam de linha em pontos que
 * mudavam A CADA ESCOLHA (escolher "Todos os autores" e escolher um nome longo
 * dão larguras diferentes), e o contador, com `ml-auto`, ia parar sozinho na
 * última linha que calhasse. Era isso o "meio quebrado".
 *
 * Aqui embaixo de `sm` os seletores viram uma GRADE de duas colunas — largura
 * previsível, sem reflow ao escolher — e "Limpar" e o contador ganham a linha
 * de baixo, o contador à esquerda porque é ele que se lê. O `sm:contents`
 * dissolve os dois invólucros no `sm`, e a fileira do desktop volta a ser
 * exatamente a de antes, sem markup duplicado.
 *
 * Duas medidas de DEDO que não são estética:
 *
 *  - **O campo de busca é 16px no celular** (`text-base sm:text-sm`). Abaixo
 *    disso o Safari do iOS dá zoom na página ao focar o input, e sair do zoom
 *    é manual — a barra "funcionava" e ainda assim quebrava a tela.
 *  - **Os gatilhos têm 36px de altura no celular** (`min-h-9`), contra os 28
 *    do `size="sm"`. É `min-height` de propósito: `h-7` vem de uma variante
 *    `data-[size=sm]` do `SelectTrigger`, que ganha de um `h-*` solto por
 *    especificidade — `min-h` não disputa com ela, só levanta o piso.
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

/**
 * O gatilho dos três seletores. No celular ele preenche a célula da grade
 * (`w-full`, e `min-w-0` para poder encolher abaixo do texto que carrega); no
 * `sm` volta a ser `w-fit`, a largura do próprio conteúdo, que é o desenho da
 * fileira. O `min-h-9` é a medida de dedo explicada no cabeçalho.
 */
const TRIGGER = "min-h-9 w-full min-w-0 sm:min-h-0 sm:w-fit";

/** Um filtro ATIVO se acende — é o que distingue "todos" de uma escolha. */
const TRIGGER_ON = "border-scriba-blue-soft bg-scriba-blue-soft/60 text-scriba-blue-ink";

/**
 * A lista aberta pode ser MAIS LARGA que o gatilho, até o que a tela permite.
 *
 * O padrão do `SelectContent` é `w-(--anchor-width)`, e no celular o gatilho
 * agora tem metade da grade: "Pr. Antônio Carlos de Albuquerque" chegava
 * cortado em "Pr. Antônio Carlos de A", sem reticências, e dois pregadores da
 * mesma família viravam a mesma linha. Um gatilho estreito é uma decisão de
 * LAYOUT; a lista aberta é uma sobreposição e não deve nada a ele.
 */
const POPUP = "w-auto min-w-(--anchor-width) max-w-(--available-width)";

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
  const panelId = useId();
  // Uma faceta sem opção nenhuma não filtra nada — ver o cabeçalho. A conta
  // sai daqui porque a grade do celular precisa saber QUANTAS sobraram.
  const visibleFacets = facets.filter((facet) => facet.options.length > 0);

  // Quantos SELETORES estão ligados. Não conta o texto da busca: aquele campo
  // fica visível e cheio, e somá-lo faria o botão acusar "1" apontando para um
  // painel onde nada está ligado.
  const activeCount =
    visibleFacets.filter((facet) => facet.value !== FACET_ALL).length + (range !== "all" ? 1 : 0);

  // Nasce ABERTO quando já há filtro ligado. É o que impede o recolhimento de
  // virar esconderijo: sem isso a pessoa volta para a lista, vê menos cartões
  // do que esperava, e o motivo está atrás de um toque que ela não sabe que
  // precisa dar. Inicializador, não efeito — depois disso o painel é dela.
  const [filtersOpen, setFiltersOpen] = useState(() => activeCount > 0);

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
            "w-full rounded-xl border border-input bg-transparent py-2.5 pl-9 pr-11 outline-none sm:pr-9",
            // 16px no celular: abaixo disso o Safari do iOS dá zoom na página
            // ao focar o campo. Ver o cabeçalho.
            "text-base sm:text-sm",
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
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-scriba-ink-mute outline-none transition-colors hover:bg-scriba-blue-soft/60 hover:text-scriba-ink focus-visible:ring-2 focus-visible:ring-ring/40 sm:right-2 sm:size-6"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Decorativo, e no celular ele custaria uma célula da grade. */}
        <SlidersHorizontal
          aria-hidden
          className="hidden size-3.5 shrink-0 text-scriba-ink-mute sm:block"
        />

        {/* O gatilho do celular. `sm:hidden` porque no desktop a grade nunca
            se recolhe — ver o cabeçalho. */}
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls={panelId}
          className={cn(
            "inline-flex min-h-9 items-center justify-between gap-2 rounded-xl border px-3 text-[13px] font-medium outline-none transition-colors sm:hidden",
            "focus-visible:ring-2 focus-visible:ring-ring/40",
            activeCount > 0
              ? "border-scriba-blue-soft bg-scriba-blue-soft/60 text-scriba-blue-ink"
              : "border-input text-scriba-ink-soft"
          )}
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal aria-hidden className="size-3.5 shrink-0" />
            Filtros
            {activeCount > 0 ? (
              <span className="tabular-nums font-semibold">· {activeCount}</span>
            ) : null}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 transition-transform duration-150",
              filtersOpen && "rotate-180"
            )}
          />
        </button>

        {/* Grade de duas colunas no celular, itens soltos da fileira no `sm`.
            O `sm:contents` é o que evita duas versões do mesmo markup — e é
            também o que faz o recolhimento valer SÓ no celular: `hidden` e
            `grid` são utilitários base, `sm:contents` é variante responsiva e
            portanto vem depois na folha, então a partir de `sm` a grade se
            dissolve na fileira independentemente do estado do botão. */}
        <div
          id={panelId}
          className={cn("grid-cols-2 gap-2 sm:contents", filtersOpen ? "grid" : "hidden")}
        >
          {visibleFacets.map((facet) => {
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
                  className={cn(TRIGGER, "sm:max-w-56", facet.value !== FACET_ALL && TRIGGER_ON)}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={POPUP}>
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
                TRIGGER,
                // Número PAR de facetas deixa o período sozinho na última
                // linha; ocupar as duas colunas é mais honesto que meia
                // largura com um buraco do lado.
                visibleFacets.length % 2 === 0 && "col-span-2",
                range !== "all" && TRIGGER_ON
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={POPUP}>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* No celular esta dupla ganha a própria linha: o contador à esquerda,
            porque é o que se lê, e "Limpar" à direita, onde o polegar está. */}
        <div className="flex items-center justify-between gap-2 sm:contents">
          <span
            aria-live="polite"
            className="shrink-0 text-[11px] font-light tabular-nums text-scriba-ink-mute sm:order-last sm:ml-auto"
          >
            {countLabel}
          </span>

          {filtering ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-scriba-ink-mute outline-none transition-colors hover:bg-scriba-blue-soft/60 hover:text-scriba-ink focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-h-0"
            >
              <X className="size-3" strokeWidth={2.5} />
              Limpar
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
