# src/features/admin: painel interno

Telas de `/admin`: métricas de produto, uso de LLM, usuários, parceiros,
cupons de convite, o feedback dos usuários e a leitura do que eles receberam
(resumo, transcrição e estudo de cada sessão), mais a leitura que a IA faz de
tudo isso.

## O gate

`app/admin/layout.tsx` chama `isCurrentUserAdmin()` e responde `notFound()`,
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

## A moldura (`app/admin/layout.tsx` + `AdminSidebar`)

Cinco coisas do chrome que quem mexer aqui não pode desfazer:

- **A sidebar é `variant="inset"`, e é ela que cria o degrau de superfície.**
  O wrapper pinta `bg-sidebar` e o `SidebarInset` é o retângulo arredondado em
  `bg-background` por cima. A faixa do topo NÃO pinta cor própria: ela herda o
  chão do inset e se separa pela borda de baixo, como a `SiteHeader` do bloco.
  Antes era `bg-scriba-surface` fixo nos dois, o que anulava justamente o
  degrau que o inset existe para criar. O `backdrop-blur` fica porque ela é
  `sticky` e o conteúdo passa por baixo, o que no bloco original não acontece.
- **A altura da faixa é `--header-height`, declarada no `SidebarProvider`**, e
  vale 56px, não os 48px do bloco: o `SidebarTrigger` tem 44px no celular por
  WCAG 2.5.5 (ver abaixo) e precisa de folga em volta.
- **`SidebarInset` precisa de `min-w-0`.** É o que deixa uma tabela larga rolar
  DENTRO do próprio cartão: sem ele o item flex adota a largura mínima do
  conteúdo, e quem ganha barra horizontal é a página inteira, a sidebar sai da
  tela junto.
- **Voltar ao app e sair existem em DOIS lugares, e é de propósito.** No menu do
  rodapé da sidebar e como botões na faixa do topo, porque no celular a sidebar
  é um sheet FECHADO: só no menu, sair do admin exigia abrir a gaveta antes.
  Sair é sempre um `<form method="post">` para `/auth/sign-out`, a rota que
  limpa o cookie, nunca um link.
- **O `SidebarInset` JÁ é o `<main>` da página.** Um segundo `<main>` dentro
  dele é HTML inválido e violação de a11y; o wrapper de padding é `<div>`.

No celular, a gaveta fecha sozinha, mas na TROCA DE ROTA, não no clique
(`useEffect` sobre `pathname`). Fechar no clique deixava um vão sem sinal
nenhum: a gaveta some, a rota do admin (toda `force-dynamic`) leva um segundo
ou mais no servidor, e nada na tela diz que alguma coisa está acontecendo, a
reação natural é tocar de novo. Fechando na troca, o item clicado fica à vista
com o **ícone virado spinner** (`LinkPendingSwap`, o mesmo da barra inferior do
celular) até a página chegar. O que não mudou é a razão original: a gaveta não
pode ficar por cima da tela que acabou de carregar.

O ícone é o lugar do spinner porque ele já ocupa aquele espaço, um indicador
ao lado empurraria o rótulo a cada clique. E `useLinkStatus`, que é o que
`LinkPendingSwap` usa por dentro, só funciona DENTRO da árvore de um `<Link>`:
quem põe o componente lá é o `render={<Link/>}` do `SidebarMenuButton`. Fora de
um Link ele devolve `pending: false` para sempre, em silêncio.

**O `SidebarTrigger` tem 44px no celular** (`size-11 sm:size-7`), contra os
28px do `size="icon-sm"` do shadcn. Ele é o ÚNICO jeito de abrir a gaveta no
telefone, o `SidebarRail`, a faixa arrastável, é `sm:flex` e não existe no
toque, e um alvo de 28px encostado no canto superior esquerdo erra na maioria
dos toques de polegar. Errava tantas vezes seguidas que parecia botão quebrado.
44px é o mínimo do WCAG 2.5.5 e cabe folgado nos 56px da faixa.

## A estética: o bloco `dashboard-01` do shadcn

O painel tinha uma linguagem visual PRÓPRIA, cabeçalho de tabela em versalete
espaçado, células de 1,25rem, cartões de KPI com pastilha colorida, título em
`text-[22px] font-light`. Ela foi trocada pela do bloco `dashboard-01`
(`npx shadcn@latest add dashboard-01`). O que quem mexer aqui precisa saber:

**As 15 tabelas usam UMA classe, `admin-table`.** Ela é a MOLDURA
(`overflow: hidden`, borda de 1px, canto arredondado, `bg-card`, `thead`
`sticky` em `bg-muted`) mais o RESPIRO das células, 1rem na horizontal e
0.75rem na vertical, caindo para 0.75rem na horizontal abaixo de `sm` porque
ali a tabela rola de lado. O `p-2` que a `<Table>` do shadcn traz é calibrado
para as tabelas curtas do bloco de exemplo; as daqui carregam moeda, data e
porcentagem em dez ou doze colunas. **O lugar de mexer em respiro é a classe**,
nunca um `px-` avulso numa `<TableCell>`, ou o painel volta a ter tabelas com
medidas diferentes.

> **O respiro mora num `@layer utilities`, e isso não é capricho.** `h-10
> px-2` e `p-2` vêm da `<Table>` como UTILITÁRIOS, e entre camadas não há
> desempate por especificidade: `utilities` vem depois de `base` e ganha. Uma
> regra de padding escrita em `@layer base` é engolida em SILÊNCIO, a tabela
> continua com 8px e nada acusa. **Já aconteceu neste arquivo**: a tabela
> anterior à reforma declarava `height: 3rem; padding: 0 1.25rem` no `th` em
> `@layer base`, e só o `font-size`, o versalete e a cor pegavam, porque para
> esses não havia utilitário concorrente. O respiro de 1,25rem que este
> documento descrevia nunca esteve na tela.

**Os KPIs são `<Card>` dentro de `<KpiGrid>`, e o gradiente mora na GRADE.**
`*:data-[slot=card]:bg-gradient-to-t from-primary/5 to-card` alcança todo
filho com slot de cartão; é por isso que `ui/card.tsx` emite `data-slot`, e é
por isso que um KPI solto fora da grade fica chapado. No escuro o gradiente é
desligado (`dark:*:data-[slot=card]:bg-card`), como no bloco.

**A cor deixou de ser o sinal.** Cada KPI trazia um `tone` (`blue` / `rose` /
`mint` / `cream`) e, nos dois ou três lugares em que aquilo significava alguma
coisa (`netProfitCents >= 0 ? "blue" : "rose"`), o significado dependia de quem
lia saber o que rosa queria dizer. O sinal agora é o `trend` do `KpiCard`, a
pastilha de tendência do `CardAction`, com texto: "no vermelho", "em atraso",
"abaixo do alvo". Um KPI sem tendência simplesmente não tem pastilha; não
invente porcentagem para preencher o espaço.

**As grades de KPI viram quatro colunas só em `xl`, não no `@5xl/main` do
bloco.** Em `lg` a sidebar já come 16rem, e um "R$ 12.345,67" não cabia nos
~175px que sobravam por cartão. Vale para o mesmo motivo na barra de filtros de
`/admin/usage`.

**O `max-w-[1600px]` do conteúdo não é do bloco e fica.** Sem ele uma tabela de
finanças se estica por um monitor inteiro e a linha deixa de ser lida de ponta
a ponta.

O que deste bloco NÃO foi trazido, e por quê: arrastar linha (`@dnd-kit`),
escolher colunas e paginar (`@tanstack/react-table`) e o gráfico de área
(`recharts`). São quatro dependências novas e a reescrita das 15 tabelas, não
estética. `.admin-card-surface` sobrevive como o mesmo desenho do `<Card>`
para os blocos que ainda são `<div>`; quando o último virar `<Card>`, ela sai.

## As telas privilegiadas não vazam no bundle

Os itens de admin e de parceiro do menu do avatar são um **server component**
(`PrivilegedMenuItems`) entregue ao `UserMenu` por slot. Atrás de um
`isAdmin &&` dentro do componente cliente, as strings "Admin", "Área do
parceiro", "/admin" e "/partners" viajavam no chunk que TODO usuário logado
baixa: o `false` escondia o item na tela, não o código que o desenha.

Consequência prática: **constante lida por server component não pode morar num
arquivo `"use client"`**, o compilador do Next transforma todo export daquele
módulo em referência de cliente e a string não chega. Foi por isso que
`MENU_ITEM_CLASS` teve de sair para um módulo simples.

## Uma definição por número

`lib/db/admin/metrics.ts` é a ÚNICA implementação das métricas de produto,
funil, ativação, receita, passivo de moedas, e já aceita recorte por período
e por `partnerId`. Não escreva uma segunda consulta de "conversão" dentro das
telas de parceiro: duas definições do mesmo número um dia discordam, e a
discordância aparece como um parceiro reclamando do próprio painel.

O mesmo vale para a conta do programa de parceiros: ela mora em
`lib/partners/economics.ts`, e o simulador do admin lê de lá.

## Custo

`/admin/usage` lê `llm_usage_events`, alimentada por `recordChatUsage` /
`recordAudioUsage` em cada rota de LLM. O preço por token está em
`lib/llm/pricing.ts`; a conversão para reais usa o câmbio de
`lib/fx/usd-brl.ts`.

**O câmbio tem QUATRO degraus, e o quarto existe por um sinistro real:**
AwesomeAPI → Frankfurter (BCE) → valor manual no cookie do admin → a última
cotação guardada em `usd_brl_rates` (migração 0049). O painel passou dias com
TODO campo em real em branco, custo por rota, custo por 1.000 moedas, margem
por ação, passivo de moedas, e o card da IA abriu com "painel está cego de
margem". Não havia defeito de medição: as 328 chamadas do período estavam
gravadas com o custo em dólar certo. O que faltava era o multiplicador. As duas
únicas fontes de então falhavam juntas com facilidade (o upstream limita por IP
e o de saída da Vercel é compartilhado; o cookie vale por NAVEGADOR e nunca
tinha sido digitado), e "dólar sem cotação é `null`, jamais zero" fez o resto,
**sem erro nenhum na tela**.

Duas consequências para quem mexer aqui: toda leitura viva bem-sucedida GRAVA a
cotação do dia (é assim que a série nasce, sem cron), e o pior caso deixou de
ser "sem câmbio" e passou a ser "o câmbio de ontem", com o `FxRateBadge`
dizendo que é, e oferecendo o campo manual ao lado. Um câmbio velho erra na
segunda casa; a ausência dele apaga a coluna inteira.

**O custo por moeda é sempre MEDIDO** (uso real + câmbio), nunca uma
constante. O painel mostra custo por 1.000 moedas porque por unidade o número
some no arredondamento.

A ordenação do "top de usuários" é por **moedas gastas**, não por dólar: dólar
mistura modelos de preços diferentes e a lista deixava de responder à pergunta
que ela existe para responder.

## O corte por VERSÃO (`/admin/usage`)

Rota, usuário e sessão são cortes de ESPAÇO, dizem onde o dinheiro foi. A
tabela "Por versão" é o corte de TEMPO, e responde à outra pergunta: **depois
daquela mudança, ficou melhor ou pior?**

Data não serve de marcador, ela sabe quando a CHAMADA aconteceu, não quando o
DEPLOY subiu. O marcador é `llm_usage_events.app_version` (migração `0044`),
carimbado por `recordChatUsage`/`recordAudioUsage` a partir do `package.json`.
Ele só separa alguma coisa se a versão SUBIR a cada entrega, e é por isso que
`npm run release` antes de todo push é regra do `AGENTS.md` da raiz, não
sugestão: sem o bump as linhas se fundem numa só, **sem erro nenhum na tela**.

Cinco decisões dessa tela, todas contra o mesmo risco de mostrar um número que
parece resposta e não é:

- **A leitura correta é uma ROTA de cada vez**, e o aviso acima da tabela diz
  isso. Sem fixar a rota, o custo médio por chamada muda só porque a MISTURA de
  rotas mudou entre dois deploys: uma semana com mais estudos gerados parece
  uma versão que encareceu tudo.
- **Não há coluna de moedas por versão na tabela.** O débito é por minuto de
  gravação, não por chamada, não há como ratear uma cobrança de minuto entre
  as chamadas que ela pagou.
- **Os dois KPIs de moeda no topo viram `-` sob filtro de ROTA**
  (`summary.coinsScoped`). Custo recortado dividido por moeda inteira é um
  número sempre baixo, com cara de margem folgada, o tipo de mentira que
  ninguém investiga porque a conta parece boa. Sob filtro de VERSÃO eles
  continuam, pela regra da janela abaixo.
- **Variação com menos de 20 chamadas de um dos lados sai cinza**, e abaixo de
  1% sai neutra. "+340%" em vermelho sobre duas chamadas é lido como regressão
  quando o que ele diz é "ainda não deu tempo de medir".
- **`app_version` nulo é linha própria, sempre por último.** São as chamadas
  anteriores à migração; não há backfill possível, e chutar a versão de hoje
  mentiria justamente na comparação.

O seletor de versão do filtro lista TODAS as versões do período mesmo depois de
uma ser escolhida: o recorte é aplicado em memória, e não no SQL, senão o
filtro se trancaria depois do primeiro clique.

Antes da primeira versão carimbada o seletor aparece DESABILITADO, com o motivo
no `title`, nunca escondido. A primeira versão dele sumia da tela nesse caso, e
o efeito era o oposto do pretendido: a funcionalidade desaparecia exatamente
quando alguém ia procurá-la (o estado de todo ambiente no dia em que isto sobe),
e a leitura virava "não foi feito" em vez de "ainda não há o que comparar".

### A regra da janela, e por que precificação também tem o filtro

`llm_usage_events` tem carimbo de versão; `coin_transactions` **não**. Margem
precisa dos dois lados, e recortar só o custo daria uma fatia dividida pela
receita do mês inteiro. A regra é uma frase:

> A versão recorta pelo **carimbo** onde há carimbo (chamadas de LLM) e pela
> **janela** em que ela esteve no ar onde não há (o ledger de moedas).

A janela é medida, do primeiro evento da versão ao primeiro da seguinte
(`VersionWindow` em `lib/db/admin/usage.ts`); a mais nova tem fim aberto. É o
que permite `/admin/precificacao` ter o mesmo filtro e responder "esta mudança
melhorou a margem da ação?", que é a pergunta daquela tela. Ela **mostra o
intervalo resolvido** numa faixa sob o cabeçalho: um recorte de seis horas no
ar é indistinguível de um de um mês, e os dois levam a decisões opostas.

Uma versão sem evento no período zera moeda e custo JUNTOS, zerar só o custo
produziria margem de 100%. A imprecisão conhecida é o rollout, em que a Vercel
serve as duas versões por alguns minutos.

Guia completo em [`docs/versionamento.md`](../../../docs/versionamento.md).

## O inspetor de sessão

`/admin/precificacao?sessionId=<uuid>` abre uma sessão **execução por
execução** (`lib/db/admin/session-runs.ts`). É a única tela que NÃO agrega, e
existe por causa de um ponto cego das outras duas: reprocessar um estudo grava
um segundo conjunto de eventos na mesma sessão, e somados eles viram um número
que não descreve nem uma execução nem a outra, que é justamente o número que
se quer comparar ao ajustar modelo ou prompt.

A execução é delimitada pelo evento `study-questions`, o passo 1 do pipeline,
que roda exatamente uma vez por estudo. É corte exato, não janela de tempo: dois
reprocessamentos podem ser disparados com minutos de diferença. O intervalo de
10 minutos no código é só a rede para as linhas legadas de rota `deepening`,
que não têm passo 1 para abrir.

**Só a última execução tem texto.** `updateDeepening` sobrescreve a linha, então
as anteriores existem em custo e não em qualidade. A tela diz isso; não repita
as métricas ao lado de cada execução como se cada uma tivesse sido medida.

As métricas de qualidade vêm de `lib/study/metrics.ts`, client-safe, pura, e a
MESMA que o harness de avaliação usa. Ela espelha o contrato declarado no prompt
de `lib/prompts/study-write.ts`: dois lugares, um commit.

**"Moedas gastas" é filtrado por MOTIVO, nunca por `abs(amount)`.**
`coin_transactions` é o ledger inteiro: `grant_coins` grava
`subscription_grant`, `topup_pack` e `partner_bonus` com valor POSITIVO, e o
estorno grava um negativo que é devolução de crédito, não consumo. Só os seis
motivos de `CHARGE_REASONS` são gasto. O módulo de leitura já faz esse corte,
não recrie a soma numa tela.

## Precificação (`/admin/precificacao`)

Responde a UMA pergunta que `/admin/usage` não responde: **continuo cobrando 5
moedas o minuto?** Preço não é cobrado por rota, é cobrado por AÇÃO, e uma
ação é várias rotas (o Modo Ao Vivo é transcrição + três pipelines + resumo +
os cards de acompanhamento). Somar rota a rota à mão para chegar no minuto era
o trabalho que esta tela existe para não ser refeito.

O vocabulário está em `lib/coins/billable.ts` (client-safe) e a conta em
`lib/coins/economics.ts`. O mapeamento ROTA → ação mora em
`lib/db/admin/usage.ts`, junto do resto da agregação: **é a mesma passada pelas
mesmas linhas** que alimenta `/admin/usage`. Uma segunda consulta de custo é
uma segunda definição do mesmo número.

Ela também aceita o filtro de **versão**, ao lado das pílulas de período, e ali
ele responde "esta mudança melhorou a margem da ação?". Quem recorta a moeda
junto com o custo é a janela em que a versão esteve no ar, ver "A regra da
janela" na seção do corte por versão, acima. A faixa azul sob o cabeçalho
(`VersionWindowNote`) mostra o intervalo resolvido, e ela não é decoração: sem
ela, seis horas no ar e um mês no ar produzem números indistinguíveis.

**Há DUAS margens, e a coluna mostra a da DECISÃO.** `marginAtCurrentPrice` é
custo de uma execução contra o que a ação cobra hoje; `realizedMargin` é custo
contra as moedas que o ledger de fato debitou no período. A coluna já mostrou
só a segunda, e isso a punha em contradição com a coluna vizinha: o Estudo
aprofundado aparecia com **−18% de margem** e, ao lado, a sugestão de **cobrar
menos**. Nenhuma das duas tinha defeito de cálculo, o período pegava
lançamentos anteriores à subida de 5 para 50 moedas, então o ledger tinha 180
moedas em 18 execuções. Ao preço de hoje aquela linha tem 76% de margem.

A regra que decorre: **a margem exibida e o preço sugerido saem do MESMO custo
por execução**, ou duas colunas vizinhas voltam a se contradizer sem que nada
esteja errado. A realizada continua na tela, mas só quando o ledger cobrou algo
diferente do preço atual (`ledgerDivergesFromPrice`), porque aí a divergência
é o achado, não ruído.

Três coisas que quem mexer aqui não pode desfazer:

- **Os dois lados da conta têm origens diferentes, e a tela diz qual é qual.**
  O custo é MEDIDO; o valor da moeda é uma régua que o admin gira. Um painel em
  que os dois parecem igualmente factuais convida a decidir preço com base num
  número que alguém digitou.
- **A régua é um cookie, não uma tabela.** Nada do que se digita ali cobra
  coisa alguma, quem cobra é o Price do Stripe, e quem credita é
  `lib/billing/catalog.ts`. Uma tabela `coin_pricing` no banco seria um convite
  a alguém, um dia, ler dali para cobrar de verdade.
- **A linha "gasto sem cobrança" precisa aparecer.** É a consulta de versículo
  avulsa, a formatação fora de gravação e o evento de sessão apagada: custo real
  que não entrou em margem nenhuma. Listar só o que é cobrável faz toda margem
  parecer melhor do que é.

Gerar e reprocessar estudo são UMA linha. Os dois rodam `generateStudy` com as
mesmas rotas de telemetria, então o custo é indistinguível no banco; como o
preço também é o mesmo, somá-los não perde nada, separá-los daria um custo por
execução inventado.

## A leitura da IA (`/admin/insights`)

Uma análise que um modelo escreve sobre os números do painel. Ela não tem
número próprio: `lib/admin/insights/briefing.ts` monta o briefing a partir de
`loadAdminUsageSummary`, `loadAdminMetrics` e `computeActionEconomics`, os
MESMOS que desenham as tabelas das outras telas. Uma segunda aritmética "só
para o prompt" produziria um insight contradizendo uma tabela do painel.

**Ela já foi três, e a mudança é o que este trecho precisa ensinar.** Havia um
card lateral em `/admin/precificacao`, `/admin/usage` e `/admin/metricas`, cada
um com o seu recorte (`pricing`, `usage`, `metrics`), e cada um DISPARANDO a
geração sozinho quando a linha gravada passava de 24 horas. Dois defeitos que só
aparecem com o painel em uso:

- **as três diziam quase a mesma coisa**, porque saem dos mesmos eventos, só
  recortados diferente. E nenhuma podia concluir sobre o negócio, porque cada
  uma via um terço dele: uma rota cara é a margem de uma ação, que é o preço de
  um plano, que é o passivo de moedas. A divisão que existia para evitar três
  respostas genéricas produzia três respostas parecidas E incompletas.
- **ninguém as pedia.** A chamada de LLM mais cara do produto rodava porque
  alguém abriu uma tela para conferir o MRR.

Hoje é UMA leitura geral, com página própria, e ela **só roda no clique**.

Seis coisas que quem mexer aqui não pode desfazer:

- **Nada gera sozinho.** Sem disparo automático, a conferência de validade
  ("já tem menos de 24h?") deixou de existir no card e na rota: não há o que
  proteger contra recarregar a página, porque recarregar não gera nada. Se
  alguém ressuscitar o disparo automático, a conferência tem de voltar JUNTO,
  nos dois lugares, senão "uma vez por dia" vira "uma vez por aba".
- **O card diz ao modelo o que é MEDIDO e o que é RÉGUA.** Custo vem de
  `llm_usage_events` × câmbio; o valor da moeda e a margem alvo vêm do cookie
  de simulação. Um analista que trate os dois como igualmente factuais escreve
  "a margem é 62%" onde o correto é "é 62% SE a moeda valer os R$ 20 que você
  digitou", e é assim que uma simulação vira decisão de preço. Está no prompt
  e nas etiquetas do briefing; as duas metades são necessárias.
- **O esforço de raciocínio é `medium`, e isso foi MEDIDO.** Sobre um briefing
  real de 2.697 tokens de entrada: `high` leva 203s e gasta 15.182 tokens de
  raciocínio; `medium` leva 83s com 5.078 e chega nos mesmos cinco achados. Com
  `high` e o teto de 180s da primeira versão, TODA geração estourava, e a tela
  dizia "a OpenAI não respondeu a tempo" sem dizer por quantos segundos.
- **A mensagem de erro mostra o que o upstream disse.** Timeout, 400 e 401
  chegavam à tela com a mesma frase, e o diagnóstico só existia no terminal do
  servidor. Numa tela atrás de `requireAdmin()`, o texto do upstream não é
  vazamento: é o que encurta o conserto.
- **A janela é fixa em 30 dias**, e não as pílulas de período das outras telas.
  Amarrar a leitura ao filtro daria quatro chamadas de modelo caro para
  responder a mesma pergunta.
- **A tabela `admin_insights` tem uma linha só.** A coluna `scope` sobrevive
  como PK, com o valor constante `general` (ver `lib/admin/insights/store.ts`);
  as três linhas antigas foram apagadas pela migração 0054.

O custo dela é gravado como qualquer outra rota (`admin-insights` em
`llm_usage_events`), na ação `internal`, separada de `unbilled` porque os dois
têm consertos opostos: gasto sem cobrança é preço mal ajustado, custo interno é
despesa nossa que nunca vai ter moeda atrás. Somados, a tela sugeriria cobrar
do usuário por uma chamada que só o admin dispara.

## Cupons de convite (`/admin/cupons`)

Um link que credita moedas na conta criada por ele: `scriba.cc/c/<codigo>`.
Existe para uma coisa que nenhum dos três programas de indicação faz, **chamar
uma pessoa escolhida para testar o produto**. `partners` paga comissão a quem
divulga, `referral_rewards` premia quem trouxe um amigo e `partner_prospects`
dá cortesia a quem se candidatou a divulgador; os três descrevem uma relação
com alguém de fora. O cupom é o admin abrindo a porta para quem ele quer, com
um saldo dentro. Migração `0055_signup_coupons.sql`.

O que não pode ser desfeito:

- **Todo cupom tem TETO de usos**, `max_redemptions` é NOT NULL. Um link
  público que credita moedas é uma torneira, e o custo de abusá-la é criar
  contas Google. O teto do pré-parceiro é GLOBAL porque lá a porta é uma página
  só; aqui ela é emitida uma a uma, então o teto é por cupom. Convidar mais
  gente é emitir outro cupom, o que é barato e deixa rastro de por quê.
- **Uma redenção por pessoa na vida**, e isso é a PK de
  `signup_coupon_redemptions`, não um `if`. O crédito ainda passa por
  `grant_coins` com `external_ref` derivado do usuário, que é a segunda tranca.
- **A regra inteira mora na RPC** `redeem_signup_coupon`: janela de conta nova
  (30 min, a mesma de `attach_partner`), cupom inativo/expirado/esgotado, e o
  crédito, tudo numa transação, com a linha do cupom travada por `for update`,
  que é o que torna o teto exato. `lib/db/coupons.ts` só traduz o resultado.
- **O cupom NÃO recusa quem já ganhou bônus de indicação ou de pré-parceiro**,
  ao contrário de `attach_partner_prospect`. Lá os dois lados são promoções
  abertas a quem passar; aqui é um ato deliberado sobre uma pessoa escolhida, e
  negá-lo em silêncio porque ela clicou num link de parceiro semana passada
  faria o convite falhar exatamente onde ele foi mais intencional.
- **Cupom resgatado não se apaga, desativa-se.** `redemptions.code` é
  `on delete restrict`: apagar o cupom apagaria o registro de quem o usou, e o
  crédito ficaria sem explicação no extrato da pessoa. O painel só oferece
  "Apagar" enquanto a contagem é zero, e a rota devolve 409 se alguém insistir.
- **O valor de um cupom emitido não se edita.** Um link que já circula
  prometendo 200 moedas não pode passar a valer 20 sem que ninguém saiba: quem
  quer mudar desativa aquele e emite outro. A rota simplesmente não tem essa
  ação.
- **O selo da tela de entrada só aparece se o cupom AINDA for resgatável.**
  `getCouponPublicByCode` devolve `null` para inativo, expirado ou esgotado,
  exatamente as três recusas da RPC. Anunciar um bônus que ela vai negar é
  prometer moeda que não será creditada, e a pessoa descobre isso depois de já
  ter criado a conta.

O cookie é `scriba_coupon` (`lib/referrals/cookies.ts`, junto dos outros três),
carrega só o CÓDIGO, é `httpOnly` e vale 30 dias. Ele é separado do
`scriba_ref` pela mesma razão que o do pré-parceiro: o `scriba_ref` decide para
onde vai DINHEIRO, e uma promoção não pode disputar espaço com a atribuição de
comissão.

## Modelo sem preço na tabela

`/admin/usage` abre com um aviso vermelho quando alguma chamada rodou num
modelo que não está em `lib/llm/pricing.ts`. Elas gravaram custo **zero**, e
sem o aviso o sintoma é uma conta boa demais, que é o sintoma que ninguém
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

- **Kill switch**: desliga uma feature para TODO MUNDO, inclusive para quem
  tem exceção liberada e para quem paga. Botão de incidente.
- **Exceções por pessoa**: por e-mail, liberar ou revogar.

`POST /api/admin/features` valida `feature` contra `isFeatureKey` antes de
escrever. Sem isso, um typo cria linha órfã que nunca é lida, e alguém passa a
tarde procurando por que o switch "não funcionou".

## Sessões (`/admin/sessions`)

Não é métrica nem custo: é o CONTEÚDO. A lista traz todas as sessões, de todo
mundo, e `/admin/sessions/[id]` abre uma delas em abas, resumo, transcrição,
estudo e o feed do ao vivo.

Ela existe porque as outras telas respondem em volta do texto e nunca sobre
ele: `/admin/usage` diz quanto custou, `/admin/metricas` quantas foram,
`/admin/feedback` que nota deram. Uma nota "razoável" não distingue um resumo
que inventou uma citação de uma transcrição que perdeu o meio da pregação, e
nos primeiros usuários o texto é a única evidência de qualidade que existe.

Quatro coisas que quem mexer aqui não pode desfazer:

- **A leitura usa os componentes DO PRODUTO** (`SummaryView`,
  `SavedTranscriptView`, `StudyBlockRenderer`, `Feed`). Um renderizador só do
  painel mostraria um texto que ninguém viu, e a pergunta desta tela é sobre o
  que a pessoa VIU. De quebra, bloco novo no resumo aparece aqui sem ninguém
  vir mexer. O `ReaderSurface` fixa a coluna em `max-w-3xl` pela mesma razão:
  solto na largura do painel, o mesmo resumo vira linha de 180 caracteres.
- **`SummaryView` NÃO é montado quando não há resumo.** Sem payload e com
  transcrição ele desenha o esqueleto de CARREGAMENTO, que no painel se lê
  como tela travada em vez de sessão sem resumo. A ausência tem texto próprio.
- **A tela só LÊ.** Nada de reprocessar, editar ou apagar daqui: o conserto de
  um resumo ruim é prompt e modelo, e uma correção manual produziria um
  conteúdo que o dono não gerou e não sabe que mudou. `lib/db/admin/sessions.ts`
  não exporta escrita nenhuma, e não deve passar a exportar.
- **A lista mostra sim/não, não prévia.** Um trecho de resumo cortado numa
  célula convida a julgar qualidade por meia frase, que é o julgamento que a
  leitura existe para substituir. E `short_summary` é o que responde "tem
  resumo?", justamente para não arrastar cem `final_summary` inteiros só para
  desenhar um ícone.

O `SESSIONS` da listagem tem teto (`ADMIN_SESSIONS_PAGE_SIZE`, 100) e a tela
DIZ o teto no rodapé, mesma regra do `/admin/users`: o dia em que a base passar
disso precisa ser visível, e não a lista parando de crescer em silêncio.

A pílula de modo é uma só, `SessionModeBadge`, compartilhada com a tabela de
sessões do `/admin/usage`. Ela nasceu lá e virou componente quando a segunda
tela precisou dela, com a divergência que duas cópias sempre produzem já
consumada: `youtube` tinha entrado em `SESSION_MODES` e a cópia de lá continuava
desenhando "-", que se lê como "sessão sem modo".

## O que saiu: `/admin/studies`

A tela de avaliação do estudo (as 25-30 perguntas do questionador, as
respondidas, as cortadas pelo guardião e as não escolhidas) foi **removida do
painel**. Ela era leitura diagnóstica, não métrica, e quem quisesse o
diagnóstico precisava abrir uma tela que ninguém abria.

**O dado continua existindo**, e essa é a parte que quem mexer aqui precisa
saber: `session_deepenings.plan` continua guardando o `StudyRecord` inteiro
(migração 0033), o pipeline continua gravando-o e `lib/db/admin/sessions.ts` e
`session-runs.ts` continuam lendo-o. O que saiu foi a página e o
`lib/db/admin/studies.ts` que só ela usava. `/admin/sessions/[id]` mostra a
CONTAGEM ("11 de 27 perguntas respondidas") e nada mais.

Se a pergunta "as perguntas eram rasas ou foram mal respondidas?" voltar a ser
urgente, o caminho é ler o `plan` da sessão direto no banco, ou ressuscitar a
tela a partir do git. O que não vale é desenhar meia dúzia de perguntas numa
aba de leitura e chamar isso de diagnóstico: a distinção que importava era
entre **cortada** (o guardião disse que o resumo já respondia, culpa do
questionador) e **não escolhida** (o respondedor preferiu outras, culpa dele),
e uma lista que as colapse num "descartada" não responde nada.

## Feedback (`/admin/feedback`)

A nota que os usuários deram a cada parte do produto, e o que escreveram
junto. A coleta é da pesquisa de satisfação, ver
[`src/features/feedback/AGENTS.md`](../feedback/AGENTS.md) para quando e como
a pergunta é feita.

Três blocos, e a ORDEM é a mensagem:

- **A taxa de resposta vem PRIMEIRO, antes de qualquer nota.** As médias
  abaixo são de quem se dispôs a responder, e essa amostra é sistematicamente
  mais gentil que a realidade: 4,0 sobre 12 respostas de 90 perguntas parece
  um produto adorado. É a mesma regra dos avisos antes dos números no
  financeiro, contra o mesmo risco, uma conta boa demais é a que ninguém
  investiga. É por isso que `feedback_prompts` guarda também as perguntas
  IGNORADAS; sem o denominador, o numerador mente.
- **A nota é por TÓPICO, e nunca uma soma.** Sugestões ao vivo, resumo,
  transcrição, estudo e experiência geral são cinco peças com consertos
  diferentes; uma "nota do Scriba" que as misturasse não apontaria para lugar
  nenhum. Tópico sem resposta mostra `-`, jamais zero, zero é uma nota abaixo
  de "ruim", que não existe na escala, e um painel que o exibe convida a
  concluir que a parte é péssima quando o que houve foi silêncio.
- **A distribuição fica ao lado da média**, porque quatro "razoável" e uma
  mistura de "ruim" com "excelente" dão o mesmo 2,5 e pedem coisas opostas.

O terceiro bloco são os comentários, **inteiros e sem truncamento**: a média
diz que algo está errado, só o texto diz o quê, e cortar a frase de alguém
para caber num card perde justamente a parte que o número não tem.

**Quem lista agrupa por `submission_id`.** O comentário é do ENVIO e se repete
nas linhas de nota daquele envio (ver o cabeçalho de `0047_feedback.sql`); sem
o agrupamento, uma janela do modo Ao Vivo aparece como duas pessoas dizendo
exatamente a mesma frase.

A escala é texto no banco e vira número em UM lugar só,
`FEEDBACK_RATING_SCORE`, em `lib/domain/feedback.ts`, o mesmo módulo que
desenha os chips no navegador.

## Financeiro (`/admin/financeiro`)

Seis telas atrás de um `SidebarGroup` próprio. A área inteira responde a uma
pergunta que as outras oito não respondem: **quanto o Scriba ganha, gasta e
deve, e para onde isso vai.** Desenho completo em [`docs/financeiro.md`](../../../docs/financeiro.md);
o que não pode ser desfeito está aqui.

**Metade do painel é MEDIDA e não se digita.** Receita de assinatura sai dos
créditos de `coin_transactions` (`lib/finance/measured.ts`), custo de IA de
`llm_usage_events`, taxa do Stripe de `lib/partners/economics.ts` e comissão
de `partner_commissions`. O que se lança à mão são as cinco tabelas de
`0043_finance.sql`, e elas guardam só o que ninguém mede por nós, Vercel,
Supabase, domínio, ferramentas, impostos, dívidas.

> A armadilha da área, e ela está dita na tela: lançar "assinaturas de
> setembro, R$ 5.000" à mão CONTA DUAS VEZES. `buildFinanceOverview` devolve
> um aviso quando um mês tem receita medida e receita lançada.

**Uma conta, um lugar.** Toda aritmética mora em `lib/finance/*`, puro,
client-safe e coberto por `npm test`. Nenhuma página calcula nada: elas
recebem `FinanceOverview` de `lib/db/admin/finance-overview.ts`. É a mesma
regra de `lib/db/admin/metrics.ts`, pelo mesmo motivo.

Cinco coisas que quem mexer aqui não pode desfazer:

- **Os DOIS regimes têm nomes diferentes e nunca somam.** Competência ("quanto
  o Scriba custa por mês", com a anual rateada em doze) e caixa ("quanto saiu
  da conta", com a anual inteira no mês da cobrança). Um total sem dizer de
  qual regime ele é não significa nada.
- **A fatura real de um contrato SUBSTITUI a provisão dele no mês.** É o que o
  campo `recurringId` do lançamento existe para fazer. Sem ele, o mês em que
  alguém registra a fatura da Vercel aparece com o custo dobrado.
- **Câmbio congela na liquidação e flutua enquanto pendente.** Uma despesa em
  dólar já paga custou o que custou; reconvertê-la faz o lucro de julho mudar
  porque o dólar mexeu em setembro. Uma dívida é o oposto, vale a cotação de
  hoje, que é quando ela seria quitada.
- **Sem cotação, um valor em dólar vale `null`, nunca zero.** Zero soma e some
  do total sem avisar; `null` obriga a tela a dizer quantos ficaram de fora.
  Vale para toda a camada (`lib/finance/money.ts`).
- **Os avisos vêm ANTES dos números.** Um painel financeiro erra em silêncio, e
  o sintoma é sempre uma conta boa demais, que é a que ninguém investiga. É a
  mesma razão do aviso de modelo sem preço em `/admin/usage`.

**A projeção roda no CLIENTE, e isso não é cálculo no frontend.** O componente
chama `project()` de `lib/finance/projection.ts`, o único lugar onde a fórmula
existe e o mesmo que os testes exercitam. Rodar ali é o que permite mexer numa
premissa sem round-trip; nada do que sai dela é persistido. O que se GRAVA em
`finance_scenarios` são as premissas, nunca o resultado, que envelheceria em
silêncio enquanto a base (assinantes, ARPU, custo por cliente) muda sozinha.

**Dívida não é um tipo.** É um lançamento com `status <> 'paid'` e
`due_date`; `/admin/financeiro/compromissos` é um recorte da mesma tabela. Um
terceiro `kind` daria três somas para o mesmo dinheiro e a primeira quitação
faria as três discordarem.

**Categoria não se apaga, arquiva-se.** Sem categoria, um custo é tratado como
variável, apagar "Infraestrutura" faria o custo fixo de todo o histórico
despencar sem nada indicando por quê. Por isso não existe `DELETE` na rota de
categorias, e por isso trocar a `nature` de uma categoria tem log próprio.

## Parceiros

O cadastro, a taxa de comissão e o registro de pagamento (PIX) vivem aqui, mas
as invariantes do programa estão em `src/features/partners/AGENTS.md`, leia
antes de mexer em `registerPayout` ou em qualquer coisa que toque
`partner_commissions`.

Dois pontos que mordem deste lado:

- O cadastro é client component. Uma constante que ele exibe não pode vir de
  um módulo `server-only`.
- O comprovante do PIX é um LINK https, validado no CHECK da coluna e no
  schema da rota, não um upload.
