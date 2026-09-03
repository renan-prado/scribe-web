# src/features/admin — painel interno

Telas de `/admin`: métricas de produto, uso de LLM, usuários e parceiros.

## O gate

`app/admin/layout.tsx` chama `isCurrentUserAdmin()` e responde `notFound()` —
**404, não 403**. Não confirmamos a existência da área administrativa a quem
não deveria vê-la. As rotas `/api/admin/*` usam `requireAdmin()`, que devolve
404 pela mesma razão.

**Server Action de admin reconfere com `assertAdmin()`.** O gate do layout
decide o que RENDERIZA, não o que executa: uma action é um endpoint POST
próprio, e o id dela é um hash estável embutido no bundle, não um segredo. É o
que a documentação do Next diz em "Data Security". As actions de câmbio
(`lib/fx/actions.ts`) são o exemplo no repositório.

O client service-role (`lib/supabase/admin.ts`) BYPASSA a RLS. Ele só entra
depois de ter afirmado admin, e nunca vai para o navegador.

## As telas privilegiadas não vazam no bundle

Os itens de admin e de parceiro do menu do avatar são um **server component**
(`PrivilegedMenuItems`) entregue ao `UserMenu` por slot. Atrás de um
`isAdmin &&` dentro do componente cliente, as strings "Admin", "Área do
parceiro", "/admin" e "/partners" viajavam no chunk que TODO usuário logado
baixa: o `false` escondia o item na tela, não o código que o desenha.

Consequência prática: **constante lida por server component não pode morar num
arquivo `"use client"`** — o compilador do Next transforma todo export daquele
módulo em referência de cliente e a string não chega. Foi por isso que
`MENU_ITEM_CLASS` teve de sair para um módulo simples.

## Uma definição por número

`lib/db/admin/metrics.ts` é a ÚNICA implementação das métricas de produto —
funil, ativação, receita, passivo de moedas — e já aceita recorte por período
e por `partnerId`. Não escreva uma segunda consulta de "conversão" dentro das
telas de parceiro: duas definições do mesmo número um dia discordam, e a
discordância aparece como um parceiro reclamando do próprio painel.

O mesmo vale para a conta do programa de parceiros: ela mora em
`lib/partners/economics.ts`, e o simulador do admin lê de lá.

## Custo

`/admin/usage` lê `llm_usage_events`, alimentada por `recordChatUsage` /
`recordAudioUsage` em cada rota de LLM. O preço por token está em
`lib/llm/pricing.ts`; a conversão para reais usa o câmbio de
`lib/fx/usd-brl.ts`, que busca na AwesomeAPI e cai num valor manual persistido
em cookie quando o upstream falha.

**O custo por moeda é sempre MEDIDO** (uso real + câmbio), nunca uma
constante. O painel mostra custo por 1.000 moedas porque por unidade o número
some no arredondamento.

A ordenação do "top de usuários" é por **moedas gastas**, não por dólar: dólar
mistura modelos de preços diferentes e a lista deixava de responder à pergunta
que ela existe para responder.

**"Moedas gastas" é filtrado por MOTIVO, nunca por `abs(amount)`.**
`coin_transactions` é o ledger inteiro: `grant_coins` grava
`subscription_grant`, `topup_pack` e `partner_bonus` com valor POSITIVO, e o
estorno grava um negativo que é devolução de crédito, não consumo. Só os seis
motivos de `CHARGE_REASONS` são gasto. O módulo de leitura já faz esse corte —
não recrie a soma numa tela.

## Precificação (`/admin/precificacao`)

Responde a UMA pergunta que `/admin/usage` não responde: **continuo cobrando 5
moedas o minuto?** Preço não é cobrado por rota — é cobrado por AÇÃO, e uma
ação é várias rotas (o Modo Ao Vivo é transcrição + três pipelines + resumo +
os cards de acompanhamento). Somar rota a rota à mão para chegar no minuto era
o trabalho que esta tela existe para não ser refeito.

O vocabulário está em `lib/coins/billable.ts` (client-safe) e a conta em
`lib/coins/economics.ts`. O mapeamento ROTA → ação mora em
`lib/db/admin/usage.ts`, junto do resto da agregação: **é a mesma passada pelas
mesmas linhas** que alimenta `/admin/usage`. Uma segunda consulta de custo é
uma segunda definição do mesmo número.

**Há DUAS margens, e a coluna mostra a da DECISÃO.** `marginAtCurrentPrice` é
custo de uma execução contra o que a ação cobra hoje; `realizedMargin` é custo
contra as moedas que o ledger de fato debitou no período. A coluna já mostrou
só a segunda, e isso a punha em contradição com a coluna vizinha: o Estudo
aprofundado aparecia com **−18% de margem** e, ao lado, a sugestão de **cobrar
menos**. Nenhuma das duas tinha defeito de cálculo — o período pegava
lançamentos anteriores à subida de 5 para 50 moedas, então o ledger tinha 180
moedas em 18 execuções. Ao preço de hoje aquela linha tem 76% de margem.

A regra que decorre: **a margem exibida e o preço sugerido saem do MESMO custo
por execução**, ou duas colunas vizinhas voltam a se contradizer sem que nada
esteja errado. A realizada continua na tela, mas só quando o ledger cobrou algo
diferente do preço atual (`ledgerDivergesFromPrice`) — porque aí a divergência
é o achado, não ruído.

Três coisas que quem mexer aqui não pode desfazer:

- **Os dois lados da conta têm origens diferentes, e a tela diz qual é qual.**
  O custo é MEDIDO; o valor da moeda é uma régua que o admin gira. Um painel em
  que os dois parecem igualmente factuais convida a decidir preço com base num
  número que alguém digitou.
- **A régua é um cookie, não uma tabela.** Nada do que se digita ali cobra
  coisa alguma — quem cobra é o Price do Stripe, e quem credita é
  `lib/billing/catalog.ts`. Uma tabela `coin_pricing` no banco seria um convite
  a alguém, um dia, ler dali para cobrar de verdade.
- **A linha "gasto sem cobrança" precisa aparecer.** É a consulta de versículo
  avulsa, a formatação fora de gravação e o evento de sessão apagada: custo real
  que não entrou em margem nenhuma. Listar só o que é cobrável faz toda margem
  parecer melhor do que é.

Gerar e reprocessar estudo são UMA linha. Os dois rodam `generateStudy` com as
mesmas rotas de telemetria, então o custo é indistinguível no banco; como o
preço também é o mesmo, somá-los não perde nada — separá-los daria um custo por
execução inventado.

## A leitura da IA (`AdminInsightsCard`)

As três telas de dinheiro — precificação, uso e métricas — carregam o mesmo
card, com escopos diferentes. Ele não tem número próprio: `lib/admin/insights/
briefing.ts` monta o briefing a partir de `loadAdminUsageSummary`,
`loadAdminMetrics` e `computeActionEconomics`, os MESMOS que desenham as
tabelas ao lado. Uma segunda aritmética "só para o prompt" produziria um
insight contradizendo a tela logo acima dele.

Quatro coisas que quem mexer aqui não pode desfazer:

- **O card diz ao modelo o que é MEDIDO e o que é RÉGUA.** Custo vem de
  `llm_usage_events` × câmbio; o valor da moeda e a margem alvo vêm do cookie
  de simulação. Um analista que trate os dois como igualmente factuais escreve
  "a margem é 62%" onde o correto é "é 62% SE a moeda valer os R$ 20 que você
  digitou" — e é assim que uma simulação vira decisão de preço. Está no prompt
  e nas etiquetas do briefing; as duas metades são necessárias.
- **A geração é disparada do CLIENTE, depois do render.** São ~85s num modelo
  de raciocínio; gerar dentro do server component faria a primeira visita do
  dia esperar um minuto e meio — e não a de quem queria o insight, a de quem só
  ia conferir o MRR.
- **O esforço de raciocínio é `medium`, e isso foi MEDIDO.** Sobre um briefing
  real de 2.697 tokens de entrada: `high` leva 203s e gasta 15.182 tokens de
  raciocínio; `medium` leva 83s com 5.078 e chega nos mesmos cinco achados. Com
  `high` e o teto de 180s da primeira versão, TODA geração estourava — e o card
  dizia "a OpenAI não respondeu a tempo" sem dizer por quantos segundos.
- **A mensagem de erro mostra o que o upstream disse.** Timeout, 400 e 401
  chegavam à tela com a mesma frase, e o diagnóstico só existia no terminal do
  servidor. Numa tela atrás de `requireAdmin()`, o texto do upstream não é
  vazamento: é o que encurta o conserto.
- **A validade é conferida DUAS vezes**, no card e na rota. O card decide o que
  renderizar; a rota decide o que GASTAR, e são coisas diferentes no instante
  em que alguém recarrega a página três vezes.
- **A janela é fixa em 30 dias**, e não as pílulas de período da tela. Amarrar
  o insight ao filtro daria quatro chamadas de modelo caro por dia por tela,
  para responder a mesma pergunta.

O custo dela é gravado como qualquer outra rota (`admin-insights` em
`llm_usage_events`), na ação `internal` — separada de `unbilled` porque os dois
têm consertos opostos: gasto sem cobrança é preço mal ajustado, custo interno é
despesa nossa que nunca vai ter moeda atrás. Somados, a tela sugeriria cobrar
do usuário por uma chamada que só o admin dispara.

## Modelo sem preço na tabela

`/admin/usage` abre com um aviso vermelho quando alguma chamada rodou num
modelo que não está em `lib/llm/pricing.ts`. Elas gravaram custo **zero**, e
sem o aviso o sintoma é uma conta boa demais — que é o sintoma que ninguém
investiga. O efeito em cadeia é o pior possível: a margem daquela ação sobe, e
a tela de precificação passa a recomendar BAIXAR um preço que já não se paga.
Trocar um modelo por env var sem acrescentá-lo à tabela é o caminho normal de
cair nisso.

## Funcionalidades (`/admin/features`)

A tela tem três blocos e a ORDEM é a mensagem: a matriz `funcionalidade ×
plano` vem primeiro e **não tem botão nenhum**. Ela é o retrato de
`lib/entitlements/features.ts`, e é assim que a tela diz "o lugar de liberar o
estudo para outro plano não é aqui, é um commit".

Os dois blocos seguintes editam o que precisa mudar sem deploy:

- **Kill switch** — desliga uma feature para TODO MUNDO, inclusive para quem
  tem exceção liberada e para quem paga. Botão de incidente.
- **Exceções por pessoa** — por e-mail, liberar ou revogar.

`POST /api/admin/features` valida `feature` contra `isFeatureKey` antes de
escrever. Sem isso, um typo cria linha órfã que nunca é lida, e alguém passa a
tarde procurando por que o switch "não funcionou".

## Estudos (`/admin/studies`)

Não é métrica: é leitura. Cada linha mostra as 25-30 perguntas que o
questionador levantou — as respondidas em destaque, as descartadas riscadas —
ao lado do que saiu: contagem por tipo de bloco, versículos conferidos e as
fontes que sobreviveram à selagem.

A razão de ser é diagnóstica. Um estudo ruim tem duas causas que se parecem no
texto final e têm consertos opostos: **as perguntas eram rasas** (mexer no
questionador) ou **eram boas e foram mal respondidas** (mexer no respondedor).
Sem ver as perguntas, não dá para saber em qual dos dois modelos mexer — e as
descartadas são metade do diagnóstico, porque se o respondedor deixou de fora
justamente as boas, o problema é dele.

A tela distingue as DUAS razões de uma pergunta não ter virado texto, e a
distinção é o diagnóstico: **cortada** (o guardião disse que o resumo já
respondia — culpa do questionador) e **não escolhida** (o respondedor preferiu
outras — se ele deixou de fora justamente as boas, a culpa é dele). Quem mexer
aqui não pode colapsar as duas num "descartada".

Uma leitura que também precisa ser preservada: estudo sem nenhuma fonte não é
necessariamente pior — é a selagem tendo descartado o que não tinha obra, que é
o comportamento desejado.

## Parceiros

O cadastro, a taxa de comissão e o registro de pagamento (PIX) vivem aqui, mas
as invariantes do programa estão em `src/features/partners/AGENTS.md` — leia
antes de mexer em `registerPayout` ou em qualquer coisa que toque
`partner_commissions`.

Dois pontos que mordem deste lado:

- O cadastro é client component. Uma constante que ele exibe não pode vir de
  um módulo `server-only`.
- O comprovante do PIX é um LINK https, validado no CHECK da coluna e no
  schema da rota — não um upload.
