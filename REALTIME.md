# Real-time transcription — problema e caminho para Opção B

## Contexto

A arquitetura atual é chunk-based: o MediaRecorder acumula 20–45s de áudio, envia para Whisper via REST, e só então extract/suggest disparam. Isso cria um lag mínimo de 20s entre o pastor falar e o card aparecer na tela.

O problema ficou evidente quando o pastor leu João 4:7 e nenhum `citedVerse` apareceu durante a leitura — o extract só veria esse trecho no próximo chunk.

A Opção A (chunks de 8s) atenua o problema mas não resolve a raiz. A Opção B resolve.

---

## Opção B — OpenAI Realtime API

### O que muda

Substitui o par MediaRecorder + Whisper REST por uma **conexão WebSocket persistente** com `gpt-4o-realtime-preview`. O áudio é enviado em streaming contínuo e a transcrição volta palavra por palavra com ~1s de lag.

```
Hoje:      [chunk 20-45s] → POST /api/transcribe → Whisper → texto
Real-time: [áudio contínuo] ↔ WebSocket (/api/realtime) → texto em stream
```

### Arquitetura proposta

```
Browser
  └─ AudioWorkletProcessor (captura PCM 16kHz mono)
       └─ WebSocket → /api/realtime (Next.js Route Handler com Node runtime)
                         └─ WebSocket → api.openai.com/v1/realtime
                              ↕ eventos de transcrição (input_audio_transcription.delta)
  ← transcrição parcial (words) em tempo real
  ← transcrição finalizada (por silêncio VAD ou por frase)

Extract/suggest disparam sobre o texto acumulado a cada N caracteres novos
ou a cada "frase finalizada" detectada pelo VAD da API.
```

### Eventos relevantes da Realtime API

| Evento | Quando | Uso |
|--------|--------|-----|
| `input_audio_transcription.delta` | A cada palavra | Atualizar transcript em tela |
| `input_audio_transcription.completed` | Fim de turno/silêncio | Disparar extract |
| `input_audio_buffer.speech_started` | VAD detecta fala | Indicador visual |
| `input_audio_buffer.speech_stopped` | VAD detecta silêncio | Gate para extract |

### Custo

- Realtime API: ~$0.06/min áudio de entrada + $0.24/min áudio de saída (se usar audio output — não precisamos, só transcription)
- Whisper atual: ~$0.006/min (muito mais barato por minuto, mas a experiência é incomparável)
- Para um sermão de 50 min: ~$3 com Realtime vs ~$0.30 com Whisper
- Vale se a experiência ao vivo for o produto central

### O que NÃO muda

- `/api/extract`, `/api/suggest`, `/api/verse`, `/api/final-summary` — todos ficam iguais
- Prompts, domain types, feed, SummaryView — sem alteração
- O trigger do extract muda de "chunk completado" para "N chars acumulados desde último extract" ou "frase finalizada"

### Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| WebSocket cai no meio do sermão | Reconexão automática com backoff; último transcript salvo em ref |
| Next.js App Router não suporta WebSocket nativo | Usar `server.upgrade()` no custom server, ou separar num servidor Node simples para a rota Realtime |
| Transcrição parcial (delta) gera extração prematura | Só disparar extract em `transcription.completed` (fim de turno), não em deltas |
| Latência de ida e volta WebSocket adicional | Negligível (~50ms) frente ao ganho de 20s+ eliminado |

### Pré-requisitos técnicos

1. `next.config` com custom server (ou servidor separado) para WebSocket
2. `AudioWorkletProcessor` no browser para capturar PCM16 24kHz (formato exigido pela Realtime API)
3. Substituir `createRecorder` (MediaRecorder) por `createRealtimeRecorder` (AudioWorklet + WS)
4. Env var `OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview`

### Ordem de implementação sugerida

1. Spike: conectar AudioWorklet → WebSocket → Realtime API e logar transcrições
2. Integrar com o transcript state (substituir `chunkRows` por streaming de texto)
3. Rewire os triggers de extract/suggest para `transcription.completed`
4. Remover `/api/transcribe` (ou manter como fallback offline)
5. Testar com sermão real de 30+ min

### Referências

- Docs: `node_modules/next/dist/docs/` (Next.js WebSocket support)
- OpenAI Realtime API: https://platform.openai.com/docs/guides/realtime
- Formato de áudio: PCM16, 24kHz, mono, little-endian
- Modelo atual com suporte a transcription-only: `gpt-4o-realtime-preview`
