# src/features/tour: as apresentações das telas

O balão que aparece uma vez, por tela, explicando o que há ali. Não é
onboarding de boas-vindas: é a explicação de CADA tela, no dia em que a pessoa
chega naquela tela pela primeira vez.

```
config.ts                      os três atrasos, um por tipo de tela
components/TourProvider        o dono do estado; mora no layout de (app)
components/TourRunner          o overlay: o véu com furo e o balão
components/TourTrigger         o gatilho, montado no fim de cada tela
components/ProfileTourRow      "Rever os tours", no /profile
lib/anchors.ts                 achar o elemento de que o passo fala
lib/api.ts                     as três chamadas, duas em silêncio
```

O vocabulário (chaves, versões, passos) mora em `lib/domain/tour.ts`,
client-safe, porque é o mesmo que o servidor consulta para decidir e o
navegador para desenhar. A decisão de mostrar mora em `lib/db/tours.ts`, e a
tabela em `supabase/migrations/0051_user_tours.sql`, cujo cabeçalho tem o
raciocínio do schema.

## A regra que governa tudo: uma vez por pessoa, por TELA

Não existe "o" tour do Scriba. A Biblioteca, o resumo salvo, o estudo e cada
modo de captura ensinam coisas diferentes, e quem chega pelo link de um resumo
pode levar semanas até abrir a Biblioteca. **Uma flag única de "já fez o
onboarding" gastaria a explicação de cinco telas na primeira delas**, e é por
isso que a chave primária de `user_tours` é `(user_id, tour)`.

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

**O alvo é o primeiro elemento VISÍVEL do seletor, não o primeiro.** O botão
"Gravar" existe duas vezes (header do desktop, barra do celular) e um deles
está sempre em `display: none`. Um `querySelector` cru recortaria um retângulo
de tamanho zero no canto da tela, sem erro nenhum no console. Ver
`lib/anchors.ts`.

**Nenhum tour roda com o microfone ligado.** Os três tours de captura têm
`enabled={!hasStarted && !autoStart}`, e as duas metades são necessárias:
`autostart=1` faz a gravação começar sozinha ao chegar na página, quando
`hasStarted` ainda é falso durante o tempo do atraso. Um balão por cima de uma
pregação em andamento é o pior defeito que esta pasta poderia ter.

**O tour tem preferência sobre a pesquisa de satisfação.** As duas moram nas
mesmas telas (`/summary`, `/deepening`) e as duas abrem sozinhas. Enquanto um
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
`TourProvider` envolve a moldura inteira porque parte dos alvos (o "Gravar")
mora no header e na barra inferior.

**O balão vai para o `body`, num portal.** `position: fixed` deixa de ser
relativo ao viewport dentro de um ancestral com `transform`, e o layout de
`(app)` tem o `PageTransition`, que anima deslocamento a cada troca de rota.

## Onde os gatilhos estão montados

| Tela | `tour` | Atraso | Portão |
|---|---|---|---|
| `/feed` | `feed` | 1,2s | não roda no estado vazio |
| `/recordings` | `recordings` | 1,2s | não roda no estado vazio |
| `/studies` | `studies` | 1,2s | nem vazio, nem na tela de convite |
| `/recording/:id/summary` | `summary` | 3s | — |
| `/recording/:id/deepening` | `study` | 3s | — |
| `/recording/:id/live` | `capture_live` | 0,7s | antes de a gravação começar |
| `/recording/:id/audio` | `capture_audio` | 0,7s | idem |
| `/recording/:id/transcribe` | `capture_transcribe` | 0,7s | idem |

Os atrasos e o porquê de cada um estão em `config.ts`.

Os estados vazios ficam de fora porque neles os alvos do meio não existem, e o
tour encolheria para uma frase solta sobre uma lista que não está lá. A tela de
convite do `/studies` fica de fora por outro motivo: ela JÁ É uma explicação, e
um tour por cima dela é a mesma coisa dita duas vezes.

## Telas com tour, e o atributo que o holofote procura

O contrato entre o passo e a tela é um seletor CSS, e a convenção é
`data-tour="…"`. Ao mexer num destes elementos, o atributo vai junto:

| `data-tour` | Onde vive |
|---|---|
| `nav-record` | `NewRecordingDialog` (header) e `MobileBottomNav` |
| `feed-reflection`, `feed-entries` | `app/(app)/feed/page.tsx` |
| `recordings-unfinished` | `app/(app)/recordings/page.tsx` |
| `recordings-import` | `ImportYoutubeButton` |
| `collection-search` | `CollectionSearch` (serve à Biblioteca e aos Estudos) |
| `summary-header`, `summary-followups` | `SavedSessionView` |
| `session-menu` | `SessionMenu` |
| `deepen` | `DeepenButton`, nos três estados permanentes |
| `study-thesis` | `app/(app)/recording/[id]/deepening/page.tsx` |
| `study-menu` | `DeepeningMenu` |
| `record-button` | `RecordButton` |

Um atributo que some não quebra nada: o passo simplesmente deixa de aparecer, o
que é a pior forma de a explicação falhar, porque não avisa. Quando um alvo
mudar de lugar, mude o atributo com ele.

## O que ainda não existe

Não há tela de administração dos tours. `completed_at`, `dismissed_at` e
`last_step` estão sendo gravados desde o primeiro dia justamente para que a
pergunta "qual tour as pessoas abandonam, e em que passo?" tenha resposta
quando alguém for olhar; a tela que a mostra é trabalho de outro dia.
