"use client";

import { BookOpen, Library, Menu, PenLine, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { NavLink } from "@/components/NavLink";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ScribaLogo } from "@/shared/brand";
import { AccountMenu } from "./AccountMenu";
import { TOPBAR_CHIP_CLASS } from "./chip";

/**
 * A gaveta do hambúrguer do v2.
 *
 * Ela tem a forma da sidebar do `/admin`, e isso é decisão: **marca em cima,
 * destinos no meio, conta no rodapé.** Os dois painéis do produto passaram a
 * ser lidos do mesmo jeito, e quem administra é a mesma pessoa que grava.
 *
 * - **O logotipo no topo** é o que diz onde a gaveta pertence. Ela abre por
 *   cima da tela inteira, e um retângulo de links sem marca poderia ser de
 *   qualquer app.
 * - **Quatro destinos, e só os do produto**: Biblioteca (o `/home`, o acervo),
 *   Estudos, Escrever e Importar do YouTube. Perfil, admin e área do parceiro saíram
 *   daqui: são a CONTA, e a conta agora tem um lugar só (ver `AccountMenu`).
 *   Com "Perfil" nos dois lugares, a mesma tela apareceria duas vezes na mesma
 *   gaveta.
 * - **A conta no rodapé**, na mesma linha de avatar + nome + chevron do
 *   `/admin`, abrindo o mesmo menu do avatar da `TopBar`. O Sair mora lá
 *   dentro, que é onde o item mais perigoso do app fica longe do dedo que
 *   procura uma tela.
 *
 * O saldo foi junto para dentro do menu da conta. Ele era a segunda coisa que
 * a gaveta dizia, e passou a ser a primeira que o menu diz.
 *
 * **"Escrever" fica junto de "Importar", e as duas depois das listas.** As
 * duas criam uma sessão sem passar pelo microfone, e a Biblioteca e os Estudos
 * são onde se LÊ o que já existe — o menu é lido de cima para baixo como "o
 * que eu tenho" e depois "o que eu posso criar". E, como a importação,
 * escrever não entra pelo botão de gravar: aquele botão liga o microfone e
 * cobra por minuto.
 *
 * Os destinos apontam para as telas de hoje. Os endereços antigos
 * continuam existindo, mas só para responder 308 (ver `app/AGENTS.md`).
 */
type Props = {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  coinBalance: number;
  /** Sem sessão não há conta no rodapé, só a navegação. */
  hasSession: boolean;
  /**
   * Os atalhos de quem tem papel (admin, parceiro), montados no SERVIDOR e
   * entregues prontos, e daqui repassados ao `AccountMenu`. Slot, e não dois
   * booleanos, pela razão do cabeçalho de `PrivilegedMenuItems`: com
   * `isAdmin &&` aqui dentro, as strings "Admin", "/admin", "Área do parceiro"
   * e "/partners" viajariam no chunk que TODO usuário logado baixa. O `false`
   * esconderia o item na tela, não o código.
   */
  privilegedItems?: ReactNode;
};

export function AppMenu({
  displayName,
  email,
  avatarUrl,
  coinBalance,
  hasSession,
  privilegedItems,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* O botão fica FORA do `Sheet`, e a gaveta é controlada pelo estado: o
          `sheet.tsx` deste repositório não exporta `SheetTrigger` (ele é o
          `Dialog` do base-ui, e o trigger de lá é `display: contents`, o que
          tiraria a caixa do botão e, com ela, o alvo de toque de 44px). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        // O mesmo chip da lupa e do voltar, de `chip.ts`.
        className={cn("-ml-1", TOPBAR_CHIP_CLASS)}
      >
        <Menu className="size-5" strokeWidth={1.75} />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        {/* A gaveta é `--v2-card`, um degrau acima do preto da página: no
            fundo preto ela seria uma superfície invisível sobre outra, e o véu
            borrado atrás não bastaria para dizer onde ela começa. */}
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[300px] border-none bg-v2-card p-0 text-v2-ink"
        >
          <SheetHeader className="gap-0 p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">
              Sua conta, seu saldo e as telas do Scriba.
            </SheetDescription>
          </SheetHeader>

          {/* `variant="ink"`, e não o gradiente de sempre: a gaveta é um PORTAL
              no `body`, fora do nó `dark` do layout do app, então `--scriba-cta`
              chega aqui na versão clara do tema — um degradê de dois cinzas
              escuros sobre um cinza escuro. Herdando o `color`, o logotipo
              acompanha a tinta da gaveta. */}
          {/* O fechar mora na MESMA linha do logotipo, e por isso o `Sheet`
              entrega a gaveta sem o botão dele (`showCloseButton={false}`): o
              de fábrica é absoluto em `top-3`, um X pairando acima da marca. Na
              linha, os dois centros coincidem sem nenhum número mágico.

              Ele é um botão nosso, e não o `SheetPrimitive.Close`, porque quem
              manda na gaveta aqui é o estado (`open`), pela mesma razão que o
              hambúrguer fica fora do `Sheet`. Sem `bg`: a gaveta JÁ é
              `--v2-card`, então o chip da barra seria um disco invisível. */}
          <div className="flex items-center justify-between gap-3 px-5 pt-6 pb-4">
            <ScribaLogo size={24} variant="ink" textClassName="text-[19px]" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="-mr-2.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-v2-ink-mute transition-colors hover:bg-v2-card-hover hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>
          </div>

          <nav className="flex flex-col gap-1 px-3 py-2">
            <MenuItem
              href="/home"
              /* Uma ESTANTE, não uma casa: a tela se chama Biblioteca, e o
                 `House` dizia "início" — o nome antigo dela, de quando o acervo
                 não era a primeira tela. */
              icon={<Library className="size-5" />}
              onNavigate={() => setOpen(false)}
            >
              Biblioteca
            </MenuItem>
            <MenuItem
              href="/studies"
              icon={<BookOpen className="size-5" />}
              onNavigate={() => setOpen(false)}
            >
              Estudos
            </MenuItem>
            {/* Escrever não custa moeda nenhuma, e por isso não leva a
                pastilha de preço que os caminhos pagos levariam: não há STT
                nem chamada de modelo em lugar nenhum dele. Ver
                `lib/domain/session.ts`. */}
            <MenuItem
              href="/escrever"
              icon={<PenLine className="size-5" />}
              onNavigate={() => setOpen(false)}
            >
              Escrever
            </MenuItem>
            {/* A importação entra pelo MENU, e não pelo botão de gravar: aquele
                botão liga o microfone e cobra por minuto, este traz uma legenda
                que o YouTube já tem, por um preço fechado por vídeo. A
                separação é a mesma do app atual, ver `app/AGENTS.md`. */}
            <MenuItem
              href="/importar"
              icon={<YoutubeIcon className="size-5" />}
              onNavigate={() => setOpen(false)}
            >
              Importar do YouTube
            </MenuItem>
          </nav>

          {hasSession ? (
            <div className="mt-auto px-3 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <AccountMenu
                variant="row"
                displayName={displayName}
                email={email}
                avatarUrl={avatarUrl}
                coinBalance={coinBalance}
                privilegedItems={privilegedItems}
                onNavigate={() => setOpen(false)}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function MenuItem({
  href,
  icon,
  children,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      href={href}
      onClick={onNavigate}
      spinner="none"
      contentClassName="flex items-center gap-3.5"
      // 16px com glifo de 20px, e não os 14/16 de antes: a gaveta abre por
      // cima da tela inteira e tem três linhas. Num painel desses, texto de
      // lista de configurações lê como se os destinos fossem miudezas — o
      // tamanho aqui é o que diz que estas três linhas SÃO a navegação do app.
      className="rounded-xl px-3 py-3 text-base font-medium text-v2-ink-soft transition-colors hover:bg-v2-card-hover hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
    >
      {icon}
      {children}
    </NavLink>
  );
}
