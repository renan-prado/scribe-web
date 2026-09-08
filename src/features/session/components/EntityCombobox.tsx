"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { EntitySuggestion } from "@/features/session/lib/api";
import { initialsOf } from "@/features/session/lib/text";
import { cn } from "@/lib/utils";

/**
 * Autocomplete input backed by a per-user search endpoint. Fetches suggestions
 * on mount and on every keystroke (debounced), sorted by how often the user
 * has recorded with each entity. Free-text is always allowed — hitting Enter
 * or blurring commits whatever is in the input.
 *
 * The dropdown is a plain absolute-positioned list (not a Portal) so it lives
 * inside the parent Dialog and inherits its overlay stacking without extra
 * portal wiring. O preço disso é que o contêiner que o abriga NÃO pode ter
 * `overflow` recortando — ver o `bodyClassName` do `EntityFieldDialog`.
 *
 * ## Por que a lista tem avatar
 *
 * Autor e local são as duas entidades que o usuário REUSA: quem grava toda
 * semana tem os mesmos cinco pregadores e as mesmas duas igrejas. Uma lista de
 * nomes em texto corrido obriga a LER cada linha; a pastilha de iniciais dá
 * uma âncora visual que se reconhece antes da leitura, e é a mesma pastilha
 * que o cabeçalho da sessão já mostra — a lista e a tela passam a falar a
 * mesma língua.
 *
 * A FORMA distingue as duas famílias, não o glifo: pessoa é círculo azul,
 * lugar é quadrado de canto arredondado na família verde. Os dois levam
 * INICIAIS, e é isso que faz a pastilha valer — um alfinete de mapa seria
 * idêntico nas cinco igrejas da lista, que é exatamente a leitura que a
 * pastilha existe para encurtar.
 *
 * ## A linha "usar o que foi digitado"
 *
 * Texto livre sempre foi aceito (Enter ou blur comitam), mas nada na tela
 * dizia isso: com uma lista de sugestões aberta, o usuário que digita um nome
 * novo fica esperando um item que nunca vai aparecer. A linha final torna o
 * caminho visível e dá a ele um alvo de toque — no celular, "Enter" está
 * atrás do teclado virtual.
 */
type EntityKind = "speaker" | "location";

type EntityComboboxProps = {
  id?: string;
  /** Pessoa ou lugar — decide a forma da pastilha e os textos da lista. */
  kind: EntityKind;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  fetchSuggestions: (q: string) => Promise<EntitySuggestion[]>;
  onEnter?: () => void;
};

/** Altura máxima da lista. `dvh` para que ela encolha junto com o teclado
 *  virtual em vez de ficar presa atrás dele. */
const LIST_MAX_HEIGHT = "min(17rem, 42dvh)";
/** Abaixo disto não vale abrir para baixo — a lista vira uma fresta. */
const MIN_SPACE_BELOW_PX = 180;

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Marca o trecho que casou com a busca. O casamento é feito no texto SEM
 * acento, mas as fatias saem do texto original — senão "Joao" acenderia o
 * nome inteiro com os acentos comidos.
 */
function highlight(name: string, query: string) {
  const q = normalize(query.trim());
  if (!q) return name;
  const idx = normalize(name).indexOf(q);
  if (idx < 0) return name;
  return (
    <>
      {name.slice(0, idx)}
      <span className="rounded-[3px] bg-[color:var(--session-mention-wash)] text-scriba-ink-strong">
        {name.slice(idx, idx + q.length)}
      </span>
      {name.slice(idx + q.length)}
    </>
  );
}

export function EntityCombobox({
  id,
  kind,
  value,
  onChange,
  placeholder,
  disabled = false,
  autoFocus = false,
  fetchSuggestions,
  onEnter,
}: EntityComboboxProps) {
  const [suggestions, setSuggestions] = useState<EntitySuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suppressFetchOnceRef = useRef(false);
  const listId = useId();

  useEffect(() => {
    if (suppressFetchOnceRef.current) {
      suppressFetchOnceRef.current = false;
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void fetchSuggestions(value.trim()).then((items) => {
        if (cancelled) return;
        setSuggestions(items);
        setLoading(false);
        setActiveIndex(-1);
      });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, fetchSuggestions]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const trimmed = value.trim();
  // Só oferece "usar o que foi digitado" quando ainda não existe uma sugestão
  // com exatamente esse nome — repetir a mesma opção duas vezes na lista faz o
  // usuário parar para escolher entre duas coisas iguais.
  const showFreeText =
    trimmed.length > 0 && !suggestions.some((s) => normalize(s.name) === normalize(trimmed));
  const rowCount = suggestions.length + (showFreeText ? 1 : 0);
  const hasList = open && (rowCount > 0 || loading);

  /**
   * A lista abre para CIMA quando não há altura embaixo — num telefone em
   * paisagem, ou com o teclado virtual ocupando metade da tela, ela abria por
   * baixo do próprio diálogo e o campo virava um beco sem saída.
   *
   * Medido no momento de ABRIR, e não num effect: um `useEffect` roda depois
   * da pintura, então a lista apareceria embaixo e daria um pulo para cima. É
   * também o único instante em que a medida muda — o teclado virtual sobe no
   * foco, que é justamente quando isto roda.
   */
  const openList = useCallback(() => {
    const el = inputRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      setPlacement(below < MIN_SPACE_BELOW_PX && rect.top > below ? "above" : "below");
    }
    setOpen(true);
  }, []);

  const pick = (name: string) => {
    suppressFetchOnceRef.current = true;
    onChange(name);
    setOpen(false);
  };

  const commitActive = (): boolean => {
    if (!hasList || activeIndex < 0) return false;
    if (activeIndex < suggestions.length) {
      pick(suggestions[activeIndex].name);
      return true;
    }
    if (showFreeText) {
      setOpen(false);
      return false; // o texto já está no input; deixa o Enter salvar
    }
    return false;
  };

  const activeId = activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined;

  const avatarBase = "flex size-7 shrink-0 items-center justify-center text-[10px] font-semibold";
  const avatar = useMemo(
    () =>
      kind === "speaker"
        ? cn(avatarBase, "rounded-full bg-scriba-blue-soft text-scriba-blue-ink")
        : cn(avatarBase, "rounded-lg bg-scriba-mint text-scriba-mint-ink"),
    [kind]
  );

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        ref={inputRef}
        role="combobox"
        aria-expanded={hasList}
        aria-controls={hasList ? listId : undefined}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        className={cn(
          "w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm outline-none ring-offset-background placeholder:text-muted-foreground",
          "focus:border-ring focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
        )}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        // biome-ignore lint/a11y/noAutofocus: matches original dialog behavior
        autoFocus={autoFocus}
        onFocus={openList}
        onClick={openList}
        onChange={(e) => {
          onChange(e.target.value);
          openList();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(rowCount - 1, i + 1));
            openList();
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(-1, i - 1));
          } else if (e.key === "Enter") {
            if (commitActive()) {
              e.preventDefault();
            } else if (onEnter) {
              e.preventDefault();
              onEnter();
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        autoComplete="off"
      />
      {hasList ? (
        <div
          id={listId}
          role="listbox"
          aria-label={kind === "speaker" ? "Autores sugeridos" : "Locais sugeridos"}
          style={{ maxHeight: LIST_MAX_HEIGHT }}
          className={cn(
            "absolute left-0 right-0 z-50 overflow-y-auto overscroll-contain rounded-xl border border-scriba-hairline bg-scriba-paper p-1 shadow-[0_12px_32px_rgba(15,42,71,0.14)]",
            placement === "below" ? "top-full mt-1.5" : "bottom-full mb-1.5"
          )}
        >
          {loading && suggestions.length === 0 ? (
            <ul aria-hidden className="flex flex-col gap-1 p-1">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span className="size-7 shrink-0 animate-pulse rounded-full bg-scriba-ink-mute/15" />
                  <span
                    className="h-3 animate-pulse rounded-full bg-scriba-ink-mute/15"
                    style={{ width: `${60 - i * 12}%` }}
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {suggestions.map((s, idx) => {
            const active = idx === activeIndex;
            return (
              <button
                key={s.id}
                id={`${listId}-opt-${idx}`}
                type="button"
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s.name);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors",
                  active ? "bg-scriba-blue-soft/70" : "hover:bg-scriba-blue-soft/40"
                )}
              >
                <span aria-hidden className={avatar}>
                  {initialsOf(s.name)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium leading-tight text-scriba-ink">
                    {highlight(s.name, value)}
                  </span>
                  <span className="text-[11px] font-light leading-tight text-scriba-ink-mute">
                    {s.count === 1 ? "1 gravação" : `${s.count} gravações`}
                  </span>
                </span>
              </button>
            );
          })}

          {showFreeText ? (
            <button
              id={`${listId}-opt-${suggestions.length}`}
              type="button"
              role="option"
              aria-selected={activeIndex === suggestions.length}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(trimmed);
                onEnter?.();
              }}
              onMouseEnter={() => setActiveIndex(suggestions.length)}
              className={cn(
                "mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors",
                suggestions.length > 0 && "border-t border-scriba-hairline pt-2",
                activeIndex === suggestions.length
                  ? "bg-scriba-blue-soft/70"
                  : "hover:bg-scriba-blue-soft/40"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center border border-dashed border-scriba-ink-mute/40 text-scriba-ink-mute",
                  kind === "speaker" ? "rounded-full" : "rounded-lg"
                )}
              >
                <Plus className="size-3.5" strokeWidth={2.5} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium leading-tight text-scriba-ink">
                  Usar “{trimmed}”
                </span>
                <span className="text-[11px] font-light leading-tight text-scriba-ink-mute">
                  {kind === "speaker" ? "Novo autor" : "Novo local"}
                </span>
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
