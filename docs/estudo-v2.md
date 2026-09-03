# Estudo V2 — diagnóstico e nova arquitetura de geração

> Resposta à task `tasks/001-modo-gerar-estudo`. Este documento é a análise que
> precede a implementação. O que já está decidido sobre a camada de
> conhecimento (RAG) está em `docs/scriba-rag-proposta-claude.md` e não é
> reaberto aqui — os dois planos são ortogonais, e o ponto de encontro está
> marcado na §3.

## O que existia antes desta reforma

```
POST /api/deepening            cobra 5 moedas → generateDeepening() → session_deepenings
POST /api/deepening/reprocess  cobra 5 moedas → generateDeepening() → overwrite
lib/deepening/generate.ts      2 chamadas: draft (t=0.6) + auditor (t=0.15)
lib/prompts/deepening.ts       193 linhas de prompt
lib/prompts/deepening-audit.ts 108 linhas de prompt
lib/domain/deepening.ts        DeepeningPayload = SummaryPayload (alias)
```

Entrada do draft: `finalSummary` + `feedItems` + `transcript` inteiro.
Entrada do auditor: `finalSummary` + `draft`. **A transcrição não chega ao
auditor.**

---

# 1. Diagnóstico — por que o estudo entrega pouco

Sete causas. Nenhuma se resolve reescrevendo o prompt, e é por isso que as
rodadas anteriores de ajuste de prompt não moveram a agulha.

## 1.1 O prompt é majoritariamente negativo

Das ~193 linhas do `DEEPENING_SYSTEM_PROMPT`, a esmagadora maioria diz o que
**não** fazer: anti-template, anti-repetição, lista de sujeitos proibidos,
blocklist de aforismos, self-check de 9 itens com "regra dura". Sobra pouco
espaço dizendo o que **é** um bom estudo.

Um modelo otimizando para não violar quarenta proibições escreve
defensivamente: frases curtas, afirmações hedged, escolhas seguras. O resultado
tem exatamente a textura que a task descreve — "texto teológico genérico". As
proibições foram acrescentadas uma a uma para matar sintomas (h1 genérico,
palavra grega reciclada, autoexame vazado), e cada uma cobrou seu preço em
ambição.

## 1.2 As cotas mínimas são uma máquina de alucinação

`REGRA #2` exige, por estudo: ≥2 citações de teólogo, ≥1 palavra original, ≥3
versículos novos, ≥2 distinções doutrinárias, ≥1 autoexame, ≥2 highlights.

O prompt tenta desarmar isso com "se não consegue, não invente". Mas a
instrução de cota e a instrução de abstenção competem, e cota vence — cota é
concreta e verificável, abstenção é vaga. Pior: **o auditor reimpõe as mesmas
cotas** (`Passo C — VERIFICAÇÃO DE COTAS`). O segundo passe, que existe para
reduzir invenção, adiciona pressão para inventar.

É o mecanismo pelo qual sermões pobres em material recebem estudos ricos em
material fabricado — o que a task chama de "preencher lacunas artificialmente".

## 1.3 A whitelist de autores restringe o nome, não a afirmação

Quarenta e oito nomes, sem obra, sem tema, sem século, sem posição. O modelo
escolhe qualquer um por qualquer motivo, e a única verificação possível é
`author ∈ whitelist` — justamente o campo que quase nunca está errado. O erro
mora no `text`: a formulação atribuída.

Consequência prática: a whitelist garante que a citação inventada será
atribuída a um autor real. É o pior dos mundos — empresta credibilidade a uma
afirmação não verificada. E é exatamente o sintoma "nomes jogados no texto"
que a task descreve.

## 1.4 O texto bíblico é confiado ao modelo, tendo o repositório a NVI local

`lib/bibles/lookup.ts::lookupVerse` resolve referência → texto real a partir de
`NVI.json`. É usado por `/api/verse` e por `lib/rereads/generate.ts`.
**Não é usado pelo estudo.** Todo `bibleQuote.text` de um estudo é prosa
gerada, e o prompt gasta uma seção inteira ("REGRA DE OURO") pedindo ao modelo
que não parafraseie a Escritura — um problema já resolvido no repositório,
resolvido de novo, e pior, por instrução.

## 1.5 Não existe etapa de decisão — tudo acontece numa inferência só

A parte mais importante do pedido é:

> identificação dos assuntos que realmente merecem aprofundamento

Hoje essa decisão acontece implicitamente, dentro do mesmo forward pass que
escolhe o tema, seleciona a abordagem, recupera conhecimento, escreve 15-25
blocos e roda um self-check de 9 itens. É uma decisão que ninguém consegue
ler, logar, avaliar ou corrigir. Quando sai errada, o único instrumento
disponível é acrescentar mais uma proibição ao prompt — o que nos trouxe até a
§1.1.

## 1.6 O auditor não tem como auditar

Ele recebe `finalSummary` + `draft`. Sem transcrição, sem plano, sem texto
bíblico. Logo:

- **não pode** verificar fidelidade ao sermão (critério nº 2 da task);
- **não pode** verificar se uma palavra grega pertence ao texto pregado — só
  pode adivinhar pelo tema;
- **não pode** verificar citação nenhuma.

O que ele consegue fazer é detectar repetição contra o resumo e reescrever
blocos. E um modelo a `t=0.15` reescrevendo conteúdo teológico **sem a fonte**
é, ele mesmo, um vetor de fabricação: preenche o que reescreve com
conhecimento paramétrico.

## 1.7 A forma de saída impede a estrutura adaptativa que a task pede

`DeepeningPayload = SummaryPayload`. O estudo é obrigado a falar o vocabulário
de blocos do resumo: `h1 h2 paragraph bibleQuote highlight example quote
conclusion`. Não existe bloco para objeção, para distinção, para tensão, para
leitura recomendada, para pergunta em aberto, para fonte com proveniência.

"A estrutura deve surgir do assunto" não é um problema de prompt: o tipo não
tem como expressar estruturas diferentes. Todo estudo sai parecendo um resumo
mais longo porque, estruturalmente, **é** um resumo mais longo.

## 1.8 Não há sinal de qualidade

Nada mede se um estudo ficou bom. `hallucination_reports` cobre `live` e
`summary`, não `deepening`. Sem sinal, a única evidência disponível é a
impressão do usuário — que é como esta task começou.

---

# 2. Nova proposta de experiência

Um estudo bom no Scriba deve ser **legível como um ensaio**, não como um
formulário preenchido. Três compromissos:

**a) O estudo declara o que escolheu aprofundar.** Abre nomeando o ponto do
sermão de onde parte e a razão de valer profundidade ali. Não é meta-texto
sobre o sermão — é o contrato: o leitor sabe na primeira linha que não vai
reler o resumo.

**b) Todo apoio externo é rastreável.** Citação sem obra localizável não entra.
Referência bíblica sem texto conferido não entra. Indicação de leitura sem
autor e título reais não entra. A ausência é preferível: um estudo com três
fontes sólidas vale mais que um com oito plausíveis.

**c) A forma segue o material.** Um sermão expositivo em Romanos 8 pede exegese
e história da doutrina. Uma pregação temática sobre ansiedade pede distinção
conceitual, contexto pastoral e uma objeção honesta. Uma homilia narrativa pede
contexto histórico-cultural e conexões canônicas.

Corolário desagradável e necessário: **nem todo sermão rende um estudo de 25
blocos**, e o produto precisa parar de fingir que rende. Um estudo honesto de
8 blocos densos é a entrega correta para um sermão raso, e é melhor que 25
blocos de enchimento — que é o que o usuário recebe hoje.

---

# 3. Nova arquitetura de geração

A ideia que organiza tudo cabe em duas linhas:

```
resumo  responde  →  o que foi ensinado nesta pregação?
estudo  responde  →  agora que entendi o tema, o que preciso aprender sobre ele?
```

O estudo, então, não é uma versão mais elaborada do resumo. É a resposta às
perguntas que o sermão deixou em aberto — e por isso a representação
intermediária do pipeline é uma lista de **perguntas**.

Cinco etapas, três chamadas de modelo, duas determinísticas:

```
transcrição + resumo + cards
        │
        ▼
[1] QUESTIONADOR (LLM, t=0.9)      ← interroga o sermão como um crítico
        │  tema real + 25-30 perguntas de média e alta complexidade
        │  NÃO seleciona. Pergunta sem pudor.
        ▼
[1b] GUARDIÃO (mini, t=0)          ← corta a pergunta que o resumo já responde
        ▼
[2] RESPONDEDOR (LLM, t=0.5)       ← escolhe e responde
        │  descarta a redundante, a rasa, a genérica, a que não sabe responder
        │  responde 10-14 numa chamada só, com todas à vista
        │  marca onde as tradições protestantes divergem
        ▼
[3] ANCORAGEM (determinístico)     ← sem LLM
        │  lookupVerse(NVI) em toda referência citada nas respostas
        │  referência inexistente → descartada
        ▼
[4] REDATOR (LLM, t=0.75)          ← artigo corrido, NÃO pergunta-e-resposta
        │  reordena, funde, descarta e desdobra as respostas
        │  abre pelo problema, sustenta uma tese
        ▼
[4b] GUARDIÃO (mini, t=0)          ← a tese repete a do resumo? reescreve 1x
        ▼
[5] SELAGEM (determinístico)       ← sem LLM
        │  bibleQuote.text reescrito da NVI; quote sem obra descartado
        ▼
artigo + as perguntas persistidas para avaliação
```

## O sermão sai do pipeline depois do passo 1

**Só o questionador vê a transcrição e o resumo.** Dali em diante o material de
trabalho é um ASSUNTO ("a alegria cristã") e um conjunto de perguntas — o
respondedor e o redator não recebem o sermão de forma alguma.

É a mudança que mais mexeu no resultado, e ela é de arquitetura, não de prompt.
Enquanto os dois recebiam o resumo "para não repetir", o estudo saía com as
seções do sermão e usava até a expressão que o pregador tinha cunhado como
título de seção. **Entregar o texto a ser evitado a um modelo que vai escrever
é priming, não proteção:** o que está no contexto sai na saída, e o resumo é o
artefato mais estruturado que ele recebia.

O questionador também passou a separar duas coisas que antes vinham coladas:

- o **assunto** — como qualquer cristão o nomearia, sem adjetivo de sermão;
- a **moldura** — o recorte particular deste pregador, suas expressões e
  imagens.

E cada pergunta passa pelo **teste do estranho**: um cristão que não ouviu este
sermão entende a pergunta? Se precisa de explicação sobre a pregação, a
pergunta está presa à moldura e é reescrita. É verificável, ao contrário de
"não seja genérico".

## Por que perguntas, e não eixos com disciplinas

A primeira versão desta reforma pedia ao modelo um *plano editorial*: dois ou
três eixos, cada um com uma disciplina escolhida (exegese, teologia bíblica,
história da Igreja…). Não funcionou, e o motivo é instrutivo.

Uma taxonomia é um formulário. "Eixo: a graça em Efésios 2 · abordagem:
teologia sistemática" é preenchível por qualquer modelo e **não diz nada**
sobre se o estudo vai prestar. Já uma pergunta é autovalidável: qualquer
pessoa lê "Graça é libertinagem?" e sabe que rende, e lê "O que a graça nos
ensina?" e sabe que não.

Daí a regra que governa o esforço deste pipeline:

> **A qualidade do estudo é a qualidade das perguntas.**

É onde vale investir prompt, e é o primeiro lugar a olhar quando um estudo sai
ruim.

## Por que o questionador não seleciona

Ele gera 25-30 e entrega todas. Duas razões:

- **Pedir poucas produz as óbvias.** O modelo gasta as primeiras vagas nas
  definições; as perguntas interessantes aparecem depois da décima. Perguntar
  é barato, e uma boa pergunta não feita está perdida para sempre.
- **Quem melhor julga se uma pergunta vale é quem vai ter de respondê-la.** A
  seleção mora no passo 2, que descarta a redundante, a rasa e — sobretudo — a
  que ele não conseguiria responder bem. Uma resposta vaga é pior que uma
  pergunta não respondida: ocupa espaço fingindo que ensina.

Selecionar num quarto modelo pagaria latência sem comprar qualidade.

## Por que as respostas saem numa chamada só

Responder pergunta a pergunta, isoladamente, faz dez respostas sobre graça
reestabelecerem dez vezes que graça é favor imerecido. Com o conjunto à vista,
cada resposta pressupõe as anteriores — e é isso que produz densidade em vez
de repetição costurada.

## O guardião — dois cortes contra a repetição do resumo

> Medido depois: com o sermão fora dos passos 2 e 4, o filtro [1b] tem muito
> menos trabalho, e o modelo dele precisou subir para conseguir discriminar.
> Ver a nota de calibragem no fim desta seção.

O modo de falha nº 1 deste produto é o estudo sair dizendo a mesma coisa que o
resumo já disse. Os três modelos recebem o resumo e são instruídos a não
repeti-lo; a instrução compete com a inclinação natural do modelo de voltar ao
ponto mais saliente do contexto, e às vezes perde.

O guardião não instrui — **corta**. Roda num modelo barato
(`OPENAI_STUDY_GUARD_MODEL`, `gpt-4o-mini` por padrão) a temperatura zero,
porque as duas tarefas são classificação, não escrita. Custa uma fração de
centavo e alguns segundos.

**[1b] Filtro de perguntas.** Entre o questionador e o respondedor. Recebe o
resumo e as 25-30 perguntas, e devolve as que devem morrer: a que o resumo já
responde, a que apenas reconduz à tese, a que é sobre o sermão em vez de sobre
o assunto, a genérica, a que se esgota numa definição.

É o corte de melhor rendimento do pipeline, porque ataca na fonte: uma
pergunta cuja resposta já está no resumo produz, necessariamente, um trecho que
repete o resumo. Descartada aqui, ela economiza uma resposta E o parágrafo que
sairia dela.

Salvaguarda: se sobrarem menos de seis perguntas, seguimos com TODAS. Corte
excessivo significa questionador preguiçoso, e responder duas sobras produziria
um estudo raquítico — repetição é ruim, mas vazio é pior.

**Calibragem, medida.** A primeira versão do filtro perguntava "o resumo já
responde isto?" e reprovava 25 de 25, depois 28 de 28: num estudo sobre o mesmo
assunto, quase toda pergunta encosta no que o resumo tocou, e o filtro só
acionava o fallback. O critério foi estreitado para o teste do estranho —
tratar do mesmo assunto deixou de ser motivo de corte. E mesmo assim o
`gpt-4o-mini` continuava reprovando 26 de 27; com o mesmo prompt, o `gpt-5-mini`
reprova 6, em 9 segundos. Era teto de modelo, não de prompt.

**[4b] Checagem de tese.** Depois do redator. Compara a tese e os títulos de
seção do resumo com os do artigo, e responde uma coisa só: o estudo está apenas
repetindo?

Existe porque o filtro [1b] não alcança esta falha. Mesmo partindo de perguntas
boas, o redator pode colapsar o artigo de volta na tese do sermão na hora de
amarrar tudo — foi a falha observada em produção, e nenhum filtro de entrada a
pega.

Quando reprova, dispara **uma** reescrita, com a sobreposição nomeada
explicitamente numa mensagem separada. Se a segunda tentativa também repetir, o
estudo é entregue assim mesmo: o usuário já pagou as moedas, e devolver 502
depois de cobrar é pior que entregar algo imperfeito. O fato fica no log e em
`/admin/studies`.

**A reescrita respeita um prazo.** O pipeline inteiro mede ~255s e a função tem
teto de 300s; uma reescrita são mais ~100s. Passado
`REWRITE_DEADLINE_MS` (150s), o veredito vira só sinal — tentar reescrever fora
do prazo trocaria "estudo com a tese parecida" por "função morta depois de
debitar as moedas". Com os modelos de hoje ela quase nunca cabe; se um modelo
mais rápido entrar, ela volta a caber sozinha.

Os dois cortes ficam registrados em `StudyRecord.guard`, então o
`/admin/studies` distingue as duas razões de uma pergunta não ter virado texto:
**cortada** (o guardião disse que o resumo já respondia — culpa do
questionador) e **não escolhida** (o respondedor preferiu outras — se ele
deixou de fora justamente as boas, a culpa é dele).

## As duas etapas determinísticas são o coração

Nenhuma instrução em linguagem natural — por mais maiúscula, por mais "REGRA
DE OURO" — consegue o que uma consulta a `NVI.json` consegue de graça: garantir
que o versículo está certo.

Regra geral que passa a valer: **toda restrição que pode virar código sai do
prompt e vira código.** O que sobra no prompt é o que só linguagem consegue
pedir — julgamento.

## O que não existe aqui, e por quê

- **Não há passo de auditoria de conteúdo.** Ele existia na primeira versão e
  foi removido: o artigo fala do ASSUNTO, não do que o pregador disse, então o
  risco de atribuir ao pregador uma posição que ele não defendeu caiu muito. O
  que o auditor de fato pegava — citação sem origem, versículo parafraseado —
  a selagem pega melhor, porque é código e não instrução. O que sobrou de
  verificação é o guardião, que faz uma pergunta só e a faz barato.
- **Não há passo de pesquisa.** `callChat` fala com Chat Completions sem
  ferramentas: não há web search nem base indexada. Uma "pesquisa" contra o
  conhecimento paramétrico do modelo é só mais uma chance de inventar, com um
  rótulo mais confiável colado em cima. Ela entra quando a camada de
  conhecimento existir (`docs/scriba-rag-proposta-claude.md`, PR 1-2): o passo
  [3] passa a produzir `âncoras = versículos + chunks recuperados`, e o
  respondedor recebe fontes reais com proveniência. **O pipeline foi desenhado
  para que essa troca seja um parâmetro, não uma reescrita.**

---

# 4. Estratégia de modelos

| Etapa | Papel | Env var | Modelo | Esforço |
|---|---|---|---|---|
| [1] Questionador | amplitude e ângulos improváveis | `OPENAI_STUDY_QUESTIONS_MODEL` | `gpt-5.1` | low |
| [1b] [4b] Guardião | classificação | `OPENAI_STUDY_GUARD_MODEL` | `gpt-5-mini` | low |
| [2] Respondedor | seleção e substância | `OPENAI_STUDY_ANSWERS_MODEL` | `gpt-5.1` | padrão |
| [4] Redator | prosa | `OPENAI_STUDY_WRITE_MODEL` | `gpt-5.1` | low |

## A troca de modelo foi a mudança de maior impacto

Isto foi medido, não estimado. Com `gpt-4o` nas três etapas, sobre o mesmo
sermão e com os mesmos prompts:

| | gpt-4o | gpt-5.1 |
|---|---|---|
| palavras por resposta | 186 | 420 |
| palavras do artigo | 723 → 1.330 | 3.100 → 4.000 |
| blocos | 17 | 55-71 |
| distinções, objeções, leituras | 0 | várias |
| seções | rótulos de categoria | temas próprios |

Três rodadas de ajuste de prompt levaram o artigo de 723 para 1.330 palavras e
pararam ali. A troca de modelo levou para 4.000 na primeira tentativa. **Era
teto de modelo, e nenhum prompt ia furá-lo** — vale lembrar disso antes da
próxima rodada de reescrita de prompt.

O estudo é a funcionalidade paga por si mesma e a única que o usuário lê
inteira. É onde o modelo caro se paga.

## O que a família de raciocínio muda no `callChat`

`gpt-5*` e os modelos `o*` falam um dialeto diferente do Chat Completions, e as
duas diferenças são erro 400, não aviso:

- `max_tokens` é recusado — o nome é `max_completion_tokens`;
- `temperature` só aceita o padrão, e mandá-la junto de `reasoning_effort`
  falha.

`lib/llm/openai.ts` detecta a família por prefixo e troca os parâmetros. Quem
regula a etapa nesses modelos é `reasoning_effort`, não a temperatura — os
valores de `temperature` nas rotas seguem valendo se alguém configurar um
`gpt-4o` de volta.

O esforço por etapa segue a natureza do trabalho: **baixo** para levantar
perguntas (é divergência, e raciocinar demais CONVERGE), **padrão** para
responder (é onde os fatos e as distinções se decidem), **baixo** para escrever
(compor prosa a partir de material pronto não é dedução — o fôlego vem do
orçamento de blocos do prompt).

## Latência e o teto da função

O pipeline mede **~255s**: 35s perguntando, ~110s respondendo, ~100s
escrevendo, mais os cortes do guardião.

As rotas declaram `maxDuration = 300` — sem isso a função morreria no padrão da
plataforma, e morreria DEPOIS de debitar as moedas. As chamadas [2] e [4]
passam `timeoutMs` de 240s, contra os 60s padrão do `callChat`.

Esse orçamento é o que governa duas decisões acima: o esforço baixo no redator
e o prazo da reescrita do guardião. Ele também é o primeiro a apertar quando
alguém quiser um estudo ainda mais longo.

## O preço

**50 moedas**, contra as 5 de antes (`lib/coins/pricing.ts`). São três chamadas
a um modelo de raciocínio produzindo um artigo de três a quatro mil palavras: o
estudo passou a ser a ação mais cara do produto por uma ordem de grandeza.

Reprocessar custa o mesmo 50, e não pode custar menos: reprocessar roda o
pipeline inteiro de novo, e um preço menor abriria a arbitragem de gerar uma
vez pelo preço cheio e reprocessar indefinidamente barato.

O custo real por estudo é MEDIDO em `/admin/usage` — as três etapas gravam com
rotas separadas, então dá para ver quanto custa perguntar, responder e
escrever, e decidir onde baixar de modelo se a conta não fechar.

---

# 5. Estrutura do estudo

O resultado é um **artigo**: texto corrido, que se lê do começo ao fim, com
título, tese e de três a seis seções.

`DeepeningPayload` deixa de ser alias de `SummaryPayload`.

## 5.1 Blocos novos

Ao vocabulário do resumo, quatro tipos que hoje não teriam como existir:

- `objection` — uma objeção honesta, pelo lado mais forte dela, com a resposta.
  É o que mais faltava: nenhum bloco do resumo comporta tensão.
- `distinction` — `{ a, b, text }`: dois conceitos que costumam ser colapsados.
- `reading` — `{ author, title, note }`: indicação de leitura. Campos separados
  justamente para que autor e obra possam ser validados em código.
- `question` — pergunta em aberto, **no máximo duas e só no fecho**. O limite é
  a regra número um do redator em forma de tipo: o texto é artigo, não
  questionário.

Cada um sai do modelo com campos, não com prosa — é o que permite à selagem
conferir. Mesmo princípio de `bibleQuote.reference` vs `text`.

## 5.2 Não há cota de nada

Nem de citação, nem de versículo, nem de seção. O comprimento vem do número de
perguntas boas respondidas, não de uma instrução para escrever longo — pedir
"escreva longo" é o pedido que produz enchimento. A instrução ao redator é a
inversa: não corte substância para encurtar, e não escreva parágrafo que não
carrega ideia nova.

## 5.3 A armadilha do redator

Ele pode simplesmente tirar os pontos de interrogação e entregar um FAQ
disfarçado — um parágrafo por resposta, na ordem em que vieram. Três
instruções existem só para impedir isso: licença explícita para **reordenar,
fundir, descartar e desdobrar** respostas; a exigência de uma **tese** que
atravessa o texto; e a ordem de **abrir pelo problema, nunca pela definição**.

O teste: se o artigo tem tantas seções quanto respostas recebidas, o redator
não fez o trabalho.

## 5.4 Divergência entre tradições é conteúdo

O leitor pode ser batista, presbiteriano, pentecostal, metodista ou luterano.
A leitura ingênua disso ("não ofenda ninguém") produz mingau: o modelo hedgeia
tudo em "alguns entendem X, outros Y", que é exatamente o genérico que esta
reforma existe para matar.

A regra tem duas metades, e a primeira é a que importa:

- **Onde as tradições protestantes concordam** — e é a maior parte do
  evangelho — **afirme com convicção, sem ressalva.** Encher de "alguns creem
  que" o que a Igreja crê há vinte séculos é covardia, não prudência.
- **Onde divergem de fato** — soberania e livre-arbítrio, batismo, dons,
  perseverança, escatologia — **a divergência vira conteúdo**: nomeie os lados
  e explique o que cada um está protegendo. "Reformados e arminianos separam
  águas aqui, e a diferença é esta" ensina; "há várias visões" não ensina nada.

O respondedor registra isso no campo `tension` de cada resposta, e o redator o
usa. Vazio significa consenso — e aí o texto afirma.

---

# 6. Estratégia de fontes

Regra única, aplicada em código na selagem:

> **Uma fonte só entra se tiver identificação suficiente para ser conferida por
> um humano em menos de um minuto.**

Na prática:

- `quote` passa a exigir `author` **e** `work` (obra nomeável). Sem `work`, o
  bloco é descartado no passo [5] — não "avaliado", descartado.
- `reading` exige `author` e `title`.
- `author` é validado contra um índice em `lib/prompts/theologians.ts` que
  substitui a whitelist plana: cada autor com século, tradição, obras
  principais e temas. O índice serve a dois propósitos — filtrar na selagem e,
  sobretudo, **entrar no prompt de redação já filtrado por tema**: o modelo
  recebe os oito a doze autores pertinentes ao eixo, com obra e assunto, em vez
  de 48 nomes soltos. É o ataque direto ao "nomes jogados no texto".
- Versículo nunca vem do modelo. Vem da NVI, sempre.

O passo que fecha o problema de vez fica registrado como próximo: quando a base
do RAG existir, `quote` deixa de ser "o modelo lembrou" e passa a ser "o chunk
indexado diz", com `source_id` no bloco. A estrutura de campos proposta aqui já
é a que esse dia vai exigir.

---

# 7. Critérios de qualidade

Oito critérios, avaliados por leitura humana sobre uma **amostra fixa** de
sessões — reaproveitar as mesmas sessões a cada rodada é o que torna a
comparação possível. Nota 1-5, exceto os binários.

| # | Critério | Como se mede |
|---|---|---|
| 1 | **Fidelidade** | Alguma afirmação atribui ao pregador algo que ele não disse? (binário; qualquer ocorrência reprova) |
| 2 | **Verificabilidade** | % de `quote`/`reading` cuja obra existe e contém a formulação |
| 3 | **Novidade sobre o resumo** | Quantos blocos trazem substância ausente do `finalSummary` |
| 4 | **Qualidade das perguntas** | Quantas das 25-30 levantadas rendiam de fato? O respondedor escolheu as certas? |
| 5 | **Ausência de genérico** | Quantos blocos passariam intactos para um sermão de outro tema |
| 6 | **Densidade** | Blocos com conteúdo ÷ blocos totais |
| 7 | **Provocação** | O estudo produz uma pergunta que o leitor não tinha |
| 8 | **Honestidade de extensão** | Estudo curto para sermão raso conta a favor, não contra |

O critério 5 é o único já perseguido hoje (via anti-template) e sozinho não
resolveu nada — está na lista para não regredir, não como meta.

**As perguntas são persistidas junto com o estudo** — todas, com marcação de
quais foram respondidas. É o que separa duas falhas que se parecem no texto
final e têm consertos opostos: as perguntas eram rasas (mexer no questionador)
ou eram boas e foram mal respondidas (mexer no respondedor). Sem esse dado, a
próxima rodada de melhoria volta a partir de impressão.

---

# 8. Planos e feature entitlements

## 8.1 Flag e entitlement são coisas diferentes — e a distinção vale

- **Entitlement**: "este plano dá direito a isto". Muda com contrato, dura
  enquanto a assinatura vive, e negá-lo é uma decisão de produto que o usuário
  reverte comprando.
- **Flag**: "isto está ligado". Muda com deploy ou incidente, é temporária, e
  não tem nada a ver com quem o usuário é.

Confundir as duas produz `if (plan === "estudioso" && !isBroken)` espalhado.
Mas criar duas abstrações grandes seria pior. A saída: **um ponto único de
consulta, com as duas dimensões dentro dele.**

```ts
canUseFeature(ctx, "study_generation")
// false se: a feature está desligada (kill switch)
//        ou o plano do usuário é inferior ao mínimo
//        ou um override do admin revogou para este usuário
```

## 8.2 Onde mora a regra

O catálogo (`feature → plano mínimo`) mora **em código**, client-safe, em
`lib/entitlements/features.ts`. Pela mesma razão que `lib/billing/catalog.ts`
mora em código: uma linha errada numa tabela do banco não pode virar acesso
grátis a uma feature paga. O admin **vê** a matriz; não a edita.

O que o admin edita é o que faz sentido editar em runtime:

- **kill switch por feature** — desligar para todos durante um incidente;
- **override por usuário** — conceder a um beta tester, revogar de um abusador.

Ambos em `feature_overrides`, com `service_role` como único escritor — o mesmo
padrão de `grant_coins`.

## 8.3 A proteção mora no servidor

Esconder o botão é UX, não segurança. `POST /api/deepening` passa a chamar
`requireFeature("study_generation")` **antes de cobrar moedas**, e responde 403
`feature_not_available`. O botão também é escondido, porque oferecer o que vai
dar 403 é um bug de produto — mas a ordem importa: servidor primeiro.

## 8.4 Duas decisões de produto que a implementação assume

Fechar o "Gerar estudo" para o Estudioso tira uma capacidade de quem já a
tinha. Ambas revertem em uma linha do catálogo:

1. **Estudos já gerados continuam legíveis** por qualquer plano. Só a *geração*
   é restrita. Retirar acesso a conteúdo já pago seria confisco.
2. **`reprocess_deepening` segue a mesma regra da geração** — é geração com
   outro nome.

---

# 9. Ordem de implementação

| Passo | Entrega | Estado |
|---|---|---|
| 1 | Feature entitlements: catálogo, gate no servidor, UI, admin, docs | **feito** |
| 2 | Índice de teólogos com obra, século e tema (`lib/prompts/theologians.ts`) | **feito** |
| 3 | Tipos de bloco novos + `StudyPayload` próprio + `StudyBlockRenderer` | **feito** |
| 4 | Pipeline questionador → respondedor → redator (`lib/study/`) | **feito** |
| 5 | Amostra fixa de sessões + planilha dos oito critérios | a fazer |
| 6 | (RAG PR 1-2) fontes reais no passo [3] — ver `docs/scriba-rag-*` | a fazer |

## O que o passo 5 ainda precisa

A metade instrumental existe: as perguntas são persistidas em
`session_deepenings.plan` e `/admin/studies` mostra as levantadas, as
escolhidas e o resultado lado a lado. Falta a metade humana — escolher as sessões da amostra e passar a
preencher a tabela dos oito critérios a cada mudança. Sem isso, a próxima
rodada de melhoria volta a começar de impressão.

Uma consequência prática de já ter medido pouco: os estudos gerados antes
desta mudança têm `plan = NULL`, e não há backfill possível. A comparação
antes/depois é entre estudos NOVOS e a memória dos antigos — o que é
suficiente para a primeira rodada e insuficiente para a segunda.
