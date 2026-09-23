"use client";

import { ArrowLeft } from "lucide-react";
import { type ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { ScribaMark } from "@/shared/brand";
import { TOPBAR_SLOT_ID } from "./AppHeaderShell";
import { TOPBAR_CHIP_CLASS } from "./chip";

/**
 * A barra do topo do v2: a pena, o título, a busca.
 *
 * Mora aqui, e não dentro de `home/`, porque a `/recording` usa a mesma:
 * são telas diferentes do mesmo produto, e um cabeçalho que muda de desenho ao
 * entrar na gravação faria a pessoa achar que saiu do app.
 *
 * **Ela não desenha mais uma barra: ela PREENCHE a que o layout já desenhou.**
 * O que se vê na tela é a soma de duas peças — esta, que é da PÁGINA, e a
 * `AppHeaderShell`, que é do layout de `(shell)` e carrega o avatar, o saldo e
 * o menu da conta. O porquê da divisão está no cabeçalho de lá, e resume-se a
 * isto: página o App Router descarta ao navegar, layout ele preserva. Com a
 * conta na página, cada toque num link refazia duas consultas ao banco e
 * remontava o cabeçalho — o "header carregando de uma tela para outra".
 *
 * Por isso ela é CLIENTE e devolve um portal. Ela continua sendo renderizada
 * no mesmo lugar de sempre (dentro do `SearchScope` da Biblioteca, do
 * `SummaryFindProvider` do resumo, do `ClockScope` da gravação), então o
 * `trailing` continua enxergando o contexto da tela dele; só o DOM é que pousa
 * lá em cima. Passar isso como prop era impossível: layout não recebe prop de
 * página, e subir os três providers até o layout daria escopo global a estado
 * de uma tela só.
 *
 * **Ela não lê mais o banco**, e é o ponto inteiro da mudança: as duas
 * consultas (`getCurrentAccount` e `isCurrentUserPartner`) subiram para o
 * layout, onde acontecem uma vez por carregamento em vez de uma por navegação.
 *
 * **O canto esquerdo é a PENA, sozinha, em cinza, e ela não clica.** Ali houve
 * um hambúrguer, e a gaveta dele tinha quatro destinos: Biblioteca, Estudos,
 * Escrever e Importar do YouTube. Os dois últimos passaram para o `+` do
 * rodapé, que é onde se cria; os Estudos saíram da interface; e a Biblioteca,
 * que sobrou, virou por um tempo o destino da própria marca. Hoje nem isso: a
 * pena é MARCAÇÃO, sem link e sem hover. Quem precisa da Biblioteca chega nela
 * pelo voltar do `/summary`, que é o caminho por onde se entrou.
 *
 * O canto direito tem DUAS coisas, e só uma delas é da página. O `trailing` é
 * um SLOT: a Biblioteca passa as portas de criação e o gatilho da busca (que
 * precisa do estado dela, ver `SearchScope`), o `/summary` passa as portas e a
 * busca DENTRO do resumo, a gravação passa o relógio. **O avatar vem depois
 * dele e é do LAYOUT**, em toda tela de `(shell)`: a conta não é assunto de uma
 * página, e um avatar que aparece e some conforme a tela obrigaria a decorar em
 * qual delas ele estava. Ver `AccountMenu`.
 *
 * **Entre os dois há um FIO, e só no desktop.** Ele foi junto com o avatar para
 * o layout, pela mesma razão: ele separa os controles DA TELA da CONTA, e quem
 * desenha a fronteira é o lado que não muda.
 *
 * **Com `backHref`, o canto esquerdo troca a pena por um VOLTAR** e o título
 * pode sumir — é a barra do `/summary`. Uma tela de leitura aberta a partir de
 * um cartão precisa do caminho de volta no lugar onde o polegar já procura,
 * que é o canto onde a marca estava; e repetir ali o título do sermão, que a
 * página inteira grita duas linhas abaixo, seria dizê-lo duas vezes. O resto da
 * barra NÃO muda: a lupa e o avatar continuam onde estavam em toda tela.
 */
export function TopBar({
  title,
  backHref,
  trailing,
}: {
  /** Some no `/summary`: a própria página já é o título. */
  title?: string;
  /** Quando passado, a pena vira um voltar para cá. */
  backHref?: string;
  trailing?: ReactNode;
}) {
  const host = useTopBarSlot();
  // No HTML do servidor não há portal: o vão nasce vazio e é preenchido na
  // hidratação. Ele já tem altura própria (`min-h-10` lá), então a barra não
  // muda de tamanho entre um momento e o outro e nada pula de lugar.
  if (!host) return null;

  return createPortal(
    <>
      {backHref ? (
        <NavLink
          href={backHref}
          aria-label="Voltar"
          spinner="none"
          contentClassName="inline-flex items-center"
          className={cn("-ml-1", TOPBAR_CHIP_CLASS)}
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} />
        </NavLink>
      ) : (
        /* A PENA sozinha, e em cinza: sem a palavra e sem o gradiente do
           `ScribaLogo`. O logotipo inteiro ali competia com o título da tela —
           duas palavras no mesmo peso lado a lado, e a que importa é a que diz
           onde você está. A pena basta para dizer de quem é o app, e em
           `--v2-ink-mute` ela fica no plano em que uma marca fica: presente e
           atrás do conteúdo.

           **Ela NÃO é clicável, e não reage ao mouse: é marcação.** Foi um link
           para a Biblioteca por algumas versões, herdado da gaveta do
           hambúrguer que morava neste canto. Um logotipo que acende sob o
           cursor promete um destino, e num app de três telas esse destino não
           valia o clique que ele pedia. Sem `hover`, sem `focus`, sem `href`:
           quem olha entende que ali não há nada para tocar.

           Ela mora numa caixa de 40px — a mesma do chip do voltar e da lupa —,
           e é isso que mantém a barra com a mesma altura em toda tela. Mas NÃO
           ganha o disco `--v2-card` do chip: dentro de uma pastilha a marca
           viraria mais um botão numa fileira deles, que é exatamente o que ela
           deixou de ser.

           Não leva `aria-label` nenhum: a pena já é `aria-hidden`, e um enfeite
           sem ação não é coisa que o leitor de tela precise anunciar. */
        // `text-v2-ink` no claro e `v2-ink-mute` no escuro, e não um token só:
        // no escuro a pena é um enfeite e um branco chapado ali competiria com
        // o título ao lado; no claro o cinza médio a fazia sumir na página
        // branca, e a marca é a única coisa da barra que diz de quem é o app.
        <span className="inline-flex size-10 shrink-0 items-center justify-center text-v2-ink dark:text-v2-ink-mute">
          <ScribaMark size={26} />
        </span>
      )}
      {/* Sem peso: o título é a placa da tela, e em negrito ele competia com o
          conteúdo que a página veio mostrar. */}
      {title ? (
        <h1 className="min-w-0 flex-1 truncate text-[22px] text-v2-ink">{title}</h1>
      ) : (
        <span className="flex-1" />
      )}
      {/* Sem `trailing`, um vão do tamanho do botão: é ele que mantém o título
          na mesma posição nas duas telas, e sem o vão o texto escorregaria
          para a direita ao trocar de página. Só que ele existe para segurar o
          TÍTULO — nas telas que não têm um (o `/summary`, o estudo) não há o
          que segurar, e o vão seria um buraco de 40px antes do avatar. */}
      {trailing ?? (title ? <span aria-hidden className="size-10 shrink-0" /> : null)}
    </>,
    host
  );
}

/**
 * O nó onde a barra pousa, achado no DOM depois da montagem.
 *
 * `useSyncExternalStore` e não `useState` + `useEffect`: o snapshot do servidor
 * é `null` por definição (não há DOM lá), e este hook é o jeito de dizer isso
 * ao React sem que ele acuse divergência de hidratação. O `subscribe` é vazio
 * de propósito — o vão é criado pelo layout, que por construção monta ANTES de
 * qualquer página e nunca desmonta enquanto se anda dentro de `(shell)`, então
 * não há evento a que assinar.
 */
function useTopBarSlot(): HTMLElement | null {
  return useSyncExternalStore(
    () => () => {},
    () => document.getElementById(TOPBAR_SLOT_ID),
    () => null
  );
}
