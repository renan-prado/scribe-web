/**
 * Constantes de ajuste da sessão. Controlam o ritmo do gravador e das
 * pipelines de LLM durante uma gravação ao vivo. Mantenha as unidades no
 * nome (Ms, Chars) para que os chamadores não precisem adivinhar.
 */

export const SILENCE_RMS_THRESHOLD = 0.005;

/**
 * "Extract" extrai o que o pregador realmente disse (versículos citados,
 * destaques do pregador, citações atribuídas ao vivo). Roda em cada chunk
 * para que um versículo citado ou frase marcante apareça no feed quase
 * imediatamente.
 */
export const EXTRACT_EVERY_N_CHUNKS = 2;
// No modo de leitura o gravador corta chunks menores (4-8s), então disparar
// o extract em cada chunk significa disparar a cada 4-8s — o que, com ~4500
// tokens por chamada, ultrapassa o limite de 30k TPM do gpt-4o. Disparar a
// cada 2 chunks (~8-16s) equivale ao ritmo fora do modo de leitura e fica
// dentro do limite do plano.
export const EXTRACT_EVERY_N_CHUNKS_READING = 1;

/**
 * "Suggest" é enriquecimento gerado pela IA (versículos relacionados,
 * contexto histórico/linguístico, citações sugeridas). Se beneficia de um
 * pouco de contexto acumulado antes do primeiro disparo, mas não deve ficar
 * muito atrás do extract — o ouvinte está escutando a introdução agora.
 */
export const SUGGEST_EVERY_N_CHUNKS = 3;
export const SUGGEST_WARMUP_CHUNKS = 3;

/**
 * Limita o trecho da transcrição enviado ao extract/suggest. Dois motivos:
 * (1) custo/latência, (2) o modelo deve permanecer ancorado no MOMENTO ATUAL
 * da pregação — itens sobre coisas mencionadas há 5+ minutos e abandonadas
 * confundem o ouvinte. ~3000 chars ≈ 2-3 minutos de fala, a janela desejada.
 */
export const RECENT_TRANSCRIPT_CHARS = 2500;

/**
 * Crescimento mínimo do trecho da transcrição (em chars) entre duas chamadas
 * de extract/suggest. Com chunks de 8s, o pregador produz ~80–120 chars de
 * fala, então os limiares ficam abaixo desse piso para não pular conteúdo
 * real. Extract dispara a cada chunk; suggest a cada 2 chunks (~16s), então
 * sua barra é ligeiramente mais alta para evitar disparar em contexto quase
 * idêntico.
 */
export const EXTRACT_MIN_TAIL_DELTA_CHARS = 40;
export const SUGGEST_MIN_TAIL_DELTA_CHARS = 160;

/**
 * Toda vez que o feed visível acumula essa quantidade de cards gerados pela IA
 * sem um card do pregador quebrando a sequência, o cliente dispara
 * /api/sermon-echo para trazer uma frase literal do pregador. O limiar exato
 * é sorteado uniformemente em [MIN, MAX] a cada disparo para que o ritmo não
 * pareça mecânico.
 *
 * ECHO_MIN_TAIL_DELTA_CHARS controla o disparo: se o trecho da transcrição
 * não cresceu significativamente desde o último pedido de echo, não há
 * material novo para ecoar — pula e economiza os tokens.
 */
export const ECHO_STREAK_MIN = 3;
export const ECHO_STREAK_MAX = 6;
export const ECHO_MIN_TAIL_DELTA_CHARS = 200;

/**
 * Espaçamento mínimo entre dois cards do feed se tornarem visíveis. As
 * pipelines de extract/suggest podem retornar 2+ itens de uma vez; uma fila
 * de gotejamento no cliente os espaça para que o ouvinte tenha tempo de ler
 * cada um em vez de ser inundado.
 */
export const FEED_MIN_GAP_MS = 60000; // 60s

// Chunks menores reduzem o atraso entre o pregador dizer algo e o primeiro
// disparo de extract/suggest. Mínimo de 8s dá ao Whisper áudio suficiente
// para transcrever com precisão mantendo a latência abaixo de 10s na prática.
// Máximo de 20s para que uma frase longa não espere indefinidamente.
export const RECORDER_MIN_CHUNK_MS = 8_000;
export const RECORDER_MAX_CHUNK_MS = 30_000;

// Enquanto o pregador lê a Escritura literalmente (readingMode=true), o
// ouvinte assiste um card de versículo crescer para acompanhar a passagem
// sendo lida. Cortar chunks mais cedo permite que o extract dispare com mais
// frequência a cada novo versículo, para que o card de intervalo se atualize
// em tempo quase real. O Whisper ainda recebe áudio suficiente porque o ritmo
// de leitura é lento e a dicção é cuidadosa.
export const RECORDER_MIN_CHUNK_MS_READING = 4_000;
export const RECORDER_MAX_CHUNK_MS_READING = 8_000;

// Durante uma leitura ativa, o card da passagem faz prefetch silencioso desse
// número de versículos além do fim confirmado, para que quando o extract
// expanda o intervalo os novos versículos renderizem instantaneamente do
// cache. Cada unidade custa uma chamada a /api/verse.
export const LIVE_READING_LOOKAHEAD_PREFETCH = 6;

// Período de carência antes que uma passagem em leitura "ativa" recolha seus
// versículos de lookahead. O readingMode do extract pode alternar brevemente
// para false entre versículos (pausa, interjeição curta, ruído de transcrição)
// — recolher no primeiro false esconderia versículos no meio da passagem.
// Só tratamos a passagem como realmente encerrada quando readingMode
// permanece false por esse tempo.
export const LIVE_READING_ACTIVE_GRACE_MS = 15_000;
export const RECORDER_SILENCE_THRESHOLD = 0.01;
export const RECORDER_SILENCE_HOLD_MS = 400;

export const TICK_INTERVAL_MS = 300;
