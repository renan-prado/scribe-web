/**
 * Constantes de ajuste da sessão. Controlam o ritmo do gravador e das
 * duas pipelines de LLM que rodam ao vivo (bible + insights). Unidades
 * ficam no nome (Ms, Chars) para o chamador não precisar adivinhar.
 */

// ---------- Fluxo BIBLE (rápido, gated por regex + guard ponderado) ----------

/**
 * Trecho da transcrição enviado ao /api/bible. Pequeno porque a rota só
 * precisa enxergar a menção mais recente pra decidir a referência.
 */
export const BIBLE_TRANSCRIPT_CHARS = 900;

/**
 * Score mínimo do bible guard (`lib/bible/guard.ts`) pra disparar a chamada.
 * A primeira camada (regex de menção) já rodou; o guard soma sinais ponderados
 * como bookWithNumber (+4), readingVerbNear (+3), demonstrativeAnaphora (-4)
 * etc. Threshold 4 corresponde a exigir pelo menos um sinal forte
 * ("Salmo 23") ou dois sinais médios que se somem.
 */
export const BIBLE_GUARD_THRESHOLD = 4;

/**
 * Janela em que uma referência recém-emitida ainda é considerada duplicata.
 * Enquanto ativa, o sinal duplicateEmit (-5) mata sozinho um bookWithNumber
 * (+4), impedindo re-disparo pra mesma passagem quando o pastor segue
 * discutindo em cima dela.
 */
export const BIBLE_GUARD_COOLDOWN_MS = 90_000;

/**
 * TTL do `currentReading` — enquanto fresco, triggers isolados
 * ("versículo 10", "no verso seguinte") disparam continuationHit (+3),
 * resolvendo a leitura pausada em que o pastor anuncia livro+capítulo
 * uma vez e depois só cita versos.
 */
export const BIBLE_GUARD_CURRENT_READING_TTL_MS = 300_000; // 5min

/**
 * Palavras ao redor do match consideradas pelo guard pra detectar verbo de
 * leitura ("abra", "leiam") ou verbo passado ("li", "acabei de ler").
 */
export const BIBLE_GUARD_VERB_WINDOW_WORDS = 6;

/**
 * Crescimento mínimo da transcrição (em chars) entre duas chamadas de bible.
 * Aplicado *após* o guard passar — impede re-fire no mesmo tail quando o LLM
 * responde items: 0 (nesse caso `lastBibleEmit` não atualiza e o sinal
 * `duplicateEmit` não dispara, então sem esse gate o effect re-executa
 * imediatamente ao flip de `bibleInFlight`).
 */
export const BIBLE_MIN_TAIL_DELTA_CHARS = 40;

// ---------- Fluxo INSIGHTS (lento, chunk-based) ----------

/**
 * Cadência do /api/insights em número de chunks OK. A cada 4 chunks
 * transcritos com sucesso o pipeline dispara — com chunks de 15-30s isso
 * equivale a ~60-120s de fala, dando contexto suficiente ao modelo e
 * mantendo o custo por minuto sob controle.
 */
export const INSIGHTS_CHUNK_INTERVAL = 4;

/**
 * Trecho da transcrição enviado ao /api/insights. Menor que a janela
 * pra o modelo captar o tema atual sem carregar o histórico inteiro.
 */
export const INSIGHTS_TRANSCRIPT_CHARS = 1500; // 1.5k chars

/**
 * Delta mínimo de transcrição entre duas chamadas de insights. Evita
 * chamar quando pouco foi dito desde a chamada anterior. Também funciona
 * como warmup implícito: o primeiro tick só dispara quando a transcrição cresceu além desse piso.
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
export const FEED_MIN_GAP_MS = 25_000; // 25s

/**
 * Gap curto aplicado quando o head da drip queue é um `citedVerse`. A citação
 * vem do próprio pregador lendo — precisa aparecer perto do momento da fala,
 * não atrás dos 25s dos cards de IA. Combina com o "furar-fila" no
 * `enqueueFeedItems` (citedVerse é inserido antes de itens não-citedVerse).
 */
export const FEED_CITED_VERSE_GAP_MS = 3_000; // 3s

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
export const RECORDER_MIN_CHUNK_MS = 15_000;
export const RECORDER_MAX_CHUNK_MS = 20_000;

export const RECORDER_SILENCE_THRESHOLD = 0.01;
export const RECORDER_SILENCE_HOLD_MS = 400;
export const SILENCE_RMS_THRESHOLD = 0.005;

// ---------- OUTROS ----------

export const TICK_INTERVAL_MS = 300;
