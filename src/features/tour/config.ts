/**
 * Quando o tour abre, contado a partir da montagem da tela.
 *
 * O atraso não é polidez: ele é o que separa uma apresentação de uma
 * interrupção. Uma tela ainda montando com um balão por cima ensina, antes de
 * qualquer outra coisa, que a primeira reação ao chegar numa página nova é
 * procurar o X.
 *
 * O mesmo raciocínio governa `src/features/feedback/config.ts`, e os dois
 * arquivos se olham: no `/summary` e no `/deepening` as duas coisas disputam a
 * mesma tela, e quem cede é a pesquisa, ver `FeedbackPrompt`.
 */

/**
 * Listagens (`/feed`, `/recordings`, `/studies`): 1,2 segundo.
 *
 * O conteúdo delas chega pronto do servidor; o que falta é a pessoa bater o
 * olho e entender onde está. Mais que isso e o balão aparece depois de ela já
 * ter começado a rolar a página, o que faz o holofote apontar para um
 * elemento que saiu da tela.
 */
export const TOUR_DELAY_LIST_MS = 1_200;

/**
 * Resumo salvo e estudo: 3 segundos.
 *
 * As duas são telas de RESULTADO, e a pessoa chegou nelas para ler o
 * resultado. Três segundos é o tempo de o título e o primeiro bloco entrarem
 * no olho, o suficiente para o tour ser sobre uma tela que ela já viu, e não
 * sobre uma tela que ela ainda não sabe se lhe interessa.
 */
export const TOUR_DELAY_RESULT_MS = 3_000;

/**
 * Telas de captura: 700 ms.
 *
 * O mais curto de todos, e por uma razão de risco. O tour ali só pode rodar
 * ANTES de a gravação começar (ver `TourTrigger` e `RecordingLive`), e a
 * janela entre chegar na tela e tocar no botão é curta, é uma tela de um
 * botão só. Um atraso longo faria o balão abrir por cima de alguém que já
 * está gravando, que é exatamente o que não pode acontecer.
 */
export const TOUR_DELAY_CAPTURE_MS = 700;
