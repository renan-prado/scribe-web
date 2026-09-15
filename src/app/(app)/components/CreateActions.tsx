"use client";

import { PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { MicGlyph } from "@/components/icons/MicGlyph";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { NavLink } from "@/components/NavLink";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TOPBAR_CHIP_CLASS } from "./chip";

/**
 * As três portas de criação na BARRA DO TOPO, e só no desktop.
 *
 * **É o `CreateDock` sem o `+`.** No celular, criar mora num botão flutuante
 * que abre um painel de três opções (ver `home/CreateDock.tsx`): ali o polegar
 * chega no canto de baixo e a barra do topo está longe, então vale um toque a
 * mais para não gastar a única faixa larga da tela. No desktop as duas razões
 * caem juntas — o cursor chega em qualquer canto pelo mesmo custo, e a barra
 * tem vão de sobra à direita do título. O `+` vira o que ele é quando o espaço
 * não é escasso: um clique cobrado para revelar três ícones que já cabiam na
 * tela. Por isso o dock inteiro é `md:hidden` e estes chips são
 * `hidden md:inline-flex` — nunca os dois ao mesmo tempo, em nenhuma largura.
 *
 * **São TRÊS componentes soltos, e não uma fileira.** A ordem da barra é
 * Importar, Gravar, **lupa**, Escrever, avatar: a busca entra NO MEIO das
 * portas de criação, então não há grupo contíguo para embrulhar. Quem monta a
 * ordem é a página, que é também quem sabe se aquela tela tem lupa — o
 * `/summary` e o `/escrever` não têm, e ali os três ficam juntos por
 * consequência, não por regra.
 *
 * O espaçamento é o `gap-3` da própria `TopBar`, sem grupo interno: com um
 * `gap` menor entre os chips de criar, a lupa no meio lia como intrusa numa
 * fileira que não era dela. Um vão só, e a barra vira uma fileira de controles.
 *
 * **Sem rótulo, com TOOLTIP.** No painel do dock cada ícone tem o verbo escrito
 * embaixo, porque ele abre no vazio e precisa se explicar sozinho. Aqui os três
 * entram numa barra que já tem título, lupa e avatar; três palavras a mais
 * viram uma segunda linha de navegação em cima da primeira. O nome não se
 * perde, só passa a ser pedido: ele volta no hover, e o `aria-label` de cada
 * link o diz sempre, para quem navega por teclado ou leitor de tela.
 *
 * **Eles são CHIPS da barra** (`TOPBAR_CHIP_CLASS`), o mesmo disco de 40px do
 * voltar e da lupa. Desenhá-los como os quadrados de 48px do painel poria dois
 * formatos de botão lado a lado na mesma linha, e a fileira leria como um
 * pedaço de outra tela colado ali.
 *
 * **NENHUM é vermelho, nem o de gravar.** No painel do dock ele é, e ali a cor
 * tem trabalho: são três quadrados iguais abertos no vazio, e o vermelho é o
 * que faz o olho cair na porta mais usada sem ler os três nomes. Na barra não
 * há fileira nenhuma para destacar — os três estão separados pela lupa, entre o
 * voltar e o avatar, e um disco vermelho no meio de quatro cinzas não leria como
 * "o principal", leria como ALERTA, que é o que um ponto vermelho numa barra de
 * ferramentas diz. O vermelho continua sendo a cor do microfone; ele volta na
 * tela de gravação, onde há o que ele marcar.
 *
 * **Cada chip é um ALVO DE TOUR, e o nome dele é o mesmo da porta gêmea do
 * `CreateDock`** (`create-record`, `create-write`, `create-import`). A
 * apresentação da Biblioteca tem um passo por porta, e como um dos dois
 * desenhos está sempre em `display: none`, `resolveAnchor` fica com o visível —
 * os mesmos três passos servem às duas larguras sem um `if` de tamanho de tela
 * em lugar nenhum (ver `src/features/tour/lib/anchors.ts`).
 *
 * **O que NÃO existe aqui é o `create-dock`**, e a ausência é deliberada. Ele é
 * o `+` do rodapé, e o passo que o recorta diz "atrás deste botão estão as três
 * portas" — uma frase que, no desktop, descreveria uma tela que não está ali:
 * as três já estão abertas nesta barra. Sem alvo, aquele passo se apaga
 * sozinho, pela regra de sempre. Enquanto o chip de gravar respondeu por
 * `create-dock`, o desktop levava um balão a mais falando de um menu que ele
 * não tem.
 */

/** A porta do YouTube: cola o link e a legenda vira transcrição. */
export function ImportAction() {
  return (
    <CreateAction
      href="/importar"
      label="Importar do YouTube"
      icon={<YoutubeIcon className="size-5" />}
      tourId="create-import"
    />
  );
}

/**
 * A porta do microfone. `?auto=1` abre a `/recording` JÁ GRAVANDO: quem clicou
 * aqui já disse que quer gravar, e um segundo clique do outro lado cobraria
 * duas vezes pela mesma decisão. Mesmo parâmetro do dock.
 */
export function RecordAction() {
  return (
    <CreateAction
      href="/recording?auto=1"
      label="Gravar resumo"
      icon={<MicGlyph className="size-5" />}
      tourId="create-record"
    />
  );
}

/** A folha em branco: o único caminho do produto que não custa moeda. */
export function WriteAction() {
  return (
    <CreateAction
      href="/escrever"
      label="Escrever resumo"
      icon={<PenLine className="size-5" strokeWidth={1.75} />}
      tourId="create-write"
    />
  );
}

/**
 * Um chip de criação: o glifo no disco da barra, o nome no tooltip.
 *
 * O gatilho do tooltip é um `<span>` em volta, e não o próprio link: o
 * `TooltipTrigger` do base-ui entrega `ref` e handlers ao que ele renderiza, e
 * o `NavLink` é tipado sobre `ComponentPropsWithoutRef<"a">`. É a mesma volta
 * que o `DeepenButton` dá, pela mesma razão.
 *
 * É o SPAN que carrega o `hidden md:inline-flex`, e não o link: ele é a caixa
 * que a barra enxerga, e um `display: none` por dentro dele deixaria no celular
 * um item de flex vazio comendo um `gap-3`.
 *
 * O nome aparece em DOIS lugares, e não é repetição descuidada: no tooltip,
 * para quem vê a tela, e no `aria-label`, para quem não vê. Vem da mesma prop,
 * então não há como divergirem.
 */
function CreateAction({
  href,
  label,
  icon,
  tourId,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  tourId?: string;
}) {
  return (
    // `delay` curto: o nome do ícone é informação que se pede com o cursor já
    // parado em cima, não um aviso que precisa de tempo de leitura antes. Ele
    // só existe no `Provider` do base-ui — o `Root` não o aceita —, e por isso
    // cada chip traz o seu, como o `DeepenButton`.
    <TooltipProvider delay={120}>
      <Tooltip>
        <TooltipTrigger
          render={<span data-tour={tourId} className="hidden shrink-0 md:inline-flex" />}
        >
          <NavLink
            href={href}
            aria-label={label}
            spinner="none"
            contentClassName="inline-flex items-center"
            className={TOPBAR_CHIP_CLASS}
          >
            {icon}
          </NavLink>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
