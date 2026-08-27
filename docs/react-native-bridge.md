# React Native WebView bridge

Quando o `scribe-web` é embutido em um app React Native (WebView), o site publica eventos via `window.ReactNativeWebView.postMessage`. Do lado RN, escute `onMessage` do `<WebView>` e traduza esses eventos em ações nativas — a única forma real de manter a gravação viva com **tela bloqueada / app minimizado / iOS Safari em background**, porque a Web plataforma não expõe foreground service próprio.

## Contrato

Todo payload é JSON serializado por `JSON.stringify`. Tipos publicados:

```ts
type NativeRecordingEvent =
  | { type: "recording:start"; sessionId: string; label?: string }
  | { type: "recording:stop"; sessionId: string }
  | { type: "recording:heartbeat"; sessionId: string; elapsedMs: number };
```

- **`recording:start`** — dispara quando o usuário começa a gravar. O RN deve iniciar seu foreground service de microfone e chamar `activate()` no `AVAudioSession` (iOS).
- **`recording:heartbeat`** — chega a cada 15s enquanto grava. Use como watchdog para expirar sessões órfãs se ficar mais de ~60s sem heartbeat.
- **`recording:stop`** — encerra o foreground service e libera o `AVAudioSession`.

## Detecção do ambiente

Do lado web:

```ts
import { isReactNativeWebView } from "@/features/session/lib/nativeBridge";
```

Retorna `true` se `window.ReactNativeWebView` existir. Use pra esconder banners de "instale como app", já que o usuário já está no app.

## Android — foreground service

O foreground service **precisa** declarar `foregroundServiceType="microphone"` no manifest e ter `RECORD_AUDIO` runtime permission concedida. Sem isso o Android mata a captura em segundo plano assim que o app perde foco. Referência: <https://developer.android.com/develop/background-work/services/fgs/service-types>

## iOS — AVAudioSession

No `Info.plist`:
- `NSMicrophoneUsageDescription` (obrigatório) — texto que aparece no prompt.
- `UIBackgroundModes` incluindo `audio`.

No código Swift, na `recording:start`:

```swift
try AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .default, options: [.mixWithOthers, .allowBluetooth])
try AVAudioSession.sharedInstance().setActive(true)
```

## Por que o web sozinho não basta

Mesmo com todas as defesas web ativas (silent-audio loop, Media Session, wake lock, service worker), o iOS Safari suspende `MediaRecorder` assim que o app vai pra background — [WebKit bug 226620](https://bugs.webkit.org/show_bug.cgi?id=226620), não resolvido em 2026. No Android o Chrome mantém a captura *só enquanto o próprio Chrome tem um foreground service ativo*; sob pressão de memória o OS pode matar o Chrome. O shell RN é a única forma de garantir captura contínua com tela bloqueada.
