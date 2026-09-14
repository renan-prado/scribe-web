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
import { tailSentences } from "@/features/session/lib/text";
import {
  type CaptureMeta,
  deleteCapture,
  deleteExpiredCaptures,
  listCaptures,
  loadParts,
  patchCaptureMeta,
  putCaptureMeta,
  putFragment,
} from "@/lib/capture-store";
import { cn } from "@/lib/utils";
import { useClockScope } from "./ClockScope";
import { useAudioCapture, WAVE_BARS } from "./useAudioCapture";

/**
 * O gravador do v2.
 *
 * **Uma gravação, uma transcrição.** O app de hoje transcreve a cada 15-20s
 * porque o feed ao vivo precisa do texto na hora; aqui não há feed, e fazer o
 * mesmo custaria ~206 chamadas por hora de sermão para entregar o mesmo resumo.
 *
 * O áudio é fatiado mesmo assim, mas por outro motivo e em outra escala: um
 * fragmento a cada 2 minutos, guardado no IndexedDB na hora, para que nada se
 * perca se a aba morrer. No stop os fragmentos são concatenados de volta e o
 * que sobe é o arquivo inteiro (ver `useAudioCapture` e `lib/capture-store`).
 *
 * Só quando o arquivo encosta no teto de `/api/transcribe` (8 MB, uns 46
 * minutos a 24 kbps) é que ele vira DUAS partes, e aí são duas chamadas. 40
 * minutos: uma. 60 minutos: duas. Nunca duzentas.
 *
 * ## A ordem do stop
 *
 * O áudio já está guardado antes de qualquer chamada de rede — foi guardado
 * durante a pregação. Então o stop é só: cria a sessão, transcreve as partes em
 * ordem, resume, e só aí apaga a cópia local. Se qualquer passo falhar, o áudio
 * continua no aparelho e a tela oferece tentar de novo ou baixar o arquivo.
 *
 * Isso é o conserto do defeito que custou uma palestra de quase uma hora: o
 * `Blob` vivia numa variável local, a falha de rede caía num `catch` que
 * mostrava um aviso educado, e o coletor comia a única cópia do que foi dito.
 *
 * ## O que ainda NÃO faz
 *
 * Começar sem internet. A gravação em si não depende de rede, mas a sessão
 * nasce de um `POST` no stop — sem ele o áudio fica guardado e esperando, que é
 * bem melhor do que sumir, mas não é o mesmo que funcionar offline.
 */
type Phase = "capture" | "creating" | "transcribing" | "summarizing";

const PHASE_LABEL: Record<Exclude<Phase, "capture">, string> = {
  creating: "Guardando a gravação…",
  transcribing: "Transcrevendo o áudio…",
  summarizing: "Montando o resumo…",
};

const CAPTURE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

export function AudioStudio({ autoStart = false }: { autoStart?: boolean }) {
  const router = useRouter();
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const startedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("capture");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [depleted, setDepleted] = useState(false);
  const [scanned, setScanned] = useState(false);

  /** A gravação guardada e ainda não transcrita: a que acabou de parar, a que
   * falhou no envio, ou a que ficou de uma visita anterior. */
  const [pending, setPending] = useState<CaptureMeta | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  /** `false` quando o IndexedDB recusou os fragmentos: a gravação corre sem
   * rede de segurança e a tela precisa dizer isso. */
  const [persisted, setPersisted] = useState(true);

  const captureIdRef = useRef<string | null>(null);
  /** Os `putFragment` em andamento. O stop espera por eles antes de remontar,
   * senão o último fragmento pode não estar no banco ainda. */
  const writesRef = useRef<Set<Promise<void>>>(new Set());

  const paintLevels = useCallback((levels: Float32Array) => {
    for (let i = 0; i < levels.length; i++) {
      const bar = barsRef.current[i];
      if (!bar) continue;
      bar.style.height = `${14 + levels[i] * 154}px`;
    }
  }, []);

  // O relógio do cabeçalho lê daqui (ver `ClockScope`): a origem é dele, e este
  // hook só a move.
  const { startedAtRef, setRunning, setVisible } = useClockScope();

  const { state, error, setError, start, pause, resume, stop, discard } = useAudioCapture({
    startedAtRef,
    onLevels: paintLevels,
    onFragment: ({ part, seq, blob }) => {
      const id = captureIdRef.current;
      if (!id) return;
      const set = writesRef.current;
      const write: Promise<void> = putFragment({ captureId: id, part, seq, blob })
        .then((ok) => {
          if (!ok) setPersisted(false);
        })
        .finally(() => set.delete(write));
      set.add(write);
    },
  });

  const idle = state === "idle";
  const busy = phase !== "capture";
  const capturing = state === "recording" || state === "paused";
  const rescuing = !busy && !capturing && pending !== null;

  useUnloadGuard(capturing || busy);

  // O relógio corre gravando, congela na pausa e some ao voltar ao repouso.
  useEffect(() => {
    setRunning(state === "recording");
    if (capturing) setVisible(true);
    else if (idle && !busy) setVisible(false);
  }, [state, capturing, idle, busy, setRunning, setVisible]);

  useCoinTick({
    enabled: state === "recording",
    reason: "recording_minute",
    sessionId: null,
    onDepleted: () => {
      setDepleted(true);
      pause();
    },
  });

  // Uma gravação que ficou de outra visita é encontrada aqui e devolvida.
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

  const begin = useCallback(async () => {
    const id = crypto.randomUUID();
    captureIdRef.current = id;
    setPersisted(true);
    if (!(await start())) captureIdRef.current = null;
  }, [start]);

  /**
   * Sobe as partes em ordem e devolve a transcrição inteira.
   *
   * O `prevText` de uma parte é a cauda da anterior: é o que dá contexto ao
   * modelo na emenda, que já caiu num silêncio (ver `useAudioCapture`).
   */
  const transcribeParts = useCallback(async (meta: CaptureMeta, sessionId: string) => {
    const parts = await loadParts(meta.id, meta.mimeType);
    if (parts.length === 0) throw new Error("Não encontrei o áudio guardado desta gravação.");
    const texts: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const form = new FormData();
      form.append("file", parts[i], `gravacao-${i}.${meta.extension}`);
      form.append("extension", meta.extension);
      form.append("chunkIndex", String(i));
      form.append("sessionId", sessionId);
      form.append("durationMs", String(Math.round(meta.durationMs / parts.length)));
      if (i > 0) form.append("prevText", tailSentences(texts.join(" "), 2));

      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (res.status === 413) {
        throw new Error(
          "Uma parte da gravação ficou grande demais para a transcrição. O áudio não foi perdido: baixe o arquivo."
        );
      }
      if (!res.ok) {
        const raw = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(`Não consegui transcrever o áudio: ${raw.error ?? `HTTP ${res.status}`}`);
      }
      const raw = (await res.json()) as { text?: string };
      texts.push((raw.text ?? "").trim());
    }
    const transcript = texts.join(" ").replace(/\s+/g, " ").trim();
    if (!transcript)
      throw new Error("A transcrição voltou vazia, não consegui ouvir nada no áudio.");
    return transcript;
  }, []);

  /** Sessão → transcrição → resumo. Mesmo caminho no envio original e na
   * retentativa, por isso ele confere o `sessionId` antes de criar outro. */
  const upload = useCallback(
    async (meta: CaptureMeta) => {
      let current = meta;
      setError(null);
      try {
        let sessionId = current.sessionId;
        if (!sessionId) {
          setPhase("creating");
          const created = await requestCreateSession({ mode: "audio" });
          if ("error" in created)
            throw new Error(`Não consegui criar a gravação: ${created.error}`);
          sessionId = created.id;
          current = { ...current, sessionId };
          setPending(current);
          await patchCaptureMeta(current.id, { sessionId });
        }

        setPhase("transcribing");
        const text = await transcribeParts(current, sessionId);

        setPhase("summarizing");
        const summary = await requestFinalSummary({
          sessionId,
          text,
          durationMs: current.durationMs,
        });
        if (!summary) throw new Error("Não consegui montar o resumo desta gravação.");

        await deleteCapture(current.id);
        setPending(null);
        setPendingCount((n) => Math.max(0, n - 1));
        router.push(`/v2/summary/${sessionId}`);
      } catch (err) {
        const attempts = current.attempts + 1;
        await patchCaptureMeta(current.id, { attempts });
        setPending({ ...current, attempts });
        setPhase("capture");
        setError((err as Error).message);
      }
    },
    [router, setError, transcribeParts]
  );

  async function finish() {
    const id = captureIdRef.current;
    const result = await stop();
    if (!id || !result) {
      setError("Não deu tempo de gravar nada. Tente de novo.");
      return;
    }
    // Os fragmentos precisam estar no banco ANTES de remontar o arquivo.
    await Promise.allSettled([...writesRef.current]);
    const meta: CaptureMeta = {
      id,
      sessionId: null,
      mimeType: result.mimeType,
      extension: result.extension,
      durationMs: result.durationMs,
      parts: result.parts,
      createdAt: Date.now(),
      attempts: 0,
    };
    const saved = await putCaptureMeta(meta);
    if (!saved) setPersisted(false);
    captureIdRef.current = null;
    setPending(meta);
    setPendingCount((n) => n + 1);
    await upload(meta);
  }

  useEffect(() => {
    if (!autoStart || !scanned || pending || startedRef.current) return;
    startedRef.current = true;
    void begin();
  }, [autoStart, scanned, pending, begin]);

  return (
    <>
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
          <div role="alert" className="flex max-w-xs flex-col gap-2 text-center">
            <p className="text-sm font-light text-v2-ink-soft">
              {formatDurationLong(pending.durationMs)
                ? `Sua gravação de ${formatDurationLong(pending.durationMs)} está guardada neste aparelho e ainda não foi transcrita.`
                : "Sua gravação está guardada neste aparelho e ainda não foi transcrita."}
            </p>
            {error ? <p className="text-sm font-light text-v2-ink-mute">{error}</p> : null}
            {!persisted ? (
              <p className="text-sm font-light text-v2-ink-mute">
                Não consegui guardar uma cópia no armazenamento deste navegador. Baixe o áudio antes
                de sair desta tela.
              </p>
            ) : null}
            {pendingCount > 1 ? (
              <p className="text-sm font-light text-v2-ink-mute">
                Há {pendingCount} gravações esperando. Resolvendo esta, a próxima aparece aqui.
              </p>
            ) : null}
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
        ) : !persisted && capturing ? (
          <p role="alert" className="max-w-xs text-center text-sm font-light text-v2-ink-mute">
            Este navegador não está guardando cópia da gravação. Ela existe só enquanto esta tela
            estiver aberta.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center justify-center gap-6">
          {busy ? null : rescuing && pending ? (
            <>
              {/* Baixar é a única ação que não depende de nada dar certo: a
                  rede pode continuar fora e o arquivo sai do aparelho assim
                  mesmo. É a saída que faltava no dia em que uma palestra se
                  perdeu. */}
              <button
                type="button"
                onClick={() => void downloadCapture(pending)}
                aria-label="Baixar o áudio"
                className="inline-flex size-14 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                <Download className="size-5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => void upload(pending)}
                aria-label="Tentar de novo"
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
                  if (state !== "paused") return pause();
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
              <button
                type="button"
                onClick={() => void finish()}
                aria-label="Parar"
                className="inline-flex size-24 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
              >
                <Square className="size-8 fill-current" strokeWidth={0} />
              </button>
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
        onConfirm={async () => {
          discard();
          const id = captureIdRef.current;
          captureIdRef.current = null;
          if (id) await deleteCapture(id);
          router.push("/v2/home");
        }}
      />

      <ConfirmDialog
        open={confirmDrop}
        onOpenChange={setConfirmDrop}
        title="Apagar a gravação que não foi transcrita?"
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
 * Entrega o arquivo a quem gravou, uma parte por vez.
 *
 * Não depende de rede, de saldo nem de a rota aceitar o tamanho, e por isso é a
 * garantia de último recurso: o que foi dito sai do aparelho de um jeito que o
 * resto do sistema não pode estragar.
 */
async function downloadCapture(meta: CaptureMeta) {
  const parts = await loadParts(meta.id, meta.mimeType);
  const stamp = new Date(meta.createdAt).toLocaleString("sv-SE").replace(/[: ]/g, "-").slice(0, 16);
  parts.forEach((blob, i) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      parts.length > 1
        ? `scriba-${stamp}-parte${i + 1}.${meta.extension}`
        : `scriba-${stamp}.${meta.extension}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // Revogar no mesmo quadro cancela o download em alguns navegadores.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
}
