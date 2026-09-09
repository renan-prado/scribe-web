# O modo YouTube — a decisão e a conta

Este documento existe porque as duas escolhas centrais do modo — **usar um
provedor pago para algo que parece gratuito** e **cobrar por vídeo em vez de
por minuto** — parecem erradas até se ver o número atrás delas.

## 1. Por que não extraímos a legenda nós mesmos

A legenda do YouTube é pública e o endpoint `timedtext` é aberto. Isso deixou
de bastar.

Desde o fim de 2024 o YouTube pune reputação de IP de **datacenter** naquele
endpoint, e continua servindo IP residencial e móvel normalmente. O efeito é o
pior possível de depurar, porque não é um erro — é um ambiente:

- `youtube-transcript` e afins funcionam na máquina de quem escreveu;
- os mesmos vinte caracteres de código devolvem 429 e página de bot-check
  depois de ~100-200 requisições a partir da Vercel;
- um IP novo de datacenter funciona por algumas horas antes de ser cortado.

As três alternativas óbvias foram descartadas, cada uma por um motivo próprio:

| Caminho | Por que não |
|---|---|
| API oficial (`captions.download`) | Exige OAuth do **dono** do vídeo. Serve para quem baixa a legenda do próprio canal, e nada além disso |
| Buscar do navegador do usuário | CORS. O IP seria residencial e resolveria o bloqueio, mas `youtube.com` não devolve cabeçalho para nós |
| Proxy residencial próprio | Custo recorrente **mais** manutenção do parser toda vez que o YouTube muda o formato da resposta. É virar mantenedor de uma corrida que não temos interesse em correr |

Sobrou provedor hospedado. É `lib/youtube/supadata.ts`, atrás da interface de
`lib/youtube/transcript.ts` — a indireção existe porque este é o pedaço do
produto com maior chance de precisar ser trocado, e trocar tem de ser escrever
um arquivo ao lado, não caçar `x-api-key` dentro de uma rota que também cobra
moedas.

**A exceção que confirma a regra:** `lib/youtube/oembed.ts` chama o YouTube
direto, do servidor, e funciona. O oEmbed é serviço de metadado público pensado
para ser consumido por servidor de terceiro (é o que monta o preview de um link
colado em qualquer lugar) e não passa pelo antifraude do `timedtext`. Ele nos dá
título e canal de graça — e nada além disso, porque não devolve duração.

## 2. Só legenda que já existe

`mode=native`. A Supadata sabe transcrever o áudio com Whisper quando não há
legenda, e essa porta está **fechada**:

- custa **2 créditos por minuto** contra 1 por vídeo;
- volta assíncrona (202 + `jobId`), exigindo polling e uma tela de espera que
  sobreviva a reload;
- num vídeo de duas horas o provedor sozinho custaria mais do que as 25 moedas
  rendem inteiras.

Vídeo sem legenda é recusado **antes da cobrança**, com uma frase que diz o que
houve. A cobertura disso é alta em canal de igreja: o YouTube gera legenda
automática em português para praticamente todo upload.

**O que a legenda automática não tem é pontuação.** O resumo aguenta — ele
reorganiza a mensagem em blocos e não depende de ponto final —, mas a leitura
crua sofre. É por isso que a sessão importada abre em `/summary` e não numa
página de transcrição, e por isso `short_summary` nasce nulo em vez de receber
as primeiras frases do texto, que virariam um cartão ilegível na lista.

## 3. O título vem em três pedaços colados

O primeiro teste real do modo entregou isto:

```
título do vídeo:  "Pr. Yago Martins I Por seis vezes foi melhor ser pagão I 09.03.2025 - 17H"
author_name:      "batistadopovo"
```

Usando o oEmbed cru, aquilo virava o título da sessão e "batistadopovo" virava
o **autor** do sermão. Dois erros:

1. O título são **três informações** — pregador, tema e data —, e o separador é
   a **letra `I` maiúscula**, não um pipe.
2. O canal é a **igreja**, não o pregador. O sermão é do Yago Martins.

### Por que um modelo e não uma regra

O `I` como separador é o caso que mata a abordagem textual: nenhuma regra o
distingue de um `I` legítimo dentro de um título sem estragar outro vídeo. E
ele é só a variação mais chamativa — na prática os canais usam `|`, `I`, `l`,
`-`, `–`, `//`, `•`, colchetes e parênteses, com o pregador ora antes ora
depois do tema, e com data, hora, série, `#327`, "AO VIVO" e "EBD" espalhados.

A decisão canal-é-igreja-ou-pessoa também não cabe em configuração: "Ministério
Fiel" é local, "Yago Martins" é autor, e a diferença é semântica.

`lib/youtube/metadata.ts` faz uma chamada de `gpt-4o-mini` a temperatura 0 sobre
UMA linha de texto (título + canal). É extração, não julgamento: tudo que a
resposta precisa conter já está na entrada, e o prompt traz cinco exemplos
resolvidos. Custa frações de centavo e tem rota própria em `llm_usage_events`
(`youtube-metadata`) — separada porque é a única chamada do produto que roda
sobre METADADO e não sobre o sermão, e fundida com a do resumo ninguém saberia
que há duas chamadas numa importação.

Medido sobre oito títulos, reais e sintéticos, oito acertos:

| entrada | title | autor | local |
|---|---|---|---|
| `Pr. Yago Martins I Por seis vezes… I 09.03.2025 - 17H` @batistadopovo | Por seis vezes foi melhor ser pagão | Pr. Yago Martins | Canal Batista do Povo |
| `Bispo Macedo - A fé que move montanhas - 12/01/2025` @IURD Oficial | A fé que move montanhas | Bispo Macedo | Canal IURD Oficial |
| `Presbítero João Alves \| O temor do Senhor \| EBD` @ipbcentral | O temor do Senhor | Presbítero João Alves | Canal IPB Central |
| `Diácono Marcos Silva - Servir com alegria` @Igreja Nova Aliança | Servir com alegria | Diácono Marcos Silva | Canal Igreja Nova Aliança |
| `Padre Fábio de Melo - Deus e a solidão` @Canção Nova | Deus e a solidão | Padre Fábio de Melo | Canal Canção Nova |
| `Como Deus fala conosco hoje?` @Yago Martins | Como Deus fala conosco hoje? | Yago Martins | **null** |
| `CULTO DE DOMINGO - AO VIVO - 09.03.2025` @ibnovavida | **null** | null | Canal IB Nova Vida |
| `Quem é o Espírito Santo? - Rev. Augustus Nicodemus - IPB Goiânia` @Fiel TV | Quem é o Espírito Santo? | Rev. Augustus Nicodemus | IPB Goiânia |

### Duas regras de forma que não são cosméticas

**O título eclesiástico FICA, na forma em que veio.** "Pr. Yago Martins" não
vira "Yago Martins", e "Pastor" não vira "Pr.". É assim que o pregador é
chamado na fonte, e normalizar seria decidir por quem publicou. O prompt traz a
lista para reconhecer (Pastor, Reverendo, Bispo, Presbítero, Diácono,
Missionário, Apóstolo, Evangelista, Padre, Frei, Irmão, Ancião, Doutor, nas
formas por extenso e abreviadas, masculino e feminino); ela é de RECONHECIMENTO,
nunca de conversão.

**Local que veio do CANAL leva "Canal " na frente.** `speaker_location` quer
dizer "onde isto foi pregado", e nos outros três modos quem responde é uma
pessoa digitando. Aqui é dedução nossa: o canal que publicou provavelmente é a
igreja, mas o vídeo não afirmou isso. "Canal Batista do Povo" é honesto;
"Batista do Povo" seco afirma um lugar que ninguém confirmou. Quando a igreja
está DECLARADA no título — a última linha da tabela — ela vai limpa, sem
prefixo, e o canal que só publicou ("Fiel TV") é descartado.

### Os dois `null` da tabela são o desenho, não falha

**Título nulo é uma resposta.** "CULTO DE DOMINGO - AO VIVO - 09.03.2025" não
tem título de pregação: tem data e rótulo. O prompt manda devolver `null`, a
rota põe `keepTitle: false`, e **o resumo cria um título a partir do conteúdo**
— que é melhor que qualquer coisa extraível daquela linha. O log marca esses
casos como `titleFromSummary`; se o número subir, o prompt está conservador
demais.

**Local nulo é canal pessoal.** Quando o canal é o nome de uma pessoa, ele vira
o autor e não há igreja a afirmar.

O que distingue "o modelo devolveu null de propósito" de "o JSON veio quebrado"
é o resto do objeto: o parser devolve os **três** campos nulos quando não
conseguiu ler nada, enquanto uma resposta de verdade que abre mão do título
quase sempre traz pregador ou igreja. Três nulos = não houve resposta, e aí o
título cru volta.

### O que ficou de fora

- **A transcrição não entra no prompt.** A abertura de um sermão às vezes traz
  o pregador se apresentando, e seria a saída para o vídeo cujo título não
  nomeia ninguém. Ficou fora porque multiplicaria o tamanho da chamada por um
  ganho incerto — é a primeira escotilha a abrir se a extração se mostrar fraca.
- **Nada é ligado às entidades reutilizáveis** (`speakers` / `locations`). A
  importação preenche só os snapshots `speaker_name` / `speaker_location`, como
  os outros modos fazem por padrão. Agrupar imports sob "Yago Martins" exigiria
  casamento aproximado de nome, que é problema próprio.
- **"PARTE 3" é descartado** junto com o resto da numeração de série. É uma
  perda pequena e deliberada; o título fica "Romanos 8".

### Onde o link é colado

Em `/importar`, uma página própria — não no diálogo de gravação.

Já esteve lá, como um card de modo com um `<input>` dentro, e duas coisas
quebraram: o card precisava crescer no meio de uma fileira de irmãos do mesmo
tamanho, e o rodapé do diálogo tinha de mentir sobre a unidade do preço ("/min"
num modo que cobra por vídeo). Escolher COMO capturar e escolher QUAL vídeo são
duas perguntas.

Hoje o diálogo "Gravar" itera sobre `CAPTURE_MODES` (os três que ligam o
microfone) e o YouTube entra pela Biblioteca, num botão secundário ao lado do
título. O botão primário do app continua sendo "Gravar": gravar ao vivo é o
produto, importar é o atalho para o que já está online.

A limpeza roda **depois da cobrança**, entre o débito e a gravação da
transcrição. Antes do débito só acontece o que decide se o vídeo é importável —
e esta etapa não decide nada, ela embeleza. Falha dela devolve o título cru; o
que ela nunca faz, em nenhum caminho de erro, é deixar o canal virar autor.

## 4. A conta das 25 moedas

Régua: `DEFAULT_COIN_PRICE_PER_THOUSAND_BRL` = R$ 20 o milheiro (1 moeda =
R$ 0,020), alvo de 70% em `DEFAULT_TARGET_MARGIN_PCT`.

| item | custo | de onde vem |
|---|---:|---|
| legenda (1 crédito Supadata) | ~R$ 0,03 | preço do provedor, fixo por vídeo |
| resumo + releia/lembra/frases | R$ 0,105 | **medido** — é o número que fixou `summaryFromTranscript` em 15 moedas |
| **total, vídeo típico** | **~R$ 0,135** | |

A régua pediria **23**. O preço é **25**, e fica acima dela de propósito: o
custo do resumo cresce com a transcrição na **entrada** e a receita não cresce
com nada.

| duração | receita | margem |
|---|---:|---:|
| 30 min | R$ 0,50 | ~70% |
| 60 min | R$ 0,50 | ~65% |
| 120 min | R$ 0,50 | ~56% |

**É o teto de 2 horas que segura a última linha dessa tabela.**
`COIN_COSTS.youtubeImport` e `YOUTUBE_MAX_DURATION_MS` andam sempre juntos:
subir o teto sem mexer no preço é escolher a linha de baixo para todo mundo.

### Por que não por minuto

Os três modos de captura cobram por minuto porque o custo deles **é** por
minuto — cada minuto de áudio é uma chamada de STT a US$ 0,006. Uma importação
não tem STT: a legenda já existe e custa o mesmo num vídeo de dez minutos e num
de duas horas. Cobrar por minuto de vídeo seria cobrar por um trabalho que não
fazemos.

### O que 25 compra de graça

25 é metade de `INITIAL_COIN_BALANCE`, e isso não é coincidência: quem acabou de
criar conta importa **dois sermões** antes de precisar comprar. É a única porta
do produto que não exige esperar até domingo — todas as outras dependem de
haver uma pregação acontecendo na frente do microfone.

## 5. O risco assumido: canibalização

Os mesmos 45 minutos custam **225 moedas gravados** no Modo Resumo e **25
importados**. Para uma igreja que transmite ao vivo, os dois caminhos existem, e
o segundo é 9× mais barato.

A margem se sustenta nos dois — o custo cai junto com o preço, porque a
diferença inteira é o STT que não rodamos. O que cai é a **receita por sermão**.

Isso foi decidido com o número à vista, não descoberto depois. Se um dia a
mistura de receita virar problema, os dois consertos são conhecidos e nenhum
exige mudar o desenho: subir o preço fixo, ou passar a cobrar por faixa de
duração (o ledger já separa `youtube_import` como motivo próprio, e
`/admin/precificacao` já mede a linha isoladamente).

## 6. A ordem dentro da rota

```
dono → já importada? → legenda → duração/tamanho → COBRA → resumo
```

A legenda vem **antes** da cobrança, e isso inverte o padrão de `/reprocess` e
`/api/deepening`, onde nada acontece antes de pagar. Dois motivos:

1. **A legenda é a chamada barata** (R$ 0,03); o resumo é a cara. A regra que
   aquelas rotas protegem — não deixar a chamada CARA rodar antes do débito —
   continua cumprida, porque o débito está entre as duas.
2. **É a legenda que diz se o vídeo é importável.** A duração sai do último
   segmento dela; "sem legenda", "longo demais" e "curto demais" só são
   conhecidos depois. Cobrar antes obrigaria a estornar três recusas
   rotineiras — e estorno é o caminho onde um erro de contagem vira moeda
   criada do nada.

**A transcrição é gravada assim que a cobrança passa, antes do resumo.** Falha
do modelo depois disso não estorna (como nas outras rotas), mas dói menos:
quem pagou fica com o sermão inteiro em texto, e
`/api/final-summary/from-transcript` é o caminho de recuperação que já existe.
O `ended_at` que esse UPDATE grava é também o que faz um POST repetido bater no
409 de `session_already_imported` em vez de cobrar duas vezes.

## 7. Operação

- **Variável:** `SUPADATA_API_KEY`, opcional. Sem ela o app sobe normalmente e
  só `/api/youtube/import` responde 503 `provider_unavailable` — a tela diz
  "importação indisponível", nunca "esse vídeo não tem legenda".
- **Onde configurar:** `.env.dev`, `.env.prod` e o painel da Vercel nos escopos
  **Production e Preview** (ver `docs/ambientes.md`).
- **Conta:** free tier de 100 créditos/mês para validar; Pro US$ 17/3.000
  créditos; Mega US$ 47/30.000.
- **Conciliação:** o cabeçalho `x-billable-requests` de cada resposta vai para
  o log (`supadata` scope, nível debug). Se a fatura deles divergir do número
  de importações do nosso ledger, é ali que a diferença aparece.
- **Telemetria:** quatro rotas próprias em `llm_usage_events`
  (`final-summary-youtube`, `summary-enrichment-youtube`, `rereads-youtube`,
  `reminders-youtube`), somadas na ação `youtube` de `/admin/precificacao`.
  Elas são separadas justamente para a pergunta "vídeo longo está comendo a
  margem?" ter onde ser respondida.
