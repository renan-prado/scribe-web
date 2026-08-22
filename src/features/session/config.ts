/**
 * Constantes de ajuste da sessão. Controlam o ritmo do gravador e das
 * duas pipelines de LLM que rodam ao vivo (bible + insights). Unidades
 * ficam no nome (Ms, Chars) para o chamador não precisar adivinhar.
 */

// ---------- Fluxo BIBLE (rápido, gated por regex) ----------

/**
 * Trecho da transcrição enviado ao /api/bible. Pequeno porque a rota só
 * precisa enxergar a menção mais recente pra decidir a referência.
 */
export const BIBLE_TRANSCRIPT_CHARS = 900;

/**
 * Crescimento mínimo da transcrição (em chars) entre duas chamadas de bible.
 * Chunks de 8s produzem ~80-120 chars — o piso fica abaixo pra não pular
 * conteúdo real, mas evita disparar em contexto quase idêntico.
 */
export const BIBLE_MIN_TAIL_DELTA_CHARS = 40;

// ---------- Fluxo INSIGHTS (lento, tempo-based) ----------

/**
 * Cadência do /api/insights. Alto o suficiente pra dar contexto ao modelo
 * (pregador desenvolve o ponto durante ~1 min), baixo o suficiente pra que
 * highlights/citações não fiquem descolados do momento.
 */
export const INSIGHTS_INTERVAL_MS = 45_000; // 45s

/**
 * Trecho da transcrição enviado ao /api/insights. Menor que a janela
 * antiga (2500) pra baratear tokens — 1500 ≈ 90-120s de fala, suficiente
 * pra o modelo captar o tema atual sem carregar o histórico inteiro.
 */
export const INSIGHTS_TRANSCRIPT_CHARS = 1500; // 1.5k chars

/**
 * Delta mínimo de transcrição entre duas chamadas de insights. Evita
 * chamar quando pouco foi dito desde a chamada anterior. Também funciona
 * como warmup implícito: o primeiro tick só dispara quando a transcrição
 * cresceu além desse piso.
 */
export const INSIGHTS_MIN_TAIL_DELTA_CHARS = 200;

// ---------- Fluxo SERMON-ECHO (streak-based) ----------

/**
 * Toda vez que o feed acumula essa quantidade de cards da IA seguidos sem
 * card do pregador quebrando, o cliente dispara /api/sermon-echo pra trazer
 * uma frase literal. O limiar exato é sorteado uniformemente em [MIN, MAX]
 * a cada disparo pra o ritmo não parecer mecânico.
 *
 * ECHO_MIN_TAIL_DELTA_CHARS controla o gate: se a transcrição não cresceu
 * o suficiente desde o último eco, não há material novo — pula e economiza.
 */
export const ECHO_STREAK_MIN = 3;
export const ECHO_STREAK_MAX = 5;
export const ECHO_MIN_TAIL_DELTA_CHARS = 200;

// ---------- FEED (drip visual) ----------

/**
 * Espaçamento mínimo entre dois cards se tornarem visíveis. As pipelines
 * podem retornar 2+ itens de uma vez; uma fila no cliente os espaça pra o
 * ouvinte ter tempo de ler cada um.
 */
export const FEED_MIN_GAP_MS = 45_000; // 45s

/**
 * Se a fila de drip já tem esse número de items pendentes, o insights tick
 * pula a chamada. Backpressure: enquanto os cards antigos não aparecem, não
 * faz sentido gerar mais material — economiza tokens e evita que insights
 * geradas há vários minutos apareçam fora do momento certo.
 */
export const INSIGHTS_QUEUE_BACKPRESSURE = 3;

// ---------- RECORDER (chunking + silêncio) ----------

// Chunks menores reduzem o atraso entre pregador dizer algo e o primeiro
// disparo da pipeline. Mínimo de 8s dá ao Whisper áudio suficiente pra
// transcrever com precisão. Máximo de 30s pra que uma frase longa não
// espere indefinidamente.
export const RECORDER_MIN_CHUNK_MS = 8_000;
export const RECORDER_MAX_CHUNK_MS = 30_000;

export const RECORDER_SILENCE_THRESHOLD = 0.01;
export const RECORDER_SILENCE_HOLD_MS = 400;
export const SILENCE_RMS_THRESHOLD = 0.005;

// ---------- OUTROS ----------

export const TICK_INTERVAL_MS = 300;
