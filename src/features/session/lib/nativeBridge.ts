/**
 * Thin bridge for when this web app is embedded inside a React Native WebView.
 * The RN shell subscribes to `onMessage` on the WebView and reacts to these
 * payloads — typically by starting/stopping a native foreground service
 * (Android: `foregroundServiceType="microphone"`) or activating an
 * `AVAudioSession` background category (iOS). Without a native side those
 * messages are simply no-ops.
 *
 * When rendered in a normal browser tab `window.ReactNativeWebView` is
 * undefined and every helper here becomes a no-op.
 */
type ReactNativeWebViewHandle = { postMessage: (data: string) => void };

declare global {
  interface Window {
    ReactNativeWebView?: ReactNativeWebViewHandle;
  }
}

export type NativeRecordingEvent =
  | { type: "recording:start"; sessionId: string; label?: string }
  | { type: "recording:stop"; sessionId: string }
  | { type: "recording:heartbeat"; sessionId: string; elapsedMs: number }
  /**
   * Pedido de haptic curto (card novo no feed). Existe porque iOS/Safari não
   * implementa `navigator.vibrate` — dentro da shell RN quem vibra é o nativo.
   */
  | { type: "haptics:tap" };

export function isReactNativeWebView(): boolean {
  return typeof window !== "undefined" && !!window.ReactNativeWebView;
}

export function postNativeEvent(event: NativeRecordingEvent): void {
  if (typeof window === "undefined") return;
  const handle = window.ReactNativeWebView;
  if (!handle) return;
  try {
    handle.postMessage(JSON.stringify(event));
  } catch {
    // swallow — RN bridge may not be ready during teardown
  }
}
