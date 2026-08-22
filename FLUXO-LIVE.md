# Fluxo Live — Scriba

```mermaid
flowchart TD
    MIC([🎙️ Microfone]) --> CHUNKS

    subgraph CHUNKS [A cada ~30s — ou silêncio detectado]
        AUDIO[Chunk de áudio] --> WHISPER[Whisper\ntranscreve para texto]
        WHISPER --> TRANSCRIPT[(Transcrição\nacumulada)]
    end

    TRANSCRIPT --> BIBLE & INSIGHTS & ECHO

    subgraph BIBLE [🔵 Bible — por chunk]
        direction TB
        B1{Tem referência\nbíblica no texto?} -->|não| B2[ignora]
        B1 -->|sim| B3[/api/bible]
        B3 --> B4[Card: verso citado\nex. João 3:16]
        B4 --> B5{Pregador\nestá lendo?}
        B5 -->|sim — Reading Mode| B6[Aparece na hora\nchunks mais rápidos\nInsights pausado]
        B5 -->|não| QUEUE
    end

    subgraph INSIGHTS [🟣 Insights — a cada 45s]
        direction TB
        I1{Tem conteúdo\nnovo suficiente?} -->|não| I2[ignora]
        I1 -->|sim| I3[/api/insights]
        I3 --> I4[Cards:\ndestaque do pregador\ncitação · verso relacionado\ncontexto · sugestão]
        I4 --> QUEUE
    end

    subgraph ECHO [🟠 Echo — quando há muitos cards de IA seguidos]
        direction TB
        E1{3–5 cards de IA\nsem frase do pregador?} -->|não| E2[ignora]
        E1 -->|sim| E3[/api/sermon-echo]
        E3 --> E4[Card: frase literal\ndo pregador]
        E4 --> QUEUE
    end

    subgraph QUEUE [Fila de cards]
        Q1[Card entra na fila] --> Q2[Aparece no feed\num a cada 45s]
    end

    QUEUE --> FEED[📱 Feed do usuário]

    MIC -->|usuário para| STOP
    subgraph STOP [Ao parar]
        S1[/api/final-summary\ntranscrição completa + feed] --> S2[Resumo estruturado]
    end
    STOP --> SUMMARY[📄 Tela de resumo]
```

---

## Em palavras simples

**Durante a gravação:**

1. O microfone captura áudio e quebra em pedaços de ~30s
2. Cada pedaço vai para o **Whisper** (IA da OpenAI) → vira texto
3. Esse texto alimenta 3 pipelines ao mesmo tempo:
   - **Bible** — detecta se o pregador citou um versículo e mostra o card na hora
   - **Insights** — a cada 45s gera destaques, citações, contexto, etc.
   - **Echo** — quando apareceram muitos cards de IA seguidos, injeta uma frase literal do pregador para "ancorar" o feed
4. Os cards gerados entram numa **fila** e aparecem no feed um a cada 45s (para não inundar a tela)

**Modo leitura** (`readingMode`): quando o pregador começa a ler um trecho da Bíblia, os chunks ficam mais rápidos, os insights pausam, e só cards de versos aparecem — em tempo real.

**Ao parar:** toda a transcrição + os cards do feed vão para um último modelo de IA que gera o **resumo final**.
