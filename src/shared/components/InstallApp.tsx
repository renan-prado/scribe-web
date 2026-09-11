"use client";

import { Check, Download, Globe, Share, SquarePlus, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
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
import { type InstallMethod, useInstallPrompt } from "@/shared/hooks/use-install-prompt";

/**
 * O convite para instalar o Scriba na tela inicial.
 *
 * Não existe app nas lojas, e não vai existir tão cedo: o PWA É o app. Quem
 * grava um sermão está de pé, no meio de um culto, com o celular na mão, a
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
 * `no-touch:hidden` porque o alvo é o APARELHO, não a largura da janela. Aqui
 * já se usou `lg:hidden`, e o iPad DEITADO caía fora: 1024px é desktop para o
 * breakpoint e continua sendo um tablet que instala o PWA pelo menu
 * Compartilhar. No desktop de verdade o navegador oferece a instalação
 * sozinho, e lá o `/profile` tem a linha permanente. Ver a variante `touch`
 * em `app/globals.css`.
 *
 * O X é dispensa LEVE: some nesta visita e volta na próxima vez que o `/feed`
 * montar. No celular/tablet o convite nunca some de vez, instalar o PWA é o
 * caminho que queremos, e quem quer adiar de verdade tem o `/profile`.
 */
export function InstallAppCard({ className }: { className?: string }) {
  const { method, promptInstall } = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);
  // Só o estado desta montagem, sem localStorage: sair do /feed e voltar
  // remonta o card. Começa visível, não há nada persistido para consultar,
  // então também não há a piscada que motivava o valor inicial `true` de antes.
  const [dismissed, setDismissed] = useState(false);

  const dismiss = useCallback(() => setDismissed(true), []);

  // `method === "none"` já cobre o PWA instalado: `useInstallPrompt` lê o
  // `useIsStandalone` e não oferece instalação a quem está dentro do app.
  if (dismissed) return null;
  if (method === "none") return null;

  return (
    <>
      <div className={cn("no-touch:hidden", className)}>
        {/* Duas linhas, e não uma: num aparelho de 360px o texto, o botão e o
            X na mesma faixa espremem a frase em três linhas de duas palavras.
            O botão inteiro na segunda linha também é o alvo de toque maior. */}
        <div className="flex flex-col gap-5 rounded-[24px] bg-[image:var(--feed-card)] bg-[size:200%_100%] px-4 py-6 ring-1 ring-scriba-hairline">
          <div className="flex items-start gap-4">
            <span className="flex size-10 flex-none items-center justify-center rounded-2xl bg-scriba-blue-soft text-scriba-blue-ink">
              <ScribaMark className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm font-semibold text-scriba-ink-strong">
                Conheça nosso app!
              </span>
              {/* A mesma frase nos dois sistemas, o que muda entre eles é o
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
              // visita futura, só o X é definitivo.
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
 * e o único no desktop: o card do /feed só existe em aparelho de toque e sua
 * dispensa é leve
 * (volta a cada visita), então esta linha é onde a instalação fica sempre à
 * mão, inclusive para quem prefere adiar.
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
            Instalar no iPhone ou iPad
          </DialogTitle>
          <DialogDescription className="text-scriba-ink-soft">
            Ao instalar o Scriba, ele passa a abrir como um aplicativo.
          </DialogDescription>
        </DialogHeader>
        <IosSteps />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Os três passos, sem diálogo em volta.
 *
 * Vive separado porque o `InstallChoiceDialog` os mostra DENTRO de si, no
 * lugar da escolha, quando o "Instalar o app" é tocado num aparelho da Apple.
 * Empilhar um segundo diálogo por cima do primeiro só para exibir o mesmo
 * texto piscaria duas molduras na tela para chegar na mesma informação.
 *
 * A barra do Safari não tem lugar fixo (embaixo no iPhone, em cima no iPad),
 * então o passo 1 não diz onde ela fica: diz o que procurar.
 */
function IosSteps() {
  return (
    <ol className="flex flex-col gap-3">
      <IosStep
        n={1}
        icon={<Share className="size-4" />}
        text="Toque em Compartilhar, na barra do Safari."
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
  );
}

/**
 * A escolha que o CTA da landing abre num aparelho de toque: instalar ou
 * seguir no navegador.
 *
 * Ele existe porque o botão da LP voltou a dizer o que promete ("Começar
 * grátis"), e não "Instalar app". Empurrar a instalação no primeiro toque é
 * pedir uma decisão de compromisso a quem ainda não viu o produto; perguntar
 * DEPOIS do toque mantém a instalação à mão sem transformá-la em pedágio.
 * Quem quer só entrar tem o segundo botão, no mesmo lugar e sem hierarquia
 * escondida.
 *
 * **A escolha é a MESMA nos dois sistemas**, e é isso que o `step` protege. A
 * Apple não expõe API de instalação, então no iPhone o passo a passo do menu
 * Compartilhar é tudo o que existe para oferecer, mas ele só aparece DEPOIS
 * do "Instalar o app". Mostrá-lo de saída trocava a pergunta por uma aula: o
 * aparelho da Apple via três passos e um botão onde o Android via duas
 * opções, e a mesma decisão chegava com duas caras diferentes. Aqui o segundo
 * toque é o que muda de plataforma, não o primeiro.
 *
 * O `step` volta para "choice" quando o diálogo ABRE, e não quando ele fecha,
 * porque fechar tem animação de saída: resetar ali trocaria o conteúdo na
 * frente de quem está vendo o diálogo se despedir.
 *
 * `method === "none"` (navegador que não instala, ou app já instalado) NÃO
 * chega aqui: o `LandingCta` navega direto, porque um diálogo de escolha com
 * uma opção só é uma pergunta sem pergunta.
 */
export function InstallChoiceDialog({
  open,
  onOpenChange,
  method,
  onInstall,
  onBrowser,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: InstallMethod;
  onInstall: () => void;
  onBrowser: () => void;
}) {
  const [step, setStep] = useState<"choice" | "ios">("choice");

  useEffect(() => {
    if (open) setStep("choice");
  }, [open]);

  function handleInstall() {
    // No iPhone/iPad o botão não instala: ele ENSINA, que é tudo o que a
    // plataforma permite. No Android ele dispara o diálogo nativo.
    if (method === "ios") {
      setStep("ios");
      return;
    }
    onInstall();
  }

  const showingSteps = step === "ios";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-[28px] bg-scriba-paper"
        bodyClassName="flex flex-col gap-4 px-6 pb-6"
      >
        <DialogHeader className="px-6 pt-8">
          <DialogTitle className="font-heading text-base font-semibold text-scriba-ink-strong">
            {showingSteps ? "Instalar no iPhone ou iPad" : "Como você quer usar o Scriba?"}
          </DialogTitle>
          <DialogDescription className="text-scriba-ink-soft">
            {showingSteps
              ? "A instalação é feita pelo menu Compartilhar do Safari. São três toques:"
              : "Você pode instalar o Scriba no seu aparelho ou usar direto pelo navegador."}
          </DialogDescription>
        </DialogHeader>
        {showingSteps ? <IosSteps /> : null}
        <div className="flex flex-col gap-2.5">
          {showingSteps ? null : (
            <Button className="h-11 w-full rounded-full" onClick={handleInstall}>
              <Download aria-hidden className="size-4" />
              Instalar o app
            </Button>
          )}
          {/* O caminho do navegador continua à mão mesmo no passo a passo:
              quem abriu as instruções e desistiu delas não pode ficar sem
              saída a não ser fechar o diálogo e tocar no CTA de novo. */}
          <Button variant="outline" className="h-11 w-full rounded-full" onClick={onBrowser}>
            <Globe aria-hidden className="size-4" />
            Usar no navegador
          </Button>
        </div>
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
