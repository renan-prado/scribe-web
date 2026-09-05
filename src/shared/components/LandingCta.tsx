"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { useInstallPrompt } from "@/shared/hooks/use-install-prompt";

/**
 * O CTA da landing que, NO CELULAR, entra primeiro pela instalação do PWA em
 * vez de mandar direto para o `/sign-in`.
 *
 * O PWA É o app — não há loja — e quem grava um sermão está de pé no meio de um
 * culto: a diferença entre abrir uma aba e tocar num ícone é a diferença entre
 * usar e não usar. Por isso o caminho de entrada no mobile é "instale primeiro".
 *
 * - **Desktop (`lg` pra cima):** nada muda. Renderiza o mesmo `<Link>` de
 *   antes, com o mesmo texto e as mesmas classes — o HTML estático da LP
 *   continua idêntico (ver `app/AGENTS.md`). O corte é em `lg`, não `sm`,
 *   porque o iPad instala o PWA como o iPhone e precisa do mesmo caminho.
 * - **Android/Chromium:** o botão dispara o diálogo nativo (`beforeinstallprompt`);
 *   recusado, cai no `href`.
 * - **iOS:** não há API; o botão abre o passo a passo do menu Compartilhar.
 * - **Navegador que não instala (Firefox Android…):** o clique cai no `href`.
 *   O link "continuar no navegador" (`escape`) é a saída visível.
 *
 * É cliente puro, como o `StandaloneHomeGuard`, e não custa a estaticidade da
 * página. O diálogo do iOS entra por `dynamic` e só é montado depois do
 * primeiro toque — sem isso o Dialog do base-ui pesaria no bundle que o
 * anônimo baixa primeiro (mesma razão do `ChapterDialog`).
 */
const IosInstructionsDialog = dynamic(
  () => import("./InstallApp").then((m) => m.IosInstructionsDialog),
  { ssr: false }
);

type LandingCtaProps = {
  /** As classes EXATAS do CTA que ele substitui — link e botão as compartilham. */
  className: string;
  /** Texto no desktop, e no mobile quando a instalação não é oferecida. */
  label: string;
  /** Texto no mobile quando o botão instala o app. Cai em `label` se ausente. */
  mobileLabel?: string;
  /** Ícone à esquerda do texto (a pena da marca, geralmente). */
  icon?: ReactNode;
  /** Destino do caminho "navegador". */
  href?: string;
  /** Renderiza o link discreto "continuar no navegador" abaixo (só no mobile). */
  showEscape?: boolean;
};

export function LandingCta({
  className,
  label,
  mobileLabel,
  icon,
  href = "/sign-in",
  showEscape = false,
}: LandingCtaProps) {
  const router = useRouter();
  const { method, promptInstall } = useInstallPrompt();
  // Dois estados: `armed` decide se o diálogo EXISTE (chunk baixado), `open` se
  // está aberto — fechar não pode desmontar no mesmo quadro da animação de saída.
  const [armed, setArmed] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

  function handleMobileClick() {
    if (method === "ios") {
      setArmed(true);
      setIosOpen(true);
      return;
    }
    if (method === "prompt") {
      void promptInstall().then((accepted) => {
        // Recusou o diálogo nativo: segue para o navegador em vez de deixar o
        // toque sem resposta.
        if (!accepted) router.push(href);
      });
      return;
    }
    // Navegador sem instalação: o caminho de sempre.
    router.push(href);
  }

  return (
    <>
      {/* Desktop: o link de sempre. `max-lg:hidden` some com ele no celular e
          no tablet. */}
      <Link href={href} className={cn(className, "max-lg:hidden")}>
        {icon}
        {label}
      </Link>
      {/* Mobile e tablet: o botão que entra pela instalação. */}
      <button type="button" onClick={handleMobileClick} className={cn(className, "lg:hidden")}>
        {icon}
        {mobileLabel ?? label}
      </button>
      {showEscape ? (
        <Link
          href={href}
          className="text-center text-[12px] font-light text-scriba-ink-mute underline underline-offset-4 lg:hidden"
        >
          ou continuar pelo navegador
        </Link>
      ) : null}
      {armed ? <IosInstructionsDialog open={iosOpen} onOpenChange={setIosOpen} /> : null}
    </>
  );
}
