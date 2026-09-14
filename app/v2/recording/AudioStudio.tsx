"use client";

import { Download, Pause, Play, RotateCw, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MicGlyph } from "@/components/icons/MicGlyph";
import { ConfirmDialog } from "@/features/session/components/ConfirmDialog";
import { useCoinTick } from "@/features/session/hooks/useCoinTick";
import { useUnloadGuard } from "@/features/session/hooks/useUnloadGuard";
import { requestCreateSession, requestFinalSummary } from "@/features/session/lib/api";
import { formatDurationLong } from "@/features/session/lib/formatting";
import {
  deleteCapture,
  deleteExpiredCaptures,
  listCaptures,
  type PendingCapture,
  patchCapture,
  putCapture,
} from "@/lib/capture-store";
import { cn } from "@/lib/utils";
import { useAudioCapture, WAVE_BARS } from "./useAudioCapture";

/**
 * O gravador do v2: a onda do microfone, três controles e nada mais na tela.
 *
 * ## A ordem das coisas, que é o ponto desta tela
 *
 * Nada existe no SERVIDOR até o STOP. Não há sessão criada ao abrir, não há
 * áudio subindo durante a pregação, não há transcrição parcial. Quem desiste (o
 * botão de apagar) não deixa rastro nenhum para limpar depois.
 *
 * É o oposto do gravador do app atual, e de propósito: lá a sessão nasce antes
 * da primeira palavra porque o feed ao vivo precisa de uma linha para pendurar
 * os cartões. Aqui não há feed, então a linha só precisa existir quando houver
 * o que guardar nela.
 *
 * No stop, em sequência (e só então):
 *
 * 1. **guarda o áudio no aparelho** (`lib/capture-store`, IndexedDB);
 * 2. cria a sessão (`POST /api/sessions`, modo `audio_only`);
 * 3. manda o ÁUDIO INTEIRO, num POST só, para `/api/transcribe`;
 * 4. manda o texto para `/api/final-summary`, que grava transcrição e resumo
 *    na sessão e a encerra;
 * 5. apaga a cópia local e abre `/v2/summary/:id`.
 *
 * ## O passo 1 é o mais importante, e ele foi aprendido do jeito caro
 *
 * Antes ele não existia: o `Blob` vivia numa variável local dentro do `finish()`
 * e em mais lugar nenhum. Quando um dos passos de rede falhava, o `catch`
 * mostrava um aviso educado na tela, a função retornava, a variável saía de
 * escopo e o coletor comia a ÚNICA cópia do que foi dito. O aviso mais provável
 * era o de tamanho, porque `/api/transcribe` recusa acima de 8 MB e um arquivo
 * de 24 kbps encosta nisso perto dos 44 minutos, ou seja: exatamente as
 * gravações mais longas, aquelas em que mais se perdia, eram as que a tela
 * destruía. Uma palestra de quase uma hora se perdeu assim.
 *
 * Agora o áudio é gravado no aparelho ANTES da primeira chamada de rede, e a
 * cópia só morre quando existe resumo no banco. Falhar virou só falhar: a tela
 * mostra o painel de resgate (tentar de novo, **baixar o arquivo**, apagar), e
 * fechar a aba no meio não destrói nada — na próxima visita a gravação pendente
 * é encontrada e oferecida de volta.
 *
 * O `Blob` também fica em estado do React, e não só no IndexedDB. Os dois não
 * são redundância boba: o IndexedDB pode simplesmente não estar disponível
 * (aba anônima, armazenamento desligado, cota estourada), e nesse caso a cópia
 * em memória ainda segura o áudio até a aba fechar, que é a diferença entre
 * "dá para baixar o arquivo" e "acabou". Quando ela é a única, a tela DIZ isso.
 *
 * ## Sem internet
 *
 * Cai no mesmo lugar: o passo 2 falha, o painel de resgate aparece, e o áudio
 * está guardado. Quem voltar a ter rede aperta "Tentar de novo". O que esta
 * tela ainda NÃO faz é tentar sozinha, com backoff, como a fila do app atual
 * (`useTranscribeQueue`) faz com os chunks — aqui a retentativa é manual.
 *
 * ## A cobrança
 *
 * `COIN_COSTS.audioOnlyMinute` por minuto INICIADO, debitado do cliente a cada
 * 60s enquanto captura, exatamente como no gravador do app atual: o primeiro
 * minuto sai no `start`, e pausar congela o relógio (ver `useCoinTick`).
 *
 * **Ela roda DURANTE a captura, e não no stop**, embora a sessão só nasça lá.
 * Cobrar tudo no fim pareceria mais simples e é a decisão errada: quem tem
 * saldo zero gravaria três horas e só descobriria no stop, e o custo de STT
 * dessas três horas já teria sido nosso. Cobrando por minuto, o saldo acabando
 * PARA a captura na hora (`onDepleted`), que é o mesmo contrato do app atual.
 *
 * O preço disso é que as primeiras linhas do ledger saem sem `sessionId`, o
 * porquê está em `useCoinTick`. E a retentativa NÃO cobra de novo: os minutos
 * já foram pagos quando o microfone estava aberto.
 *
 * ## O que esta tela ainda NÃO faz
 *
 * **Não passa de ~44 minutos.** `/api/transcribe` recusa acima de 8 MB, o que a
 * 24 kbps (ver `useAudioCapture`) dá cerca de 44 minutos num arquivo só. Acima
 * disso o POST volta 413. A diferença é que agora isso não custa a gravação:
 * ela fica guardada e o arquivo pode ser baixado enquanto o fatiamento não
 * existe. Um sermão de uma hora ainda precisa dele.
 *
 * **Não protege quem fecha a aba NO MEIO da pregação.** A cópia local nasce no
 * stop, porque é só ali que o `MediaRecorder` vira arquivo: antes disso o áudio
 * está dentro dele, e não existe em forma nenhuma que dê para guardar. Uma aba
 * morta aos 40 minutos perde os 40 minutos, e nenhum IndexedDB conserta isso —
 * quem conserta é o fatiamento, que transforma a gravação em pedaços que podem
 * ser guardados enquanto ela acontece. Até lá, `useUnloadGuard` pergunta antes
 * de sair, que é a proteção possível.
 *
 * ## A onda
 *
 * Treze barras arredondadas, crescendo a partir do centro. Elas são desenhadas
 * uma vez e, daí em diante, quem mexe nelas é o laço de áudio escrevendo
 * `style.height` direto no DOM, nunca o React (ver `useAudioCapture`).
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
type Phase = "capture" | "creating" | "transcribing" | "summarizing";

const PHASE_LABEL: Record<Exclude<Phase, "capture">, string> = {
  creating: "Guardando a gravação…",
  transcribing: "Transcrevendo o áudio…",
  summarizing: "Montando o resumo…",
};

/**
 * Quanto tempo uma gravação pendente sobrevive no aparelho: 30 dias.
 *
 * É muito mais que as 24h do `chunk-store`, e a diferença é o que está em jogo.
 * Lá o que expira é um pedaço de 20 segundos, cuja perda é um buraco no meio de
 * uma transcrição; aqui é a pregação inteira de alguém, e a pessoa que não
 * conseguiu enviar no domingo pode perfeitamente só reabrir o app no domingo
 * seguinte. O custo de guardar é espaço em disco do próprio aparelho; o custo
 * de apagar cedo demais é definitivo.
 */
const CAPTURE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

export function AudioStudio({ autoStart = false }: { autoStart?: boolean }) {
  const router = useRouter();
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const startedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("capture");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [depleted, setDepleted] = useState(false);

  /**
   * A gravação que existe e ainda não virou resumo: a que acabou de ser parada,
   * a que falhou no envio, ou a que foi encontrada no aparelho na montagem.
   *
   * Ela é ESTADO, e não um `ref`, porque é ela que decide o que a tela mostra.
   * E ela segura o `Blob`, o que significa que a referência ao áudio sobrevive
   * ao `catch` do envio — era exatamente isso que faltava.
   */
  const [pending, setPending] = useState<PendingCapture | null>(null);
  /** Quantas pendentes existem ao todo. Some que existe uma segunda gravação
   * parada seria repetir o defeito que esta tela veio consertar. */
  const [pendingCount, setPendingCount] = useState(0);
  /** `false` quando o IndexedDB recusou a cópia. A tela avisa, porque aí fechar
   * a aba perde de verdade. */
  const [persisted, setPersisted] = useState(true);
  /** Só depois de varrer o aparelho é que o `?auto=1` pode abrir o microfone. */
  const [scanned, setScanned] = useState(false);

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

  const { state, error, setError, start, pause, resume, stop, discard } = useAudioCapture({
    onLevels: paintLevels,
  });
  const idle = state === "idle";
  const busy = phase !== "capture";
  const rescuing = !busy && pending !== null;

  // O único buraco que a cópia no aparelho NÃO tapa: enquanto o microfone está
  // aberto, o áudio ainda é um `MediaRecorder` em andamento, e ele só vira
  // arquivo no `stop()`. Fechar a aba no meio da pregação perde tudo, e não há
  // o que guardar antes disso sem fatiar (ver as dívidas no cabeçalho). Até lá,
  // perguntar antes de sair é a proteção possível — é o mesmo guarda das telas
  // de gravação do app de hoje.
  //
  // Ele vale também para a fase de envio: sair no meio do POST não perde o
  // áudio (ele está no IndexedDB), mas perde o progresso e assusta à toa.
  useUnloadGuard(state === "recording" || state === "paused" || busy);

  // Saldo acabando PAUSA, não encerra. Encerrar jogaria fora o que já foi
  // gravado (e já foi pago); pausado, quem comprar moedas numa outra aba
  // retoma de onde parou, e quem não comprar ainda pode parar e ficar com o
  // resumo do que gravou até ali. É o mesmo contrato do `useCoinGuard` do app.
  useCoinTick({
    enabled: state === "recording",
    reason: "audio_only_minute",
    sessionId: null,
    onDepleted: () => {
      setDepleted(true);
      pause();
    },
  });

  // Varre o aparelho na montagem: uma gravação que ficou pendente de uma visita
  // anterior (o envio falhou e a aba foi fechada) é encontrada aqui e devolvida
  // ao dono. Sem esta varredura o IndexedDB seria um cofre sem chave.
  useEffect(() => {
    let alive = true;
    void (async () => {
      await deleteExpiredCaptures(CAPTURE_TTL_MS);
      const rows = await listCaptures();
      if (!alive) return;
      if (rows.length > 0) {
        setPending(rows[0]);
        setPendingCount(rows.length);
      }
      setScanned(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Chegando pelo `?auto=1` (o botão do `/v2/home`) o microfone abre sozinho.
  // O `startedRef` não é paranoia: em desenvolvimento o React monta, desmonta e
  // remonta cada componente uma vez para caçar efeito impuro, e sem a trava
  // isso abriria DOIS microfones, dos quais um ficaria órfão.
  //
  // Uma gravação pendente SEGURA o automático: abrir o microfone por cima do
  // painel de resgate esconderia, atrás da onda, a única tela que ainda oferece
  // de volta o que não foi enviado.
  useEffect(() => {
    if (!autoStart || !scanned || pending || startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [autoStart, scanned, pending, start]);

  /**
   * Os três passos de rede, a partir de uma gravação já guardada no aparelho.
   *
   * É o mesmo caminho no envio original e na retentativa, e por isso ele começa
   * conferindo o `sessionId`: se a sessão já nasceu numa tentativa anterior, ela
   * é REUSADA. Criar outra a cada tentativa encheria a biblioteca de linhas
   * vazias em "Em aberto", uma por vez que a rede caiu.
   */
  const runUpload = useCallback(
    async (capture: PendingCapture) => {
      let current = capture;
      setError(null);
      try {
        let sessionId = current.sessionId;
        if (!sessionId) {
          setPhase("creating");
          const created = await requestCreateSession({ mode: "audio_only" });
          if ("error" in created)
            throw new Error(`Não consegui criar a gravação: ${created.error}`);
          sessionId = created.id;
          current = { ...current, sessionId };
          setPending(current);
          await patchCapture(current.id, { sessionId });
        }

        setPhase("transcribing");
        const text = await transcribeWhole(current, sessionId);

        setPhase("summarizing");
        const summary = await requestFinalSummary({
          sessionId,
          text,
          feedItems: [],
          durationMs: Math.round(current.durationMs),
        });
        if (!summary) throw new Error("Não consegui montar o resumo desta gravação.");

        // O resumo está no banco: só AGORA a cópia local deixa de ser a única
        // coisa que existe, e só agora ela pode morrer.
        await deleteCapture(current.id);
        setPending(null);
        setPendingCount((n) => Math.max(0, n - 1));
        router.push(`/v2/summary/${sessionId}`);
      } catch (err) {
        const attempts = current.attempts + 1;
        await patchCapture(current.id, { attempts });
        setPending({ ...current, attempts });
        setPhase("capture");
        setError((err as Error).message);
      }
    },
    [router, setError]
  );

  async function finish() {
    const captured = await stop();
    if (!captured) {
      setError("Não deu tempo de gravar nada. Tente de novo.");
      return;
    }
    const entry: PendingCapture = {
      id: crypto.randomUUID(),
      blob: captured.blob,
      extension: captured.extension,
      durationMs: captured.durationMs,
      createdAt: Date.now(),
      sessionId: null,
      attempts: 0,
    };
    // Nesta ordem, e a ordem é o conserto: o áudio vira estado e vira registro
    // no aparelho ANTES de existir a primeira chance de dar errado.
    setPending(entry);
    setPendingCount((n) => n + 1);
    const saved = await putCapture(entry);
    setPersisted(saved);
    await runUpload(entry);
  }

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
        ) : rescuing && pending ? (
          <RescueNotice
            capture={pending}
            count={pendingCount}
            persisted={persisted}
            error={error}
          />
        ) : depleted ? (
          <p role="alert" className="max-w-xs text-center text-sm font-light text-v2-ink-soft">
            Suas moedas acabaram e a gravação foi pausada. Você ainda pode parar e ficar com o
            resumo do que gravou até aqui.
          </p>
        ) : error ? (
          <p role="alert" className="max-w-xs text-center text-sm font-light text-v2-ink-mute">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center justify-center gap-6">
          {busy ? null : rescuing && pending ? (
            <>
              {/* Baixar vem ANTES de tentar de novo, e do mesmo tamanho do
                  principal, porque é o único dos três que não depende de nada
                  dar certo: a rede pode continuar fora, a rota pode continuar
                  recusando o tamanho, e o arquivo sai do aparelho do mesmo
                  jeito. É a saída que faltava no dia em que uma palestra se
                  perdeu. */}
              <button
                type="button"
                onClick={() => downloadCapture(pending)}
                aria-label="Baixar o áudio"
                className="inline-flex size-14 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                <Download className="size-5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => void runUpload(pending)}
                aria-label="Tentar enviar de novo"
                className="inline-flex size-24 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                <RotateCw className="size-8" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDrop(true)}
                aria-label="Apagar esta gravação"
                className="inline-flex size-14 items-center justify-center rounded-full bg-v2-card text-v2-ink-mute transition-colors hover:bg-v2-card-hover hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                <Trash2 className="size-5" strokeWidth={1.75} />
              </button>
            </>
          ) : idle ? (
            <button
              type="button"
              onClick={start}
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
                  if (state !== "paused") return pause();
                  // Sem saldo o "Retomar" não retoma: ele manda comprar. Deixar
                  // o botão voltar a capturar daria minutos de graça até o
                  // próximo tick falhar de novo.
                  if (depleted) return;
                  resume();
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
                onClick={finish}
                aria-label="Parar"
                className="inline-flex size-24 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                <Square className="size-8 fill-current" strokeWidth={0} />
              </button>
              {/* Apagar PERGUNTA. Não porque algo será destruído no servidor (não
                  há nada lá ainda), mas porque o que se perde é a única cópia do
                  que foi dito, e ela não volta de lugar nenhum. */}
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

        {/* A saída do painel de resgate. Discreta porque é a escolha rara, mas
            presente porque a alternativa é trancar do lado de fora quem tem uma
            gravação emperrada e uma pregação começando agora. A pendente NÃO é
            descartada: ela continua no aparelho, esperando. */}
        {rescuing ? (
          <button
            type="button"
            onClick={() => {
              setPending(null);
              setError(null);
            }}
            className="text-sm font-light text-v2-ink-mute underline-offset-4 transition-colors hover:text-v2-ink-soft hover:underline"
          >
            Gravar outra agora
          </button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Apagar esta gravação?"
        description="O áudio gravado até aqui é descartado e nada é salvo. Não dá para desfazer."
        confirmLabel="Apagar"
        onConfirm={() => {
          discard();
          router.push("/v2/home");
        }}
      />

      <ConfirmDialog
        open={confirmDrop}
        onOpenChange={setConfirmDrop}
        title="Apagar a gravação que não foi enviada?"
        description="Este é o único arquivo desta gravação. Apagando, ele some do aparelho e não volta. Se ainda não baixou o áudio, baixe antes."
        confirmLabel="Apagar"
        onConfirm={async () => {
          if (pending) await deleteCapture(pending.id);
          setPending(null);
          setPendingCount((n) => Math.max(0, n - 1));
          setError(null);
        }}
      />
    </>
  );
}

/**
 * O texto do painel de resgate: o que existe, por que parou e o que dá para
 * fazer.
 *
 * Ele diz a DURAÇÃO da gravação antes de qualquer outra coisa. Quem chega aqui
 * depois de uma hora de pregação precisa primeiro saber que o que gravou não
 * sumiu; o motivo da falha é a segunda pergunta, não a primeira.
 */
function RescueNotice({
  capture,
  count,
  persisted,
  error,
}: {
  capture: PendingCapture;
  count: number;
  persisted: boolean;
  error: string | null;
}) {
  const duration = formatDurationLong(capture.durationMs);
  return (
    <div role="alert" className="flex max-w-xs flex-col gap-2 text-center">
      <p className="text-sm font-light text-v2-ink-soft">
        {duration
          ? `Sua gravação de ${duration} está guardada neste aparelho e ainda não foi enviada.`
          : "Sua gravação está guardada neste aparelho e ainda não foi enviada."}
      </p>
      {error ? <p className="text-sm font-light text-v2-ink-mute">{error}</p> : null}
      {!persisted ? (
        <p className="text-sm font-light text-v2-ink-mute">
          Não consegui guardar uma cópia no armazenamento deste navegador, então ela existe só
          enquanto esta aba estiver aberta. Baixe o áudio antes de sair.
        </p>
      ) : null}
      {count > 1 ? (
        <p className="text-sm font-light text-v2-ink-mute">
          Há {count} gravações esperando. Resolvendo esta, a próxima aparece aqui.
        </p>
      ) : null}
      {capture.attempts > 1 ? (
        <p className="text-sm font-light text-v2-ink-mute">
          {capture.attempts} tentativas até aqui. Se não passar, baixe o áudio para não depender
          desta tela.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Entrega o arquivo a quem gravou.
 *
 * É a única ação desta tela que não depende de rede, de saldo nem de a rota
 * aceitar o tamanho, e por isso ela é a garantia de último recurso: o que foi
 * dito sai do aparelho de um jeito que o resto do sistema não pode estragar.
 *
 * O `revokeObjectURL` é adiado porque revogar no mesmo quadro do clique cancela
 * o download em alguns navegadores, que ainda nem começaram a ler a URL.
 */
function downloadCapture(capture: PendingCapture) {
  const stamp = new Date(capture.createdAt)
    .toLocaleString("sv-SE")
    .replace(/[: ]/g, "-")
    .slice(0, 16);
  const url = URL.createObjectURL(capture.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `scriba-${stamp}.${capture.extension}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * O áudio inteiro num POST só para `/api/transcribe`.
 *
 * A rota nasceu para chunks de 15-20s e continua a mesma: o que muda aqui é que
 * `chunkIndex` é sempre 0 e não há `prevText`, porque não existe pedaço anterior
 * para dar contexto ao modelo. O 413 tem mensagem própria porque é o limite que
 * esta tela encosta primeiro (ver o cabeçalho do componente).
 */
async function transcribeWhole(
  capture: Pick<PendingCapture, "blob" | "extension" | "durationMs">,
  sessionId: string
): Promise<string> {
  const form = new FormData();
  form.append("file", capture.blob, `gravacao.${capture.extension}`);
  form.append("extension", capture.extension);
  form.append("chunkIndex", "0");
  form.append("sessionId", sessionId);
  form.append("durationMs", String(Math.round(capture.durationMs)));

  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  if (res.status === 413) {
    throw new Error(
      "A gravação ficou grande demais para transcrever de uma vez (o limite hoje é cerca de 44 minutos). O áudio não foi perdido: baixe o arquivo por enquanto."
    );
  }
  if (!res.ok) {
    const raw = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`Não consegui transcrever o áudio: ${raw.error ?? `HTTP ${res.status}`}`);
  }
  const raw = (await res.json()) as { text?: string };
  const text = (raw.text ?? "").trim();
  if (!text) throw new Error("A transcrição voltou vazia, não consegui ouvir nada no áudio.");
  return text;
}
