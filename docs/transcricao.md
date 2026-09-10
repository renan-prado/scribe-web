# A transcrição: o que foi medido

Este documento existe porque quase toda intuição sobre "melhorar transcrição de
áudio ruim" está errada, e três delas estavam implementadas no Scriba.

O material: 51s de pregação real gravada no celular dentro do salão da igreja,
eco, microfone distante, ruído de plateia, mais uma transcrição de referência
digitada à mão por quem estava lá. Ambos em `public/prints/audio/`. Toda taxa
abaixo é WER (word error rate: substituições + inserções + omissões sobre o
número de palavras da referência), com caixa e acento normalizados.

**A referência tem 85 palavras.** Uma amostra só, então trate diferenças de
1-2 pontos como ruído; o que decide é a ordem de grandeza, e ela é grande.

## O resultado

| | antes | depois |
|---|---:|---:|
| WER no áudio de referência | **27,1%** | **11,8%** |
| WER sob reverberação forte | **70,0%** | **16,5%** |
| custo por minuto de áudio | $0,0030 | $0,0060 |

Três mudanças produziram isso, e nenhuma delas é processamento de áudio.

## 1. O modelo era o problema (27,1% → 11,8%)

`OPENAI_TRANSCRIBE_MODEL` era `gpt-4o-mini-transcribe`. Hoje é `gpt-transcribe`.

O mesmo áudio, nos mesmos chunks, sem mais nenhuma mudança:

| modelo | limpo | reverb leve | reverb forte | ruído | reverb+ruído |
|---|---:|---:|---:|---:|---:|
| `gpt-4o-mini-transcribe` | 31,8% | 33,5% | **70,0%** | 52,4% | 62,9% |
| `gpt-4o-transcribe` | 16,5% | - | 37,1% | 25,3% | 38,2% |
| `gpt-transcribe` | **14,7%** | **12,9%** | **16,5%** | **14,1%** | **14,1%** |

A linha que importa não é a primeira coluna, é a inclinação. O mini não é só
pior: ele **desaba** quando a acústica piora, que é exatamente a condição em
que o produto é usado. O `gpt-transcribe` fica plano, a diferença entre
gravar num estúdio e num salão com eco custa 3 pontos de WER, não 40.

Ele também é mais rápido (2,3s contra 3,7s por chunk) e mais estável: três
execuções do mesmo chunk deram exatamente o mesmo texto, enquanto o mini
variou entre 22% e 41% de WER na mesma entrada.

**Consequência: a escalada de modelo foi removida.** Havia um segundo degrau,
chunk ruim era reenviado ao `gpt-4o-transcribe`. Com o modelo novo no primeiro
degrau, esse reenvio dobra o custo para entregar um texto pior em todos os
cenários da tabela. Não existe modelo acima do `gpt-transcribe` para escalar.

## 2. A lista de 66 livros bíblicos atrapalhava (16,5% → 11,8%)

O prompt-guia recitava os 66 livros da Bíblia mais seis termos teológicos, para
o modelo preferir "Filemom" a "Filemão". Medido, com `gpt-transcribe` nos
mesmos chunks:

| prompt | WER |
|---|---:|
| lista dos 66 livros | 16,5% |
| lista dos 66 livros + `prevText` | 12,9% |
| frase curta de domínio + `prevText` | 12,4% |
| **só `prevText`** | **11,8%** |
| nenhum | 17,6% |

Duas coisas saem daí:

- **A lista custa 4,7 pontos.** O `prompt` do endpoint de transcrição é tratado
  como *transcrição prévia*, o modelo tenta continuar a partir dele. Sessenta
  e seis substantivos próprios que ninguém falou são contexto falso, e em áudio
  incerto o modelo ainda os ecoa como se fossem fala (é a alucinação que
  `stripVocabHallucination` existe para limpar; a causa era nossa).
- **Quem carrega o peso é o `prevText`.** Sem prompt nenhum o WER sobe para
  17,6%; com só o rabo da transcrição anterior, cai para 11,8%. Contexto de
  verdade ajuda; vocabulário decorado não.

Ficou uma frase curta de domínio + `prevText` (`lib/vocabulario.ts`). A frase é
neutra na medição e ancora registro e idioma; se um dia a ideia de guiar
vocabulário voltar, o caminho medido é **alongar o `prevText`**, não listar
termos.

## 3. Os limiares de qualidade nunca disparavam

`LOW_CONFIDENCE_AVG_LOGPROB` era -0,6. Nos três chunks do áudio de referência,
os mesmos que produziram 27% de WER, os logprobs foram -0,392, -0,105 e
-0,071. **Nenhum passou do limiar.** O aviso de áudio ruim, construído
justamente para essa situação, não apareceu uma vez sequer.

Com `gpt-transcribe` o sinal é muito mais informativo. Degradando o mesmo áudio
em passos de reverberação:

| avgLogprob | WER |
|---:|---:|
| -0,046 | 14% |
| -0,062 | 19% |
| -0,105 | 27% |
| -0,118 | 35% |
| -0,157 | 49% |
| -0,227 | 85% |

Todo áudio ainda utilizável fica entre -0,045 e -0,073. O limiar novo é
**-0,10**, e ele marca a linha em que o áudio começa a custar conteúdo.

**Trocar `OPENAI_TRANSCRIBE_MODEL` obriga a refazer esta tabela.** O logprob é
propriedade do decodificador, não do áudio: o mesmo -0,1 significa coisas
diferentes em modelos diferentes.

O piso de densidade continua em 3 chars/s. O comentário antigo supunha 12-16
chars/s de fala contínua; medido, a **pregação rende 8**, o púlpito tem pausa
retórica. Áudio inutilizável mede 2,4-3,4, então o piso segue sendo o detector
de catástrofe, e quem pega a faixa do meio é o logprob.

## O que NÃO funcionou

Registrado para ninguém tentar de novo.

### Limpar o áudio antes de enviar piora

Nove variantes de pré-processamento, `gpt-transcribe`, três execuções cada:

| filtro | WER |
|---|---:|
| nenhum (referência) | 11,8% |
| passa-alta 85 Hz + normalização de volume | 10,6% |
| normalização de volume só | 12,9% |
| passa-alta 85 Hz | 14,1% |
| passa-alta + compressor | 15,3% |
| cadeia completa (passa-alta + denoise + compressor + normalização) | 12,9% |
| **passa-alta + denoise espectral (`afftdn`)** | **21,2%** |

**Denoise custa quase 10 pontos.** O modelo foi treinado em áudio sujo e usa o
que a limpeza remove, a cauda reverberante que um denoiser trata como ruído
carrega a fala. Compressão e equalização também pioram. Só normalização de
volume fica dentro do ruído da medição, e não vale o código.

No `gpt-4o-mini-transcribe` o estrago era ainda maior (29,0% → 38,8% com
denoise; 42,0% com a cadeia completa).

**É por isso que `lib/recorder.ts` desliga `noiseSuppression`,
`echoCancellation` e `autoGainControl`.** `getUserMedia({ audio: true })` liga
os três por padrão: é o pacote do WebRTC afinado para chamada de voz, e uma
igreja é o caso oposto do quarto com a boca a vinte centímetros do aparelho.

> **Isto é a única mudança não confirmada em campo.** A medição acima é um
> proxy offline, o denoiser do ffmpeg não é o do WebRTC. Tentamos fechar isso
> alimentando o Chrome com o arquivo por `--use-file-for-fake-audio-capture`, e
> o caminho de mic falso não reproduziu o áudio. Por isso o recorder loga
> `track.getSettings()` (`log.info("recorder", "mic", …)`): **uma gravação real
> diz se o navegador aceitou o pedido.** Se precisar voltar atrás, é o objeto
> `AUDIO_CONSTRAINTS`, e nada mais.

### Um passe de LLM corrigindo a transcrição não paga

A ideia: mandar o texto transcrito a um modelo de linguagem para desfazer
trocas fonéticas que o contexto denuncia ("ele foi **ver** com Jesus" →
"ele foi **ter** com Jesus").

Na primeira tentativa funcionou: 11,8% → 8,2%. Era falso. O prompt trazia como
exemplo justamente uma das correções do gabarito, e o modelo estava copiando a
resposta. O mesmo prompt, aplicado a **transcrições já corretas**, estragava
uma em cinco, transformava "e a verdade é essa, irmãos" em "e a Bíblia fala é
essa, irmãos".

Sem o exemplo vazado, três prompts × dois modelos, medindo ganho e dano juntos:

| prompt | modelo | WER (era 11,8%) | dano em texto já correto |
|---|---|---:|---:|
| sem exemplo | `gpt-4.1-mini` | 11,8% | 0% |
| conservador | `gpt-4.1-mini` | **10,6%** | 0% |
| marcado | `gpt-5.4-mini` | **10,6%** | 0% |
| sem exemplo | `gpt-5.4-mini` | 12,9% | 0% |

Um ponto de WER, às vezes negativo, ao preço de uma chamada de LLM por sessão e
de uma superfície nova de invenção sobre a fala de um pregador. Não entrou.

Aplicado ao texto do modelo fraco (29,4%) o ganho foi **zero**: um revisor não
recupera o que a decodificação já perdeu. Conserte o modelo, não o texto.

### Modelos de áudio-chat são piores

`gpt-audio-1.5`, `gpt-audio` e `gpt-audio-mini` aceitam áudio e um prompt rico.
No mesmo arquivo: 47,1%, 21,2% e 27,1% de WER, contra 11,8% do
`gpt-transcribe`. Os três ainda inventaram interjeições que não estão no áudio
("Glória a Deus" onde ninguém disse), que é o defeito mais caro possível num
produto que transcreve pregação.

### O fatiamento em chunks não é o problema

Suspeita razoável: cortar a 15-20s parte frases no meio. Medido, o mesmo áudio
inteiro contra os mesmos três chunks com `prevText`: 10,6% contra 11,8%. O
`prevText` já paga a costura. Não há motivo para mexer em
`RECORDER_MIN/MAX_CHUNK_MS` por qualidade.

## O que sobrou de erro

Os dez erros restantes no áudio de referência, alinhados palavra a palavra:

```
[S recebesse → essa] visao foi necessario ele tirar [I → de] sobre si a capa
e logo [D a →] apos ele largar a capa ele foi [S ter → ver] com jesus ...
so tem visao [S quem → que] primeiro deixa a capa [D ou →] larga a capa ...
e a [D biblia →] [D fala →] [S que → verdade] tem alguns que [S sao → estao] cegos
```

Vale olhar de perto antes de perseguir os últimos pontos:

- `recebesse → essa` é o áudio começando no meio da palavra;
- `tirar de sobre si` e `logo após` são **a transcrição estando certa e a
  referência tendo o erro**, o gabarito é humano e tem typos;
- só dois são erros semânticos de verdade: `ter → ver` e
  `a bíblia fala que → a verdade`.

Ou seja: **a taxa real está abaixo dos 11,8% medidos.** Perseguir esse resto
com mais engenharia tem retorno baixo; o próximo ganho de verdade está na
captação, não no software.

## O custo

Transcrição sai de $0,003 para $0,006 por minuto de áudio. É o dobro, e não há
como não ser: `gpt-4o-mini-transcribe` é o único modelo nesse preço e é o que
desaba com eco.

Onde isso aperta, à régua de R$ 20,00 o milheiro de moeda
(`lib/coins/economics.ts`) e câmbio de ~R$ 5,40:

| modo | moedas/min | receita/min | custo de STT/min | sobra para o resto |
|---|---:|---:|---:|---:|
| `live` | 7 | R$ 0,140 | R$ 0,032 | R$ 0,108 |
| `audio_only` | 6 | R$ 0,120 | R$ 0,032 | R$ 0,088 |
| `transcript_only` | 1 | **R$ 0,020** | **R$ 0,032** | **-** |

**`transcript_only` passa a dar prejuízo**: 1 moeda por minuto não cobre a
única chamada que o modo faz. Já estava apertado (19% de margem ao preço
antigo); agora está negativo. Para os 70% de margem que
`DEFAULT_TARGET_MARGIN_PCT` usa como régua, seriam ~6 moedas/min.

Os outros dois modos continuam positivos, com a margem reduzida pela diferença.
`/admin/precificacao` mostra o número real assim que houver medição nova, a
tabela acima é aritmética, não medição.

**Isso é decisão de preço, não de engenharia, e não foi tomada aqui.**

## Como refazer a medição

O laboratório não está no repositório (é descartável, e depende de `ffmpeg`).
O que ele precisa fazer:

1. Fatiar o áudio reproduzindo o VAD de `lib/recorder.ts`, RMS sobre 2048
   amostras a cada 50ms, corte no primeiro silêncio de 400ms depois de
   `RECORDER_MIN_CHUNK_MS`, corte forçado em `RECORDER_MAX_CHUNK_MS`. Medir
   sobre o arquivo inteiro dá um número que o produto nunca vê.
2. Transcrever chunk a chunk, encadeando o `prevText` como a rota faz.
3. Alinhar com a referência por distância de edição em nível de PALAVRA, com
   caixa e acento normalizados, a referência é digitada à mão e tem typos.
4. Repetir cada condição 2-3 vezes. O `gpt-transcribe` é praticamente
   determinístico; o mini varia 20 pontos entre execuções da mesma entrada.

Degradações usadas, via `ffmpeg -af`: `aecho=0.8:0.85:60:0.35` (reverb leve),
`aecho=0.9:0.95:150:0.8` (forte), `anoisesrc=c=pink` misturado a `amix`
(ruído), `volume=0.18` (baixo).
