/**
 * O ritmo da pergunta. Um número só, e ele é a diferença entre uma janela que
 * se responde e uma que se fecha por reflexo.
 *
 * Todos são medidos a partir da MONTAGEM da tela, que é o instante em que a
 * pessoa chegou ao que ela veio buscar, o resumo já foi gerado, a transcrição
 * já está lá, o estudo já está aberto.
 */

/**
 * Resumo (modos Ao Vivo e Áudio): 5 segundos.
 *
 * A pessoa chega aqui vinda do "parar", com a tela do resumo montando. Abrir
 * a janela em cima disso a faz cobrir o que ela esperou a gravação inteira
 * para ver, e a resposta seria o clique mais rápido para tirá-la da frente.
 * Cinco segundos é o tempo de bater o olho no título e nos primeiros blocos,
 * o suficiente para haver o que avaliar.
 */
export const FEEDBACK_DELAY_SUMMARY_MS = 5_000;

/**
 * Transcrição: 2,5 segundos.
 *
 * Mais curto de propósito. A transcrição não tem um "resultado" que se revela,
 * ela é o texto, e ele está inteiro na tela desde o primeiro frame. Não há
 * o que esperar terminar.
 */
export const FEEDBACK_DELAY_TRANSCRIPT_MS = 2_500;

/**
 * Estudo: 8 segundos.
 *
 * O mais longo dos três, e por uma razão de conteúdo: o estudo é para LER, e
 * uma nota dada antes de a pessoa ter lido a tese central não é sobre o
 * estudo, é sobre a espera. Oito segundos é o tempo de chegar ao fim do
 * primeiro bloco.
 */
export const FEEDBACK_DELAY_STUDY_MS = 8_000;
