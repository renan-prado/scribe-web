"use client";

import { Cookie } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CONSENT_EVENT, grantConsent, hasConsent, isConsentExemptPath } from "@/shared/consent";

/**
 * O aviso de cookies, e o BLOQUEIO de quem não aceitou.
 *
 * O porquê de ser um bloqueio, e não um banner que se ignora, está em
 * `src/shared/consent.ts`: sem cookies não há login, e um "recusar e seguir"
 * prometeria um produto que não existe sem eles.
 *
 * Três estados, e só um deles desenha tela cheia:
 *
 * - **aceito**: nada é desenhado. É o caso de quase toda visita.
 * - **pendente** fora das páginas legais: tela cheia por cima de tudo. O resto
 *   da página vira `inert` (nem clique, nem teclado, nem leitor de tela chega
 *   nela) e a rolagem trava. Só o `overflow: hidden` e o véu não bastariam: o
 *   Tab atravessaria o véu e acionaria um botão escondido atrás dele.
 * - **pendente** numa página legal: um cartão no rodapé, sem bloquear. A
 *   pessoa precisa poder LER a política antes de aceitá-la.
 *
 * Quem recusa vê o motivo e um caminho de volta, nunca uma tela vazia: "não
 * usar" é uma resposta legítima, e a tela diz o que ela implica.
 *
 * **Nada é desenhado antes da hidratação.** O cookie só é legível no
 * navegador, e decidir no servidor tornaria dinâmica toda página estática do
 * site (a landing inclusive), só para desenhar um aviso que a maioria já
 * aceitou. O preço é o aviso surgir um instante depois do primeiro paint para
 * quem ainda não aceitou, uma vez na vida.
 */

type State = "unknown" | "accepted" | "pending" | "refused";

export function CookieConsent() {
  const pathname = usePathname() ?? "/";
  const [state, setState] = useState<State>("unknown");
  const rootRef = useRef<HTMLElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setState(hasConsent() ? "accepted" : "pending");
    // Aceitou em outra aba: esta libera sozinha quando volta a ter foco.
    const sync = () => {
      if (hasConsent()) setState("accepted");
    };
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const exempt = isConsentExemptPath(pathname);
  const blocking = (state === "pending" || state === "refused") && !exempt;

  useEffect(() => {
    if (!blocking) return;
    const root = rootRef.current;
    const siblings = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el !== root && !el.inert
    );
    for (const el of siblings) el.inert = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    acceptRef.current?.focus();
    return () => {
      for (const el of siblings) el.inert = false;
      document.body.style.overflow = previousOverflow;
    };
  }, [blocking]);

  if (state === "unknown" || state === "accepted") return null;

  const accept = () => {
    grantConsent();
    setState("accepted");
  };

  if (!blocking) {
    return (
      <section
        ref={rootRef}
        aria-label="Aviso de cookies"
        className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-scriba-hairline bg-popover p-4 text-popover-foreground shadow-[var(--scriba-shadow)] sm:flex-row sm:items-center">
          <p className="flex-1 text-[13px] font-light leading-[1.55] text-scriba-ink-soft">
            O Scriba usa cookies para manter você conectado e medir, de forma agregada, o uso do
            site. Para usar o Scriba é preciso aceitá-los.
          </p>
          <Button onClick={accept} className="shrink-0">
            Aceitar cookies
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-body"
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-background/80 px-4 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:items-center"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-scriba-hairline bg-popover p-6 text-popover-foreground shadow-[var(--scriba-shadow)]">
        <span
          aria-hidden
          className="flex size-10 items-center justify-center rounded-full bg-scriba-surface text-scriba-ink-strong"
        >
          <Cookie className="size-5" />
        </span>

        {state === "refused" ? (
          <>
            <h2
              id="cookie-consent-title"
              className="font-heading text-lg font-semibold tracking-tight text-scriba-ink-strong"
            >
              Sem cookies, o Scriba não funciona
            </h2>
            <p
              id="cookie-consent-body"
              className="text-sm font-light leading-relaxed text-scriba-ink-soft"
            >
              Entrar na sua conta, guardar suas gravações e abrir seus resumos dependem de um cookie
              de sessão. Sem ele não há como saber que é você. Se mudar de ideia, é só aceitar
              abaixo.
            </p>
          </>
        ) : (
          <>
            <h2
              id="cookie-consent-title"
              className="font-heading text-lg font-semibold tracking-tight text-scriba-ink-strong"
            >
              Este site usa cookies
            </h2>
            <div
              id="cookie-consent-body"
              className="flex flex-col gap-2 text-sm font-light leading-relaxed text-scriba-ink-soft"
            >
              <p>Usamos cookies para:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>manter você conectado à sua conta com segurança;</li>
                <li>saber de onde você veio, quando chega por um convite;</li>
                <li>medir, de forma agregada, como o site é usado (Google Analytics).</li>
              </ul>
              <p>Não usamos cookies de publicidade. Para usar o Scriba, é preciso aceitá-los.</p>
            </div>
          </>
        )}

        <p className="text-[12px] font-light text-scriba-ink-mute">
          Detalhes na{" "}
          <Link
            href="/privacy"
            className="text-scriba-blue-ink underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Política de Privacidade
          </Link>
          .
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {state === "pending" ? (
            <Button variant="ghost" onClick={() => setState("refused")}>
              Recusar
            </Button>
          ) : null}
          <Button ref={acceptRef} onClick={accept}>
            Aceitar e continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
