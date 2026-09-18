"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AUDIO_CONSTRAINTS, pickMime, reportTrackSettings } from "@/lib/audio-constraints";
import { BIBLO_VOICE_MAX_MS, type BibloVoiceTurn } from "@/lib/domain/biblo";
import { createLogger } from "@/lib/log";
import { useElapsedTimer } from "./useElapsedTimer";

const log = createLogger("biblo-voice");

/**
 * Mesma taxa do gravador principal (`AUDIO_BITS_PER_SECOND` em
 * `useAudioCapture.ts`): fala em 24 kbps transcreve igual, e o que muda é o
 * tamanho do upload. Aqui isso importa em dobro, é o que mantém o arquivo bem
 * abaixo do teto de bytes da rota mesmo em 60s cheios.
 */
const VOICE_BITS_PER_SECOND = 24_000;

export type BibloVoiceCaptureState = "idle" | "recording" | "transcribing";

/**
 * O recado falado do composer: um `MediaRecorder`, um blob, um POST.
 *
 * **Não reusa `useAudioCapture.ts`.** Aquele hook existe para uma hora de
 * sermão: fragmenta a cada 2 minutos para não perder áudio, corta em partes
 * de ~7 MB e desenha uma onda de 13 barras. Um recado de até
 * `BIBLO_VOICE_MAX_MS` não precisa de nada disso. O que os dois dividem,
 * `AUDIO_CONSTRAINTS` e `pickMime`, mora em `lib/audio-constraints.ts`.
 *
 * O texto que volta cai no CAMPO da gaveta, nunca é enviado sozinho: quem
 * chama recebe o texto por `onTranscribed` e decide o que fazer com ele. Ver
 * `docs/biblo-implementacao.md` §14.
 */
export function useBibloVoice({
  sessionId,
  ensureSession,
  onTranscribed,
}: {
  sessionId: string;
  /** Ver `BibloDrawer`. Ausente onde a sessão já existe (`/summary/:id`). */
  ensureSession?: () => Promise<string | null>;
  onTranscribed: (text: string, balance: number | null) => void;
}) {
  const [state, setState] = useState<BibloVoiceCaptureState>("idle");
  const [error, setError] = useState<string | null>(null);
  // `true` só para "insuficiente" e "plano": os dois casos em que a próxima
  // ação certa é abrir o `BillingDialog`, não só tentar de novo.
  const [showBilling, setShowBilling] = useState(false);
  // Falso até o efeito confirmar suporte no NAVEGADOR: computar isto no corpo
  // do componente divergiria entre o HTML do servidor (sempre sem
  // `MediaRecorder`) e o do cliente, hidratação incompatível pelo mesmo motivo
  // documentado em `useIsStandalone`.
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(pickMime() !== null), []);

  const startedAtRef = useRef(0);
  const elapsedMs = useElapsedTimer(state === "recording", startedAtRef);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<{ mime: string; extension: string } | null>(null);
  const autoStopRef = useRef<number | null>(null);

  const releaseStream = useCallback(() => {
    for (const t of streamRef.current?.getTracks() ?? []) t.stop();
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  // Some sem upload nenhum: fechar a gaveta no meio de uma gravação não pode
  // deixar o microfone aberto nem mandar um recado que ninguém confirmou.
  useEffect(
    () => () => {
      if (autoStopRef.current !== null) window.clearTimeout(autoStopRef.current);
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.ondataavailable = null;
        rec.onstop = null;
        rec.stop();
      }
      releaseStream();
    },
    [releaseStream]
  );

  const finishRecording = useCallback(async (): Promise<Blob | null> => {
    const rec = recorderRef.current;
    const picked = mimeRef.current;
    if (!rec || rec.state === "inactive" || !picked) return null;
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
    });
    if (chunksRef.current.length === 0) return null;
    return new Blob(chunksRef.current, { type: picked.mime });
  }, []);

  const stop = useCallback(async () => {
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    // O guarda é o RECORDER, não `state`: esta função é chamada de dois
    // lugares (o toque e o `setTimeout` do teto), e o teto é armado dentro de
    // `start`, antes do primeiro re-render que traria um `state` fresco. Uma
    // guarda por `state` fecharia sobre "idle" para sempre e o teto nunca
    // pararia nada.
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    const startedAt = startedAtRef.current;
    const picked = mimeRef.current;
    setState("transcribing");
    const blob = await finishRecording();
    releaseStream();

    if (!blob || blob.size === 0) {
      setState("idle");
      setError("Não peguei nenhum áudio. Tente de novo.");
      return;
    }

    try {
      const id = ensureSession ? await ensureSession() : sessionId;
      if (!id) {
        setState("idle");
        setError("Não consegui salvar a sessão. Tente de novo.");
        return;
      }

      const form = new FormData();
      const extension = picked?.extension ?? "webm";
      form.append("file", blob, `voice.${extension}`);
      form.append("sessionId", id);
      form.append("extension", extension);
      form.append("durationMs", String(Math.round(performance.now() - startedAt)));

      const res = await fetch("/api/biblo/voice", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as BibloVoiceTurn | null;

      if (!res.ok || !body?.ok) {
        setState("idle");
        setError(voiceErrorMessage(body));
        setShowBilling(
          !!body &&
            !body.ok &&
            "reason" in body &&
            (body.reason === "insufficient_balance" || body.reason === "plan")
        );
        return;
      }

      setState("idle");
      setShowBilling(false);
      onTranscribed(body.text, body.balance);
    } catch (err) {
      log.error("upload falhou", { error: String(err) });
      setState("idle");
      setError("Não consegui transcrever agora. Tente de novo.");
    }
  }, [finishRecording, releaseStream, ensureSession, sessionId, onTranscribed]);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    setShowBilling(false);
    const picked = pickMime();
    if (!picked) {
      setError("Este navegador não grava áudio. Tente pelo Chrome, Safari ou Edge.");
      return false;
    }
    mimeRef.current = picked;
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
      } catch (err) {
        // Algumas WebViews recusam o objeto de constraints inteiro em vez de
        // ignorar o que não conhecem. Mesma rede de `useAudioCapture.ts`.
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          throw err;
        }
      }
      streamRef.current = stream;
      reportTrackSettings(stream);

      chunksRef.current = [];
      const rec = new MediaRecorder(stream, {
        mimeType: picked.mime,
        audioBitsPerSecond: VOICE_BITS_PER_SECOND,
      });
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorderRef.current = rec;
      rec.start();
      startedAtRef.current = performance.now();
      setState("recording");
      // O TETO encerra sozinho: é o que torna o preço fixo defensável, ver
      // `BIBLO_VOICE_MAX_MS`.
      autoStopRef.current = window.setTimeout(() => {
        void stop();
      }, BIBLO_VOICE_MAX_MS);
      return true;
    } catch (err) {
      releaseStream();
      setState("idle");
      setError(
        err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "SecurityError")
          ? "Sem permissão para usar o microfone. Libere o acesso e tente de novo."
          : "Não consegui abrir o microfone neste aparelho."
      );
      return false;
    }
  }, [releaseStream, stop]);

  return { state, elapsedMs, supported, error, showBilling, start, stop };
}

function voiceErrorMessage(body: BibloVoiceTurn | null): string {
  if (!body || body.ok) return "Não consegui transcrever agora. Tente de novo.";
  if (body.error === "empty_transcription") {
    return "Não entendi nada no áudio. Tente falar mais perto do microfone.";
  }
  if ("reason" in body) {
    switch (body.reason) {
      case "plan":
        return "A voz é um recurso dos planos pagos.";
      case "insufficient_balance":
        return "Seus créditos acabaram.";
      case "disabled":
        return "Estou em manutenção por aqui. Volte daqui a pouco.";
      case "revoked":
        return "Não consigo transcrever nesta conta.";
    }
  }
  return "Não consegui transcrever agora. Tente de novo.";
}
