# src/features/feedback: a pesquisa de satisfação

A janela que pergunta "como foi para você?" no instante em que a pessoa acabou
de usar cada parte do produto, e o botão "Dar feedback" do `/profile`.

```
config.ts                     os três atrasos, um por superfície
components/FeedbackPrompt     o gatilho: pergunta ao servidor e abre a janela
components/FeedbackDialog     a janela em si (chips + texto opcional)
components/ProfileFeedbackRow o botão que a própria pessoa procura
lib/api.ts                    as duas chamadas, ambas falhando em silêncio
```

O vocabulário (escala, tópicos, superfícies, limites) mora em
`lib/domain/feedback.ts`, client-safe, porque é o mesmo que desenha os chips
no navegador e as médias do `/admin/feedback`. A decisão de perguntar mora em
`lib/db/feedback.ts`, e as tabelas em `supabase/migrations/0047_feedback.sql`,
cujo cabeçalho tem o raciocínio do schema.

## A regra que governa tudo: a pergunta é uma interrupção

A pessoa acabou de gerar um resumo e quer LER o resumo. Toda decisão desta
pasta desce daí, e nenhuma delas é preferência estética:

- **Três vezes na vida, nunca mais.** 1ª, 3ª e 8ª gravação; 1ª, 3º e 8º
  estudo. A 1ª é a primeira impressão, que não existe duas vezes; a 3ª é
  depois de o encanto passar e antes de o hábito se formar, a janela em que
  se desiste; a 8ª é a opinião de quem já sabe do que está falando. Perguntar
  em toda gravação treinaria a pessoa a fechar o diálogo sem ler, e a partir
  daí não há mais como perguntar nada.
- **A nota é um toque; o texto é opcional e só aparece depois dela.** Com o
  campo de texto aberto de saída, a janela abre parecendo formulário, e o que
  se quer da maioria é o toque, não a redação. **A exceção é o /profile**, onde
  a caixa já vem aberta: ali a janela não interrompeu ninguém, a pessoa clicou
  em "Dar feedback" para ESCREVER, e esconder a caixa atrás de um chip é fazer
  com que ela procure o que veio usar. É a mesma distinção que dá nome ao
  `selfInitiated` do diálogo, e ela também troca o rótulo do campo: "quer
  contar mais alguma coisa?" pressupõe que algo já foi dito.
- **"Agora não" é um botão de verdade**, do mesmo tamanho do outro. Uma janela
  cujo único caminho de saída é responder envenena as duas seguintes.
- **Erro de rede agradece e fecha.** O envio falho não vira toast vermelho
  sobre o resumo que a pessoa acabou de gerar: ela estava nos fazendo um
  favor, e cobrar dela o conserto de um problema nosso é o pior fim possível
  para essa interação.

## O que quem mexer aqui não pode desfazer

**O cliente não decide NADA sobre quando é perguntado.** Ele diz qual sessão
está na tela; `resolveFeedbackPrompt` responde. Ordinal, marco e superfície
são derivados no servidor, e o envio nem sequer manda a superfície, ela é
reconstruída da linha de `feedback_prompts` que o próprio servidor escreveu.
Um corpo que dissesse "isto é sobre o estudo da sessão X" não teria como ser
desmentido, e a tabela que orienta o roadmap passaria a aceitar o que o
navegador quisesse dizer.

**A pergunta é REGISTRADA no momento em que é feita, e por isso o
`FeedbackPrompt` chama o servidor DEPOIS do atraso, não antes.** Perguntar
cedo e esperar para mostrar gastaria o marco de quem fechou a aba em três
segundos, e aquela pessoa nunca mais seria perguntada sobre a primeira
gravação da vida dela. Pela mesma razão, sair da página antes do prazo não
consome nada, e aba escondida (celular no bolso enquanto o resumo termina) é
tratada como saída.

**A contagem começa em `profiles.feedback_started_at`, não na primeira
gravação da vida.** No dia em que isto subiu, quem já tinha quarenta sessões
teria passado dos três marcos sem nunca ter sido perguntado. A coluna nasceu
`not null default now()`, o que carimba o instante do deploy em quem já
existia e o instante do cadastro em quem chegar depois, sem backfill e sem
data mágica em TypeScript.

**Os tópicos do modo Ao Vivo são DOIS, e não viram um.** As sugestões durante
a pregação e o resumo do fim são produtos diferentes com consertos diferentes;
quem gostou dos cards e achou o resumo fraco precisa poder dizer isso. A
segunda pergunta só aparece depois de a primeira ter nota, é o que evita a
janela abrir com cara de formulário.

**`summary` é o mesmo tópico no modo Ao Vivo e no modo Áudio.** É o mesmo
pipeline produzindo o mesmo artefato; separá-los partiria a amostra ao meio
sem responder nenhuma pergunta nova.

**O botão do `/profile` não passa por `feedback_prompts`.** Não há marco a
queimar nem pergunta a marcar como respondida, então o envio vai sem
`promptId` e o servidor o trata como feedback geral (tópico `overall`, sem
sessão). Ele existe porque as três janelas automáticas são NOSSA escolha de
momento, e o momento em que alguém tem algo a dizer é dele, quem se incomodou
na décima gravação é exatamente a pessoa que ainda está aqui.

## Onde o gatilho está montado

| Página | `kind` | Atraso | Pergunta sobre |
|---|---|---|---|
| `/recording/:id/summary` | `recording` | 5s | sugestões ao vivo + resumo, ou só o resumo |
| `/recording/:id/transcript` | `recording` | 2,5s | a transcrição |
| `/recording/:id/deepening` | `study` | 8s | o estudo |

Os três atrasos e o porquê de cada um estão em `config.ts`. Uma sessão do modo
transcrição que ganhou resumo depois aparece nas DUAS páginas; o
`feedback_prompts_once` garante que ela é perguntada uma vez só.

## O painel

`/admin/feedback` lê de `lib/db/admin/feedback.ts`. Duas coisas de lá valem
repetir aqui, porque elas restringem o que esta pasta pode mudar:

- **A taxa de resposta vem antes das notas.** As médias são de quem escolheu
  responder, e essa amostra é sistematicamente mais gentil que a realidade.
  Por isso `feedback_prompts` guarda também as perguntas ignoradas.
- **A média por tópico nunca é somada numa nota geral.** Cada tópico é uma
  peça com um conserto próprio; uma "nota do Scriba" não apontaria para lugar
  nenhum.
