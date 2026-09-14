export type ChunkEvent = {
  index: number;
  blob: Blob;
  mimeType: string;
  extension: string;
  startedAt: number;
  durationMs: number;
};

export type RecorderErrorSource = "stream" | "chunk" | "vad";

export type RecorderErrorEvent = {
  source: RecorderErrorSource;
  message: string;
};

export type RecorderOptions = {
  minChunkMs?: number;
  maxChunkMs?: number;
  silenceThreshold?: number;
  silenceHoldMs?: number;
  /** First chunk index this recorder should emit. Used when resuming from a
   * pause so new chunks keep counting up instead of colliding with chunks
   * captured before the pause. Defaults to 0. */
  startingIndex?: number;
};

type ChunkTiming = {
  minChunkMs?: number;
  maxChunkMs?: number;
};

/**
 * Não existe captura do áudio da sessão INTEIRA, e a ausência é deliberada.
 * Havia aqui um segundo MediaRecorder sobre o mesmo MediaStream, gravando o
 * sermão completo em paralelo aos chunks, com um `onFinalAudio` que ninguém
 * nunca registrou: o áudio era codificado duas vezes, acumulado na memória do
 * início ao fim, e no stop virava um `new Blob` contíguo de dezenas de MB para
 * ser descartado. Numa WebView, heap bem menor que o de uma aba de Chrome,
 * esse pico caía exatamente no instante em que o usuário aperta "parar".
 *
 * Se um dia quisermos guardar o áudio, ele precisa ir para o IndexedDB
 * incrementalmente (como `chunk-store.ts` já faz com os chunks), nunca se
 * acumular num array até o fim da gravação.
 */
export type Recorder = {
  start(): Promise<{ mimeType: string; extension: string }>;
  stop(): Promise<void>;
  onChunk(cb: (ev: ChunkEvent) => void): void;
  onError(cb: (ev: RecorderErrorEvent) => void): void;
  setChunkTiming(next: ChunkTiming): void;
  /**
   * O `AnalyserNode` que o VAD já usa, ou `null` antes do `start()` e depois do
   * `stop()`. Existe para quem DESENHA o áudio (a onda do `/v2/recording`).
   *
   * A alternativa seria a tela abrir seu próprio `AudioContext` sobre o mesmo
   * stream, e num celular isso é caro do jeito errado: contexto de áudio é
   * recurso de HARDWARE, com limite baixo, e o segundo existiria só para ler um
   * sinal que este já tem na mão. Emprestar o analyser é de graça.
   *
   * Ler dele não atrapalha o VAD: o corte de chunk usa `getByteTimeDomainData`,
   * e o `smoothingTimeConstant`, que a onda ajusta, só afeta a leitura de
   * FREQUÊNCIA. As duas leituras convivem no mesmo nó.
   */
  getAnalyser(): AnalyserNode | null;
};
