"use client";

import { useEffect, useRef } from "react";
import { isReactNativeWebView, postNativeEvent } from "@/features/session/lib/nativeBridge";
import { createSilentWavUrl } from "@/features/session/lib/silentAudio";

type Args = {
  enabled: boolean;
  sessionId: string;
  label?: string;
  /** Fires when the user hits the media-session "stop"/"pause" hardware button. */
  onExternalStop?: () => void;
};

/**
 * Everything the web platform allows us to do to keep a recording alive while
 * the tab is backgrounded, the window is minimized, or the phone screen is
 * off. Combined with the native RN shell (when present), this covers:
 *
 *   1. **Silent audio loop** through a hidden `<audio>` element. Because the
 *      element counts as "actively playing media", Chromium/WebKit:
 *        - stop throttling `setInterval` / `setTimeout` in the tab,
 *        - keep AudioContexts running,
 *        - surface lock-screen media controls on Android,
 *        - resist killing the tab under memory pressure.
 *      The audio is a 2s zero-sample WAV generated in-memory (see
 *      `createSilentWavUrl`) and looped.
 *
 *   2. **Media Session metadata + `playbackState = "playing"`**. Android
 *      Chrome exposes a persistent notification with these fields; the
 *      notification itself keeps the browser process ranked as a foreground
 *      audio user, which is what actually prevents the OS from killing it
 *      under memory pressure.
 *
 *   3. **React Native bridge**. If we're inside a WebView, we tell the shell
 *      to start/stop its own foreground service so the mic stream stays alive
 *      even when the app is fully backgrounded or the screen is locked.
 *      Desktop/mobile browsers ignore this entirely.
 *
 *   4. **Watchdog re-play**. Some browsers pause `<audio>` on backgrounding —
 *      we listen for `pause` / `visibilitychange` and immediately kick it back
 *      into playback while the caller still wants us running.
 *
 * On iOS Safari (not the RN shell), background mic capture is blocked at the
 * platform layer (WebKit bug 226620) and no web trick can defeat it — this
 * hook still runs but its only iOS benefit is timer-throttling relief while
 * the tab is merely unfocused, not backgrounded.
 */
export function useBackgroundKeepalive({ enabled, sessionId, label, onExternalStop }: Args): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const externalStopRef = useRef<Args["onExternalStop"]>(onExternalStop);

  useEffect(() => {
    externalStopRef.current = onExternalStop;
  }, [onExternalStop]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    startedAtRef.current = Date.now();

    const url = createSilentWavUrl(2);
    urlRef.current = url;

    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 1; // silence — value doesn't matter, but 1 keeps OSes happy
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("aria-hidden", "true");
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const tryPlay = () => {
      audio.play().catch(() => {
        // iOS Safari may reject if the user gesture chain was consumed by
        // getUserMedia. We retry on the next visibility change / user gesture.
      });
    };
    tryPlay();

    const onPause = () => {
      // Something (backgrounding, headphone unplug, another tab) paused us —
      // if the caller still wants keepalive, resume immediately.
      tryPlay();
    };
    audio.addEventListener("pause", onPause);

    const onVis = () => {
      if (document.visibilityState === "visible" && audio.paused) tryPlay();
    };
    document.addEventListener("visibilitychange", onVis);

    // Also resume on any user interaction — first tap after iOS lock/unlock,
    // for example. Passive listeners so we don't affect scrolling perf.
    const resumeEvents = ["pointerdown", "touchstart", "keydown"] as const;
    const onInteract = () => {
      if (audio.paused) tryPlay();
    };
    for (const evt of resumeEvents) {
      window.addEventListener(evt, onInteract, { passive: true });
    }

    // Media Session — the OS-visible "we're recording" surface.
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: label?.trim() ? label : "Gravando sermão",
          artist: "Scriba",
          album: "Transcrição ao vivo",
        });
        navigator.mediaSession.playbackState = "playing";
        // Any of these can be triggered by lock-screen hardware buttons or
        // Bluetooth headset. Route them all through onExternalStop.
        const stopHandler = () => externalStopRef.current?.();
        try {
          navigator.mediaSession.setActionHandler("stop", stopHandler);
        } catch {
          // some browsers don't support "stop"
        }
        try {
          navigator.mediaSession.setActionHandler("pause", stopHandler);
        } catch {
          // ignore
        }
      } catch {
        // MediaMetadata ctor missing on very old browsers
      }
    }

    // Bridge to the RN shell if present.
    postNativeEvent({ type: "recording:start", sessionId, label });

    // Heartbeat so a native shell can time out stale sessions and so the
    // audio element is periodically nudged even if events go quiet.
    heartbeatRef.current = setInterval(() => {
      if (audio.paused) tryPlay();
      postNativeEvent({
        type: "recording:heartbeat",
        sessionId,
        elapsedMs: Date.now() - startedAtRef.current,
      });
    }, 15_000);

    return () => {
      audio.removeEventListener("pause", onPause);
      document.removeEventListener("visibilitychange", onVis);
      for (const evt of resumeEvents) window.removeEventListener(evt, onInteract);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      try {
        audio.pause();
      } catch {
        // ignore
      }
      audio.removeAttribute("src");
      try {
        audio.load();
      } catch {
        // ignore
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      audioRef.current = null;
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.playbackState = "none";
          navigator.mediaSession.metadata = null;
          for (const action of ["stop", "pause"] as const) {
            try {
              navigator.mediaSession.setActionHandler(action, null);
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }
      }
      postNativeEvent({ type: "recording:stop", sessionId });
    };
  }, [enabled, sessionId, label]);
}

export { isReactNativeWebView };
