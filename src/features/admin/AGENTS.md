# src/features/admin: painel interno

Oito telas: a visão geral (com a leitura que a IA faz do negócio), as métricas
de produto, os custos de LLM, o controle financeiro, a leitura do que os
usuários receberam, os programas de entrada de gente, os usuários e as
configurações.

## Oito telas, e por que não são dezessete

O menu já teve **dezessete itens** (onze mais seis num grupo "Financeiro"), e a
maior parte deles não era uma ÁREA: era um RECORTE dos mesmos números com uma
linha própria no menu.

- "Uso & custos" e "Precificação" liam a MESMA passada de `llm_usage_events`,
  cada uma com o seu cabeçalho, as suas pílulas de período, o seu seletor de
  versão, o seu selo de câmbio e uma fileira de KPI que só diferia pela margem
  no fim.
- "Visão geral" era `/admin/usage` com filtro fixo de 30 dias e sem filtro para
  mexer: não mostrava MRR, nem caixa, nem funil, e fechava com quatro atalhos,
  um menu dentro de uma tela que já tinha menu.
- "Compromissos" era um FILTRO de "Lançamentos" sobre a mesma tabela.
- "Leitura da IA" era um cabeçalho e um botão.
- "Funcionalidades" e "Configurações financeiras" eram os dois lugares de girar
  um parâmetro sem deploy, em cantos opostos do menu.
- MRR aparecia em `/admin/metrics` E em `/admin/finance`, por duas
  consultas diferentes sobre a mesma definição.

O custo disso não é estético. **Uma lista de dezessete deixa de ser encontrada
por reconhecimento**: para achar uma coluna era preciso saber de cor em qual
das duas telas parecidas ela estava, e trocar de tela recomeçava os filtros do
zero. Dois lugares publicando o mesmo número fazem quem lê conferir se batem em
vez de ler a tela.

**A regra que ficou: um item de menu é uma PERGUNTA, um recorte é uma ABA.**

| Tela | Pergunta | O que absorveu |
|---|---|---|
| Visão geral | como o negócio vai hoje? | + a leitura da IA |
| Métricas | quem chega, quem ativa, quem assina? | (perdeu o MRR) |
| Custos | quanto a OpenAI cobra, e o preço fecha? | `usage` + `precificacao`, em 4 abas |
| Financeiro | quanto entra, sai e devemos? | 6 telas → 1 item com abas |
| Conteúdo | o que a pessoa recebeu presta? | `sessions` + `feedback` + `lexico` |
| Crescimento | por onde entra gente? | `partners` + `cupons` |
| Usuários | quem são, quem paga e o que podem? | |
| Configurações | o que dá para girar sem deploy? | `features` + as financeiras |

A faixa de abas é `AdminTabs`, e ela é **LINK, não estado de cliente**: toda
tela do painel é `force-dynamic`, a aba troca o que o SERVIDOR busca, não o que
o navegador esconde. Como link, ela sobrevive a um F5 e pode ser colada para
alguém. Cada tela também busca só o que a aba ativa usa — `/admin/costs` só
carrega a lista de usuários do filtro nas abas que a têm, e `/admin/settings`
não toca em finanças na aba de produto.

O que uma aba diz e um item de menu não diz: **isto aqui é o mesmo assunto,
visto de outro ângulo.** É por isso que "Em aberto" é aba de "Lançamentos" e
não tela irmã: as duas são a mesma tabela, e lado a lado a tela responde
sozinha a pergunta que dois itens de menu faziam nascer ("o que eu lanço ali
aparece aqui?").

**O grupo "Financeiro" da sidebar sumiu junto.** Ele existia para quebrar a
parede de quatorze itens seguidos; com oito não há parede, e um rótulo de grupo
sobre uma linha só é moldura sem quadro.

## O gate

`src/app/admin/layout.tsx` chama `isCurrentUserAdmin()` e responde `notFound()`,
**404, não 403**. Não confirmamos a existência da área administrativa a quem
não deveria vê-la. As rotas `/api/admin/*` usam `requireAdmin()`, que devolve
404 pela mesma razão.

**Server Action de admin reconfere com `assertAdmin()`.** O gate do layout
decide o que RENDERIZA, não o que executa: uma action é um endpoint POST
próprio, e o id dela é um hash estável embutido no bundle, não um segredo. É o
que a documentação do Next diz em "Data Security". As actions de câmbio
(`src/lib/fx/actions.ts`) são o exemplo no repositório.

O client service-role (`src/lib/supabase/admin.ts`) BYPASSA a RLS. Ele só entra
depois de ter afirmado admin, e nunca vai para o navegador.

## A moldura (`src/app/admin/layout.tsx` + `AdminSidebar`)

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
`/admin/costs`.

**O `max-w-[1600px]` do conteúdo não é do bloco e fica.** Sem ele uma tabela de
finanças se estica por um monitor inteiro e a linha deixa de ser lida de ponta
a ponta.

O que deste bloco NÃO foi trazido, e por quê: arrastar linha (`@dnd-kit`) e
escolher colunas e paginar (`@tanstack/react-table`). São dependências novas e
a reescrita das 15 tabelas, não estética. `.admin-card-surface` sobrevive como
o mesmo desenho do `<Card>` para os blocos que ainda são `<div>`; quando o
último virar `<Card>`, ela sai.

**O gráfico de área (`recharts`) ENTROU**, a pedido, para "Contas ativas por
dia" de `/admin/metrics` — ver "Acessos e presença", abaixo. `src/shared/ui/chart.tsx`
é o wrapper padrão do shadcn (`ChartContainer`/`ChartTooltip`/`ChartConfig`),
escrito à mão porque `ui.shadcn.com` não é um host que o ambiente de build
alcança: o CLI não consegue buscar o registro do componente, só o pacote do
`recharts` (npm) é alcançável. Gráfico novo no painel usa este wrapper, não uma
segunda cópia dele.

## Acessos e presença (KPI de "Visão geral", gráfico de "Métricas")

**"Quantas contas estão online agora" e "quantas acessaram hoje" não vinham de
lugar nenhum.** `auth.users.last_sign_in_at` (já lido em `server/db/users.ts`,
para a ficha de `/admin/users`) é um valor por CONTA, sobrescrito a cada login:
não dá história ("quantas contas diferentes acessaram terça-feira passada?") e
não diz nada sobre quem ainda está com o app aberto duas horas depois de
entrar. Os dois números são outra pergunta, e vêm de uma fonte nova.

**A fonte é um PULSO, não um evento de login.** O cliente logado (moldura de
`(app)/layout.tsx`, ver `src/app/AGENTS.md`) bate em `POST
/api/presence/heartbeat` a cada ~60s enquanto o app está aberto
(`PresenceHeartbeat.tsx`), sem corpo — quem chama já basta, a sessão diz quem
é. A escrita é `upsert` numa linha por (dia, conta), `user_daily_access`
(migração 0071), sempre por service-role recebendo o `user_id` da SESSÃO,
nunca do corpo: é telemetria que o painel lê para decidir coisa, a mesma régua
de `user_tours` (RLS ligada, nenhuma policy, ver `supabase/AGENTS.md`).

`src/features/admin/server/db/access.ts` é a ÚNICA leitura. Como a chave primária já é
`(day, user_id)`, uma conta não tem como aparecer duas vezes no mesmo dia, e
`count(*)` de um dia JÁ É contas distintas — sem `distinct` nenhum em memória.
Duas contas:

- **"Hoje"** é `count(*)` do dia corrente — o tile "Acessos hoje" de `/admin`.
- **"Online agora"** é o mesmo filtro mais `last_seen_at` nos últimos 5
  minutos. No tile ele leva uma BOLA VERDE e nenhum til: o `~` que abria a
  linha lia como incerteza do dado, não como a janela de 5 minutos que ele de
  fato é, e a ressalva foi para o `title`. É uma APROXIMAÇÃO deliberada, não
  uma contagem de WebSocket aberto:
  a folga de 5 minutos cobre até três pulsos perdidos (rede ruim, aba em
  segundo plano), e ninguém deveria ler este número como uma medida exata —
  é "tem gente usando isto agora", com a margem que o método permite.

**O gráfico de `/admin/metrics` ("Contas ativas por dia") funde esta fonte com
`signupsByDay`**, que já existia em `loadAdminMetrics` sem NENHUM consumidor
visual até aqui. As duas áreas não empilham: cadastro e acesso são duas
perguntas diferentes (gente NOVA contra gente que voltou), e empilhá-las
somaria como se fossem partes do mesmo total. `buildAccessSeries` (no page.tsx)
preenche todo dia da janela, inclusive os de zero — um buraco no eixo de um
gráfico de área lê como falha de coleta, não como "zero naquele dia".

O bucket de `rate-limit.ts` (`presence-heartbeat`) segue a régua de
`sessions-read` no limite por IP, e não a de uma rota de LLM: uma igreja
gravando ao mesmo tempo põe centenas de aparelhos atrás do mesmo Wi-Fi, e
apertar o balde apagaria "online agora" justamente no pico de uso do produto.

## O filtro por PESSOA (`/admin/costs` e `/admin/sessions`)

Os dois filtros por pessoa eram um `<select>` cheio com a base inteira:
`listUsersForFilter()` lia `profiles` sem teto declarado e a lista viajava
inteira no payload do RSC, uma `<option>` por conta.

**Isso tem três vidas, e a do meio é a perigosa.** Com dezenas de contas é o
mais simples que existe. Com mil, quem corta é o `max-rows` do PostgREST: a
lista fica INCOMPLETA e nada na tela diz isso, então a pessoa procurada
simplesmente não está no select e quem olha conclui que ela não tem sessão
nenhuma. Com um milhão nem chega lá, a consulta ordena a tabela toda e a tela
carrega megabytes de nome e e-mail para usar UM deles.

O que ficou no lugar, em três peças:

- `src/features/admin/server/db/user-search.ts` — `searchUsersForFilter(termo)`, teto de
  20 linhas SEMPRE, e `getUserFilterOption(id)`, uma linha, que resolve o
  rótulo de quem já está no `?userId=`.
- `/api/admin/users/search` — irmã de `/api/admin/users` e deliberadamente
  não a mesma rota: aquela monta a ficha financeira de cada conta (duas
  varreduras de `coin_transactions`) para a tabela de `/admin/users`, e um
  campo que dispara a cada tecla não pode pagar isso.
- `UserPicker` — o campo, com debounce de 200ms e `AbortController`.

Quatro decisões que quem mexer aqui não deve desfazer:

- **O teto é DITO quando é atingido.** Vinte linhas cheias podem ser vinte de
  vinte ou vinte de duas mil, e sem a linha do rodapé as duas são a mesma
  tela. É a mesma régua do teto de `/admin/users` e do de `ADMIN_SESSIONS_PAGE_SIZE`.
- **A falha de rede é dita também.** Uma lista vazia por 500 é idêntica, na
  tela, a "não existe ninguém com esse nome", e as duas mandam quem lê para
  lados opostos.
- **O campo aceita o uuid colado.** O id é o que está à mão em toda outra tela
  do painel (uma coluna, um link, um log) e num select não tinha onde ser
  digitado.
- **O servidor resolve o rótulo do `?userId=` da URL.** Sem isso, um link
  colado abriria mostrando um uuid até a busca do cliente responder. O estado
  do filtro continua na URL, como no resto do painel.

O termo passa por `sanitizeTerm` antes de entrar no `.or()` do PostgREST: a
vírgula e os parênteses são a GRAMÁTICA do filtro, não dados, e um deles
digitado no campo muda a consulta que chega ao Postgres. `escapeLikeValue`
(de `lib/db/like.ts`) cuida de `%` e `_`, que são de outra camada.

A migração **0074** é o que sustenta a busca no tamanho grande: `pg_trgm` mais
GIN em `display_name` e `email`, porque `ilike '%pedaço%'` não usa B-tree
nenhum, e um índice por `created_at desc` para as 20 mais recentes que o campo
mostra antes de alguém digitar. Termo de menos de dois caracteres não vai ao
banco procurar (trigrama tem três letras, abaixo disso o índice não ajuda e a
consulta vira varredura a cada tecla).

**A lista de `/admin/users` continua sendo o caso não resolvido**, e de
propósito: ela não é um filtro, é a tela, e a busca dela é sobre a ficha
financeira que só ela carrega. O teto está declarado
(`ADMIN_USERS_PAGE_SIZE`, 1000) e aparece na tela; o dia de paginar de verdade
é quando a base passar disso.

## As telas privilegiadas não vazam no bundle

Os itens de admin e de parceiro do menu do avatar são um **server component**
(`PrivilegedMenuItems`) entregue ao `UserMenu` por slot. Atrás de um
`isAdmin &&` dentro do componente cliente, as strings "Admin", "Área do
parceiro", "/admin" e "/partners/dashboard" viajavam no chunk que TODO usuário logado
baixa: o `false` escondia o item na tela, não o código que o desenha.

Consequência prática: **constante lida por server component não pode morar num
arquivo `"use client"`**, o compilador do Next transforma todo export daquele
módulo em referência de cliente e a string não chega. Foi por isso que
`MENU_ITEM_CLASS` teve de sair para um módulo simples.

## Uma definição por número

`src/features/admin/server/db/metrics.ts` é a ÚNICA implementação das métricas de produto,
funil, ativação, receita, passivo de moedas, e já aceita recorte por período
e por `partnerId`. Não escreva uma segunda consulta de "conversão" dentro das
telas de parceiro: duas definições do mesmo número um dia discordam, e a
discordância aparece como um parceiro reclamando do próprio painel.

O mesmo vale para a conta do programa de parceiros: ela mora em
`src/features/partners/economics.ts`, e o simulador do admin lê de lá.

## Quem entra na conta: a conta de Backoffice

**Todo número de dinheiro deste painel mede CLIENTES por padrão**, e as contas
de Backoffice (`profiles.is_internal`, migração 0073) ficam de fora.

O motivo é medido, não teórico. No dia em que a coluna nasceu, em produção:
435 das 1.004 chamadas de LLM (43%) eram de duas contas do autor; as DUAS
únicas assinaturas ativas eram dele, somando R$ 89,80 de MRR que nunca foi
dinheiro de ninguém; e o funil dizia 2 convertidos de 16 cadastros. Nenhum
desses números estava errado pelo caminho que o produziu — estavam errados na
PERGUNTA: "quanto custa atender um cliente" e "quantos clientes pagam" não
admitem o operador dentro da amostra.

O vocabulário é `features/admin/audience.ts` (client-safe, porque o seletor é
componente cliente): `clients` (padrão), `internal`, `all`. Os dois agregados
o aceitam, e cada um o aplica onde ele não pode ser esquecido:

| | Onde filtra | Por quê |
|---|---|---|
| `loadAdminUsageSummary` | em MEMÓRIA, nos DOIS lados | nem `llm_usage_events` nem `coin_transactions` têm a coluna. Recortar o custo e não a moeda produz a fatia dividida pelo total que `coinsScoped` documenta: um número que parece margem, sempre bom |
| `loadAdminMetrics` | na consulta de CONTAS | sessões, moedas e assinaturas são buscadas por `userIds`; excluir na origem tira a conta do funil, da receita e do passivo de uma vez |

O conjunto de ids sai de `server/db/internal-accounts.ts`, numa consulta só, e
**falha de leitura devolve vazio** — o painel volta a medir tudo, como media
antes. O engano na outra direção esvaziaria todas as telas de dinheiro sem
nenhum erro aparecendo nelas.

**As pílulas ficam no cabeçalho de `/admin/costs`**, ao lado de período e
versão e pela mesma razão: valem para as quatro abas e atravessam a troca
delas. Fora do padrão, a tela DIZ o que ficou de fora — um total recortado é
indistinguível de um total inteiro olhando só para o número.

**O Financeiro é a exceção, e é deliberada.** A despesa de IA de
`/admin/finance` continua contando as contas internas: lá o número é CAIXA, e
o dólar dos testes saiu da conta da OpenAI do mesmo jeito. Quem mede unit
economics é `/admin/costs`. Para os dois não discordarem em silêncio na visão
geral, o card de custo diz "chamadas de clientes" e há um atalho para
`/admin/costs?audience=internal` — "quanto me custa testar o meu próprio
produto" continua sendo uma pergunta com resposta.

O MRR do Financeiro sai de `loadAdminMetrics` (ver "Uma definição por
número"), então ele cai junto: é por isso que o aviso "há assinaturas ativas e
nenhum crédito de assinatura no ledger" cala ao marcar as contas de teste — ele
acusava exatamente as assinaturas criadas para ver o checkout de pé.

**Marcar é do admin**, em `/admin/users` → Tipo de conta, e nenhum caminho do
cliente escreve a coluna (o GRANT por coluna de 0026 a deixa fora do alcance de
`authenticated`). O campo é separado do "Papel" de propósito: **admin é quem
ENTRA no painel; interna é a conta que não deve APARECER nele.** O admin que
testa é as duas coisas; um beta tester convidado pode precisar ser só a
segunda.

## Custo

`/admin/costs` lê `llm_usage_events`, alimentada por `recordChatUsage` /
`recordAudioUsage` em cada rota de LLM. O preço por token está em
`src/lib/llm/pricing.ts`; a conversão para reais usa o câmbio de
`src/lib/fx/usd-brl.ts`.

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

**Na aba "Rotas", só a rota VIVA tem linha própria; o resto é "outras".**
`llm_usage_events` guarda tudo o que o produto já chamou, e o produto já foi
outro: o feed ao vivo (`bible`, `insights`, `sermon-echo`), os cards de
acompanhamento (`practices*`, `rereads*`, `reminders*`), a formatação de
parágrafo, o enriquecimento em segunda chamada, o resumo do modo transcrição.
Cada um tinha a sua linha, e a aba do DIAGNÓSTICO abria com vinte, metade delas
sobre código que não existe mais — numa tela cuja única saída é "trocar o modelo
desta rota" ou "encurtar este prompt", que são consertos impossíveis no passado.

Três coisas que essa fusão não pode desfazer:

- **Quem diz o que é vivo é `USAGE_ROUTES`** (`src/lib/db/usage.ts`), a lista do
  que o código de fato ESCREVE. Uma segunda lista dentro do painel envelheceria
  calada na primeira rota nova que subisse, e o sintoma seria a rota recém-criada
  nascendo dentro de "outras".
- **Some da leitura, não da soma.** O custo continua inteiro nos totais, nos
  KPIs, na margem e no filtro de rota — que segue listando todos os nomes reais,
  porque isolar o custo histórico de uma rota morta continua sendo uma pergunta
  legítima.
- **A linha imprime os nomes que engoliu, e vai sempre por ÚLTIMO.** Sem os
  nomes, "outras" vira uma rota fantasma e o custo histórico perde endereço;
  ordenada por custo entre as vivas, ela seria lida como "a rota mais cara do
  produto", que é o contrário do que ela diz. Pela mesma razão o briefing da
  leitura da IA a rotula como aposentada: sem isso o analista sugere trocar o
  modelo "da rota outras".

## O corte por VERSÃO (aba "Versões" de `/admin/costs`)

Rota, usuário, ação e sessão são cortes de ESPAÇO, dizem onde o dinheiro foi. A
aba "Versões" é o corte de TEMPO, e responde à outra pergunta: **depois daquela
mudança, ficou melhor ou pior?**

Data não serve de marcador, ela sabe quando a CHAMADA aconteceu, não quando o
DEPLOY subiu. O marcador é `llm_usage_events.app_version` (migração `0044`),
carimbado por `recordChatUsage`/`recordAudioUsage` a partir do `package.json`.
Ele só separa alguma coisa se a versão SUBIR a cada entrega, e é por isso que
`npm run release` antes de todo push é regra do `AGENTS.md` da raiz, não
sugestão: sem o bump as linhas se fundem numa só, **sem erro nenhum na tela**.

Cinco decisões dessa aba, todas contra o mesmo risco de mostrar um número que
parece resposta e não é:

- **A leitura correta é uma ROTA de cada vez**, e o aviso acima da tabela diz
  isso. Sem fixar a rota, o custo médio por chamada muda só porque a MISTURA de
  rotas mudou entre dois deploys: uma semana com mais importações do YouTube
  parece uma versão que encareceu tudo.
- **Não há coluna de moedas por versão na tabela.** O débito é por minuto de
  gravação, não por chamada, não há como ratear uma cobrança de minuto entre
  as chamadas que ela pagou.
- **Os filtros finos (usuário, rota, modo) NÃO atravessam para a aba de
  preços** (`summary.coinsScoped`). Custo recortado por rota dividido por moeda
  inteira é um número sempre baixo, com cara de margem folgada, o tipo de
  mentira que ninguém investiga porque a conta parece boa. Enquanto eram duas
  telas, a proteção era um travessão nos dois KPIs de moeda; hoje o recorte
  simplesmente não chega àquela aba, e período e versão são os únicos que
  atravessam, porque os dois recortam os DOIS lados da conta (o da versão pela
  regra da janela, abaixo).
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

### A regra da janela, e por que a aba de preços também tem o filtro

`llm_usage_events` tem carimbo de versão; `coin_transactions` **não**. Margem
precisa dos dois lados, e recortar só o custo daria uma fatia dividida pela
receita do mês inteiro. A regra é uma frase:

> A versão recorta pelo **carimbo** onde há carimbo (chamadas de LLM) e pela
> **janela** em que ela esteve no ar onde não há (o ledger de moedas).

A janela é medida, do primeiro evento da versão ao primeiro da seguinte
(`VersionWindow` em `src/features/admin/server/db/usage.ts`); a mais nova tem fim aberto. É o
que permite a aba de PREÇOS responder "esta mudança melhorou a margem da
ação?" com o mesmo seletor de versão. A faixa `VersionWindowNote` **mostra o
intervalo resolvido**, e fica acima das abas, não dentro de uma: um recorte de
seis horas no ar é indistinguível de um de um mês, os dois levam a decisões
opostas, e quem trocou de aba com a versão fixada precisa continuar vendo qual
é.

Uma versão sem evento no período zera moeda e custo JUNTOS, zerar só o custo
produziria margem de 100%. A imprecisão conhecida é o rollout, em que a Vercel
serve as duas versões por alguns minutos.

Guia completo em [`docs/versionamento.md`](../../../docs/versionamento.md).

## A aba "Sessões": o LUCRO de cada uma

A tabela responde "esta sessão deu dinheiro?", e as colunas de hoje são o
conserto de uma que respondia outra pergunta. A última era **custo por 1.000
moedas** — a unidade da aba de PREÇOS, onde a pergunta é se o milheiro se
paga. Uma sessão não é uma decisão de preço: ela já aconteceu, já cobrou e já
custou. O que se quer dela é quanto sobrou.

No lugar entraram **duas** colunas, e são a mesma conta em unidades que
servem para coisas diferentes: **lucro em real** soma ao longo da lista,
**margem em porcento** compara sessões de tamanhos diferentes. A conta é
`computeSessionEconomics` (`features/coins/economics.ts`), no mesmo arquivo
de onde sai a da aba de preços — uma segunda definição de margem no painel é
o começo de duas telas discordando.

É a margem **realizada** (custo medido contra a moeda que o ledger cobrou), e
não a "do preço de hoje": uma sessão inteira não tem preço de tabela contra o
qual ser comparada. Duas consequências que a legenda da tabela DIZ:

- **A receita é simulada e o custo é medido.** A receita são as moedas da
  sessão avaliadas pela régua de `/admin/costs` → Preços & margem.
- **Margem em `-` não é 0%.** Uma sessão cuja moeda foi debitada fora do
  período não tem receita para dividir; ali o lucro é o custo com sinal
  negativo, e −100% seria um número inventado sobre uma divisão por zero.

Saiu também a coluna **Chamadas** (detalhe de pipeline, e a aba Rotas é a
tela que responde onde o custo se reparte) e a data subiu de legenda do
título para COLUNA — uma coluna que não existe é uma coluna pela qual não se
ordena.

**A ordenação é estado de CLIENTE, e é a exceção consciente à regra da URL.**
Data (padrão, mais recentes primeiro), modo, lucro e margem. A regra do
painel — abas e filtros são LINK — vale porque aqueles controles trocam *o
que o servidor busca*; ordenar não troca nada, as linhas já estão na tela. O
preço da escolha está escrito na legenda: a ordenação reordena as
`RECENT_SESSIONS` (50) linhas que vieram, que são as mais recentes do
período. Ordenar por lucro não vai buscar a sessão mais lucrativa de três
meses atrás.

## O que saiu dessa aba: o inspetor de execuções

Havia ali um `/admin/costs?aba=sessoes&sessionId=<uuid>` que abria uma sessão
**execução por execução** (`server/db/session-runs.ts`, `SessionRunPanel`,
`SessionRunLookup`). Era a única leitura que NÃO agregava, e existia por um
ponto cego específico: reprocessar um ESTUDO gravava um segundo conjunto de
eventos na mesma sessão, e somados eles viravam um número que não descrevia
nem uma execução nem a outra.

**Com o estudo fora do produto não há mais duas execuções para separar.** Toda
outra ação do Scriba grava um conjunto de eventos por cobrança, e é isso que a
tabela de sessões já mostra. O inspetor saiu junto, e com ele o `sessionId` na
URL desta tela: a porta que a linha ainda tem é o "ler", que abre o CONTEÚDO
da sessão em `/admin/sessions/[id]` ao lado do custo que ele pagou.

**"Moedas gastas" é filtrado por MOTIVO, nunca por `abs(amount)`.**
`coin_transactions` é o ledger inteiro: `grant_coins` grava
`subscription_grant`, `topup_pack` e `partner_bonus` com valor POSITIVO, e o
estorno grava um negativo que é devolução de crédito, não consumo. Só os seis
motivos de `CHARGE_REASONS` são gasto. O módulo de leitura já faz esse corte,
não recrie a soma numa tela.

## Preços e margem (a aba de decisão de `/admin/costs`)

Responde a UMA pergunta que nenhum dos outros três cortes responde: **continuo
cobrando 5 moedas o minuto?** Preço não é cobrado por rota, é cobrado por AÇÃO,
e uma ação é várias rotas (um minuto gravado é transcrição + a fatia dele no
resumo final). Somar rota a rota à mão para chegar no minuto era o trabalho que
esta aba existe para não ser refeito.

**Ela é a aba PADRÃO da tela** (`/admin/costs` sem query abre nela), e a ordem
das quatro é a da decisão: preço, depois o diagnóstico por rota, depois o
tempo, depois a sessão. Quem chega com uma pergunta de dinheiro cai na resposta
antes de cair no detalhe.

**A fileira de KPI do topo era DUAS.** "Uso & custos" abria com custo, moedas e
custo por milheiro; "Precificação" abria com os mesmos três mais a margem, com
o primeiro cartão rebatizado ("Custo no período" contra "Custo medido"). Ficou
a fileira completa, uma vez só, e a margem — a única diferença real — é o
cartão que fecha a leitura.

**As ações são quatro: gravação, importação do YouTube, resumo de sessão
salva e Biblo.** Os motivos de ledger LEGADOS (os três modos de captura
antigos, o resumo sob demanda do modo transcrição) continuam somando nas
linhas certas — ver o comentário de `reasons` em `billable.ts`. Reescrever
motivo em ledger de dinheiro é apagar o que de fato aconteceu.

**Eram cinco, e a quinta era o Estudo aprofundado.** Ele saiu do produto
inteiro, e com ele a LINHA DE PREÇO: perguntar "o estudo ainda se paga?" sobre
algo que ninguém pode comprar é uma decisão que não existe. O que ele gastou e
cobrou continua no banco e continua dentro da margem agregada, num balde
próprio (`LEGACY_ACTION_KEY`) — sem ele o custo daquelas chamadas cairia na
linha da Gravação, que as gerou, engordando o custo do minuto sem engordar as
moedas dele. Os motivos `deepening` / `reprocess_deepening` foram para
`LEGACY_CHARGE_REASONS` pela mesma razão, do lado do ledger.

O vocabulário está em `src/features/coins/billable.ts` (client-safe) e a conta em
`src/features/coins/economics.ts`. O mapeamento ROTA → ação mora em
`src/features/admin/server/db/usage.ts`, junto do resto da agregação: **é a
mesma passada pelas mesmas linhas** que alimenta as outras abas. Uma segunda
consulta de custo é uma segunda definição do mesmo número — e hoje é
literalmente a mesma chamada, uma só por request, com a aba escolhendo o que
desenhar do resultado.

Ela aceita o filtro de **versão**, ao lado das pílulas de período, e ali ele
responde "esta mudança melhorou a margem da ação?". Quem recorta a moeda junto
com o custo é a janela em que a versão esteve no ar, ver "A regra da janela" na
seção do corte por versão, acima. **O que ela NÃO aceita são os filtros finos**
(usuário, rota, modo): eles não chegam a esta aba, pelo motivo do mesmo
parágrafo.

**Há DUAS margens, e a coluna mostra a da DECISÃO.** `marginAtCurrentPrice` é
custo de uma execução contra o que a ação cobra hoje; `realizedMargin` é custo
contra as moedas que o ledger de fato debitou no período. A coluna já mostrou
só a segunda, e isso a punha em contradição com a coluna vizinha: a linha do
Estudo aprofundado (que existia então) aparecia com **−18% de margem** e, ao
lado, a sugestão de **cobrar menos**. Nenhuma das duas tinha defeito de
cálculo: o período pegava lançamentos anteriores à subida de 5 para 50 moedas,
então o ledger tinha 180 moedas em 18 execuções.

A regra que decorre: **a margem exibida e o preço sugerido saem do MESMO custo
por execução**, ou duas colunas vizinhas voltam a se contradizer sem que nada
esteja errado. A realizada continua na tela, mas só quando o ledger cobrou algo
diferente do preço atual (`ledgerDivergesFromPrice`), porque aí a divergência
é o achado, não ruído.

Quatro coisas que quem mexer aqui não pode desfazer:

- **A régua da moeda mora NESTA aba, e não em `/admin/settings`.** Ela é o
  único parâmetro do painel que não foi para a tela de configurações, e a razão
  é a do item seguinte: separá-la da margem que ela move faria o número da
  outra tela parecer um fato. O câmbio manual fica fora pelo mesmo motivo, no
  selo que mostra a cotação em uso.
- **Os dois lados da conta têm origens diferentes, e a tela diz qual é qual.**
  O custo é MEDIDO; o valor da moeda é uma régua que o admin gira. Um painel em
  que os dois parecem igualmente factuais convida a decidir preço com base num
  número que alguém digitou.
- **A régua é um cookie, não uma tabela.** Nada do que se digita ali cobra
  coisa alguma, quem cobra é o Price do Stripe, e quem credita é
  `src/features/billing/server/catalog.ts`. Uma tabela `coin_pricing` no banco seria um convite
  a alguém, um dia, ler dali para cobrar de verdade.
- **A linha "gasto sem cobrança" precisa aparecer.** É a consulta de versículo
  avulsa, a formatação fora de gravação e o evento de sessão apagada: custo real
  que não entrou em margem nenhuma. Listar só o que é cobrável faz toda margem
  parecer melhor do que é.

## A leitura da IA (na visão geral, `/admin`)

Uma análise que um modelo escreve sobre os números do painel. Ela não tem
número próprio: `src/features/admin/server/insights/briefing.ts` monta o briefing a partir de
`loadAdminUsageSummary`, `loadAdminMetrics` e `computeActionEconomics`, os
MESMOS que desenham as tabelas das outras telas. Uma segunda aritmética "só
para o prompt" produziria um insight contradizendo uma tabela do painel.

**Ela já foi três, depois uma tela própria, e as duas mudanças são o que este
trecho precisa ensinar.** Primeiro havia um card lateral nas duas telas de
custo de então e em `/admin/metrics`, cada um com o seu recorte (`pricing`,
`usage`, `metrics`), e cada um DISPARANDO a geração sozinho quando a linha
gravada passava de 24 horas. Dois defeitos que só aparecem com o painel em uso:

- **as três diziam quase a mesma coisa**, porque saem dos mesmos eventos, só
  recortados diferente. E nenhuma podia concluir sobre o negócio, porque cada
  uma via um terço dele: uma rota cara é a margem de uma ação, que é o preço de
  um plano, que é o passivo de moedas. A divisão que existia para evitar três
  respostas genéricas produzia três respostas parecidas E incompletas.
- **ninguém as pedia.** A chamada de LLM mais cara do produto rodava porque
  alguém abriu uma tela para conferir o MRR.

A correção foi uma leitura geral, com página própria, rodando **só no clique**.
A página própria, porém, era um cabeçalho, o painel e três atalhos, e custava
uma linha do menu para hospedar um botão.

Hoje a leitura vive na VISÃO GERAL, e o encaixe é exato: ela é uma síntese do
negócio inteiro (custo, preço, funil e passivo saem dos mesmos agregados das
outras telas), e a visão geral é a tela que também é síntese. Os cinco números
do topo são os mesmos que o briefing recebe, então o texto comenta o que está
logo acima dele. **O clique continua sendo a única coisa que dispara geração**:
abrir `/admin` não chama modelo nenhum.

Sete coisas que quem mexer aqui não pode desfazer:

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
  como PK, com o valor constante `general` (ver `src/features/admin/server/insights/store.ts`);
  as três linhas antigas foram apagadas pela migração 0054.
- **Os atalhos abaixo dela não são decoração.** A leitura cita margem, rota e
  funil, e quem quiser conferir um número precisa chegar à tabela que o publica
  sem caçar no menu. Eles são a razão de a visão geral ainda ter uma fileira de
  links, agora três e não quatro, e apontando para telas que o texto acima de
  fato menciona.

O custo dela é gravado como qualquer outra rota (`admin-insights` em
`llm_usage_events`), na ação `internal`, separada de `unbilled` porque os dois
têm consertos opostos: gasto sem cobrança é preço mal ajustado, custo interno é
despesa nossa que nunca vai ter moeda atrás. Somados, a tela sugeriria cobrar
do usuário por uma chamada que só o admin dispara.

## Cupons de convite (aba de "Crescimento")

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
  que é o que torna o teto exato. `src/lib/db/coupons.ts` só traduz o resultado.
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

O cookie é `scriba_coupon` (`src/features/referrals/cookies.ts`, junto dos outros três),
carrega só o CÓDIGO, é `httpOnly` e vale 30 dias. Ele é separado do
`scriba_ref` pela mesma razão que o do pré-parceiro: o `scriba_ref` decide para
onde vai DINHEIRO, e uma promoção não pode disputar espaço com a atribuição de
comissão.

## Modelo sem preço na tabela

`/admin/costs` abre com um aviso vermelho quando alguma chamada rodou num
modelo que não está em `src/lib/llm/pricing.ts`. Elas gravaram custo **zero**, e
sem o aviso o sintoma é uma conta boa demais, que é o sintoma que ninguém
investiga.

**A tabela que vale depende da ROTA, não do nome do modelo**, e é
`isAudioUsageRoute` (`lib/db/usage.ts`) quem responde: as rotas de áudio são
cobradas por minuto e o resto por token. Isto já falhou uma vez — o agregador
só conhecia `transcribe`, e quando `biblo-voice` nasceu como a segunda rota de
áudio o modelo dela passou a ser procurado na tabela de CHAT, onde nenhum STT
existe. Duas chamadas com custo gravado certo viravam um aviso de custo
subestimado, na visão geral inclusive. **Um aviso de medição que mente é pior
que aviso nenhum**: ele gasta a confiança que o painel precisa ter no dia em
que estiver certo. Rota nova que chame `recordAudioUsage` entra em
`AUDIO_USAGE_ROUTES`, de onde o tipo do parâmetro também sai. O efeito em cadeia é o pior possível: a margem daquela ação sobe, e
a aba de preços passa a recomendar BAIXAR um preço que já não se paga. Trocar
um modelo por env var sem acrescentá-lo à tabela é o caminho normal de cair
nisso.

**O aviso fica ACIMA das abas, não dentro de uma.** Custo subestimado contamina
os quatro cortes, e quem abriu direto a aba de preços não passa pela de rotas
para ser avisado. Vale o mesmo para a faixa da janela de versão: os dois são
ressalvas sobre TODA a tela. Ele reaparece, resumido, entre os avisos da visão
geral, pela mesma razão — é lá que se abre o painel.

## Configurações (`/admin/settings`)

**Tudo o que o painel GIRA sem deploy, num lugar só**, em duas abas:
Funcionalidades e Financeiro. Eram duas telas em cantos opostos do menu
(`/admin/features` no grupo do produto, `/admin/financeiro/configuracoes` no do
dinheiro) fazendo a mesma coisa, e quem procurava "onde eu ligo/desligo isso"
tinha de adivinhar por qual começar.

**Duas réguas NÃO vieram para cá, e a exceção é a regra.** O valor da moeda e o
câmbio manual continuam onde o número que eles movem é lido: a régua na aba de
preços de `/admin/costs`, o câmbio no selo que mostra a cotação em uso.
Separar uma simulação da margem que ela produz faria o número da outra tela
parecer um fato — que é exatamente o risco documentado na seção de preços.

**Cada aba busca só o que usa.** A de produto não toca em finanças; a
financeira não carrega o snapshot de doze meses, porque não mostra total nenhum
e puxar os eventos de LLM para desenhar dois formulários seria gastar quatro
consultas grandes por visita sem nada em troca.

### A aba de Funcionalidades

Três blocos, e a ORDEM é a mensagem: a matriz `funcionalidade × plano` vem
primeiro e **não tem botão nenhum**. Ela é o retrato de
`src/lib/entitlements/features.ts`, e é assim que a tela diz "o lugar de liberar
uma funcionalidade para outro plano não é aqui, é um commit".

**Ela tem UMA linha hoje, `biblo_chat`.** A segunda era `study_generation`, e
saiu junto com o estudo: um kill switch e uma exceção por pessoa para um
produto que não existe são controles que não governam nada, e girá-los não
produz efeito nenhum em tela nenhuma. É o mesmo raciocínio que tirou a linha
de preço do estudo de `/admin/costs`.

Os dois blocos seguintes editam o que precisa mudar sem deploy:

- **Kill switch**: desliga uma feature para TODO MUNDO, inclusive para quem
  tem exceção liberada e para quem paga. Botão de incidente.
- **Exceções por pessoa**: por e-mail, liberar ou revogar.

`POST /api/admin/features` valida `feature` contra `isFeatureKey` antes de
escrever. Sem isso, um typo cria linha órfã que nunca é lida, e alguém passa a
tarde procurando por que o switch "não funcionou". **A rota não mudou de
endereço**: só a tela que a chama mudou, e `/api/admin/features` continua sendo
o nome dela.

### A aba Financeiro

`FinanceSettingsForm` (saldo em caixa, alíquota, câmbio das projeções) e
`CategoriesManager`. **Categoria não se apaga, arquiva-se**: sem categoria um
custo é tratado como variável, e apagar "Infraestrutura" faria o custo fixo de
todo o histórico despencar sem nada indicando por quê. Por isso não existe
`DELETE` na rota de categorias, e por isso trocar a `nature` de uma tem log
próprio.

## Os dois detalhes que abrem POR CIMA da lista

`/admin/sessions/[id]` e `/admin/users/[id]` são **rotas interceptadas**: o
clique na linha abre um modal sobre a lista, e a mesma URL colada num chat ou
recarregada com F5 abre a página cheia. São as duas únicas do repositório, e a
convenção é a do Next (`@modal` + `(.)`, ver `intercepting-routes.md` e
`parallel-routes.md` em `node_modules/next/dist/docs/`).

```
admin/layout.tsx                    recebe o slot `modal` como PROP
admin/@modal/default.tsx            `null` — o estado vazio, em toda outra rota
admin/@modal/(.)sessions/[id]/      o modal  ─┐ os dois desenham
admin/@modal/(.)users/[id]/         o modal  ─┤ o MESMO componente
admin/sessions/[id]/                a página ─┤ (`AdminSessionReader`,
admin/users/[id]/                   a página ─┘  `UserEditForm`)
```

**O que isso compra é a lista que fica ATRÁS.** `/admin/sessions` tem filtro de
modo, de usuário e paginação em `searchParams`, e é uma tela que se percorre:
abrir e fechar quatro sessões até achar a certa era, antes, quatro voltas à
lista do zero — consulta refeita, filtro perdido, rolagem no topo. Com o modal
a lista nunca é desmontada. Em `/admin/users` o ganho é outro: a ficha era um
`<Dialog>` aberto por `useState`, **sem endereço nenhum** — não dava para
mandar "olha essa conta" para alguém nem voltar a ela depois de um F5.

Quatro coisas que quem mexer aqui não pode desfazer:

- **O conteúdo mora num COMPONENTE, nunca dentro de uma das duas rotas.** Elas
  são dois enquadramentos do mesmo conteúdo, e duas cópias divergem na primeira
  aba nova — que entraria só numa delas, sem nada acusando, até alguém comparar.
- **`@modal/default.tsx` devolvendo `null` é obrigatório.** Um slot paralelo
  precisa ter o que renderizar em TODA rota do painel, e sem ele uma carga dura
  de `/admin/costs` responde 404 na tela inteira: o jeito mais confuso possível
  de uma rota que existe parecer que não existe.
- **Fechar é `router.back()`, nunca um `push` para a lista** (`RouteModal`). O
  modal nasceu de uma navegação, então desfazê-la é o que devolve a pessoa ao
  lugar exato de onde ela veio. Um `push` empilha entrada nova e traz a lista do
  topo, com os filtros em branco — exatamente o que este desenho evita.
- **O link tem de ser um `<Link>`.** A interceptação só acontece na navegação
  do cliente; um `onClick` com `window.location` ou um `<a>` cru é carga dura, e
  a pessoa cai na página cheia sem lista atrás. Foi essa a troca feita no botão
  da pena de `UsersManager`.

O `AdminSessionReader` recebe `inModal` para esconder o "Todas as sessões": no
modal ele seria um segundo jeito de fazer o que fechar já faz, e o pior dos
dois, porque é um `<Link>` que empilha histórico. O `UserEditForm` recebe
`frame` pela mesma razão, e é o que decide entre `back()` e `push`.

## Sessões (aba de "Conteúdo")

Não é métrica nem custo: é o CONTEÚDO. A lista traz todas as sessões, de todo
mundo, e `/admin/sessions/[id]` abre uma delas em abas: resumo e transcrição.
Houve uma terceira, o estudo, que saiu com ele do produto.

Ela existe porque as outras telas respondem em volta do texto e nunca sobre
ele: `/admin/costs` diz quanto custou, `/admin/metrics` quantas foram, e a
aba vizinha, Feedback, que nota deram. Uma nota "razoável" não distingue um
resumo que inventou uma citação de uma transcrição que perdeu o meio da
pregação, e nos primeiros usuários o texto é a única evidência de qualidade que
existe.

**As duas são abas da mesma tela por isso.** A nota sem o texto não diz o quê;
o texto sem a nota não diz se alguém se incomodou. Separadas no menu, cada uma
respondia metade de "o que a pessoa recebeu presta?", que é uma pergunta só.

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
  conteúdo que o dono não gerou e não sabe que mudou. `src/features/admin/server/db/sessions.ts`
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
sessões de `/admin/costs`. Ela nasceu lá e virou componente quando a segunda
tela precisou dela, com a divergência que duas cópias sempre produzem já
consumada: `youtube` tinha entrado em `SESSION_MODES` e a cópia de lá continuava
desenhando "-", que se lê como "sessão sem modo".

## O que saiu: `/admin/studies`, e depois o estudo inteiro

A tela de avaliação do estudo (as 25-30 perguntas do questionador, as
respondidas, as cortadas pelo guardião e as não escolhidas) foi removida do
painel primeiro: era leitura diagnóstica, não métrica, e quem quisesse o
diagnóstico precisava abrir uma tela que ninguém abria.

Naquele commit **o dado continuou existindo** — `session_deepenings.plan`
guardava o `StudyRecord` inteiro (migração 0033), o pipeline continuava
gravando-o, e `/admin/sessions/[id]` mostrava a CONTAGEM ("11 de 27 perguntas
respondidas").

**Hoje não existe mais nada disso.** O estudo saiu do produto inteiro e a
tabela foi dropada (migração 0075), junto com a aba de leitura, o
`SessionRunPanel` e a linha de preço. Quem quiser a história abre o git: a
distinção que importava era entre **cortada** (o guardião disse que o resumo já
respondia, culpa do questionador) e **não escolhida** (o respondedor preferiu
outras, culpa dele), e ela vale como lição de desenho de diagnóstico mesmo sem
o produto atrás.

## Léxico (aba de "Conteúdo")

Os nomes próprios que o resumo MARCA no texto, e o cartão que abre em cada um.
Migração 0063, tabela `lexicon_entries`.

**Ele é aba de Conteúdo porque responde à mesma pergunta pelo outro lado.**
Sessões e Feedback olham o que o MODELO escreveu; o léxico é o único texto de um
resumo com a NOSSA voz — um cartão sobre Habacuque ou sobre o Mar Vermelho,
escrito à mão. Quem abre uma sessão para julgar qualidade está a um clique de
consertar a parte que é nossa.

**Publicar é a ação de verdade desta tela, e por isso é um BOTÃO, não um
campo.** Publicar uma entrada faz três coisas de uma vez: o nome passa a ser
marcado na prosa de todo mundo, o cartão passa a abrir no toque, e a descrição
passa a entrar como FONTE na conversa do Biblo. Isso não é um atributo que se
alterna de passagem enquanto se conserta um acento. `LexiconEntryInput` nem
aceita o campo; a rota tem uma ação `publish` própria.

O que não pode ser desfeito:

- **Só entrada COM cartão é marcada.** Título e descrição, os dois, e a regra
  mora em `canPublishLexiconEntry` (client-safe), chamada pelo painel para
  acender o botão e pela rota para recusar o pedido. O botão é UX, a rota é a
  regra. A imagem é opcional: um cartão com texto e sem foto responde a pergunta
  que o toque fez; com foto e sem texto é uma imagem sem legenda no meio de um
  sermão.
- **Salvar NÃO fecha a caixa, nem no cadastro novo**, e isso conserta um fluxo
  em dois tempos: criar, ver o diálogo fechar, procurar a entrada na lista,
  abrir de novo, subir a imagem, publicar. Imagem e publicação só existem depois
  que HÁ uma linha, então fechar bem no instante em que ela passa a existir é
  fechar a porta na hora em que ela abre. O diálogo guarda a entrada corrente
  (`current`) e TROCA DE MODO no lugar quando o `create` volta.
- **Publicar GRAVA o formulário junto, numa escrita só**, e isso é o conserto de
  um defeito real. Os dois lados chamavam a mesma função sobre coisas
  DIFERENTES: o botão sobre o formulário, a rota sobre a linha gravada. Quem
  preenchia os campos e ia direto ao Publicar via *"Escreva o título e a
  descrição antes de publicar"* com os dois escritos na frente dele — um passo
  escondido ("salve primeiro") que nada na tela pedia. Uma escrita, e não um
  salvar seguido de um publicar: duas chamadas abrem a janela em que a primeira
  passa e a segunda falha, e a entrada fica gravada e apagada.
- **A tela nasceu com 258 rascunhos e zero publicadas**, porque o seed da 0063
  trouxe para cá o léxico que era um array no código. O trabalho que ela serve
  não é administrar um cadastro, é ESCREVER CARTÕES até o produto voltar a marcar
  nomes — daí a ordenação padrão pôr rascunho primeiro e o filtro de estado ser o
  primeiro que se alcança. O "x de y publicadas" é o progresso disso, e o
  denominador vem de uma segunda leitura sem filtro, senão filtrar por rascunho
  mudaria o total na mesma tela em que se acompanha o avanço.
- **O SLUG não é recalculado quando o termo muda.** Ele é o endereço do cartão
  (`/api/lexicon/<slug>`) e o que o Biblo grava ao apontar uma entrada; trocá-lo
  por causa de um acerto de acento quebraria em silêncio toda referência já
  gravada. O diálogo o mostra por isso.
- **Uma entrada publicada que perde título ou descrição volta a rascunho**, no
  próprio `updateLexiconEntry`. Publicado é a promessa de que há cartão, e salvar
  não pode deixá-la de pé e vazia.
- **A busca é feita em MEMÓRIA, e só a categoria e o estado vão ao banco.** Ela
  precisa cobrir também os APELIDOS (quem procura "Lutero" não sabe que a entrada
  se chama "Martinho Lutero"), e `aliases` é `text[]`, onde o PostgREST só
  oferece `cs`, que casa o elemento inteiro — "luter" não acharia nada.

### "Algo está errado": o alerta que vem de quem lê

O cartão tem um menu de três pontinhos com "Algo está errado", e o que ele
escreve cai em `lexicon_reports` (migração 0066), listado no TOPO desta tela.

**Ele não é o alerta de alucinação, apesar do mesmo rótulo.** Aquele manda a
nota a um modelo que a cruza com a TRANSCRIÇÃO e responde na própria janela;
existe o que auditar, porque o texto foi escrito por uma IA a partir de um áudio
que existe. Aqui o conteúdo foi escrito à mão no painel: não há IA para auditar
nem transcrição para conferir, e a única resposta possível é uma pessoa ler e
corrigir. Então a janela do usuário não promete análise nenhuma — recebe o
recado e agradece. Fingir uma apuração seria pior que não ter o botão.

- **A fila abre a tela, e some quando está vazia.** O trabalho normal daqui é
  escrever o próximo cartão; um alerta é a exceção que fura essa fila, porque
  alguém LEU o que escrevemos e disse que está errado. Um bloco "nenhum alerta"
  permanente seria moldura vazia no lugar do que a pessoa veio fazer.
- **"Resolvido" marca, não apaga.** A linha sai da fila e fica no banco: é o que
  responde "esse texto já foi questionado antes?", e três alertas sobre a mesma
  entrada dizem algo que um só não diz.
- **A tabela tem RLS ligada e NENHUMA policy**, como `feedback_responses`. Uma
  policy de INSERT para `authenticated` autorizaria a escrita sem olhar o
  conteúdo, e esta tabela é uma FILA DE TRABALHO: enchê-la de lixo não custa
  dinheiro, custa os alertas de verdade ficarem enterrados.

### A imagem: o primeiro arquivo que o produto guarda

Bucket público `lexicon`, escrita só por `/api/admin/lexicon/image` com
service-role. Três coisas:

- **O banco guarda o CAMINHO, nunca a URL.** O domínio do projeto Supabase é
  diferente em dev e em produção; uma URL gravada apontaria para o ambiente
  errado no primeiro dump copiado de um lado para o outro. O `remotePatterns` do
  `next.config.ts` deriva o host da mesma variável, pela mesma razão.
- **O nome do arquivo carrega um carimbo de tempo.** Público quer dizer cacheado:
  sobrescrever `abraao.jpg` deixaria a foto antiga viva nos navegadores por
  horas, e o sintoma é "troquei a imagem e não mudou nada". Nome novo, URL nova,
  e a antiga é apagada em seguida.
- **E isso não bastava sozinho.** A URL nova fura todo cache de HTTP e mesmo
  assim a imagem trocada continuava velha na LEITURA, porque quem segurava a URL
  antiga era um degrau acima: o cache de consulta do cartão, criado com
  `staleTime: Infinity` copiado do padrão da passagem bíblica. A Bíblia é
  imutável; um cartão é conteúdo que a mesma pessoa acabou de editar. Hoje o
  prazo dele é o mesmo do índice de nomes, e a query fica fora do disco. Ver
  `features/session/lexicon-query.ts`.
- **A imagem nunca é CORTADA, em nenhuma das três telas.** Faixa de altura fixa
  com `object-contain`, e não uma proporção com `object-cover`. O léxico guarda
  as duas formas — o retrato de um personagem é alto, o mapa de uma rota é
  deitado —, e não existe proporção fixa que sirva às duas cortando: um 16/9
  sobre o retrato de Paulo comeu a cabeça e o peito, que era o que a imagem
  tinha a dizer. A altura é fixa porque não guardamos as dimensões do arquivo:
  uma caixa que se molda à imagem só saberia o tamanho depois de carregá-la, e o
  texto abaixo pularia de lugar no meio da leitura. A miniatura do painel segue
  a mesma regra, porque quem confere a imagem aqui está conferindo o que vai
  aparecer lá.
- **SVG é aceito** (migração 0064), e o cabeçalho dela tem o argumento inteiro:
  mapa, planta do templo e linha do tempo são desenho, não foto. O que o mantém
  inerte são três pernas, e as três precisam continuar de pé — quem sobe é o
  admin, o arquivo mora em OUTRA origem (o domínio do Supabase, não `scriba.cc`),
  e a tela o desenha por `<img>`/`next/image`, nunca por `<object>`, `<iframe>`
  ou `<embed>`, que são os que executam script de SVG.

## Feedback (aba de "Conteúdo")

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
  transcrição e experiência geral são peças com consertos diferentes; uma "nota do Scriba" que as misturasse não apontaria para lugar
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
o agrupamento, uma janela com dois tópicos aparece como duas pessoas dizendo
exatamente a mesma frase.

A escala é texto no banco e vira número em UM lugar só,
`FEEDBACK_RATING_SCORE`, em `src/lib/domain/feedback.ts`, o mesmo módulo que
desenha os chips no navegador.

## Usuários (`/admin/users`)

A lista de contas responde "quem são e o que podem" desde sempre; ela passou a
responder também **quem paga, por qual plano, há quanto tempo, e quem já pagou e
parou**. Antes disso a única forma de saber se uma conta era pagante era abrir o
Stripe: `/admin/metrics` dizia QUANTOS assinantes existem e `/admin/finance`
quanto eles somam, mas nenhuma das duas dizia QUEM.

**E ela CREDITA moedas avulsas**, pelo botão da moeda em cada linha
(`GrantCoinsDialog` → `POST /api/admin/users/:id/coins`). Antes disso, dar uma
cortesia a quem perdeu uma gravação por um defeito nosso significava abrir o
Supabase Studio e somar um número na coluna `coin_balance` à mão: sem lançamento
no ledger, sem autor, sem motivo, e a uma tecla de editar a linha errada. Um
crédito feito assim não aparece em `/admin/costs` e não entra no passivo de
moedas.

**A rota é mais um chamador de `grantCoins`, não uma segunda porta de crédito**
(ver `src/features/billing/AGENTS.md`, "Todo crédito passa por `fulfill.ts`" —
o princípio é o mesmo). Daí ela herdar de graça o lançamento com motivo próprio
(`admin_grant`, que já existia no `GrantReason` esperando por isto), o
incremento ATÔMICO da RPC e a idempotência por `external_ref`. O `external_ref`
carrega QUEM deu e um id sorteado no SERVIDOR: quem deu é o que torna o
lançamento auditável meses depois, e o sorteio do lado de cá é o que faz duas
cortesias iguais no mesmo minuto serem dois créditos em vez de um — sorteado no
cliente, um duplo clique viraria crédito dobrado ou nenhum.

**Ela só CREDITA**, com teto de 50.000 por operação. Tirar moeda é estorno, tem
motivo próprio (`refund`/`chargeback`) e já tem caminho (`clawbackCoins`); um
campo que aceitasse os dois sinais transformaria um erro de digitação na zeragem
da conta de um assinante. O MOTIVO digitado vai para o log, nunca para o ledger:
`coin_transactions.reason` é o vocabulário fechado de `GrantReason`, e texto
livre nele faria toda consulta que agrupa por motivo ganhar uma cauda de frases
únicas.

A coluna "Saldo" ao lado veio junto, da mesma linha de `profiles` que a lista já
lia — sem ela o diálogo pediria um número sem dizer quanto já existe na conta,
que é justamente o que decide entre dar 50 ou 500.

**O plano vem do espelho; o tempo e o dinheiro vêm do ledger.** Essa divisão é a
decisão central da tela, e ela não é preciosismo:

- `subscriptions` é um espelho MUTÁVEL, uma linha por conta, sobrescrita pelo
  webhook a cada mudança. Ela sabe o estado de AGORA e mais nada: quem cancelou e
  voltou tem uma linha só, o `created_at` dela é a primeira assinatura e não o
  começo do período atual, e quem abandonou o checkout no meio (`incomplete`) tem
  linha igual à de quem pagou. Ler "pagante desde" daí devolveria a data de uma
  INTENÇÃO.
- `coin_transactions` tem histórico: cada fatura paga é uma linha com
  `external_ref` único, escrita por `features/billing/server/fulfill.ts`, e ela
  nunca é reescrita. É o único sinal datado de "entrou dinheiro" que o banco tem.

Daí saem as **quatro classes, excludentes**, que são as pílulas de filtro:
`assinante` (assinatura viva), `ex_assinante` (pagou fatura, hoje sem assinatura
viva), `avulso` (nunca assinou, comprou pacote — também é conta pagante) e
`nunca`. Elas cobrem a base inteira, e é isso que permite ler as contagens como
resposta em vez de quatro filtros que talvez se sobreponham.

O que não pode ser desfeito:

- **A receita por conta sai de `aggregateMeasuredRevenue`**, a MESMA função que
  desenha a receita de `/admin/finance`. Uma conversão moeda→reais escrita
  aqui seria a segunda definição do mesmo número, e as duas discordariam no dia
  em que um plano mudasse de franquia. A limitação dela vale aqui igual (é preço
  de TABELA, não valor cobrado — ver o cabeçalho de `finance/measured.ts`), e o
  asterisco na célula existe para os créditos que não casaram com o catálogo: um
  total incompleto sem aviso é um total que ninguém audita.
- **A tela não publica MRR nem receita total.** Os dois já têm dono, e dois
  lugares publicando o mesmo número fazem quem lê conferir se batem em vez de
  ler a tela. O que ela publica são contagens de LINHAS dela mesma.
- **O intervalo de tempo é medido com dinheiro dos dois lados**: do primeiro
  pagamento ao último, ou até HOJE enquanto a assinatura vive. Medir um
  ex-assinante até hoje o mostraria como cliente de dois anos tendo pago três
  meses e sumido — e é justamente ele que a tela existe para encontrar.
- **O intervalo aparece na célula, não só a duração.** "5 meses" não distingue
  quem paga de quem parou; "03/2026 – hoje" contra "03/2026 – 08/2026" distingue
  numa olhada.
- **`paidSpanDays` é calculado no SERVIDOR.** `UsersManager` é componente
  cliente renderizado antes no servidor: um `Date.now()` lá dentro produz dois
  valores para o mesmo HTML.
- **Conta apagada (`user_id` nulo no ledger, migração 0056) não vira linha.** O
  pagamento dela continua na receita do painel financeiro; aqui não há a quem
  somar.

As duas consultas de cobrança rodam **sem `.in(userIds)`**, de propósito: com mil
perfis o filtro viraria uma URL de mil UUIDs no PostgREST, as duas tabelas são
pequenas ao lado de `profiles`, e o cruzamento em memória ainda evita a
pegadinha do `in([])`, que o PostgREST lê como "sem filtro".

## Financeiro (`/admin/finance`)

Uma área com navegação PRÓPRIA (`FinanceTabs`), atrás de um item de menu só. A
área inteira responde a uma pergunta que as outras sete não respondem: **quanto
o Scriba ganha, gasta e deve, e para onde isso vai.** Desenho completo em
[`docs/financeiro.md`](../../../docs/financeiro.md); o que não pode ser
desfeito está aqui.

Ela já foi **seis linhas do menu** dentro de um `SidebarGroup`, o que era mais
de um terço do painel inteiro descrevendo recortes de um assunto. Hoje são
quatro rotas e cinco abas:

| Aba | Rota |
|---|---|
| Visão geral | `/admin/finance` |
| Lançamentos | `/admin/finance/entries` |
| Em aberto | `/admin/finance/entries?visao=aberto` |
| Custos recorrentes | `/admin/finance/recurring` |
| Projeções | `/admin/finance/scenarios` |

**"Em aberto" é um FILTRO de Lançamentos, e a faixa de abas diz isso ao pôr os
dois lado a lado sobre a mesma rota.** Era `/admin/financeiro/compromissos`,
uma tela irmã com título próprio ("Compromissos e dívidas"), e a leitura natural
era a de duas listas independentes — a primeira dúvida de quem chegava era se
um valor lançado numa aparecia na outra. Dívida não é um tipo: é um lançamento
com `status <> 'paid'` e `due_date`, e a tela agora responde isso sozinha.

Configurações saiu da área: categorias e parâmetros são a aba Financeiro de
`/admin/settings`, junto do resto do que o painel gira.

**Metade do painel é MEDIDA e não se digita.** Receita de assinatura sai dos
créditos de `coin_transactions` (`src/features/admin/finance/measured.ts`), custo de IA de
`llm_usage_events`, taxa do Stripe de `src/features/partners/economics.ts` e comissão
de `partner_commissions`. O que se lança à mão são as cinco tabelas de
`0043_finance.sql`, e elas guardam só o que ninguém mede por nós, Vercel,
Supabase, domínio, ferramentas, impostos, dívidas.

> A armadilha da área, e ela está dita na tela: lançar "assinaturas de
> setembro, R$ 5.000" à mão CONTA DUAS VEZES. `buildFinanceOverview` devolve
> um aviso quando um mês tem receita medida e receita lançada.

**Uma conta, um lugar.** Toda aritmética mora em `src/features/admin/finance/*`, puro,
client-safe e coberto por `npm test`. Nenhuma página calcula nada: elas
recebem `FinanceOverview` de `src/features/admin/server/db/finance-overview.ts`. É a mesma
regra de `src/features/admin/server/db/metrics.ts`, pelo mesmo motivo.

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
  Vale para toda a camada (`src/features/admin/finance/money.ts`).
- **Os avisos vêm ANTES dos números.** Um painel financeiro erra em silêncio, e
  o sintoma é sempre uma conta boa demais, que é a que ninguém investiga. É a
  mesma razão do aviso de modelo sem preço em `/admin/costs`.

**A projeção roda no CLIENTE, e isso não é cálculo no frontend.** O componente
chama `project()` de `src/features/admin/finance/projection.ts`, o único lugar onde a fórmula
existe e o mesmo que os testes exercitam. Rodar ali é o que permite mexer numa
premissa sem round-trip; nada do que sai dela é persistido. O que se GRAVA em
`finance_scenarios` são as premissas, nunca o resultado, que envelheceria em
silêncio enquanto a base (assinantes, ARPU, custo por cliente) muda sozinha.

**Dívida não é um tipo.** É um lançamento com `status <> 'paid'` e
`due_date`; a aba "Em aberto" é um recorte da mesma tabela, e por isso divide a
rota com Lançamentos. Um terceiro `kind` daria três somas para o mesmo dinheiro
e a primeira quitação faria as três discordarem.

**Categoria não se apaga, arquiva-se.** A regra está na aba Financeiro de
`/admin/settings`, que é onde as categorias são editadas; ver a seção de
Configurações, acima.

## Parceiros (aba de "Crescimento")

O cadastro, a taxa de comissão e o registro de pagamento (PIX) vivem aqui, mas
as invariantes do programa estão em `src/features/partners/AGENTS.md`, leia
antes de mexer em `registerPayout` ou em qualquer coisa que toque
`partner_commissions`.

Dois pontos que mordem deste lado:

- O cadastro é client component. Uma constante que ele exibe não pode vir de
  um módulo `server-only`.
- O comprovante do PIX é um LINK https, validado no CHECK da coluna e no
  schema da rota, não um upload.
