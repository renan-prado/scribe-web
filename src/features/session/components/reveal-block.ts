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

/**
 * A piscada só começa quando a ROLAGEM PARA, e isto é o que espera.
 *
 * Começando junto com o `scrollIntoView`, os dois pulsos aconteciam DURANTE o
 * caminho: no celular — onde a gaveta ainda está fechando e a distância é
 * maior — a animação acabava antes de o bloco chegar ao centro, e o que se via
 * era rolagem e mais nada.
 *
 * O critério é a POSIÇÃO do bloco parar de mudar, e não um tempo cravado: a
 * duração de uma rolagem suave depende da distância e do navegador, e qualquer
 * número fixo seria curto num caso e longo em outro.
 *
 * Três amarras, cada uma contra uma falha diferente:
 *
 *  - **O piso** (`FLOOR`) existe porque nos primeiros quadros a rolagem ainda
 *    não começou: sem ele, "não mudou de posição" é verdade justamente antes de
 *    o movimento sair, e a espera terminaria no ato.
 *  - **Três quadros parados**, e não um: uma rolagem suave desacelera, e no fim
 *    dela dois quadros seguidos podem diferir por menos de meio pixel.
 *  - **O teto** (`CAP`) garante que a piscada aconteça de todo jeito. Rolagem
 *    interrompida pelo dedo, bloco que já estava no centro, aba em segundo
 *    plano: em qualquer um deles é melhor piscar um pouco tarde que nunca.
 */
const SETTLE_FLOOR_MS = 120;
const SETTLE_CAP_MS = 1200;
const SETTLE_STABLE_FRAMES = 3;

function whenScrollSettles(el: HTMLElement, flash: () => void): void {
  const started = performance.now();
  let previousTop = Number.NaN;
  let stable = 0;

  const tick = () => {
    const top = el.getBoundingClientRect().top;
    stable = Math.abs(top - previousTop) < 0.5 ? stable + 1 : 0;
    previousTop = top;

    const elapsed = performance.now() - started;
    const parou = stable >= SETTLE_STABLE_FRAMES && elapsed >= SETTLE_FLOOR_MS;
    if (parou || elapsed >= SETTLE_CAP_MS) {
      flash();
      return;
    }
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

export function revealSummaryBlock(index: number): void {
  const el = document.querySelector<HTMLElement>(`[${SUMMARY_BLOCK_ATTR}="${index}"]`);
  if (!el) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  el.scrollIntoView({
    // Rolagem suave é o que liga o lugar de antes ao lugar de agora; com
    // movimento reduzido ela é um salto, e a piscada continua dizendo qual é o
    // bloco — o recado não depende da animação.
    behavior: reduced ? "auto" : "smooth",
    block: "center",
    // `inline: "nearest"` é uma GUARDA, não um detalhe: `scrollIntoView` mexe
    // em TODO ancestral que rola, e na leitura um deles é o trilho horizontal
    // dos dois slides (`SummaryDeck`). Sem isto, revelar um bloco poderia
    // arrastar o carrossel para o meio do caminho entre o resumo e a
    // transcrição.
    inline: "nearest",
  });

  const flash = () => {
    // Revelar o MESMO bloco duas vezes seguidas (inserir, desfazer, inserir de
    // novo) não reinicia uma animação que já está na classe: o navegador só a
    // dispara quando ela ENTRA. Tirar, forçar o reflow e pôr de volta é o que
    // reinicia.
    el.classList.remove(FLASH_CLASS);
    void el.offsetWidth;
    el.classList.add(FLASH_CLASS);
    el.addEventListener("animationend", () => el.classList.remove(FLASH_CLASS), { once: true });
  };

  // Com rolagem instantânea não há o que esperar: o bloco já está no centro.
  if (reduced) flash();
  else whenScrollSettles(el, flash);
}
