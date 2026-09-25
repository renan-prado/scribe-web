"use client";

import { Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * O campo "Pessoa" dos filtros do painel.
 *
 * ## Por que não é mais um `<select>`
 *
 * Era: o servidor lia `profiles` inteira e mandava a lista toda para o
 * navegador, uma `<option>` por conta. Isso tem três vidas — funciona com
 * dezenas, fica INCOMPLETO EM SILÊNCIO com mil (o corte do PostgREST não
 * aparece em lugar nenhum da tela, e a pessoa procurada simplesmente não está
 * na lista), e não existe com um milhão. Um select também obriga a RECONHECER
 * o nome numa lista rolável ordenada por outra coisa que não a sua pergunta,
 * quando quem chega aqui já sabe quem procura e sabe digitar.
 *
 * Aqui quem filtra é o Postgres, sobre índice de trigramas (migração 0074), e
 * o que viaja é sempre uma lista de no máximo 20. Ver
 * `features/admin/server/db/user-search.ts`.
 *
 * ## As três coisas que o campo aceita
 *
 * Nome, e-mail e o **uuid colado**. O terceiro não é capricho: o id é o que
 * está à mão em toda outra tela do painel (uma coluna, um link, um log), e
 * num select ele não tinha onde ser digitado.
 *
 * ## Abre mostrando as contas mais novas
 *
 * Um campo de busca vazio que não mostra nada obriga a adivinhar o que ele
 * aceita. As 20 mais recentes são, quase sempre, a lista certa: quem se
 * investiga é quem acabou de chegar.
 *
 * ## O estado continua na URL
 *
 * O componente é controlado e não navega sozinho — quem decide é a barra de
 * filtros que o abriga, como o resto do painel: um recorte é colável, e o
 * botão voltar desfaz. Por isso ele recebe a pessoa JÁ resolvida pelo
 * servidor (uma linha, por id), em vez de procurar o rótulo de novo no
 * cliente e piscar um uuid até a resposta chegar.
 */

export type UserPickerOption = {
  id: string;
  displayName: string | null;
  email: string | null;
};

type Props = {
  id?: string;
  value: UserPickerOption | null;
  onChange: (next: UserPickerOption | null) => void;
  /**
   * Como o campo se chama quando não filtra ninguém. Vira o começo do
   * placeholder ("Todos. Busque por nome, e-mail ou id"), que é o único lugar
   * onde o estado "sem filtro" precisa de nome.
   */
  anyLabel?: string;
};

const DEBOUNCE_MS = 200;

/**
 * O teto do servidor (`SEARCH_LIMIT` de `server/db/user-search.ts`), repetido
 * aqui porque aquele módulo é `server-only` e uma constante dele não pode ser
 * importada por um componente cliente. Serve só para a tela DIZER que a lista
 * foi cortada; se os dois divergirem, o aviso deixa de aparecer, nada quebra.
 */
const SERVER_LIMIT = 20;

export function labelOf(user: UserPickerOption): string {
  return user.displayName?.trim() || user.email || user.id.slice(0, 8);
}

function initialsOf(user: UserPickerOption): string {
  const base = user.displayName?.trim() || user.email || "?";
  const parts = base
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]);
  return (letters.join("") || base[0] || "?").toUpperCase();
}

export function UserPicker({ id, value, onChange, anyLabel = "Todos" }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserPickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  // Só busca com a lista ABERTA: fechada, o campo não tem onde mostrar o que
  // veio, e a chamada seria um gasto de balde por nada.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/users/search?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: { users: UserPickerOption[] }) => {
          if (cancelled) return;
          setResults(data.users ?? []);
          setFailed(false);
          setLoading(false);
          setActiveIndex(-1);
        })
        .catch((err: unknown) => {
          if (cancelled || (err as Error).name === "AbortError") return;
          // A falha é DITA. Uma lista vazia por erro de rede é idêntica, na
          // tela, a "não existe ninguém com esse nome", e as duas mandam quem
          // lê para lados opostos.
          setResults([]);
          setFailed(true);
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(t);
    };
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = useCallback(
    (next: UserPickerOption) => {
      onChange(next);
      setQuery("");
      setOpen(false);
      setActiveIndex(-1);
    },
    [onChange]
  );

  // Não há linha "Todos" na lista, e não é esquecimento: com uma pessoa
  // escolhida o campo vira a pastilha abaixo e a lista nem chega a existir.
  // Quem desfaz o filtro é o X dela, que está à vista o tempo todo.
  if (value) {
    return (
      <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm">
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-scriba-blue-soft text-[10px] font-semibold text-scriba-blue-ink"
        >
          {initialsOf(value)}
        </span>
        <span className="min-w-0 flex-1 truncate" title={value.email ?? undefined}>
          {labelOf(value)}
        </span>
        <button
          type="button"
          aria-label="Limpar filtro de pessoa"
          className="shrink-0 rounded-md p-1 text-scriba-ink-mute transition-colors hover:bg-scriba-hairline-soft hover:text-scriba-ink"
          onClick={() => {
            onChange(null);
            // O foco volta para o campo que acabou de nascer no lugar deste,
            // senão trocar de pessoa exige um clique a mais.
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-scriba-ink-mute"
      />
      <input
        id={id}
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={`${anyLabel}. Busque por nome, e-mail ou id`}
        className={cn(
          "h-9 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm outline-none",
          "placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
        )}
        value={query}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((i) => Math.min(results.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(-1, i - 1));
          } else if (e.key === "Enter") {
            const row = results[activeIndex];
            if (row) {
              // Dentro de um `<form>`, um Enter que escolhe da lista não pode
              // também submeter a barra de filtros com o valor anterior.
              e.preventDefault();
              pick(row);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Contas"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-scriba-hairline bg-scriba-paper p-1 shadow-[0_12px_32px_rgba(15,42,71,0.14)]"
        >
          {results.map((u, index) => (
            <Row
              key={u.id}
              id={`${listId}-opt-${index}`}
              active={activeIndex === index}
              onHover={() => setActiveIndex(index)}
              onPick={() => pick(u)}
              initials={initialsOf(u)}
              title={labelOf(u)}
              subtitle={u.displayName?.trim() ? (u.email ?? u.id) : u.id}
            />
          ))}

          {results.length === 0 ? (
            <p className="px-2.5 py-3 text-[13px] font-light text-scriba-ink-mute">
              {loading
                ? "Procurando…"
                : failed
                  ? "A busca falhou. Tente de novo."
                  : query.trim()
                    ? `Nenhuma conta com “${query.trim()}”.`
                    : "Nenhuma conta."}
            </p>
          ) : null}

          {/* O teto é DITO quando é atingido. Vinte linhas cheias podem ser
              vinte de vinte ou vinte de duas mil, e sem esta linha as duas
              são a mesma tela. */}
          {results.length >= SERVER_LIMIT ? (
            <p className="border-t border-scriba-hairline px-2.5 py-2 text-[11px] font-light text-scriba-ink-mute">
              Mostrando as 20 primeiras. Refine o termo para achar outra.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Row({
  id,
  active,
  onHover,
  onPick,
  initials,
  title,
  subtitle,
}: {
  id: string;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
  initials: string;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      // `onMouseDown` e não `onClick`: o clique fecharia a lista pelo blur do
      // input antes de o clique acontecer.
      onMouseDown={(e) => {
        e.preventDefault();
        onPick();
      }}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors",
        active ? "bg-scriba-blue-soft/70" : "hover:bg-scriba-blue-soft/40"
      )}
    >
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-scriba-blue-soft text-[10px] font-semibold text-scriba-blue-ink"
      >
        {initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium leading-tight text-scriba-ink">{title}</span>
        <span className="truncate text-[11px] font-light leading-tight text-scriba-ink-mute">
          {subtitle}
        </span>
      </span>
    </button>
  );
}
