# src/features/tour: as apresentações das telas

O balão que aparece uma vez, por tela, explicando o que há ali. Não é
onboarding de boas-vindas: é a explicação de CADA tela, no dia em que a pessoa
chega naquela tela pela primeira vez.

```
config.ts                      os três atrasos, um por tipo de tela
components/TourProvider        o dono do estado; mora no layout do app
components/TourRunner          o overlay: o véu com furo e o balão
components/TourTrigger         o gatilho, montado no fim de cada tela
components/ProfileTourRow      "Rever os tours", no /profile
lib/anchors.ts                 achar o elemento de que o passo fala
lib/reveal.ts                  pedir à tela que ABRA o que o passo explica
lib/api.ts                     as três chamadas, duas em silêncio
```

O vocabulário (chaves, versões, passos) mora em `src/lib/domain/tour.ts`,
client-safe, porque é o mesmo que o servidor consulta para decidir e o
navegador para desenhar. A decisão de mostrar mora em `src/lib/db/tours.ts`, e a
tabela em `supabase/migrations/0051_user_tours.sql`, cujo cabeçalho tem o
raciocínio do schema.

## A regra que governa tudo: uma vez por pessoa, por TELA

Não existe "o" tour do Scriba. A Biblioteca, a gravação, o resumo salvo, a
lista de estudos e o estudo pronto ensinam coisas diferentes, e quem chega pelo
link de um resumo pode levar semanas até abrir a Biblioteca. **Uma flag única de
"já fez o onboarding" gastaria a explicação de cinco telas na primeira delas**, e
é por isso que a chave primária de `user_tours` é `(user_id, tour)`.

Tudo aqui desce daí, e nada é preferência estética:

- **É banco, não `localStorage`.** A pergunta "esta pessoa já viu isto?" é
  sobre a PESSOA. Guardada no navegador, ela volta a interromper quem se
  cadastrou no computador e abriu o celular, e some para sempre de quem limpou
  os dados do site. As duas falhas são invisíveis para nós.
- **O servidor decide, e grava no instante em que mostra.** O cliente recebe do
  layout uma cópia do mapa "tour → versão vista", e ela serve para não pedir
  nada quando não há o que mostrar, que é o caso da esmagadora maioria das
  visitas. Quem responde de verdade é `claimTour`, e é ele que resolve duas
  abas abertas na mesma tela.
- **O atraso vem ANTES da pergunta ao servidor.** A chamada é o que registra o
  tour; perguntar cedo e esperar para mostrar gastaria a apresentação de quem
  fechou a aba em dois segundos. Sair da página antes do prazo não consome
  nada, e aba escondida é tratada como saída. É a mesma inversão do
  `FeedbackPrompt`, pela mesma razão.
- **"Pular" é um botão de verdade**, do mesmo tamanho do "Próximo". Um tour
  cuja única saída visível é o X do canto ensina, antes de qualquer outra
  coisa, que a reação certa ao chegar numa tela nova é procurar o X.
- **Erro de rede não vira toast.** O tour é a explicação de uma tela que já
  funciona sozinha. A exceção é o "Rever os tours" do /profile: ali foi a
  pessoa que clicou, e um clique que não faz nada e não avisa é pior que um
  botão que não existe.

## O que quem mexer aqui não pode desfazer

**O passo cujo alvo não está na tela é DESCARTADO, e o tour segue.** Metade dos
alvos é condicional: a faixa "Em aberto" só existe para quem tem gravação
inacabada, o botão de gerar estudo troca de forma para quem já gerou. Um tour
que travasse no alvo ausente seria um tour que só funciona na conta de quem o
escreveu. E se não sobrar passo nenhum, **nada é registrado**: a tela ainda não
tem o que mostrar, e o tour espera a próxima visita.

**O passo que precisa de um menu FECHADO pede que ele abra, e é a única
exceção à regra acima.** As três portas de criação do celular moram atrás do
`+` do `CreateDock`, que nasce fechado; a apresentação da Biblioteca tem um
balão para cada uma, e medi-las na hora em que o tour monta as descartaria em
toda visita. O passo declara `reveal: "create-dock"`, o `TourRunner` publica
esse pedido enquanto ele durar, e o `CreateDock` escuta (`lib/reveal.ts`). Três
consequências que quem mexer aqui precisa manter:

- **`resolveSteps` não julga um passo com `reveal`.** Ele entra sempre — o alvo
  dele está fechado por definição, e é ele mesmo que vai mandar abrir.
- **A limpeza é de DESMONTAGEM, não da volta do efeito.** O tour acaba por
  quatro caminhos e nenhum deles pode deixar o menu aberto sobre a Biblioteca
  depois de o véu sumir; e entre dois passos que pedem o MESMO reveal, uma
  limpeza no meio fecharia e reabriria o painel a cada "Próximo".
- **Quem escuta deriva o `open`, não o guarda.** No `CreateDock`, `open` é
  `tapped || revealed`: com um estado só, o `setTapped(false)` da rolagem e do
  Esc apagaria o pedido do tour e o painel fecharia no meio do balão que fala
  dele.

**O alvo é o primeiro elemento VISÍVEL do seletor, não o primeiro.** Parte dos
alvos é desenhada duas vezes, em versões que se escondem por `display: none`
conforme a largura da tela. Um `querySelector` cru recortaria um retângulo de
tamanho zero no canto da tela, sem erro nenhum no console. Ver `src/lib/anchors.ts`.

**No celular, o balão encosta no rodapé, e por isso o alvo PRESO ao viewport
tem tratamento próprio.** A correção normal, quando o alvo cairia embaixo do
balão, é rolar a página; ela não move um elemento `fixed`, e o passo do
"Criar", cujo alvo mora no `CreateDock`, terminava com o balão pousado
exatamente em cima do botão de que estava falando. Quando rolar
não tem como resolver, alvo preso (`isPinnedToViewport`) ou página que já rolou
o que podia neste passo, o balão sobe para CIMA do alvo. Quem mexer na posição
do balão precisa manter as duas saídas: a que rola e a que troca de lado.

**Nenhum tour roda com o microfone ligado.** O tour da gravação tem
`enabled={auto !== "1"}`: quem chega pelo "Gravar" do dock leva `?auto=1`, que abre
o microfone sozinho, e ali o tour simplesmente não dispara. Quem abre a tela pelo
endereço direto vê. Um balão por cima de uma pregação em andamento é o pior
defeito que esta pasta poderia ter.

**O tour tem preferência sobre a pesquisa de satisfação.** As duas moram nas
mesmas telas (o resumo e o estudo) e as duas abrem sozinhas. Enquanto um
tour está aberto, o `FeedbackPrompt` nem começa a contar o atraso dele, e
recomeça do zero quando a tela fica livre. Não é só cortesia visual: perguntar
é GASTAR a 1ª, a 3ª ou a 8ª gravação da vida de alguém, e gastá-la atrás de um
balão é gastá-la sem resposta. Quem cede é a pesquisa porque ela ainda terá
outros dois marcos, e o tour é uma vez na vida.

**Subir a `version` de um tour é reinterromper a base inteira.** Corrigir uma
vírgula num passo não sobe versão; acrescentar um passo sobre um botão novo
sobe. A linha guarda a versão vista, e não um booleano, exatamente para essa
decisão existir.

**O overlay é UM, e mora no layout.** Duas páginas capazes de abrir o próprio
véu empilhariam dois no dia em que alguém montasse dois gatilhos por engano. O
`TourProvider` envolve a moldura inteira (`src/app/layout.tsx`) também porque o
mapa do que já foi visto sobrevive à navegação: o layout não é refeito ao andar
entre as telas, então o `seen` que veio do servidor continua valendo.

**O balão vai para o `body`, num portal.** `position: fixed` deixa de ser
relativo ao viewport dentro de um ancestral com `transform`, e o `/admin` e o
`/partners` têm o `PageTransition`, que anima deslocamento a cada troca de rota.

## Onde os gatilhos estão montados

| Tela | `tour` | Atraso | Portão |
|---|---|---|---|
| `/home` | `library` | 1,2s | — (roda TAMBÉM na Biblioteca vazia) |
| `/studies` | `studies` | 1,2s | nem vazio, nem na tela de convite |
| `/summary/:id` | `summary` | 3s | — |
| `/studies/:id` | `study` | 3s | — |
| `/recording` | `recording` | 0,7s | só sem `?auto=1` |

Os atrasos e o porquê de cada um estão em `config.ts`.

**O tour da Biblioteca tem SEIS passos no celular e CINCO no desktop, e a
diferença não é um `if` de largura.** Os três últimos falam de uma porta de
criação cada, e cada porta é desenhada duas vezes — no painel do dock e na barra
do topo —, com uma delas sempre em `display: none`; o alvo visível é o que o
holofote acha. O sexto é o `+`, que só existe no celular: no desktop as três
portas já estão abertas na barra, e um balão dizendo "elas estão atrás deste
botão" descreveria uma tela que não está ali. Sem alvo, ele se apaga sozinho.

**A Biblioteca vazia é a única que TEM tour, e é de propósito.** O vazio das
outras listas é uma lista que não encheu ainda; o vazio da Biblioteca é a
primeira tela do primeiro minuto de quem se cadastrou, e o `library` é o único
tour que começa com "Bem-vindo ao Scriba". Calá-lo ali seria calá-lo justamente
para quem ele foi escrito. Os passos sobrevivem à lista vazia porque
nenhum alvo deles mora nela: a lupa e as portas de criação existem sempre.

O vazio dos `/studies` fica de fora porque o tour de lá fala de uma lista que
não está na tela, e a tela de convite fica de fora por outro motivo: ela JÁ É
uma explicação, e um tour por cima dela é a mesma coisa dita duas vezes.

## Telas com tour, e o atributo que o holofote procura

O contrato entre o passo e a tela é um seletor CSS, e a convenção é
`data-tour="…"`. Ao mexer num destes elementos, o atributo vai junto:

| `data-tour` | Onde vive |
|---|---|
| `library-search` | a LUPA da `TopBar` na Biblioteca (`SearchToggle`, em `(app)/components/SearchScope.tsx`) |
| `studies-search` | a mesma lupa nos Estudos — o `tourId` é prop, a tela é que o nomeia |
| `collection-search` | `CollectionSearch`, a barra. Nenhum tour aponta para ela, e é de propósito |
| `create-dock` | o `+` de `src/app/(app)/home/CreateDock.tsx` (era `record-dock`, no microfone que ele substituiu). **Só no celular**: o passo que fala dele se apaga sozinho no desktop |
| `create-record` | a porta "Gravar" — o quadrado do painel do dock, e o chip do microfone da `TopBar` |
| `create-write` | a porta "Escrever", nos mesmos dois lugares |
| `create-import` | a porta "Importar", nos mesmos dois lugares |
| `record-button` | `src/app/recording/AudioStudio.tsx` |
| `summary-header` | `SavedSessionView` |
| `session-menu` | `SessionMenu` |
| `deepen` | `DeepenButton`. Sem passo apontando para ele: o botão saiu da interface com o modo estudo |
| `study-thesis` | `src/app/studies/[id]/page.tsx` |
| `study-menu` | `DeepeningMenu` |

Um atributo que some não quebra nada: o passo simplesmente deixa de aparecer, o
que é a pior forma de a explicação falhar, porque não avisa. Quando um alvo
mudar de lugar, mude o atributo com ele.

**E um atributo que EXISTE no código pode não existir na tela.** O passo
`search` do `library` apontou para `[data-tour="collection-search"]` desde o
primeiro dia e nunca apareceu uma vez: aquela barra só é montada depois do
clique na lupa, e o tour abre com ela fechada. O passo irmão dos Estudos
aparecia — lá a barra era permanente —, e parou de aparecer no dia em que ela
foi para trás da lupa também; mudou de alvo no mesmo commit. Um alvo condicional
serve de âncora para o passo que fala DELE (o botão de gerar estudo, a faixa
"Em aberto"); para o passo que fala de um recurso, a âncora é o que abre o
recurso, e esse está sempre na tela.

## O que ainda não existe

Não há tela de administração dos tours. `completed_at`, `dismissed_at` e
`last_step` estão sendo gravados desde o primeiro dia justamente para que a
pergunta "qual tour as pessoas abandonam, e em que passo?" tenha resposta
quando alguém for olhar; a tela que a mostra é trabalho de outro dia.

## As chaves foram TROCADAS, não renomeadas

Os cinco tours de hoje são `library`, `recording`, `summary`, `studies` e
`study`. Eram oito, e cinco descreviam telas que deixaram de existir: `feed` (o
Início), `recordings` (a Biblioteca antes de virar a primeira tela) e os três
`capture_*`, um por modo de gravação.

**As chaves novas não reaproveitam os nomes antigos, e isso é decisão.** O
mecanismo de `version` existe para reexibir um tour MUDADO; aqui a tela é outra,
e quem viu a apresentação do `recordings` viu outra coisa. Reaproveitar a chave
e subir a versão daria o mesmo efeito prático com uma mentira no meio: a tabela
diria que a pessoa viu a versão 1 de um tour que ela nunca viu.

As linhas antigas continuam em `user_tours` sem chave correspondente, inertes. A
coluna `tour` é texto SEM `check` de valores justamente para isso (ver o
cabeçalho de `0051_user_tours.sql`), então nada no banco precisou mudar.
