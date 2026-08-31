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
 * Cadência do /api/insights em número de chunks OK. Com chunks de 15-20s,
 * 6 chunks equivalem a ~90-120s (1.5-2min) de fala — a cadência-alvo de
 * ~1 card a cada 1:30-2min no feed live. O FEED_MIN_GAP_MS de 90s segura
 * o ritmo quando uma call retorna 2 itens de uma vez.
 */
export const INSIGHTS_CHUNK_INTERVAL = 6;

/**
 * Warmup: chunks OK exigidos pro PRIMEIRO disparo de insights da sessão.
 * Sem ele, o primeiro card só apareceria após INSIGHTS_CHUNK_INTERVAL chunks
 * (2min+), o que lê como "não está funcionando". Disparar já no primeiro
 * chunk deixa o prompt decidir se o trecho curto rende algo útil — se
 * retornar 0 items, o próximo tick volta à cadência normal.
 */
export const INSIGHTS_FIRST_FIRE_CHUNK = 1;

/**
 * Trecho da transcrição enviado ao /api/insights. Acompanha o
 * INSIGHTS_CHUNK_INTERVAL: com ~2min entre chamadas e fala em português
 * rodando ~900 chars/min, 2k cobre o intervalo com folga de contexto.
 */
export const INSIGHTS_TRANSCRIPT_CHARS = 2000; // 2k chars

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
 * ouvinte ter tempo de ler cada um. 90s casa com a cadência de insights
 * (~1.5-2min): quando uma call retorna 2 itens, o segundo espera 90s, e o
 * ritmo visível fica na faixa 1:30-2min por card.
 */
export const FEED_MIN_GAP_MS = 90_000; // 90s

/**
 * Gap curto pro PRIMEIRO card da sessão. Enquanto `feedItems` estiver vazio,
 * o drain usa esse valor em vez de FEED_MIN_GAP_MS. Reduz a ansiedade inicial
 * ("será que está funcionando?") sem afetar o ritmo depois — após o primeiro
 * drain, a fila volta ao gap longo.
 */
export const FEED_FIRST_CARD_GAP_MS = 20_000; // 20s

/**
 * Gap aplicado quando o head da drip queue é um `citedVerse`. ZERO de
 * propósito: a citação vem do próprio pregador lendo — uma vez identificada,
 * aparece imediatamente, sem nenhum pacing de fila. O atraso restante é só o
 * inevitável (fechamento do chunk de áudio + transcrição + call do bible).
 * Combina com o "furar-fila" no `enqueueFeedItems` (citedVerse é inserido
 * antes de itens não-citedVerse).
 */
export const FEED_CITED_VERSE_GAP_MS = 0;

/**
 * Se a fila de drip já tem esse número de items pendentes, o insights tick
 * pula a chamada. Backpressure: enquanto os cards antigos não aparecem, não
 * faz sentido gerar mais material — economiza tokens e evita que insights
 * geradas há vários minutos apareçam fora do momento certo. Reduzido pra 2
 * porque cada call agora retorna no máximo 2 itens; segurar 2 na fila já
 * significa uma call inteira aguardando.
 */
export const INSIGHTS_QUEUE_BACKPRESSURE = 2;

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

// ---------- TRANSCRIÇÃO (qualidade + escalada de modelo) ----------

/**
 * Janela deslizante de chunks OK observada para decidir a promoção da sessão
 * ao modelo de transcrição escalado. Se, entre os últimos
 * TRANSCRIBE_ESCALATION_WINDOW chunks, TRANSCRIBE_ESCALATION_BAD_COUNT ou mais
 * saíram ruins (assinatura de alucinação, baixa confiança, ou o servidor
 * precisou re-transcrever no modelo escalado), a sessão inteira passa a pedir
 * o modelo escalado direto — evita pagar dois modelos por chunk em áudio
 * sabidamente ruim. A promoção é pegajosa: vale até o fim da sessão, e o
 * usuário é avisado por um banner para decidir se continua gastando moedas.
 */
export const TRANSCRIBE_ESCALATION_WINDOW = 5;
export const TRANSCRIBE_ESCALATION_BAD_COUNT = 3;

// ---------- OUTROS ----------

export const TICK_INTERVAL_MS = 300;
