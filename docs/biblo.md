# Biblo: o bate-papo dentro do resumo

> **Status: implementado.** Este documento nasceu como proposta, para a feature
> ser discutida ANTES de virar código, e é por isso que ele ainda argumenta em
> vez de descrever. O QUE FOI CONSTRUÍDO está aqui; o COMO, os números e o que
> ficou de fora estão em
> [`biblo-implementacao.md`](./biblo-implementacao.md).

---

## 1. O que é, em uma frase

**Um lugar dentro da sessão onde a pessoa conversa sobre o que ela acabou de
resumir — ou sobre o que ela está escrevendo — e sai da conversa com material
que entra no texto.**

O nome do interlocutor é **Biblo**. Ele não é um chat genérico com um nome
bonito: ele já chega sabendo o que está na tela. Se há um resumo sobre o filho
pródigo, a primeira coisa que ele diz não é "olá, como posso ajudar?", é "vi
que você está escrevendo sobre o filho pródigo — quer o contexto da parábola,
ou os paralelos em Lucas 15?".

Essa diferença é a feature inteira. Um campo de texto vazio com um cursor
piscando devolve ao usuário o trabalho de formular a pergunta, e a maioria das
pessoas não abre um chat porque não sabe o que perguntar. **O Biblo pergunta
primeiro.**

---

## 2. Por que agora

Três coisas se encontram.

**Primeiro: o resumo acabou e a pessoa fica parada.** Hoje, quando o resumo
fica pronto, o produto termina. Ela lê, edita um nome errado, compartilha. Mas
quem grava um sermão quase sempre vai fazer alguma coisa com ele depois —
pregar de novo, dar uma aula, escrever um post, estudar a passagem a fundo. Esse
"depois" acontece fora do Scriba, e é exatamente onde o valor está.

**Segundo: o estudo está saindo.** O estudo aprofundado era a resposta para esse
"depois", e ele não funcionou — `docs/estudo-v2.md` tem o diagnóstico inteiro.
Resumindo em uma linha: **uma única entrega gigante, pedida de uma vez, que a
pessoa não consegue dirigir**. Ela pede "aprofunde" e recebe quatro mil palavras
que podem estar a quilômetros do que ela queria, por 50 moedas e quatro minutos
de espera. Não há como corrigir a rota no meio.

O Biblo é a mesma ambição pelo caminho oposto: **em pedaços pequenos, guiados
pela pessoa, um de cada vez.** Ela pede o contexto histórico de Jonas, lê, acha
interessante, pergunta sobre Nínive, gosta de um parágrafo, manda para o resumo.
Cada passo custa pouco, chega rápido e é dirigido por quem sabe o que está
procurando. O estudo tentava adivinhar tudo de uma vez; o Biblo pergunta.

**Terceiro: o `/escrever` criou um segundo momento para ele.** Quem escreve um
resumo à mão está com a folha aberta e a cabeça no assunto. É o instante em que
"me lembra outra passagem sobre perdão" tem mais valor do que em qualquer outro
lugar do app — e é o único caminho do produto que não custa moeda nenhuma, o que
o torna também o melhor lugar para alguém encostar num recurso pago pela
primeira vez.

---

## 3. Onde ele vive

**Nos dois lugares, com o mesmo comportamento: na leitura (`/summary/:id`) e na
escrita (`/escrever/:id`).**

Isso não é "vamos colocar em todo lugar". É que a conversa é sobre o CONTEÚDO, e
o conteúdo é o mesmo nos dois — o `SummaryPayload` que a IA escreve e que o
editor também escreve. Um Biblo que só existisse na leitura faria a pessoa
fechar o editor para perguntar algo sobre o parágrafo que ela está escrevendo, e
voltar depois. Um que só existisse no editor deixaria de fora quem gravou o
sermão, que é a maioria.

**Como ele aparece:** um botão flutuante com o rosto do Biblo no canto inferior
direito, nas duas telas — a pergunta nasce no meio do texto, não no topo dele. É
o mesmo gesto do `+` da Biblioteca e do hambúrguer do painel, que já são o mesmo
gesto um do outro; com o teclado aberto, ele sobe e fica em cima dele. Dali abre
uma gaveta por cima do conteúdo. Não é uma quarta aba, não é um terceiro slide
do carrossel, não é uma tela nova. O resumo continua atrás, visível, porque a conversa é SOBRE ele: quem
está lendo uma resposta sobre o versículo 14 precisa poder olhar o versículo 14.

**Uma conversa por sessão, que fica guardada.** Fechar a gaveta não joga nada
fora; reabrir no dia seguinte, no outro aparelho, mostra a conversa onde ela
parou. Uma conversa que evapora ensina a pessoa a não usá-la.

---

## 4. A abertura: o cumprimento e os chips

**O cumprimento olha o resumo antes de falar.** Título, ideia central,
passagens citadas — o suficiente para a primeira frase ser específica. Se a
sessão ainda está vazia (alguém que acabou de abrir o `/escrever`), ele
cumprimenta sem fingir que sabe de algo, e os chips viram os genéricos ("sobre
qual passagem você quer escrever?").

**Os chips são o coração da coisa, e são derivados do conteúdo, não fixos.** A
referência de desenho é o menu do `+` do editor: pastilhas com rótulo de leigo,
na ordem de uso. Se o resumo cita Jonas 1 e fala de arrependimento, os chips da
abertura são mais ou menos estes:

- **Contexto de Jonas 1** — quando foi escrito, para quem, o que estava
  acontecendo
- **Quem foi Jonas** — o personagem, sem virar aula de seminário
- **Onde ficava Nínive** — o lugar, e por que ele importa na história
- **Outras passagens sobre arrependimento** — o que mais a Bíblia diz sobre isso
- **Uma pergunta que incomode** — a provocação, o ângulo que ninguém trouxe
- **O que ler sobre isso** — livro, autor, frase de referência cristã

Três a cinco por vez, nunca a lista inteira; e novos chips aparecem depois de
cada resposta, puxados do que acabou de ser dito ("quer os paralelos em Mateus
12?"). É assim que a conversa anda sem a pessoa ter de escrever uma linha.

**E o campo de digitar está sempre lá.** Os chips são o atalho, não a cerca. A
pergunta que ninguém previu — "meu pastor disse que essa passagem fala de
dízimo, isso procede?" — é justamente a boa.

---

## 5. O que ele conversa

Seis coisas, que são a lista do produto:

1. **Indicar textos bíblicos ligados ao tema.** Não "leia também João 3:16":
   a passagem COM a razão de ela ter vindo, que é o que transforma uma lista de
   referências em material de sermão.
2. **Contexto histórico** da passagem, do livro, do momento.
3. **Personagens e lugares** que aparecem no resumo ou na conversa.
4. **Tirar dúvidas e ensinar.** A pergunta direta, inclusive a pergunta básica
   que a pessoa tem vergonha de fazer em público.
5. **Novas perspectivas e provocações.** O ângulo que o sermão não pegou, a
   tensão que o texto tem e a pregação suavizou. É aqui que o Biblo é mais útil
   e mais perigoso — ver §8.
6. **Referências para ler:** livro, autor, uma frase de alguém que a igreja
   reconhece.

**E o que ele NÃO faz:** ele não escreve o sermão. "Escreva uma pregação de 20
minutos sobre Jonas" tem de bater numa recusa gentil e numa contraproposta
("posso te dar os três movimentos e as passagens de cada um — o texto é seu").
O produto inteiro é construído sobre a voz de quem prega, e um Biblo que gera o
sermão pronto destrói isso na primeira semana.

---

## 6. Da conversa para o resumo

**Esta é a parte que separa o Biblo de um ChatGPT aberto numa aba ao lado.**

A conversa acontece ao lado de um texto que está sendo escrito. Então, quando a
resposta é boa, o Biblo oferece: *"quer que eu acrescente isso como uma passagem
bíblica depois da ideia central?"*.

Três regras, todas inegociáveis:

**Ele nunca escreve sozinho.** Toda inserção passa por um "Adicionar" explícito.
O texto é da pessoa, e um assistente que mexe no documento por conta própria vira
algo que se desliga.

**A sugestão vem no vocabulário do resumo.** Não é um bloco de texto solto no
fim: é uma *passagem bíblica*, uma *frase de destaque*, um *parágrafo*, uma
*citação* — os mesmos blocos do editor, com o mesmo desenho, entrando numa
posição que ele propõe e que a pessoa pode mudar. Se a sugestão não couber no
vocabulário que já existe, ela não é uma sugestão: é uma resposta que fica na
conversa.

**Copiar é a segunda porta, e é igualmente legítima.** Nem tudo vira bloco —
às vezes a pessoa quer o parágrafo no caderno dela, no WhatsApp do grupo, num
slide. Todo trecho da conversa tem "copiar", e nada no desenho faz disso o
caminho de segunda classe.

E, depois de adicionado, **dá para desfazer**: um "remover" no próprio cartão
recém-inserido, enquanto a conversa ainda está aberta.

---

## 7. O rosto: Biblo

O avatar é o que faz "conversar com o Scriba" virar "perguntar ao Biblo", e essa
diferença é grande na cabeça de quem usa — principalmente do público desse app,
que não é o público que já usa três chatbots por dia.

A ideia foi o [blobatar](https://blobatar.dev/): **uma biblioteca MIT, ~4,4 KB
gzipped e sem dependências, que gera um avatar geométrico determinístico a
partir de uma string** — o mesmo nome sempre produz a mesma forma —, com dez
silhuetas.

Ele resolve a **identidade** (um Biblo idêntico em todo aparelho, sem asset para
manter, sem custo, contraste já resolvido) **e resolve a atuação também**. Este
parágrafo já disse o contrário, e estava errado: a biblioteca traz oito
expressões prontas (`idle`, `happy`, `sad`, `mad`, `love`, `shy`, `sick` e
**`thinking`**), animação que respeita `prefers-reduced-motion`, e um olhar que
segue o ponteiro do mouse. Não é uma forma para animarmos por cima — é um
personagem pronto.

**Usamos três das oito**, e a regra que exclui as outras é de produto: a
expressão diz o estado da MÁQUINA (parado, pensando, deu certo), nunca uma
opinião sobre o conteúdo. Um Biblo triste ou irritado com uma pergunta sobre
doutrina é o avatar tomando o partido que a §8 proíbe o texto de tomar. O
detalhe de implementação está em
[`biblo-implementacao.md`](./biblo-implementacao.md) §9.

**Tom de voz:** amigo que estudou, não professor. Segunda pessoa, frases curtas,
zero jargão sem tradução. E — regra de ouro — **ele nunca soa mais espiritual do
que o usuário**. O Biblo informa, provoca e sugere; ele não abençoa, não
exorta e não corrige a fé de ninguém.

---

## 8. A verdade importa mais aqui do que em qualquer outro lugar do app

O resumo tem uma âncora: a transcrição. Ele pode errar um nome, mas não pode
inventar um sermão que não aconteceu. **A conversa não tem âncora nenhuma** — e
é sobre a Bíblia, com alguém que vai pregar aquilo para uma igreja no domingo.

O `docs/estudo-v2.md` já pagou o preço dessas lições, e elas valem aqui inteiras:

- **Texto bíblico não se gera, se busca.** O repositório tem onze traduções em
  `src/lib/bibles/`. Toda vez que o Biblo citar um versículo, o texto vem de lá.
- **Citação de autor é onde a invenção mora.** O nome do teólogo quase nunca
  está errado; a frase atribuída a ele está. Sem uma fonte verificável, o Biblo
  fala do autor e da ideia — não põe aspas.
- **Nada de cotas.** O estudo exigia "no mínimo duas citações, três versículos
  novos" e assim fabricava o que faltava. A conversa não tem cota de nada: uma
  resposta curta e honesta é uma boa resposta.
- **"Não sei" é resposta.** Sobre datas disputadas, autoria contestada,
  divergência entre tradições — dizer que há divergência É o conteúdo.
- **Doutrina divide, e o Biblo sabe disso.** Nos pontos onde as igrejas
  discordam, ele apresenta as posições; não escolhe. Quem escolhe é quem prega.

---

## 9. Quanto custa

> **Decidido.** A conta, os números e o que mexer quando algum deles estiver
> errado estão em [`biblo-implementacao.md`](./biblo-implementacao.md) §1: **duas
> moedas por mensagem** para quem tem plano pago, cobradas em silêncio, e **10
> mensagens de presente**, uma vez por conta, para a conta gratuita conhecer. O raciocínio que levou
> até lá continua aqui, porque ele é o que explica os números.

O que se sabia quando isto foi escrito:

- A régua da casa é 1.000 moedas ≈ R$ 20 — **uma moeda vale cerca de dois
  centavos** (`src/features/coins/economics.ts`).
- Uma resposta de chat, com o resumo como contexto, é uma chamada barata: ordem
  de menos de um centavo. É uma fração do que custa um minuto de gravação.
- O que pode encarecer não é a mensagem, é a **conversa longa**: cada resposta
  releva tudo o que veio antes, e a décima quinta mensagem custa bem mais que a
  primeira.

**O que foi recomendado aqui, e por que a decisão saiu diferente.** A
recomendação era cobrar por BLOCO de mensagens, e não por mensagem, "para não
pôr um contador na cara de quem está pensando" — a preocupação estava certa e o
remédio estava errado. O que põe o contador na cara não é a unidade de cobrança,
é o **odômetro do saldo na barra do app**; resolvido ele, cobrar por mensagem é
mais honesto (paga-se o que se usou) e não tem a parede do "compre mais dez" no
meio de uma conversa. As duas decisões viraram uma só, e a segunda tem documento
próprio: [`creditos-na-tela.md`](./creditos-na-tela.md).

O que continua valendo inteiro: a conversa é o que faz a pessoa voltar ao app
entre um domingo e outro, e cobrar caro na porta mata isso. O teto do caso
extremo também existe — só que ele virou uma janela de contexto deslizante, que
segura o custo sem nenhuma parede na tela.

Duas coisas a resolver junto com o preço: **o Biblo depende de plano?** (o
`/escrever` é o único caminho gratuito do produto, e o Biblo ali dentro é a
melhor vitrine que os planos pagos poderiam ter) e **quem não tem moedas vê o
quê?** — a gaveta abre e mostra o convite, ou o botão nem aparece?

---

## 10. O que fica de fora da primeira versão

Registrado para não ser reinventado como "e se também...":

- **Voz.** Nem falar nem ouvir.
- **Streaming de resposta.** O produto inteiro não tem SSE hoje (ver
  `AGENTS.md`), e uma conversa funciona muito bem com um "pensando" honesto.
- **Buscar na internet.** A resposta sai do que o modelo sabe mais a Bíblia
  local. Quando a camada de conhecimento curado existir
  (`docs/scriba-rag-proposta-claude.md`), o Biblo é o primeiro cliente dela — e
  é ali que "sugerir livros e frases" deixa de ser um risco de invenção e vira
  uma consulta a conteúdo que nós escolhemos.
- **Conversar sobre a Biblioteca inteira** ("o que eu já preguei sobre graça?").
  Boa ideia, outra feature: a conversa desta aqui é sobre UMA sessão.
- **Compartilhar a conversa.**

---

## 11. Perguntas em aberto

1. ~~**Preço e plano** (§9).~~ **Resolvido**, ver
   [`biblo-implementacao.md`](./biblo-implementacao.md) §1.
2. **A conversa de uma sessão `manual` que ainda está vazia** — o Biblo ajuda a
   COMEÇAR um texto do zero? É um uso diferente (e ótimo), e muda o
   cumprimento, os chips e provavelmente o preço.
3. **Reprocessar apaga o que o Biblo acrescentou**, como já apaga o que foi
   editado à mão — a pessoa precisa ser avisada disso de um jeito mais forte do
   que hoje?
4. **O que acontece com o estudo.** Se o Biblo entrega em pedaços o que o estudo
   entregava em bloco, o estudo (rotas e tabelas ainda de pé, sem botão) morre de
   vez, ou volta um dia como "juntar esta conversa num documento"?
5. **Quanto do resumo vai no contexto.** O resumo inteiro é barato; a
   transcrição inteira não é. Quase certamente: resumo sempre, transcrição só
   quando a pergunta for sobre o que foi dito na pregação.
