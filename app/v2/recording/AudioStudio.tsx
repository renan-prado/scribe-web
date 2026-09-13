"use client";

import { Pause, Play, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MicGlyph } from "@/components/icons/MicGlyph";
import { ConfirmDialog } from "@/features/session/components/ConfirmDialog";
import { useCoinTick } from "@/features/session/hooks/useCoinTick";
import { requestCreateSession, requestFinalSummary } from "@/features/session/lib/api";
import { cn } from "@/lib/utils";
import { type Capture, useAudioCapture, WAVE_BARS } from "./useAudioCapture";

/**
 * O gravador do v2: a onda do microfone, três controles e nada mais na tela.
 *
 * ## A ordem das coisas, que é o ponto desta tela
 *
 * Nada existe no servidor até o STOP. Não há sessão criada ao abrir, não há
 * áudio subindo durante a pregação, não há transcrição parcial. Quem grava tem
 * um arquivo na memória do aparelho e mais nada; quem desiste (o botão de
 * apagar) não deixa rastro nenhum para limpar depois.
 *
 * É o oposto do gravador do app atual, e de propósito: lá a sessão nasce antes
 * da primeira palavra porque o feed ao vivo precisa de uma linha para pendurar
 * os cartões. Aqui não há feed, então a linha só precisa existir quando houver
 * o que guardar nela.
 *
 * No stop, em sequência (e só então):
 *
 * 1. cria a sessão (`POST /api/sessions`, modo `audio_only`);
 * 2. manda o ÁUDIO INTEIRO, num POST só, para `/api/transcribe`;
 * 3. manda o texto para `/api/final-summary`, que grava transcrição e resumo
 *    na sessão e a encerra;
 * 4. abre `/v2/summary/:id`.
 *
 * Se um dos três falhar, a tela diz o que falhou e **não** avança. O áudio já
 * saiu da memória, e o que sobra no banco é coerente com o último passo que deu
 * certo: uma sessão criada e não encerrada aparece em "Em aberto" na
 * biblioteca, como qualquer gravação interrompida.
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
 * porquê está em `useCoinTick`.
 *
 * ## O que esta tela ainda NÃO faz
 *
 * **Não passa de ~44 minutos.** `/api/transcribe` recusa acima de 8 MB, o que a
 * 24 kbps (ver `useAudioCapture`) dá cerca de 44 minutos num arquivo só. Acima
 * disso o POST volta 413 e a tela diz isso. Um sermão de uma hora precisa de
 * fatiamento no servidor, que ainda não existe.
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

export function AudioStudio({ autoStart = false }: { autoStart?: boolean }) {
  const router = useRouter();
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const startedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("capture");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [depleted, setDepleted] = useState(false);

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

  // Chegando pelo `?auto=1` (o botão do `/v2/home`) o microfone abre sozinho.
  // O `startedRef` não é paranoia: em desenvolvimento o React monta, desmonta e
  // remonta cada componente uma vez para caçar efeito impuro, e sem a trava
  // isso abriria DOIS microfones, dos quais um ficaria órfão.
  useEffect(() => {
    if (!autoStart || startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [autoStart, start]);

  async function finish() {
    const capture = await stop();
    if (!capture) {
      setError("Não deu tempo de gravar nada. Tente de novo.");
      return;
    }
    try {
      setPhase("creating");
      const created = await requestCreateSession({ mode: "audio_only" });
      if ("error" in created) throw new Error(`Não consegui criar a gravação: ${created.error}`);

      setPhase("transcribing");
      const text = await transcribeWhole(capture, created.id);

      setPhase("summarizing");
      const summary = await requestFinalSummary({
        sessionId: created.id,
        text,
        feedItems: [],
        durationMs: Math.round(capture.durationMs),
      });
      if (!summary) throw new Error("Não consegui montar o resumo desta gravação.");

      router.push(`/v2/summary/${created.id}`);
    } catch (err) {
      setPhase("capture");
      setError((err as Error).message);
    }
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

      <div className="flex items-center justify-center gap-6">
        {busy ? null : idle ? (
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
    </>
  );
}

/**
 * O áudio inteiro num POST só para `/api/transcribe`.
 *
 * A rota nasceu para chunks de 15-20s e continua a mesma: o que muda aqui é que
 * `chunkIndex` é sempre 0 e não há `prevText`, porque não existe pedaço anterior
 * para dar contexto ao modelo. O 413 tem mensagem própria porque é o limite que
 * esta tela encosta primeiro (ver o cabeçalho do componente).
 */
async function transcribeWhole(capture: Capture, sessionId: string): Promise<string> {
  const form = new FormData();
  form.append("file", capture.blob, `gravacao.${capture.extension}`);
  form.append("extension", capture.extension);
  form.append("chunkIndex", "0");
  form.append("sessionId", sessionId);
  form.append("durationMs", String(Math.round(capture.durationMs)));

  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  if (res.status === 413) {
    throw new Error(
      "A gravação ficou grande demais para transcrever de uma vez (o limite hoje é cerca de 44 minutos)."
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
