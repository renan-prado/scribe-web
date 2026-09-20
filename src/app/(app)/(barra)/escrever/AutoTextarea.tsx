"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Uma `textarea` que tem exatamente a altura do texto dentro dela.
 *
 * **É o que faz o editor ser WYSIWYG sem um editor de rich text.** Nenhum
 * bloco do `SummaryBlockSchema` tem formatação inline — todos são
 * `{ type, text }`, string pura —, então uma `textarea` com as MESMAS classes
 * do `BlockRenderer` já mostra na edição o que a leitura vai mostrar. Trazer
 * um Tiptap ou um Lexical para cá seria carregar uma segunda representação do
 * texto (um documento com nós e marcas) para depois espremê-la de volta numa
 * string, e pagar cem quilobytes por recursos que o domínio não tem onde
 * guardar.
 *
 * A altura é escrita no layout effect, e não no `onChange`: colar um texto de
 * trinta linhas, desfazer com Ctrl+Z e trocar de bloco também mudam o conteúdo
 * sem passar por uma tecla. O `height = "auto"` antes de ler `scrollHeight` é
 * obrigatório — sem ele a caixa só cresce, porque `scrollHeight` nunca fica
 * menor que a altura já fixada.
 *
 * `rows={1}` e `resize-none`: a alça de redimensionar do navegador daria à
 * pessoa uma segunda maneira, manual e errada, de decidir uma altura que o
 * conteúdo já decide.
 */
type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  /** O recorte mudou dentro da caixa. Quem escuta é a barra do marca-texto,
   *  que só existe enquanto houver texto selecionado. Ver `BlockControls`. */
  onSelect?: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  ariaLabel: string;
  textareaRef?: (el: HTMLTextAreaElement | null) => void;
};

export function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  onKeyDown,
  onFocus,
  onSelect,
  ariaLabel,
  textareaRef,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // `value` não é lido aqui dentro, ele é o GATILHO: o que o efeito mede é o
  // `scrollHeight` que o navegador acabou de calcular para o texto novo. Sem
  // esta dependência ele rodaria uma vez só, na montagem, e a caixa ficaria
  // com a altura de uma linha para sempre.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ver acima
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        textareaRef?.(el);
      }}
      rows={1}
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onSelect={onSelect}
      className={cn(
        // `block` NÃO é decoração. Uma `textarea` é inline-block por padrão,
        // e um inline-block pousa na LINHA DE BASE do pai: sobra por baixo
        // dela o espaço dos descendentes da linha do pai, quatro píxeis que
        // ninguém pediu. Eles iam parar dentro da superfície do foco, que
        // ficava alta demais com o texto encostado no topo — e, somados, eram
        // quatro píxeis a mais entre cada dois parágrafos do documento.
        "block w-full resize-none overflow-hidden bg-transparent outline-none",
        "placeholder:text-scriba-ink-mute/60",
        className
      )}
    />
  );
}
