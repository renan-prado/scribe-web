"use client";

import { BookOpen, Mic, User } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import { NewRecordingDialog } from "@/features/session/components/NewRecordingDialog";
import { cn } from "@/lib/utils";

/**
 * As três telas de CAPTURA. A nav não aparece em nenhuma delas, e a razão é
 * mais forte que estética: no modo transcrição o botão de parar é `fixed` a
 * 24px do rodapé, exatamente onde esta barra fica — ela cobria o botão, e a
 * gravação não tinha como ser pausada nem encerrada. Antes só o `live` estava
 * na lista.
 *
 * Some com ela também protege a sessão: sair da página mata o MediaRecorder e
 * a fila de chunks, e uma aba de navegação a um toque de distância no meio de
 * um sermão é um acidente esperando acontecer. A volta continua existindo pelo
 * logo no header.
 */
const CAPTURE_ROUTE = /^\/recording\/[^/]+\/(live|audio|transcribe)$/;

/**
 * Mobile-only bottom nav: 5 slots with an elevated record button in the
 * center. Os ícones seguem formas primitivas do protótipo do Claude Design
 * (quadrado arredondado, traços escalonados) onde a FORMA é a ideia; onde um
 * glifo comunica melhor — o microfone, o perfil — vale o lucide.
 *
 * Ela não recebe mais prop nenhuma: era o avatar do usuário que exigia nome,
 * e-mail e URL da foto descendo do layout.
 */
export function MobileBottomNav() {
  const pathname = usePathname() ?? "";

  const hide =
    CAPTURE_ROUTE.test(pathname) ||
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/";

  if (hide) return null;

  const isFeed = pathname === "/feed";
  const isLibrary = pathname.startsWith("/list");
  const isStudies = pathname.startsWith("/studies");
  const isProfile = pathname.startsWith("/profile");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 sm:hidden">
      <div aria-hidden className="h-24 bg-[image:var(--scriba-nav-fade)]" />
      {/* O `pb` é SÓ o inset do indicador de início do iPhone, sem folga fixa
          somada. Era `max(0.5rem, env(...))`, e os 8px de piso empurravam a
          fileira inteira para cima do centro da barra — 11,5px de folga em
          cima contra 19,5 embaixo. Como a altura é `min-h` e a caixa é
          border-box, o inset cresce a barra em vez de espremer o conteúdo:
          sem inset a fileira fica exatamente no meio dos 76px; com inset ela
          continua no meio do que sobra, e a faixa do gesto do sistema fica
          livre embaixo (`viewport-fit=cover`, ver `app/layout.tsx`). */}
      <nav
        aria-label="Navegação principal"
        className="pointer-events-auto relative flex min-h-19 items-center justify-around bg-scriba-paper pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_22px_rgba(79,168,240,0.12)]"
      >
        <TabLink
          href="/feed"
          label="Feed"
          active={isFeed}
          icon={
            <span
              aria-hidden
              className={cn(
                "block size-4 rounded-[5px] border-2",
                isFeed ? "border-scriba-blue" : "border-scriba-ink-mute"
              )}
            />
          }
        />
        <TabLink
          href="/list"
          label="Gravações"
          active={isLibrary}
          icon={
            <span aria-hidden className="flex size-4 flex-col justify-between">
              <span
                className={cn(
                  "h-0.5 w-full rounded-full",
                  isLibrary ? "bg-scriba-blue" : "bg-scriba-ink-mute"
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-full rounded-full",
                  isLibrary ? "bg-scriba-blue" : "bg-scriba-ink-mute"
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-2.5 rounded-full",
                  isLibrary ? "bg-scriba-blue" : "bg-scriba-ink-mute"
                )}
              />
            </span>
          }
        />
        <span className="w-18 shrink-0" aria-hidden />
        <TabLink
          href="/studies"
          label="Estudos"
          active={isStudies}
          activeClass="text-scriba-green-ink"
          icon={
            <BookOpen
              aria-hidden
              className={cn("size-4", isStudies ? "text-scriba-green-ink" : "text-scriba-ink-mute")}
              strokeWidth={2}
            />
          }
        />
        {/* Um GLIFO, não a foto do usuário. O avatar era o único item da barra
            que mudava de tamanho, de forma e de cor por conta própria — uma
            foto redonda de 20px ao lado de três traços de 16px —, e era ele
            que desalinhava a fileira. Aqui a barra é navegação, não
            identidade: a foto continua no /profile, que é o destino do item. */}
        <TabLink
          href="/profile"
          label="Perfil"
          active={isProfile}
          icon={
            <User
              aria-hidden
              className={cn("size-4", isProfile ? "text-scriba-blue-ink" : "text-scriba-ink-mute")}
              strokeWidth={2}
            />
          }
        />

        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
          <NewRecordingDialog
            trigger={
              <span
                className={cn(
                  "flex size-16 flex-col items-center justify-center gap-1 rounded-full scriba-cta bg-[image:var(--scriba-cta)] text-scriba-cta-ink",
                  "border-2 border-scriba-paper shadow-[0_10px_22px_rgba(79,168,240,0.42)] transition-colors"
                )}
              >
                {/* O ícone herda `--scriba-cta-ink`, a tinta do próprio botão.
                    Era `bg-white` numa pastilha arredondada: no tema escuro o
                    CTA INVERTE (fundo claro, tinta navy), então o desenho
                    branco sumia dentro do botão e só sobrava a palavra
                    "Gravar". Um microfone também diz o que a pastilha genérica
                    não dizia. */}
                <Mic aria-hidden className="size-5" strokeWidth={2.2} />
                <span className="text-[8px] font-semibold uppercase tracking-[0.05em]">Gravar</span>
              </span>
            }
          />
        </div>
      </nav>
    </div>
  );
}

type TabLinkProps = {
  href: string;
  label: string;
  active: boolean;
  icon: ReactNode;
  activeClass?: string;
};

function TabLink({
  href,
  label,
  active,
  icon,
  activeClass = "text-scriba-blue-ink",
}: TabLinkProps) {
  return (
    <NavLink
      href={href}
      spinner="none"
      contentClassName="flex flex-col items-center gap-1.5"
      className={cn(
        "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
        active ? activeClass : "text-scriba-ink-mute"
      )}
    >
      {/* A calha de altura FIXA é o que alinha a fileira. Cada ícone tem a sua
          altura natural — o quadrado tem 16px, a pilha de traços tem os 16
          cheios, o glifo do lucide desenha dentro de uma caixa com folga —, e
          sem a calha cada item ficava com uma altura diferente. Como a barra
          centraliza item a item, o resultado era um rótulo em cada linha. */}
      <span aria-hidden className="flex h-4 items-center justify-center">
        {icon}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}
