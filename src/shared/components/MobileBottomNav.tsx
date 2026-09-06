"use client";

import { Mic } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { FeedGlyph, ListGlyph, ProfileGlyph, StudyGlyph } from "@/components/icons/NavGlyphs";
import { LinkPendingSwap, NavLink } from "@/components/NavLink";
import { NewRecordingDialog } from "@/features/session/components/NewRecordingDialog";
import { cn } from "@/lib/utils";
import { activeNavKey } from "@/shared/nav";

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
 * Mobile-only bottom nav: 5 slots dentro da fileira, nada deslocado. Quatro
 * são ícone + rótulo; o "Gravar" do meio é o microfone num disco na cor do
 * botão primário, com um anel pálido em volta e sem texto. O que mudou desde
 * a versão que incomodava não é a cor: é ele estar DENTRO da barra, sem rótulo
 * e sem o halo de sombra que o fazia flutuar por cima dela.
 *
 * Os quatro ícones das ABAS são um conjunto só (`@/components/icons/NavGlyphs`),
 * preenchidos e desenhados para o mesmo `viewBox` — por isso usam um `size`
 * único. Antes eram formas primitivas feitas à mão misturadas com glifos do
 * lucide, e essa mistura exigia um tamanho diferente por ícone só para eles
 * parecerem iguais.
 *
 * O microfone do botão central é a exceção, e é deliberada: ele é o `Mic` do
 * lucide, TRAÇADO, enquanto os quatro das abas são preenchidos. Existe um
 * `public/icons/recording.svg` preenchido que combinaria com o conjunto — foi
 * testado aqui e não ficou bom. Dentro do disco cheio de cor, o glifo vazado
 * respira; o sólido vira uma mancha.
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

  // A mesma decisão do `AppNav` do desktop, num lugar só. Ver `@/shared/nav`:
  // é lá que mora o caso de `/recording/:id/deepening` acender "Estudos".
  const current = activeNavKey(pathname);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 sm:hidden">
      {/* A esfumaçada que dissolve o conteúdo rolando antes de ele chegar na
          barra. Eram 96px, quase um sexto da tela de um celular coberto por um
          véu permanente. A curva do gradiente mora em `--scriba-nav-fade`, não
          aqui — inclusive a cauda longa que evita a linha horizontal no fim da
          névoa. Encurtar a faixa SEM aquela cauda traz a linha de volta, e
          mais perto do olho. */}
      <div aria-hidden className="h-12 bg-[image:var(--scriba-nav-fade)]" />
      {/* O `pb` é SÓ o inset do indicador de início do iPhone, sem folga fixa
          somada. Era `max(0.5rem, env(...))`, e os 8px de piso empurravam a
          fileira inteira para cima do centro da barra — 11,5px de folga em
          cima contra 19,5 embaixo. Como a altura é `min-h` e a caixa é
          border-box, o inset cresce a barra em vez de espremer o conteúdo:
          sem inset a fileira fica exatamente no meio dos 72px; com inset ela
          continua no meio do que sobra, e a faixa do gesto do sistema fica
          livre embaixo (`viewport-fit=cover`, ver `app/layout.tsx`). */}
      <nav
        aria-label="Navegação principal"
        className="pointer-events-auto flex min-h-18 items-center justify-around bg-scriba-paper pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_22px_rgba(79,168,240,0.12)]"
      >
        <TabLink href="/feed" label="Feed" active={current === "feed"} icon={FeedGlyph} />
        <TabLink href="/list" label="Gravações" active={current === "list"} icon={ListGlyph} />
        {/* O "Gravar" é DOIS círculos concêntricos, sem rótulo: um disco escuro
            com o microfone claro, e um anel pálido em volta que faz as vezes de
            sombra. Ele fica dentro da barra — já foi um círculo em cor de CTA
            deslocado pra fora dela.

            O anel NÃO é `box-shadow`, é um círculo de verdade atrás do outro.
            Uma sombra real precisaria de cor literal em `rgba()` (a barra
            proíbe) e no tema escuro viraria um borrão em vez de um anel.

            O disco usa o par do BOTÃO PRIMÁRIO do app — `--scriba-cta` +
            `--scriba-cta-ink` —, para ele ter a mesma cor de todo botão de
            ação das outras telas. O gradiente precisa vir por
            `bg-[image:var(--scriba-cta)]`: a classe `.scriba-cta` sozinha só
            traz o hover (um `filter`, não cor de fundo — `hover:bg-*` chaparia
            o gradiente). E como esse par INVERTE com o tema, o disco é
            azul-escuro com microfone branco no claro e pastilha clara com
            microfone navy no escuro. Não troque por `text-white`: no escuro o
            microfone sumiria dentro do disco claro.

            As duas opacidades são variantes `dark:` legítimas da base: o valor
            é OPACIDADE, não cor, e um token não expressaria isso. Elas agem em
            camadas DIFERENTES e não se somam:

            - `dark:opacity-90` no DISCO, só no escuro, assenta a pastilha
              clara no fundo escuro. Vale para o grupo, então o microfone desce
              junto e o contraste entre os dois não muda.
            - `opacity-90 dark:opacity-100` no MICROFONE, só no claro, tira o
              branco puro de cima do azul. O `dark:opacity-100` existe para o
              glifo não levar desconto duas vezes no escuro, onde o disco já
              está a 90%.

            O branco a 90% sobre a ponta mais clara do gradiente dá 4,1:1 —
            acima dos 3:1 que a WCAG 1.4.11 pede para objeto gráfico. Não
            desça mais sem refazer essa conta.

            Ele fica no FLUXO, sem calha e sem rótulo, e é a simetria do
            círculo que o alinha: a barra centra item a item, então o centro
            dele cai no mesmo centro do bloco ícone+rótulo dos outros quatro. O
            microfone, por consequência, senta abaixo dos ícones vizinhos — é
            esperado, o círculo é que faz o papel do bloco inteiro.

            O `-translate-y-1` levanta 4px a partir daí. É TRANSFORM, não
            margem: a altura da barra e a posição dos outros quatro itens não
            mudam, e ele sobe sem deslocar nada. São 4px porque é a folga que
            existe — o círculo tem 64px numa barra de 72, então isso encosta o
            topo dele na borda de cima e é o teto sem voltar a flutuar POR CIMA
            da barra, que é o desenho que já foi rejeitado aqui. Para subir
            mais, a barra precisa crescer junto.

            O nome acessível não sumiu com o texto: mora no `aria-label` do
            `DialogTrigger`. E o `trigger` faz esse trigger virar
            `display:contents`, então é este span que é o item flex. */}
        <NewRecordingDialog
          trigger={
            <span className="-translate-y-1 flex size-16 items-center justify-center rounded-full bg-scriba-blue-soft">
              <span className="flex size-12 items-center justify-center rounded-full scriba-cta bg-[image:var(--scriba-cta)] text-scriba-cta-ink dark:opacity-90">
                <Mic aria-hidden className="size-5.5 opacity-90 dark:opacity-100" strokeWidth={2} />
              </span>
            </span>
          }
        />
        <TabLink
          href="/studies"
          label="Estudos"
          active={current === "studies"}
          activeClass="text-scriba-green-ink"
          icon={StudyGlyph}
        />
        {/* Um GLIFO, não a foto do usuário. O avatar era o único item da barra
            que mudava de tamanho, de forma e de cor por conta própria — uma
            foto redonda de 20px ao lado de três traços de 16px —, e era ele
            que desalinhava a fileira. Aqui a barra é navegação, não
            identidade: a foto continua no /profile, que é o destino do item. */}
        <TabLink
          href="/profile"
          label="Perfil"
          active={current === "profile"}
          icon={ProfileGlyph}
        />
      </nav>
    </div>
  );
}

/**
 * O `icon` é o COMPONENTE, não um elemento pronto. Antes cada chamada montava
 * o seu `<Icon className={cn("size-…", active ? … : …)} />`, e a cor do ícone
 * era escrita quatro vezes, em paralelo com a do rótulo — dois lugares para a
 * mesma decisão, que já discordaram (o ícone ativo usava `--scriba-blue`, azul
 * de SUPERFÍCIE, enquanto o rótulo usava `--scriba-blue-ink`). Como os glifos
 * pintam com `currentColor`, a cor desce sozinha do `text-*` deste link.
 */
type TabLinkProps = {
  href: string;
  label: string;
  active: boolean;
  icon: ComponentType<{ className?: string }>;
  activeClass?: string;
};

function TabLink({
  href,
  label,
  active,
  icon: Icon,
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
      {/* A calha de altura FIXA é o que alinha a fileira. Sem ela, cada item
          fica com a altura do próprio ícone, e como a barra centraliza item a
          item o resultado é um rótulo em cada linha.

          Os quatro glifos usam o MESMO `size` porque vêm do mesmo conjunto e
          preenchem o `viewBox` de 24 quase inteiro (ver `NavGlyphs`). Isso é
          novo: enquanto a barra misturava formas feitas à mão com glifos do
          lucide, cada um precisava de um `size` próprio — o lucide reserva
          margem dentro do `viewBox`, e em tamanho igual os dele liam como
          menores que os vizinhos. Se um ícone novo destoar, o lugar de olhar é
          quanto ele desenha do `viewBox`, não o `size` daqui. */}
      <span aria-hidden className="flex h-5 items-center justify-center">
        {/* Enquanto a rota não chega, o PRÓPRIO ícone vira o spinner. É o único
            feedback que cabe aqui: um glifo extra ao lado mudaria a largura do
            item no meio do toque. Ver `LinkPendingSwap`.

            O `size-5` no swap não é decoração: o spinner tem 16px por padrão, e
            sem isso o ícone ENCOLHERIA ao ser tocado. */}
        <LinkPendingSwap className="size-5">
          <Icon className="size-5" />
        </LinkPendingSwap>
      </span>
      <span>{label}</span>
    </NavLink>
  );
}
