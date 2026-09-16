import type { ReactNode } from "react";

/**
 * O ID do vão onde cada tela pendura a SUA metade da barra.
 *
 * Mora aqui e é importado pela `TopBar` porque uma string escrita em dois
 * arquivos é a string que um dia diverge sem ninguém ver — e o sintoma dessa
 * divergência é a barra ficar vazia, sem erro nenhum no console.
 */
export const TOPBAR_SLOT_ID = "app-topbar-slot";

/**
 * A CASCA da barra do app, e a razão de o cabeçalho ter parado de piscar.
 *
 * ## O problema que ela resolve
 *
 * A `TopBar` inteira morava dentro de CADA página, e ela lê o banco: perfil,
 * saldo e papel de parceiro, duas consultas. Página é o que o App Router
 * DESCARTA ao navegar; layout é o que ele preserva. Com a barra na página, todo
 * toque num link refazia as duas consultas e remontava o avatar, o saldo e o
 * menu da conta — e enquanto a resposta não chegava, o cabeçalho ficava no
 * estado de carregando. É literalmente o que se via ao andar de uma tela para
 * a outra.
 *
 * Aqui a barra é partida em duas, pela linha que separa o que é da TELA do que
 * é da SESSÃO:
 *
 * - **O que é da sessão mora nesta casca**, renderizada pelo layout de
 *   `(barra)`: o avatar, o saldo, o menu da conta. Consultado UMA vez por
 *   carregamento de verdade, e depois disso preservado em toda navegação —
 *   o menu nem sequer perde o estado de aberto.
 * - **O que é da tela continua na página** (título, voltar, os chips de criar,
 *   a lupa), e chega até aqui pelo vão abaixo, por portal. Ver `TopBar`.
 *
 * ## Por que o conteúdo da tela vem por PORTAL, e não como prop
 *
 * Um layout não recebe prop de uma página, e o `trailing` de três das telas
 * depende de contexto que nasce DENTRO delas: o `SearchToggle` da Biblioteca
 * precisa do `SearchScope`, a lupa do `/summary` precisa do
 * `SummaryFindProvider`, o relógio da gravação precisa do `ClockScope`. Subir
 * os três providers até aqui seria dar escopo global a estado de uma tela só.
 * Com o portal, a `TopBar` continua sendo renderizada onde sempre foi, dentro
 * dos providers dela, e só o DOM pousa aqui em cima.
 *
 * **O preço, escrito para quem vier depois:** portal não existe no HTML do
 * servidor. Num carregamento DURO (abrir o app, um link compartilhado) este
 * vão nasce vazio e só recebe o título e os chips na hidratação — o avatar já
 * está lá, então a barra nunca parece quebrada, e a altura é a mesma nos dois
 * momentos, então nada pula de lugar. É uma vez por abertura do app, contra
 * uma vez por TOQUE, que era o que se pagava antes.
 *
 * ## Por que ela é um grupo de rotas, e não o layout de `(app)`
 *
 * `/assinar` e `/retorno` são o fluxo de pagamento, telas cheias que não têm
 * (nem devem ter) barra, e `/indicar` traz o próprio voltar. Uma lista de
 * exceções num `if` de pathname apodrece na primeira rota nova; um grupo de
 * rotas não: quem está dentro de `(barra)/` tem barra, quem está fora não tem,
 * e a pasta é a documentação. Grupo não aparece na URL, então nenhum endereço
 * mudou.
 */
export function AppHeaderShell({ account }: { account: ReactNode }) {
  return (
    // A mesma coluna das telas (`max-w-[1024px]`, `px-4`) e o mesmo `pt-2` que
    // cada `<main>` tinha antes da barra: a barra sai das páginas, e a folga
    // acima dela sai junto, senão sobraria 8px de vão duplicado no topo.
    <div className="mx-auto w-full max-w-[1024px] px-4 pt-2">
      {/* `gap-3` e `px-1 py-3` são os da barra antiga, intactos: o desenho não
          mudou, mudou de dono. */}
      <header className="flex items-center gap-3 px-1 py-3">
        {/* O VÃO. `min-h-10` é a altura do chip do voltar e da pena, e é o que
            mantém a barra com a MESMA altura antes e depois da hidratação —
            sem ele o cabeçalho teria 24px num instante e 40 no seguinte, e a
            página inteira daria um pulo. `flex-1` porque o título cresce. */}
        <div id={TOPBAR_SLOT_ID} className="flex min-h-10 min-w-0 flex-1 items-center gap-3" />
        {account}
      </header>
    </div>
  );
}
