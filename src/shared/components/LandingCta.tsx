"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { useInstallPrompt } from "@/shared/hooks/use-install-prompt";

/**
 * O CTA da landing que, NO CELULAR, pergunta antes de decidir por quem clicou.
 *
 * O PWA É o app: não há loja, e quem grava um sermão está de pé no meio de um
 * culto, onde a diferença entre abrir uma aba e tocar num ícone é a diferença
 * entre usar e não usar. Mas o botão já disse "Instalar app" na hero, e isso
 * cobrava uma decisão de compromisso de quem tinha acabado de chegar: o
 * primeiro toque da página pedia espaço no telefone antes de o produto ter
 * mostrado qualquer coisa.
 *
 * Agora **o rótulo é o mesmo nos dois lados** ("Começar grátis", "Começar"), e
 * a instalação virou uma das duas saídas do `InstallChoiceDialog`, aberto pelo
 * toque. A oferta não sumiu, deixou de ser pedágio.
 *
 * - **Desktop (`lg` pra cima):** nada muda. Renderiza o mesmo `<Link>` de
 *   antes, com o mesmo texto e as mesmas classes, o HTML estático da LP
 *   continua idêntico (ver `app/AGENTS.md`). O corte é em `lg`, não `sm`,
 *   porque o iPad instala o PWA como o iPhone e precisa do mesmo caminho.
 * - **Android/Chromium:** o diálogo oferece "Instalar o app" (que dispara o
 *   `beforeinstallprompt` nativo) e "Usar no navegador".
 * - **iOS:** não há API de instalação, então o diálogo já mostra o passo a
 *   passo do menu Compartilhar, com "Usar no navegador" abaixo dele.
 * - **Navegador que não instala (Firefox Android…) ou app já instalado:** o
 *   clique vai direto para o `href`. Um diálogo de escolha com uma opção só
 *   seria um toque a mais para chegar no mesmo lugar.
 *
 * É cliente puro, como o `StandaloneHomeGuard`, e não custa a estaticidade da
 * página. O diálogo entra por `dynamic` e só é montado depois do primeiro
 * toque: sem isso o Dialog do base-ui pesaria no bundle que o anônimo baixa
 * primeiro (mesma razão do `ChapterDialog`).
 */
const InstallChoiceDialog = dynamic(
  () => import("./InstallApp").then((m) => m.InstallChoiceDialog),
  { ssr: false }
);

type LandingCtaProps = {
  /** As classes EXATAS do CTA que ele substitui, link e botão as compartilham. */
  className: string;
  /** O texto do botão. É o MESMO no desktop e no celular, de propósito. */
  label: string;
  /** Ícone à esquerda do texto (a pena da marca, geralmente). */
  icon?: ReactNode;
  /** Destino do caminho "navegador". */
  href?: string;
};

export function LandingCta({ className, label, icon, href = "/sign-in" }: LandingCtaProps) {
  const router = useRouter();
  const { method, promptInstall } = useInstallPrompt();
  // Dois estados: `armed` decide se o diálogo EXISTE (chunk baixado), `open` se
  // está aberto, fechar não pode desmontar no mesmo quadro da animação de saída.
  const [armed, setArmed] = useState(false);
  const [open, setOpen] = useState(false);

  function goToBrowser() {
    setOpen(false);
    router.push(href);
  }

  function handleMobileClick() {
    // Nada a oferecer (app já instalado, ou navegador que não instala): o
    // caminho de sempre, sem perguntar.
    if (method === "none") {
      router.push(href);
      return;
    }
    setArmed(true);
    setOpen(true);
  }

  function handleInstall() {
    // O evento nativo é de uso único e o desfecho não muda o destino: aceitar
    // instala em segundo plano, recusar não pode deixar o toque sem resposta.
    // Nos dois casos a pessoa segue para onde o botão prometia levá-la.
    void promptInstall().then(goToBrowser);
  }

  return (
    <>
      {/* Desktop: o link de sempre. `max-lg:hidden` some com ele no celular e
          no tablet. */}
      <Link href={href} className={cn(className, "max-lg:hidden")}>
        {icon}
        {label}
      </Link>
      {/* Mobile e tablet: o botão que abre a escolha. */}
      <button type="button" onClick={handleMobileClick} className={cn(className, "lg:hidden")}>
        {icon}
        {label}
      </button>
      {armed ? (
        <InstallChoiceDialog
          open={open}
          onOpenChange={setOpen}
          method={method}
          onInstall={handleInstall}
          onBrowser={goToBrowser}
        />
      ) : null}
    </>
  );
}
