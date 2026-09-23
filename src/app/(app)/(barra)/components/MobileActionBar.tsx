"use client";

import { PenLine, Plus, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { MicGlyph } from "@/components/icons/MicGlyph";
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
 * A barra de baixo do celular, única em `/home`, `/summary` e `/escrever`:
 * busca, "Pergunte ao Biblo" e criar, os três SEMPRE visíveis. Ela substitui
 * os discos soltos que cada tela desenhava por conta própria (o `+` do
 * `CreateDock`, que só existia na Biblioteca, e o disco do Biblo, repetido nas
 * três) — hoje é uma peça só, montada pela página, que não esconde ao rolar:
 * uma barra de navegação que soma e some é pior que uma parada.
 *
 * **Quem abre o Biblo não é esta barra.** A conversa (a gaveta, a sessão, as
 * ferramentas de cada tela) continua exatamente onde estava — `BibloHomeDock`,
 * `BibloDock`, `BibloSummaryDock` — e só o GATILHO delas mudou de lugar: em
 * vez de renderizar o próprio disco flutuante no celular, cada uma expõe um
 * `ref` com `open()` que esta barra chama. No desktop nada mudou, o disco
 * delas continua ali, porque esta barra é `md:hidden`.
 *
 * **A busca é a GLOBAL** (`GlobalSearchDialog`), a mesma que o `SearchTrigger`
 * do desktop e o Ctrl+K abrem — não uma busca própria desta tela. O botão só
 * vira `open: true` na `GlobalSearchStore`; ele carrega o MESMO
 * `data-tour="library-search"` do chip do desktop, porque um dos dois está
 * sempre em `display: none` e `resolveAnchor` fica com o visível.
 *
 * **O "+" é o MESMO painel de três portas de sempre**, só que agora mora
 * dentro da barra: o botão carrega `data-tour="create-dock"` e escuta
 * `useTourReveal("create-dock")`, então o passo do tour que já apontava para
 * ele continua funcionando sem saber que o `CreateDock` antigo foi apagado.
 */
export function MobileActionBar({
  onAskBiblo,
  bibloThinking = false,
}: {
  onAskBiblo: () => void;
  bibloThinking?: boolean;
}) {
  const [tapped, setTapped] = useState(false);
  const revealed = useTourReveal("create-dock");
  const open = tapped || revealed;
  const setSearchOpen = useGlobalSearchStore((s) => s.setOpen);
  useKeyboardInset();

  const balance = useCoinsStore((s) => s.balance);
  const broke = balance === 0;
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

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 md:hidden",
          "pb-[calc(0.75rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))]"
        )}
      >
        <div className="flex w-full max-w-[1024px] items-end gap-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Buscar na biblioteca"
            data-tour="library-search"
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] text-v2-ink ring-1 ring-v2-glass-edge backdrop-blur-xl transition hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
          >
            <Search aria-hidden className="size-5" strokeWidth={1.75} />
          </button>

          {/* O pill do meio CRESCE (`flex-1`): é o alvo mais provável, o mesmo
              raciocínio do quadrado colorido do `CreateDock` — só que aqui o
              destaque é TAMANHO, porque a superfície é a mesma dos outros
              dois botões, sem cor de ação. */}
          <button
            type="button"
            onClick={onAskBiblo}
            aria-label="Pergunte ao Biblo"
            className="inline-flex h-14 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] py-1.5 pr-4 pl-1.5 text-left ring-1 ring-v2-glass-edge backdrop-blur-xl transition hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
          >
            <BibloAvatar mood={bibloThinking ? "thinking" : "idle"} size={40} />
            <span className="truncate font-medium text-[15px] text-v2-ink-soft">
              Pergunte ao Biblo
            </span>
          </button>

          <div className="relative shrink-0">
            {open ? (
              <nav
                id="mobile-create-options"
                aria-labelledby="mobile-create-title"
                className="pointer-events-auto absolute right-0 bottom-full mb-3 flex origin-bottom-right animate-v2-rec-in flex-col gap-2 rounded-[28px] bg-v2-glass-panel bg-[image:var(--v2-glass-sheen)] px-3 pt-3 pb-5 ring-1 ring-v2-glass-edge backdrop-blur-xl"
              >
                <p
                  id="mobile-create-title"
                  className="pl-2 text-[11px] pt-2 pb-3 leading-none font-medium text-v2-ink-mute"
                >
                  Criar resumo:
                </p>
                <div className="flex gap-3">
                  <CreateOption
                    href="/importar"
                    icon={<YoutubeIcon className="size-5" />}
                    label="Importar do YouTube"
                    tourId="create-import"
                    onNavigate={() => setTapped(false)}
                    onBlocked={broke ? () => setPaywall("importar um vídeo") : undefined}
                  />
                  <CreateOption
                    href="/escrever"
                    icon={<PenLine className="size-5" strokeWidth={1.5} />}
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
                    onBlocked={
                      broke ? () => setPaywall("gravar e receber o resumo pronto") : undefined
                    }
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
              className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] text-v2-ink ring-1 ring-v2-glass-edge backdrop-blur-xl transition hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
            >
              <Plus
                aria-hidden
                strokeWidth={1.5}
                className={cn("size-6 transition-transform duration-200", open && "rotate-45")}
              />
            </button>
          </div>
        </div>
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
      <span className="w-full break-words text-center text-[11px] leading-tight font-medium text-v2-ink-soft">
        {label}
      </span>
    </NavLink>
  );
}
