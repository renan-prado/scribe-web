"use client";

import { Pause, Play, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MicGlyph } from "@/components/icons/MicGlyph";
import { ConfirmDialog } from "@/features/session/components/ConfirmDialog";
import { useCoinTick } from "@/features/session/hooks/useCoinTick";
import { useTranscribeQueue } from "@/features/session/hooks/useTranscribeQueue";
import { useUnloadGuard } from "@/features/session/hooks/useUnloadGuard";
import {
  requestCreateSession,
  requestDeleteSession,
  requestFinalSummary,
} from "@/features/session/lib/api";
import { isSilentBlob } from "@/features/session/lib/audio";
import { reportRecorderError } from "@/features/session/lib/recorderErrors";
import { tailSentences } from "@/features/session/lib/text";
import type { ChunkEvent } from "@/lib/domain/recorder";
import { cn } from "@/lib/utils";
import { useChunkedCapture, WAVE_BARS } from "./useChunkedCapture";

/**
 * O gravador do v2: a onda do microfone, três controles e nada mais na tela.
 *
 * ## A ordem das coisas, que é o ponto desta tela
 *
 * A sessão nasce no START, e o áudio sobe em pedaços de 15-20s DURANTE a
 * pregação, exatamente como no gravador do app de hoje. O que esta tela não tem
 * é o feed ao vivo: o texto que volta de cada pedaço é guardado e só aparece no
 * fim, dentro do resumo.
 *
 * **Ela já foi o oposto disso, e a inversão custou caro.** O desenho anterior
 * era "nada existe no servidor até o stop": um arquivo único na memória do
 * aparelho, e no stop uma sequência de três chamadas. O argumento era bom —
 * sem feed, fatiar parecia pagar rede e costura de texto sem comprar nada — e
 * errava em três frentes que só aparecem quando algo dá errado:
 *
 * - um arquivo só tem TETO (`/api/transcribe` recusa acima de 8 MB, ~44
 *   minutos), e passar dele deixava a gravação sem como ser transcrita;
 * - um arquivo só não EXISTE antes do fim, então a aba morrer aos 40 minutos
 *   custava os 40 minutos;
 * - um arquivo só sobe UMA vez, sem fila para retomar o que a rede derrubou.
 *
 * Uma palestra de quase uma hora se perdeu por causa da primeira. Em pedaços,
 * cada uma das três deixa de existir: não há teto, cada pedaço vira registro no
 * IndexedDB assim que fecha, e a fila reenvia sozinha, para sempre, com recuo
 * progressivo (`useTranscribeQueue`).
 *
 * ## O stop NÃO resume pela metade sem dizer
 *
 * Parar espera a fila esvaziar (`drain`, 60s). Se ela não esvazia — rede fora,
 * provedor fora —, a tela **para e conta**: quantos trechos faltam, e as duas
 * saídas possíveis (esperar mais, ou resumir só com o que chegou). Gerar o
 * resumo de uma transcrição com buracos e chamar isso de pronto é o mesmo
 * defeito da versão anterior, só que mais discreto: o usuário levaria para casa
 * um resumo que parece completo e não é.
 *
 * A fila continua tentando enquanto a aba estiver aberta, então "esperar mais"
 * costuma ser a resposta certa. Sair da tela com trechos pendentes é o que
 * `useUnloadGuard` pergunta antes de deixar acontecer.
 *
 * ## A cobrança
 *
 * `COIN_COSTS.audioOnlyMinute` por minuto INICIADO, debitado do cliente a cada
 * 60s enquanto captura: o primeiro minuto sai no `start`, e pausar congela o
 * relógio (ver `useCoinTick`). Saldo acabando PAUSA, não encerra — quem comprar
 * moedas retoma de onde parou, e quem não comprar ainda leva o resumo do que
 * gravou até ali.
 *
 * Agora que a sessão nasce no start, o débito vai AMARRADO a ela: as linhas do
 * ledger deixaram de sair sem `sessionId`, e o custo de uma gravação volta a
 * aparecer no detalhe por sessão, não só no total do usuário.
 *
 * ## O que esta tela ainda NÃO faz
 *
 * **Não retoma uma sessão de outra visita.** Se a aba morrer com trechos
 * pendentes, o áudio deles continua no IndexedDB (TTL de 24h) e a sessão fica
 * em "Em aberto", mas não há por onde voltar nela: a recuperação de órfãos do
 * `useTranscribeQueue` só roda para a sessão que ESTÁ montada. Falta também
 * guardar o TEXTO de cada pedaço — hoje ele vive só na memória da aba, então
 * uma retomada reconstruiria a transcrição sem as partes que já tinham subido.
 * As duas coisas andam juntas e são o próximo passo; é a mesma dívida do app de
 * hoje (ver `listUnfinishedSessions`).
 *
 * **Não começa uma gravação sem internet.** A sessão nasce de um `POST`, e sem
 * ele não há chave para pendurar os pedaços. Perder a rede DEPOIS de começar é
 * tratado (a fila segura e reenvia); começar sem ela, não.
 *
 * ## A onda
 *
 * Treze barras arredondadas, crescendo a partir do centro. Elas são desenhadas
 * uma vez e, daí em diante, quem mexe nelas é o laço de áudio escrevendo
 * `style.height` direto no DOM, nunca o React (ver `useChunkedCapture`).
 *
 * A altura de cada barra não vai a zero: o piso é a própria largura da barra, o
 * que a transforma num PONTO no silêncio em vez de fazê-la sumir. Uma onda que
 * desaparece quando ninguém fala parece defeito; um ponto que pulsa parece
 * escuta.
 *
 * ## Os controles
 *
 * Pausar e apagar do mesmo tamanho, parar maior no meio: o tamanho é a
 * hierarquia, quem chega nesta tela vai terminar a gravação muito mais vezes do
 * que vai pausá-la ou descartá-la.
 */
type Phase = "capture" | "creating" | "draining" | "summarizing";

const PHASE_LABEL: Record<Exclude<Phase, "capture">, string> = {
  creating: "Preparando a gravação…",
  draining: "Enviando os últimos trechos…",
  summarizing: "Montando o resumo…",
};

/**
 * Quanto o stop espera a fila esvaziar antes de perguntar o que fazer.
 *
 * Mesmo valor do app de hoje. É generoso de propósito: um pedaço de 20s pesa
 * uns 80 KB, e mesmo uma rede ruim sobe a fila inteira bem antes disso. Chegar
 * no limite não significa "demorou", significa "não está subindo".
 */
const DRAIN_TIMEOUT_MS = 60_000;

export function AudioStudio({ autoStart = false }: { autoStart?: boolean }) {
  const router = useRouter();
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const startedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("capture");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [depleted, setDepleted] = useState(false);
  /** Preenchido quando o `drain` estoura: quantos trechos ficaram e quanto
   * tempo a gravação teve. Enquanto existe, a tela é a da escolha. */
  const [stalled, setStalled] = useState<{ pending: number; durationMs: number } | null>(null);
  /** Só para a tela mostrar que há coisa em trânsito. Não governa nada. */
  const [inFlight, setInFlight] = useState(0);

  /**
   * O texto de cada pedaço, por índice.
   *
   * É `ref` porque quem escreve nele é o callback da fila e quem lê é o stop, e
   * nenhum dos dois desenha a partir dele — virar estado só forçaria um render
   * por trecho transcrito para nada. É também por isso que ele MORRE com a aba,
   * a dívida está no cabeçalho.
   */
  const textsRef = useRef<Map<number, { text: string; suspect: boolean }>>(new Map());

  // O ÚNICO ponto em que o áudio toca a tela. Roda a 60 quadros por segundo,
  // então aqui não entra nada além de escrever altura: sem alocar array, sem
  // ler layout (o que forçaria reflow), sem estado.
  const paintLevels = useCallback((levels: Float32Array) => {
    for (let i = 0; i < levels.length; i++) {
      const bar = barsRef.current[i];
      if (!bar) continue;
      // 14px (o ponto em repouso) até 168px. A curva é linear de propósito: a
      // compressão já foi feita no nível, e comprimir duas vezes achata a onda
      // toda no meio da caixa.
      bar.style.height = `${14 + levels[i] * 154}px`;
    }
  }, []);

  /**
   * Junta os pedaços transcritos em ordem.
   *
   * `excludeSuspect` tira os que o servidor marcou como assinatura de
   * alucinação. Ele é usado para montar a DICA de contexto do próximo pedaço,
   * onde realimentar um trecho alucinado tende a repetir a alucinação; o texto
   * que vai para o resumo mantém todos, porque já chegam limpos.
   */
  const assemble = useCallback((opts?: { excludeSuspect?: boolean }) => {
    return Array.from(textsRef.current.entries())
      .sort(([a], [b]) => a - b)
      .map(([, c]) => c)
      .filter((c) => !(opts?.excludeSuspect && c.suspect))
      .map((c) => c.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const queue = useTranscribeQueue({
    // A fila só existe de verdade depois que a sessão nasce; até lá este id
    // vazio não casa com nada no IndexedDB e a recuperação de órfãos não acha
    // nada, que é o comportamento certo.
    sessionId: sessionId ?? "",
    onSuccess: (index, text, meta) => {
      textsRef.current.set(index, { text, suspect: meta.suspect });
      // `queueRef` é declarado abaixo, e isto o lê só quando um upload termina,
      // muito depois do primeiro render: closure captura o VÍNCULO, não o valor.
      setInFlight(queueRef.current.pendingCount());
    },
  });
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const handleChunk = useCallback(
    async (ev: ChunkEvent) => {
      // O pedaço de silêncio sai ANTES de entrar na fila: transcrever silêncio
      // é pagar a OpenAI para receber texto inventado de volta.
      if (await isSilentBlob(ev.blob)) return;
      // Pedaços suspeitos ficam fora da dica pelo motivo no `assemble`.
      const prevHint = tailSentences(assemble({ excludeSuspect: true }), 2);
      await queueRef.current.enqueue({
        index: ev.index,
        blob: ev.blob,
        mimeType: ev.mimeType,
        extension: ev.extension,
        startedAt: ev.startedAt,
        durationMs: ev.durationMs,
        prevText: prevHint,
      });
      setInFlight(queueRef.current.pendingCount());
    },
    [assemble]
  );

  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;

  /**
   * Os `handleChunk` ainda em andamento.
   *
   * O gravador ENTREGA o pedaço de forma síncrona, mas guardá-lo não é
   * síncrono: decodificar para medir silêncio e gravar no IndexedDB levam alguns
   * quadros. Sem esperar por isso, o `drain` do stop podia rodar com a fila
   * ainda vazia e responder "tudo enviado" antes de o último trecho sequer ter
   * ENTRADO nela — o fim da pregação sumindo do resumo sem erro nenhum na tela.
   */
  const inflightRef = useRef<Set<Promise<void>>>(new Set());

  const { state, error, setError, start, pause, resume, stop } = useChunkedCapture({
    onLevels: paintLevels,
    onChunk: (ev) => {
      const set = inflightRef.current;
      const running: Promise<void> = handleChunk(ev).finally(() => set.delete(running));
      set.add(running);
    },
    onRecorderError: (ev) => {
      const sid = sessionIdRef.current;
      if (sid) reportRecorderError(sid, ev);
    },
  });
  const idle = state === "idle";
  const busy = phase !== "capture";
  const capturing = state === "recording" || state === "paused";

  // Sair daqui com trecho pendente é perder aquele trecho: a fila vive na aba.
  // Também vale durante o envio e durante a escolha do `stalled`, pelos mesmos
  // 20 segundos de pregação de cada pedaço.
  useUnloadGuard(capturing || busy || stalled !== null || inFlight > 0);

  // Saldo acabando PAUSA, não encerra. Encerrar jogaria fora o que já foi
  // gravado (e já foi pago); pausado, quem comprar moedas numa outra aba
  // retoma de onde parou, e quem não comprar ainda pode parar e ficar com o
  // resumo do que gravou até ali. É o mesmo contrato do `useCoinGuard` do app.
  useCoinTick({
    enabled: state === "recording",
    reason: "audio_only_minute",
    sessionId,
    onDepleted: () => {
      setDepleted(true);
      void pause();
    },
  });

  /**
   * Abre a gravação: a sessão primeiro, o microfone depois.
   *
   * Nesta ordem, e não ao contrário, porque a fila de upload é indexada por
   * `sessionId` — um pedaço que fechasse antes de a sessão existir não teria
   * onde ser guardado. O custo é uma ida ao servidor entre o toque e a onda; o
   * primeiro pedaço só fecha 15 segundos depois, então sobra tempo.
   */
  const begin = useCallback(async () => {
    if (sessionIdRef.current || busy) return;
    setError(null);
    setPhase("creating");
    const created = await requestCreateSession({ mode: "audio_only" });
    if ("error" in created) {
      setPhase("capture");
      setError(`Não consegui preparar a gravação: ${created.error}`);
      return;
    }
    setSessionId(created.id);
    sessionIdRef.current = created.id;
    setPhase("capture");
    textsRef.current = new Map();
    if (!(await start())) {
      // O microfone recusou: a sessão recém-criada não tem para que existir, e
      // deixá-la viva encheria "Em aberto" de linhas vazias a cada tentativa.
      void requestDeleteSession(created.id);
      setSessionId(null);
      sessionIdRef.current = null;
    }
  }, [busy, setError, start]);

  /** O resumo, a partir do que já foi transcrito. Só chamado quando quem o
   * chama já sabe o que está mandando: fila vazia, ou a escolha explícita de
   * resumir com buracos. */
  const summarize = useCallback(
    async (sid: string, durationMs: number) => {
      const transcript = assemble();
      if (!transcript) {
        // O microfone esteve aberto e nada inteligível entrou (silêncio, sala
        // barulhenta abaixo do VAD, microfone mudo). Não há resumo a gerar, e a
        // linha vazia não deve sobrar no acervo.
        void requestDeleteSession(sid);
        setSessionId(null);
        setPhase("capture");
        setError("Nenhuma fala foi capturada. A gravação foi descartada sem gerar resumo.");
        return;
      }
      setPhase("summarizing");
      const summary = await requestFinalSummary({
        sessionId: sid,
        text: transcript,
        feedItems: [],
        durationMs,
      });
      if (!summary) {
        setPhase("capture");
        setError("Não consegui montar o resumo desta gravação. Tente parar de novo.");
        return;
      }
      router.push(`/v2/summary/${sid}`);
    },
    [assemble, router, setError]
  );

  async function finish() {
    const sid = sessionIdRef.current;
    if (!sid) return;
    const durationMs = await stop();
    setPhase("draining");
    // O `stop()` já garante que o último pedaço foi EMITIDO; isto garante que
    // ele foi GUARDADO. Só depois das duas coisas é que perguntar "a fila
    // esvaziou?" quer dizer alguma coisa.
    await Promise.allSettled([...inflightRef.current]);
    const { drained, pending } = await queue.drain(DRAIN_TIMEOUT_MS);
    setInFlight(queue.pendingCount());
    if (!drained && pending > 0) {
      // A escolha é de quem gravou, e por isso ela PARA aqui em vez de resumir
      // o que deu. Um resumo com buracos parece completo.
      setPhase("capture");
      setStalled({ pending, durationMs });
      return;
    }
    await summarize(sid, durationMs);
  }

  // Chegando pelo `?auto=1` (o botão do `/v2/home`) o microfone abre sozinho.
  // O `startedRef` não é paranoia: em desenvolvimento o React monta, desmonta e
  // remonta cada componente uma vez para caçar efeito impuro, e sem a trava
  // isso criaria DUAS sessões, das quais uma ficaria vazia para sempre.
  useEffect(() => {
    if (!autoStart || startedRef.current) return;
    startedRef.current = true;
    void begin();
  }, [autoStart, begin]);

  return (
    <>
      {/* A onda ocupa o miolo e fica centrada nele, sozinha. A caixa dela tem
          altura FIXA: as barras crescem para os dois lados a partir do centro,
          e sem a altura reservada o bloco inteiro subiria e desceria com a voz
          de quem fala. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <div aria-hidden className="flex h-[168px] items-center justify-center gap-2 sm:gap-2.5">
          {Array.from({ length: WAVE_BARS }, (_, i) => (
            <span
              key={`bar-${
                // biome-ignore lint/suspicious/noArrayIndexKey: as barras são posições fixas, não dados
                i
              }`}
              ref={(el) => {
                barsRef.current[i] = el;
              }}
              className={cn(
                // Meia tinta: a onda é PANO DE FUNDO da ação, não o assunto da
                // tela. Cheia, ela competia com os controles e virava a coisa
                // mais forte de uma tela cujo ponto é o botão. Em repouso cai à
                // metade de novo, o que separa "escutando" de "parado" sem
                // precisar de texto.
                "w-3.5 rounded-full bg-v2-wave transition-opacity duration-300 sm:w-4",
                idle && !busy ? "opacity-15" : "opacity-50"
              )}
              style={{ height: "14px" }}
            />
          ))}
        </div>

        {busy ? (
          <p role="status" className="text-sm font-light text-v2-ink-soft">
            {PHASE_LABEL[phase as Exclude<Phase, "capture">]}
          </p>
        ) : stalled ? (
          <div role="alert" className="flex max-w-xs flex-col gap-2 text-center">
            <p className="text-sm font-light text-v2-ink-soft">
              {stalled.pending === 1
                ? "1 trecho da gravação ainda não subiu."
                : `${stalled.pending} trechos da gravação ainda não subiram.`}{" "}
              O áudio deles está guardado neste aparelho e continua tentando sozinho.
            </p>
            <p className="text-sm font-light text-v2-ink-mute">
              Se resumir agora, o resumo sai sem essas partes. Se der para esperar a rede voltar,
              esperar é melhor — mas não feche esta tela.
            </p>
          </div>
        ) : depleted ? (
          <p role="alert" className="max-w-xs text-center text-sm font-light text-v2-ink-soft">
            Suas moedas acabaram e a gravação foi pausada. Você ainda pode parar e ficar com o
            resumo do que gravou até aqui.
          </p>
        ) : error ? (
          <p role="alert" className="max-w-xs text-center text-sm font-light text-v2-ink-mute">
            {error}
          </p>
        ) : capturing && inFlight > 0 ? (
          // Sem isto, ficar sem rede no meio da pregação é invisível até o stop.
          <p role="status" className="text-sm font-light text-v2-ink-mute">
            {inFlight === 1 ? "1 trecho aguardando envio" : `${inFlight} trechos aguardando envio`}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center justify-center gap-6">
          {busy ? null : stalled ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    setStalled(null);
                    setPhase("draining");
                    const again = await queue.drain(DRAIN_TIMEOUT_MS);
                    setInFlight(queue.pendingCount());
                    setPhase("capture");
                    if (!again.drained && again.pending > 0) {
                      setStalled({ pending: again.pending, durationMs: stalled.durationMs });
                      return;
                    }
                    const sid = sessionIdRef.current;
                    if (sid) await summarize(sid, stalled.durationMs);
                  })();
                }}
                className="inline-flex h-12 items-center justify-center rounded-full bg-v2-card px-6 text-sm text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                Esperar e tentar de novo
              </button>
              <button
                type="button"
                onClick={() => {
                  const sid = sessionIdRef.current;
                  const { durationMs } = stalled;
                  setStalled(null);
                  if (sid) void summarize(sid, durationMs);
                }}
                className="inline-flex h-12 items-center justify-center rounded-full px-6 text-sm text-v2-ink-mute transition-colors hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                Resumir assim mesmo
              </button>
            </>
          ) : idle ? (
            <button
              type="button"
              onClick={() => void begin()}
              aria-label="Começar a gravar"
              className="inline-flex size-24 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
            >
              <MicGlyph className="size-9" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (state !== "paused") return void pause();
                  // Sem saldo o "Retomar" não retoma: ele manda comprar. Deixar
                  // o botão voltar a capturar daria minutos de graça até o
                  // próximo tick falhar de novo.
                  if (depleted) return;
                  void resume();
                }}
                disabled={state === "paused" && depleted}
                aria-label={state === "paused" ? "Retomar" : "Pausar"}
                className="inline-flex size-14 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                {state === "paused" ? (
                  <Play className="size-5 fill-current" strokeWidth={0} />
                ) : (
                  <Pause className="size-5 fill-current" strokeWidth={0} />
                )}
              </button>
              {/* O maior, no meio, e o único de tinta CHEIA dos três: o tamanho
                  diz qual é o principal, o branco diz qual encerra. */}
              <button
                type="button"
                onClick={() => void finish()}
                aria-label="Parar"
                className="inline-flex size-24 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                <Square className="size-8 fill-current" strokeWidth={0} />
              </button>
              {/* Apagar PERGUNTA. O que se perde é a única cópia do que foi
                  dito, e ela não volta de lugar nenhum. */}
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                aria-label="Apagar"
                className="inline-flex size-14 items-center justify-center rounded-full bg-v2-card text-v2-ink-mute transition-colors hover:bg-v2-card-hover hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                <Trash2 className="size-5" strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Apagar esta gravação?"
        description="O áudio gravado até aqui é descartado e nada é salvo. Não dá para desfazer."
        confirmLabel="Apagar"
        onConfirm={async () => {
          await stop();
          // `clear` cancela as retentativas E apaga os pedaços desta sessão do
          // IndexedDB. Sem ele, a fila continuaria subindo áudio de uma sessão
          // que acabou de deixar de existir.
          queue.clear();
          const sid = sessionIdRef.current;
          if (sid) await requestDeleteSession(sid);
          setSessionId(null);
          sessionIdRef.current = null;
          textsRef.current = new Map();
          setInFlight(0);
          router.push("/v2/home");
        }}
      />
    </>
  );
}
