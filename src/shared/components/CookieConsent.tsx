"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CONSENT_EVENT, grantConsent, hasConsent, isConsentExemptPath } from "@/shared/consent";

/**
 * O aviso de cookies: uma barra discreta no rodapé, do jeito que a maioria
 * dos sites faz. Não é um diálogo central com véu escuro por cima de tudo —
 * essa versão já existiu e a sensação de abrir o site e topar de cara com uma
 * tela bloqueada era ruim demais para o primeiro instante de visita.
 *
 * **O que continua sendo pedido de produto, e o que mudou, são coisas
 * diferentes.** Continua existindo o impedimento de uso sem aceite (sem
 * cookies não há login, ver `src/shared/consent.ts`), só que ele deixou de
 * ser um VÉU: fora das páginas legais, enquanto não aceito, o resto da
 * página vira `inert` (sem clique, sem Tab, sem leitor de tela), mas nada
 * escurece nem borra — a barra some assim que aceita, e até lá ela é a única
 * coisa na tela com quem dá para interagir.
 *
 * **A ROLAGEM NÃO TRAVA.** Ela já travou junto com o `inert`, e travar a
 * página inteira era justamente a sensação de tela bloqueada que o formato de
 * barra veio desfazer: quem chega pela landing precisa poder descer e ver o
 * que é o produto ANTES de decidir sobre cookies. Ler não é usar; o `inert`
 * sozinho já garante que nada seja clicado sem aceite.
 *
 * Três estados:
 *
 * - **aceito**: nada é desenhado. Quase toda visita.
 * - **pendente/recusado** fora das páginas legais: a barra bloqueia o USO
 *   (inert), mas não a leitura — rola normalmente, e sem véu.
 * - **pendente/recusado** numa página legal (`CONSENT_EXEMPT_PATHS`): a mesma
 *   barra, sem bloquear nada — a pessoa precisa poder ler a política antes de
 *   aceitá-la.
 *
 * Recusar não abre uma segunda tela: o texto da própria barra muda para
 * explicar por quê, e o botão de aceitar continua ali. "Não usar" é uma
 * resposta legítima, só que sem exigir um segundo componente para dizê-la.
 *
 * **Nada é desenhado antes da hidratação.** O cookie só é legível no
 * navegador, e decidir no servidor tornaria dinâmica toda página estática do
 * site (a landing inclusive) só para desenhar um aviso que a maioria já
 * aceitou.
 */

type State = "unknown" | "accepted" | "pending" | "refused";

export function CookieConsent() {
  const pathname = usePathname() ?? "/";
  const [state, setState] = useState<State>("unknown");
  const rootRef = useRef<HTMLElement>(null);

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
    return () => {
      for (const el of siblings) el.inert = false;
    };
  }, [blocking]);

  if (state === "unknown" || state === "accepted") return null;

  const accept = () => {
    grantConsent();
    setState("accepted");
  };

  return (
    <section
      ref={rootRef}
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-scriba-hairline bg-popover p-4 text-popover-foreground shadow-[var(--scriba-shadow)] sm:flex-row sm:items-center">
        <p className="flex-1 text-[13px] font-light leading-[1.55] text-scriba-ink-soft">
          {state === "refused" ? (
            "Sem aceitar cookies não dá para usar o Scriba: são eles que mantêm você conectado à sua conta. "
          ) : (
            <>
              Usamos cookies para manter você conectado, identificar indicações e entender o uso do
              site (Google Analytics).{" "}
            </>
          )}
          <Link
            href="/privacy"
            className="text-scriba-blue-ink underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Saiba mais
          </Link>
          .
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {state === "pending" ? (
            <Button variant="ghost" size="sm" onClick={() => setState("refused")}>
              Recusar
            </Button>
          ) : null}
          <Button size="sm" onClick={accept}>
            Aceitar cookies
          </Button>
        </div>
      </div>
    </section>
  );
}
