"use client";

import { Check, Download, Share, SquarePlus, X } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ScribaMark } from "@/shared/brand";
import { useInstallPrompt } from "@/shared/hooks/use-install-prompt";

/**
 * O convite para instalar o Scriba na tela inicial.
 *
 * Não existe app nas lojas, e não vai existir tão cedo: o PWA É o app. Quem
 * grava um sermão está de pé, no meio de um culto, com o celular na mão — a
 * diferença entre abrir uma aba e tocar num ícone é a diferença entre usar e
 * não usar.
 *
 * Duas portas, porque os dois sistemas não oferecem a mesma coisa:
 *
 * - **Android/Chromium** tem `beforeinstallprompt`, então um toque abre o
 *   diálogo nativo de instalação. É o caminho bom.
 * - **iOS não tem API nenhuma.** Só o próprio usuário instala, pelo menu
 *   Compartilhar do Safari. Ali o botão não instala: ele ENSINA, com o
 *   passo a passo, que é tudo o que a plataforma permite.
 *
 * Ver `useInstallPrompt` para a detecção.
 */

/**
 * O convite, no formato de card do feed.
 *
 * Ele mora no `/feed`, e só nele: é a primeira tela de toda sessão de uso, e a
 * única onde o usuário está olhando em volta em vez de tentando terminar
 * alguma coisa. Espalhá-lo pelo layout inteiro seria o mesmo convite pedindo
 * atenção no meio de uma gravação.
 *
 * `lg:hidden` porque o alvo é celular E TABLET — o iPad instala o PWA pelo
 * mesmo menu Compartilhar do iPhone e não tem barra de endereço com o atalho
 * de instalação. Só no desktop de verdade (`lg` pra cima) o navegador oferece
 * isso sozinho, e lá o `/profile` tem a linha permanente.
 *
 * O X é dispensa LEVE: some nesta visita e volta na próxima vez que o `/feed`
 * montar. No celular/tablet o convite nunca some de vez — instalar o PWA é o
 * caminho que queremos —, e quem quer adiar de verdade tem o `/profile`.
 */
export function InstallAppCard({ className }: { className?: string }) {
  const { method, promptInstall } = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);
  // Só o estado desta montagem, sem localStorage: sair do /feed e voltar
  // remonta o card. Começa visível — não há nada persistido para consultar,
  // então também não há a piscada que motivava o valor inicial `true` de antes.
  const [dismissed, setDismissed] = useState(false);

  const dismiss = useCallback(() => setDismissed(true), []);

  // `method === "none"` já cobre o PWA instalado: `useInstallPrompt` lê o
  // `useIsStandalone` e não oferece instalação a quem está dentro do app.
  if (dismissed) return null;
  if (method === "none") return null;

  return (
    <>
      <div className={cn("lg:hidden", className)}>
        {/* Duas linhas, e não uma: num aparelho de 360px o texto, o botão e o
            X na mesma faixa espremem a frase em três linhas de duas palavras.
            O botão inteiro na segunda linha também é o alvo de toque maior. */}
        <div className="flex flex-col gap-5 rounded-[24px] bg-scriba-paper px-4 py-6 ring-1 ring-scriba-hairline">
          <div className="flex items-start gap-4">
            <span className="flex size-10 flex-none items-center justify-center rounded-2xl bg-scriba-blue-soft text-scriba-blue-ink">
              <ScribaMark className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm font-semibold text-scriba-ink-strong">
                Conheça nosso app!
              </span>
              {/* A mesma frase nos dois sistemas — o que muda entre eles é o
                  rótulo do botão, porque no iPhone ele ensina em vez de
                  instalar. */}
              <span className="text-xs leading-relaxed text-scriba-ink-soft">
                Instale agora e tenha o Scriba sempre na palma da mão
              </span>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dispensar o convite de instalação"
              className="-mt-1 -mr-1 inline-flex size-7 flex-none items-center justify-center rounded-full text-scriba-ink-mute outline-none transition-colors hover:bg-scriba-btn-muted hover:text-scriba-ink-strong focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <Button
            className="h-10 w-full rounded-full"
            onClick={() => {
              if (method === "ios") {
                setIosOpen(true);
                return;
              }
              // Aceitou: dispensa gravada, some para sempre. Recusou: a faixa
              // some desta página também (o evento do Chrome é de uso único, e
              // sem ele `method` volta a "none"), mas pode reaparecer numa
              // visita futura — só o X é definitivo.
              void promptInstall().then((accepted) => {
                if (accepted) dismiss();
              });
            }}
          >
            {method === "ios" ? (
              // O glifo do menu Compartilhar do iOS: é literalmente o botão que
              // a pessoa vai procurar na tela seguinte.
              <Share aria-hidden className="size-4" />
            ) : (
              <Download aria-hidden className="size-4" />
            )}
            {method === "ios" ? "Ver como instalar" : "Instalar agora"}
          </Button>
        </div>
      </div>
      <IosInstructionsDialog open={iosOpen} onOpenChange={setIosOpen} />
    </>
  );
}

/**
 * Variante de lista para as "Preferências" do /profile. É o caminho PERMANENTE
 * e o único no desktop: o card do /feed é `lg:hidden` e sua dispensa é leve
 * (volta a cada visita), então esta linha é onde a instalação fica sempre à
 * mão — inclusive para quem prefere adiar.
 */
export function InstallAppRow({ className }: { className?: string }) {
  const { method, installed, ready, promptInstall } = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);

  if (!ready) return null;
  // Navegador que não instala nada (Firefox no desktop, WebView) não ganha uma
  // linha que não leva a lugar nenhum.
  if (method === "none" && !installed) return null;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="flex size-9 flex-none items-center justify-center rounded-full bg-scriba-blue-soft text-scriba-blue-ink">
        {installed ? <Check className="size-4" /> : <Download className="size-4" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-medium uppercase tracking-wider text-scriba-ink-mute">
          Aplicativo
        </span>
        <span className="truncate text-sm font-medium text-scriba-ink-strong">
          {installed ? "Instalado neste aparelho" : "Instalar na tela inicial"}
        </span>
      </div>
      {installed ? null : (
        <Button
          size="sm"
          variant="outline"
          className="flex-none rounded-full"
          onClick={() => {
            if (method === "ios") {
              setIosOpen(true);
              return;
            }
            void promptInstall();
          }}
        >
          {method === "ios" ? "Como instalar" : "Instalar"}
        </Button>
      )}
      <IosInstructionsDialog open={iosOpen} onOpenChange={setIosOpen} />
    </div>
  );
}

/**
 * O passo a passo do iOS. Os ícones aqui são os glifos do próprio sistema
 * (Compartilhar e "adicionar") porque a pessoa vai procurá-los na tela, não
 * ler o nome deles.
 */
export function IosInstructionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-[28px] bg-scriba-paper"
        bodyClassName="flex flex-col gap-4 px-6 pb-6"
      >
        <DialogHeader className="px-6 pt-8">
          <DialogTitle className="font-heading text-base font-semibold text-scriba-ink-strong">
            Instalação no iPhone
          </DialogTitle>
          <DialogDescription className="text-scriba-ink-soft">
            Ao instalar o Scriba, ele passa a abrir como um aplicativo.
          </DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-3">
          <IosStep
            n={1}
            icon={<Share className="size-4" />}
            text="Toque em Compartilhar, na barra de baixo do Safari."
          />
          <IosStep
            n={2}
            icon={<SquarePlus className="size-4" />}
            text="Role a lista e escolha “Adicionar à Tela de Início”."
          />
          <IosStep
            n={3}
            icon={<Check className="size-4" />}
            text="Confirme em “Adicionar”. O Scriba passa a abrir como um aplicativo."
          />
        </ol>
      </DialogContent>
    </Dialog>
  );
}

function IosStep({ n, icon, text }: { n: number; icon: ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-8 flex-none items-center justify-center rounded-full bg-scriba-blue-soft text-scriba-blue-ink">
        {icon}
      </span>
      <span className="pt-1.5 text-sm text-scriba-ink">
        <span className="sr-only">Passo {n}. </span>
        {text}
      </span>
    </li>
  );
}
