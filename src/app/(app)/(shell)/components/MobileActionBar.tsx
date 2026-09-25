"use client";

import { Plus, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { MicGlyph } from "@/components/icons/MicGlyph";
import { WriteGlyph } from "@/components/icons/WriteGlyph";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { NavLink } from "@/components/NavLink";
import { AiPaywallDialog } from "@/features/billing/components/AiPaywallDialog";
import { useCoinsStore } from "@/features/coins/store";
import { useTourReveal } from "@/features/tour/lib/reveal";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { cn } from "@/lib/utils";
import { BibloAvatar } from "@/shared/brand";
import { useGlobalSearchStore } from "./GlobalSearchStore";

/**
 * O disco de 56px das pontas da barra, o mesmo vidro dos três botões.
 *
 * Exportado porque as PONTAS mudam de tela: na Biblioteca a da direita é o "+"
 * daqui, no resumo é um "Editar" que é link, no editor é um "Salvar"
 * que é botão. Copiada, a classe divergiria no primeiro ajuste de raio, e a
 * barra passaria a ter dois desenhos de disco lado a lado.
 */
export const MOBILE_BAR_BUTTON_CLASS =
  "inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] text-v2-ink shadow-[0_2px_6px_var(--v2-glass-shadow),0_10px_28px_var(--v2-glass-shadow)] ring-1 ring-v2-glass-edge backdrop-blur-xl transition hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute disabled:opacity-50";

/**
 * O pill do meio, que CRESCE (`flex-1`): é o alvo mais provável, o mesmo
 * raciocínio do quadrado colorido do `CreateDock` — só que aqui o destaque é
 * TAMANHO, porque a superfície é a mesma dos outros dois botões, sem cor de
 * ação.
 *
 * Constante porque ele é um `<a>` onde a conversa é rota (a Biblioteca) e um
 * `<button>` onde ela ainda é estado; a classe é a mesma nos dois, e copiada
 * divergiria no primeiro ajuste.
 */
const BIBLO_PILL_CLASS =
  "inline-flex h-14 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] py-1.5 pr-4 pl-1.5 text-left shadow-[0_2px_6px_var(--v2-glass-shadow),0_10px_28px_var(--v2-glass-shadow)] ring-1 ring-v2-glass-edge backdrop-blur-xl transition hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute";

/**
 * A barra de baixo do celular, única em `/home`, `/summary` e `/summary/new`:
 * busca, "Pergunte ao Biblo" e uma terceira ação, os três SEMPRE visíveis. Ela
 * substitui os discos soltos que cada tela desenhava por conta própria (o `+`
 * do `CreateDock`, que só existia na Biblioteca, e o disco do Biblo, repetido
 * nas três) — hoje é uma peça só, montada pela página, que não esconde ao
 * rolar: uma barra de navegação que soma e some é pior que uma parada.
 *
 * **Quem abre o Biblo não é esta barra.** A conversa (a gaveta, a sessão, as
 * ferramentas de cada tela) continua exatamente onde estava — `BibloDock`,
 * `BibloSummaryDock`, `BibloHomeDrawer` — e só o GATILHO delas mudou de lugar:
 * em vez de renderizar o próprio disco flutuante no celular, cada uma expõe um
 * `ref` com `open()` que esta barra chama. No desktop nada mudou, o disco
 * delas continua ali, porque esta barra é `md:hidden`.
 *
 * **Na BIBLIOTECA não há mais `ref` nenhum: as duas pontas são ENDEREÇOS.**
 * `searchHref` e `bibloHref` fazem do botão um `<a>` para `/home/search` e
 * `/home/chat`, e a barra deixa de saber que existe uma gaveta — quem a monta
 * é o slot `@overlay` daquela rota. As outras telas seguem no `ref`; ver
 * `lib/overlay-routes.ts` para o porquê da troca e para onde ela vai.
 *
 * ## As duas PONTAS dependem de onde a barra está, e o meio nunca muda
 *
 * O Biblo é o pill do meio em toda tela. As pontas, não:
 *
 * | | busca | ação |
 * |---|---|---|
 * | `/home` | a busca GLOBAL, por rota (`/home/search`) | o "+", as três portas |
 * | `/summary` | dentro do resumo (`SummaryFind`) | "Editar" |
 * | `/summary/new` | dentro do rascunho | "Salvar" |
 *
 * **A busca de uma tela de TEXTO é a do texto aberto.** Sobre um documento na
 * tela, uma lupa promete procurar DENTRO dele, e a global cumpria outra
 * promessa; é a mesma correção que o `SummaryFindToggle` já tinha feito na
 * lupa do cabeçalho (ver `SummaryFind`). Quem quer o acervo tem o voltar, que
 * é por onde entrou. Sem `onSearch`, a barra abre a busca global, que é o
 * certo na Biblioteca — lá o acervo É o documento.
 *
 * **E a ação de uma tela de texto é a TRAVESSIA entre ler e escrever.** Criar
 * a próxima sessão a partir de um resumo aberto é raro; trocar de modo no
 * texto que está na tela é o gesto da vez, e ele já existia nas duas telas
 * (o "Editar" do cabeçalho do `/summary`, o "Salvar" do editor) longe
 * do polegar. Quem passa o `trailing` é a tela; sem ele, a ponta é o "+".
 *
 * **No `/summary/new` ela SAI DE CENA enquanto o cursor está numa linha em
 * branco**, e quem entra no lugar é a fileira de blocos (`BlockKeyboardBar`,
 * no `_editor`), mais baixa que esta e só com glifos: ali a faixa acima do
 * teclado é ferramenta de escrita, não navegação. Ela volta assim que a linha
 * ganha texto. Quem decide é o `Composer` — esta barra não sabe que a outra
 * existe. Ver "A barra de blocos" lá.
 *
 * **O "+" é o MESMO painel de três portas de sempre**: o botão carrega
 * `data-tour="create-dock"` e escuta `useTourReveal("create-dock")`, então o
 * passo do tour que já apontava para ele continua funcionando sem saber que o
 * `CreateDock` antigo foi apagado. Ele mora na Biblioteca, que é a única tela
 * em que a barra não tem um documento para servir.
 */
export function MobileActionBar({
  onAskBiblo,
  bibloHref,
  bibloThinking = false,
  onSearch,
  searchHref,
  searchLabel = "Buscar na biblioteca",
  searchOpen = false,
  trailing,
}: {
  onAskBiblo?: () => void;
  /**
   * O ENDEREÇO da conversa desta tela (na Biblioteca, `/home/chat`). Com ele o
   * pill vira um link e a barra não precisa de estado nenhum da gaveta — nem do
   * `ref` que a abria, nem do `bibloThinking`, que acendia o avatar de uma
   * conversa montada na mesma árvore. Ver `lib/overlay-routes.ts`.
   */
  bibloHref?: string;
  bibloThinking?: boolean;
  /** O que o botão de busca faz. Sem ele e sem `searchHref`, a busca GLOBAL. */
  onSearch?: () => void;
  /** O ENDEREÇO da busca desta tela. Mesma história do `bibloHref`. */
  searchHref?: string;
  searchLabel?: string;
  /** A busca desta tela já está aberta? O glifo vira um X, como no cabeçalho. */
  searchOpen?: boolean;
  /** A ponta direita. Sem ela, o "+" com as três portas de criação. */
  trailing?: ReactNode;
}) {
  const setSearchOpen = useGlobalSearchStore((s) => s.setOpen);
  useKeyboardInset();

  const searchGlyph = searchOpen ? (
    <X aria-hidden className="size-5" strokeWidth={1.75} />
  ) : (
    <Search aria-hidden className="size-5" strokeWidth={1.75} />
  );

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 md:hidden",
        "pb-[calc(0.75rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))]"
      )}
    >
      <div className="flex w-full max-w-[1024px] items-end gap-3">
        {searchHref ? (
          /* `Link` e não `NavLink`: o destino é uma gaveta que monta na hora,
             sem `loading.tsx` para esperar, e o spinner do `NavLink` seria
             ruído no lugar de resposta. Vale para o pill do Biblo abaixo. */
          <Link
            href={searchHref}
            aria-label={searchLabel}
            /* O MESMO alvo de tour do chip do desktop: um dos dois está sempre
               em `display: none`, e o `resolveAnchor` fica com o visível. */
            data-tour="library-search"
            className={MOBILE_BAR_BUTTON_CLASS}
          >
            {searchGlyph}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onSearch ?? (() => setSearchOpen(true))}
            aria-label={searchOpen ? "Fechar a busca" : searchLabel}
            aria-expanded={onSearch ? searchOpen : undefined}
            data-tour="library-search"
            className={MOBILE_BAR_BUTTON_CLASS}
          >
            {searchGlyph}
          </button>
        )}

        {bibloHref ? (
          <Link href={bibloHref} aria-label="Pergunte ao Biblo" className={BIBLO_PILL_CLASS}>
            <BibloAvatar mood="idle" size={40} />
            <span className="truncate font-medium text-[15px] text-v2-ink-soft">
              Pergunte ao Biblo
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAskBiblo}
            aria-label="Pergunte ao Biblo"
            className={BIBLO_PILL_CLASS}
          >
            <BibloAvatar mood={bibloThinking ? "thinking" : "idle"} size={40} />
            <span className="truncate font-medium text-[15px] text-v2-ink-soft">
              Pergunte ao Biblo
            </span>
          </button>
        )}

        {trailing ?? <CreateButton />}
      </div>
    </div>
  );
}

/**
 * O "+" e o painel de três portas, a ponta direita da Biblioteca.
 *
 * Ele é um componente à parte porque o estado dele (o painel aberto, o
 * apanhador de toque, o paywall de saldo zero) não existe nas telas que passam
 * um `trailing` — e um `useState` que nunca é usado é um `useState` que vive
 * em toda barra do app.
 */
function CreateButton() {
  const [tapped, setTapped] = useState(false);
  const revealed = useTourReveal("create-dock");
  const open = tapped || revealed;

  const balance = useCoinsStore((s) => s.balance);
  const unlimited = useCoinsStore((s) => s.unlimited);
  // O gêmeo de `CreateActions` no celular, e as duas telas andam juntas: uma
  // porta que abre aqui e recusa no desktop é a mesma decisão contada de dois
  // jeitos. A conta de Backoffice passa nas duas.
  const broke = !unlimited && balance === 0;
  const [paywall, setPaywall] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setTapped(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* Tocar fora fecha só o PAINEL de criar, nunca a barra — ela não é um
          menu, é navegação permanente. Ver o mesmo apanhador em `CreateDock`. */}
      {open ? (
        <button
          type="button"
          aria-label="Fechar as opções de criação"
          onClick={() => setTapped(false)}
          className="fixed inset-0 z-20 cursor-default md:hidden"
        />
      ) : null}

      <div className="relative shrink-0">
        {open ? (
          <nav
            id="mobile-create-options"
            aria-labelledby="mobile-create-title"
            className="pointer-events-auto absolute right-0 bottom-full mb-3 flex origin-bottom-right animate-v2-rec-in flex-col gap-2 rounded-[28px] bg-v2-glass-panel bg-[image:var(--v2-glass-sheen)] px-3 pt-3 pb-5 shadow-[0_2px_6px_var(--v2-glass-shadow),0_10px_28px_var(--v2-glass-shadow)] ring-1 ring-v2-glass-edge backdrop-blur-xl"
          >
            <p
              id="mobile-create-title"
              className="pt-2 pb-3 pl-2 font-medium text-[11px] text-v2-ink-mute leading-none"
            >
              Criar resumo:
            </p>
            <div className="flex gap-3">
              <CreateOption
                href="/import"
                icon={<YoutubeIcon className="size-5" />}
                label="Importar do YouTube"
                tourId="create-import"
                onNavigate={() => setTapped(false)}
                onBlocked={broke ? () => setPaywall("importar um vídeo") : undefined}
              />
              <CreateOption
                href="/summary/new"
                icon={<WriteGlyph className="size-5" />}
                label="Escrever resumo"
                tourId="create-write"
                onNavigate={() => setTapped(false)}
              />
              <CreateOption
                href="/recording?auto=1"
                icon={<MicGlyph className="size-5" />}
                label="Resumo automático"
                accent
                tourId="create-record"
                onNavigate={() => setTapped(false)}
                onBlocked={broke ? () => setPaywall("gravar e receber o resumo pronto") : undefined}
              />
            </div>
          </nav>
        ) : null}
        <button
          type="button"
          onClick={() => setTapped((prev) => !prev)}
          aria-label={open ? "Fechar as opções de criação" : "Criar"}
          aria-expanded={open}
          aria-controls="mobile-create-options"
          data-tour="create-dock"
          className={MOBILE_BAR_BUTTON_CLASS}
        >
          <Plus
            aria-hidden
            strokeWidth={1.5}
            className={cn("size-6 transition-transform duration-200", open && "rotate-45")}
          />
        </button>
      </div>

      <AiPaywallDialog
        open={paywall !== null}
        onOpenChange={(next) => {
          if (!next) setPaywall(null);
        }}
        action={paywall ?? ""}
      />
    </>
  );
}

/** Cópia do `CreateOption` do antigo `CreateDock` — ver o cabeçalho de lá. */
function CreateOption({
  href,
  icon,
  label,
  accent = false,
  tourId,
  onNavigate,
  onBlocked,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
  tourId?: string;
  onNavigate: () => void;
  onBlocked?: () => void;
}) {
  return (
    <NavLink
      href={href}
      data-tour={tourId}
      onClick={(event) => {
        if (onBlocked) {
          event.preventDefault();
          onBlocked();
        }
        onNavigate();
      }}
      spinner="none"
      contentClassName="flex flex-col items-center gap-2"
      className="group flex w-[70px] min-w-0 flex-col rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
    >
      <span
        className={cn(
          "relative flex size-12 items-center justify-center rounded-2xl transition",
          accent
            ? "animate-accent-sheen bg-v2-accent bg-[image:var(--v2-accent-sheen)] bg-[size:200%_100%] text-v2-accent-ink group-hover:brightness-110"
            : "bg-v2-glass-tile text-v2-ink group-hover:bg-v2-glass-edge"
        )}
      >
        {icon}
        {accent ? (
          <span
            aria-hidden
            className="-top-2 -right-2 absolute inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-scriba-yellow bg-[image:var(--scriba-yellow-sheen)] px-1.5 py-[3px] font-semibold text-[9px] text-scriba-yellow-ink leading-none"
          >
            <Sparkles className="size-2.5" strokeWidth={2.5} />
            IA
          </span>
        ) : null}
      </span>
      <span className="w-full break-words text-center font-medium text-[11px] text-v2-ink-soft leading-tight">
        {label}
      </span>
    </NavLink>
  );
}
