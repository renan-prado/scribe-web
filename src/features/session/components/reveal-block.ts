/**
 * "Esse aqui": rolar até um bloco do resumo e dar nele uma piscada.
 *
 * ## Por que existe
 *
 * O "Adicionar" da conversa com o Biblo acontece DENTRO da gaveta, e o efeito
 * dele acontece FORA dela — num parágrafo que pode estar a três telas de
 * distância. Sem isto, o gesto mais valioso do Biblo (o que separa ele de um
 * ChatGPT numa aba, `docs/biblo.md` §6) não tem retorno visível nenhum: o botão
 * troca de rótulo para "Desfazer" e é só isso. A pessoa fecha a gaveta e vai
 * PROCURAR onde o bloco caiu.
 *
 * A piscada não é enfeite, é a resposta à pergunta "onde?". Ela dura o
 * suficiente para o olho chegar depois da rolagem e curta o bastante para não
 * virar um estado da tela.
 *
 * ## As duas telas chamam isto em momentos diferentes, e é inevitável
 *
 * No editor (`/escrever`) o bloco entra no rascunho local: o nó existe no
 * quadro seguinte, e quem chama espera o commit do React (ver `revealIndex` no
 * `Composer`). Na leitura (`/summary`) inserir é um POST mais um
 * `router.refresh()`, e o nó certo só existe quando o payload novo desce do
 * servidor — ali quem chama espera a PROP mudar (ver `BibloSummaryDock`).
 *
 * É por isso que esta função não tenta esperar nada: ela lê o DOM AGORA. O nó
 * no índice pedido existe nos dois casos desde antes da inserção (com o
 * conteúdo antigo), então uma espera por existência flagraria o bloco errado —
 * quem sabe quando o conteúdo é o novo é quem inseriu.
 *
 * Client-only: mexe em `document`.
 */

/**
 * O atributo que marca um bloco do resumo com o ÍNDICE dele no payload.
 *
 * Índice, e não um id: blocos de resumo não têm identidade nenhuma (o jsonb
 * guarda uma lista), e a posição é justamente o que a inserção decide
 * (`suggestion.afterIndex`). Quem desenha a lista põe o atributo; as duas telas
 * mapeiam `blocks` uma-para-uma, então o índice do DOM é o do payload.
 */
export const SUMMARY_BLOCK_ATTR = "data-summary-block";

/** A classe que faz a piscada. Declarada em `globals.css`. */
const FLASH_CLASS = "summary-block-flash";

export function revealSummaryBlock(index: number): void {
  const el = document.querySelector<HTMLElement>(`[${SUMMARY_BLOCK_ATTR}="${index}"]`);
  if (!el) return;

  el.scrollIntoView({
    // Rolagem suave é o que liga o lugar de antes ao lugar de agora; com
    // movimento reduzido ela é um salto, e a piscada continua dizendo qual é o
    // bloco — o recado não depende da animação.
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "center",
    // `inline: "nearest"` é uma GUARDA, não um detalhe: `scrollIntoView` mexe
    // em TODO ancestral que rola, e na leitura um deles é o trilho horizontal
    // dos dois slides (`SummaryDeck`). Sem isto, revelar um bloco poderia
    // arrastar o carrossel para o meio do caminho entre o resumo e a
    // transcrição.
    inline: "nearest",
  });

  // Revelar o MESMO bloco duas vezes seguidas (inserir, desfazer, inserir de
  // novo) não reinicia uma animação que já está na classe: o navegador só a
  // dispara quando ela ENTRA. Tirar, forçar o reflow e pôr de volta é o que
  // reinicia.
  el.classList.remove(FLASH_CLASS);
  void el.offsetWidth;
  el.classList.add(FLASH_CLASS);
  el.addEventListener("animationend", () => el.classList.remove(FLASH_CLASS), { once: true });
}
