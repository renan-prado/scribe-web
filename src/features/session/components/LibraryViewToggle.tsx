"use client";

import { LayoutGrid, Rows3, StickyNote } from "lucide-react";
import type { LibraryView } from "@/features/session/library-view";
import { cn } from "@/lib/utils";

/**
 * O seletor de como a Biblioteca desenha o acervo.
 *
 * **Três botões de ÍCONE, sem rótulo.** Os nomes das três vistas ("post-it",
 * "lista", "cartões") descrevem forma, não conteúdo, e forma é justamente o
 * que o próprio glifo diz melhor que a palavra — é o mesmo argumento dos
 * seletores de visualização de qualquer gerenciador de arquivos. O nome fica
 * no `title` e no `aria-label`, que é onde ele serve a quem precisa dele.
 *
 * **Três botões de alternância (`aria-pressed`), e não um `radiogroup`.** A
 * semântica de rádio seria `<input type="radio">` de verdade, com rótulos
 * escondidos e um `<fieldset>` em volta, para ganhar o "2 de 3" do leitor de
 * tela num controle cujas três opções já se anunciam pelo nome. O botão de
 * alternância diz o que precisa ser dito — qual está ligado — e é o que todo
 * seletor de visualização usa.
 *
 * A pílula ativa INVERTE (tinta no fundo, papel no texto), igual à aba
 * selecionada do `Tabs`: é o mesmo objeto — "onde eu estou" — e duas gramáticas
 * para a mesma ideia é o que faz uma interface parecer montada por duas
 * pessoas.
 */

const OPTIONS: { value: LibraryView; label: string; Icon: typeof LayoutGrid }[] = [
  { value: "postit", label: "Mural de post-its", Icon: StickyNote },
  { value: "list", label: "Lista", Icon: Rows3 },
  { value: "card", label: "Cartões", Icon: LayoutGrid },
];

export function LibraryViewToggle({
  value,
  onChange,
}: {
  value: LibraryView;
  onChange: (view: LibraryView) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-v2-card p-1">
      {OPTIONS.map(({ value: option, label, Icon }) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-full transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute",
              active
                ? "bg-v2-ink text-v2-bg"
                : "text-v2-ink-mute hover:bg-v2-card-hover hover:text-v2-ink"
            )}
          >
            <Icon aria-hidden className="size-4" strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
