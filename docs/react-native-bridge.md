# A ponte com o app React Native

O Scriba é instalado no Android como um shell React Native com uma WebView
apontada para `scriba.cc` (repositório `scriba-mobile`). O shell precisa saber
quando uma gravação está em andamento para subir um **foreground service de
microfone**, que é a única forma de a captura sobreviver à tela bloqueada e ao
app minimizado.

> **Este documento é sobre um contrato que NÃO é implementado aqui.**
> Nenhum arquivo de `src/` fala com o shell, e não deve passar a falar sem uma
> conversa — ver "Por que a emissão saiu do site", abaixo. Ele existe para que
> quem mexer no gravador saiba que há um segundo consumidor do comportamento
> dele, e o que quebra esse consumidor.

## Por que a emissão saiu do site

Ela morava em `src/features/session/lib/nativeBridge.ts`: um módulo que exportava
`isReactNativeWebView()` e publicava eventos por
`window.ReactNativeWebView.postMessage`, chamado de dentro do gravador.

Esse arquivo foi **apagado no commit `5739d3c`** ("um modo de captura só"), que
tirou três modos de gravação do produto. Ele foi no bolo com razão aparente — era
código de gravação —, e o defeito ficou invisível dos dois lados: aqui não sobrou
nenhuma referência que o `tsc` pudesse acusar, e lá o `onMessage` do shell
continuou de pé esperando eventos que ninguém mais mandava. O foreground service
deixou de subir, e o microfone passou a morrer sempre que o app ia para segundo
plano.

Um arquivo cuja única razão de existir está em OUTRO repositório é um arquivo que
vai ser apagado assim. **Hoje a ponte é injetada na página pelo próprio shell**
(`src/recordingBridge.ts`, em `scriba-mobile`), e o app depende só de si mesmo:
um deploy daqui não pode mais apagá-la.

## O que o shell observa

Ele não lê nada que o site diga sobre si. Ele envolve as APIs do navegador que o
gravador usa:

| O que o shell observa | O que ele conclui |
|---|---|
| `MediaRecorder.start()` sem sessão aberta | começou a gravar |
| `MediaRecorder.pause()` / `.resume()` | pausou / retomou |
| o ÚLTIMO `MediaStreamTrack.stop()` do stream | a gravação acabou |

**O fim é a trilha morrer, e não o `MediaRecorder` parar.** É a distinção que
faz a coisa funcionar, e ela sai direto de como `useAudioCapture.ts` é escrito:
num sermão de mais de ~46 minutos o gravador é encerrado e outro começa no mesmo
stream (`rotatePart`), porque `/api/transcribe` recusa acima de 8 MB e cada parte
precisa de cabeçalho próprio. Se o shell lesse `MediaRecorder.stop()` como fim, o
foreground service cairia e subiria no meio da pregação — e essa janela é onde o
Android mata a captura. A trilha só para no `releaseAll()`, que roda no stop e no
descartar, e em mais lugar nenhum.

## O que quebra a ponte, deste lado

Três mudanças aqui a derrubam **em silêncio** — sem erro de build, sem erro na
tela, e com o sintoma aparecendo só num telefone com o app instalado, de bolso,
no meio de um culto:

1. **Trocar `MediaRecorder` por outra API de captura.** Um `AudioWorklet` com
   encoder próprio, por exemplo, não passa por nenhum dos ganchos.
2. **Parar as trilhas do microfone entre uma parte e outra.** Hoje `rotatePart`
   mantém o stream vivo de propósito; se ele passasse a recriá-lo, cada rotação
   viraria um fim de gravação para o shell.
3. **Manter as trilhas vivas depois do stop.** O `releaseAll()` devolvendo o
   microfone ao sistema é o que sinaliza o fim; um gravador que guardasse o
   stream para reaproveitar deixaria o serviço de pé para sempre.

Mexeu em `useAudioCapture.ts` de um desses jeitos? Avise o `scriba-mobile` no
mesmo dia.

## Por que o web sozinho não basta

Mesmo com todas as defesas web (silent-audio loop, Media Session, wake lock,
service worker), o iOS Safari suspende `MediaRecorder` assim que o app vai para
background — [WebKit bug 226620](https://bugs.webkit.org/show_bug.cgi?id=226620),
sem solução em 2026. No Android o Chrome mantém a captura *só enquanto o próprio
Chrome tem um foreground service ativo*, e sob pressão de memória o sistema pode
matá-lo. O shell é a única forma de garantir captura contínua com a tela
bloqueada.

Do lado Android, o serviço precisa declarar `foregroundServiceType="microphone"`
no manifest e ter a permissão `RECORD_AUDIO` concedida em runtime
([referência](https://developer.android.com/develop/background-work/services/fgs/service-types)).
O resto — notificação, canal, ciclo de vida — é assunto de `foregroundService.ts`
no `scriba-mobile`.

## Detectar que estamos dentro do app

Não há helper para isso aqui, e o `isReactNativeWebView()` que este documento já
recomendou importar não existe mais. Quem precisar da checagem lê
`typeof window !== "undefined" && "ReactNativeWebView" in window` no ponto de
uso. O consumidor que ela teve — esconder o convite de "instale o app" para quem
já está no app — hoje é resolvido por `useIsStandalone`
(`src/shared/hooks/use-standalone.ts`), que responde a pergunta certa
("esta janela é o app instalado?") sem depender de qual shell a hospeda.
