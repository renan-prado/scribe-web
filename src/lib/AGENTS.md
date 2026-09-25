# src/lib/: a camada de servidor

Quase tudo aqui é `server-only`. As exceções client-safe estão marcadas
abaixo, e a distinção não é estilística: importar um módulo `server-only` a
partir de um `"use client"` é erro de BUILD, e é assim que tem de ser.

## O que fica aqui, e o que foi embora

`lib/` é o ENCANAMENTO e os DADOS. Nove pastas e cinco arquivos, e nenhum deles
sabe o que é um sermão:

| | |
|---|---|
| `env` `log` `http` `supabase` `llm` `fx` `auth` | infraestrutura: config, logging, validação, os três clients do Supabase, a chamada de LLM, câmbio e os gates de autorização |
| `db` | o acesso ao banco. `server-only`, uma função por consulta |
| `domain` | o VOCABULÁRIO: tipos, schemas Zod e parsers. **Client-safe**, é o que as duas pontas dividem |
| `bibles` | a NVI em disco. Dado, não regra |
| `entitlements` | qual plano libera o quê. Política que atravessa tudo |
| `rate-limit.ts` `utils.ts` `deploy.ts` `app-version.ts` `seo.ts` | cinco concerns soltos, cada um de uma linha só |

**As REGRAS DE NEGÓCIO saíram daqui.** Eram catorze pastas (`billing`, `coins`,
`partners`, `referrals`, `youtube`, `final-summary`, `transcription`,
`finance`, `admin`, `prompts`, `account`…) e cada uma tinha uma metade de tela
em `src/features/` com o mesmo nome, mais um pedaço em `lib/db/`. Uma feature em
três lugares é três lugares para procurar, e nada no código dizia que os três
eram a mesma coisa.

Hoje cada assunto mora inteiro em `src/features/<assunto>/`:

```
src/features/billing/
  components/   a tela
  plans.ts      client-safe: nome, preço e créditos de cada plano
  server/       server-only: Stripe, catálogo, fulfillment, sweep
```

**A convenção é `server/` para o que leva `import "server-only"`, e a raiz da
feature para o que é client-safe.** Não é organização por gosto: o que decide é
se o módulo pode ser importado de um `"use client"`. Um arquivo na raiz da
feature que ganhe `server-only` muda para `server/` no mesmo commit — senão a
pasta passa a mentir sobre o que se pode importar de onde.

**`lib/db/` NÃO foi dividido junto**, e isso é decisão. `db/sessions.ts` é lido
pela sessão, pelo painel e por meia dúzia de rotas; recortá-lo por feature
trocaria uma camada coesa por três donos discutindo. A exceção é `db/admin/*`,
que só o painel lia, e que foi junto para `features/admin/server/db/`.

**Regra prática:** `features/X` desenha E decide; `lib/db` persiste; `lib/*`
não sabe que X existe.

## Fronteira servidor/cliente

`import "server-only"` no topo é obrigatório em todo módulo que toca segredo,
service-role, `serverEnv` ou o client do Supabase de servidor. Sem ele, um
import distraído a partir de um componente cliente COMPILA: o Next não inlina
env sem `NEXT_PUBLIC_` no bundle do navegador, então o `safeParse` do
`src/lib/env/server.ts` falhava em runtime, no cliente, derrubando o componente e
imprimindo no console os NOMES de todas as variáveis que faltaram. Com o
guard, o mesmo import vira erro na máquina de quem escreveu.

**Corolário:** número que a TELA lê mora em módulo client-safe. Uma constante
puxada de um módulo `server-only` para um componente cliente arrasta o
Supabase com service-role para o bundle e o build recusa, corretamente. Já
aconteceu com `DEFAULT_PARTNER_MONTHLY_COINS`, que teve de mudar de
`partners/allowance.ts` para `partners/economics.ts`.

Client-safe de propósito: `coins/pricing.ts`, `coins/billable.ts`,
`coins/economics.ts`, `billing/plans.ts`, `entitlements/features.ts`,
`partners/economics.ts`, `referrals/economics.ts`, `referrals/cookies.ts`,
`domain/*` (tipos, schemas e o `documento.ts` de CPF/CNPJ),
`supabase/cookie.ts`, `app-version.ts`, `deploy.ts`, `seo.ts`, `utils.ts`,
`transcription/vocabulario.ts`.

## Env: estrito de propósito

`env/server.ts` e `env/client.ts` parseiam com Zod no import e LANÇAM. Uma
variável faltando derruba o boot, não o primeiro request de um usuário.

As do Stripe são a exceção: `.optional()`, para o app subir num ambiente sem
cobrança configurada. Quem as consome é `billing/stripe.ts`, que devolve
`null`, e as rotas `/api/billing/*` respondem 503 `billing_unavailable` em vez
de derrubar o processo no import. `NEXT_PUBLIC_GA_ID` segue a mesma lógica.

Nenhum PREÇO vive aqui: o preço real mora no Price object do Stripe. O que
guardamos é o ID.

Os modelos da OpenAI têm default no schema (`OPENAI_*_MODEL`), então trocar
modelo é variável de ambiente, não deploy.

## LLM

**Toda chamada à OpenAI passa por `callChat` / `callTranscribe`
(`llm/openai.ts`).** Não escreva `fetch("https://api.openai.com/...")` numa
rota. Os dois devolvem `Result<T>` (nunca lançam) e têm timeout por
`AbortController`.

- **Todo system prompt é constante exportada em `prompts/*.ts`**, nunca inline
  na rota.
- **Todo parse de resposta é `parseXxxFromLLM(content)` em `domain/*.ts`.** Não
  reimplemente `JSON.parse` + guardas de forma dentro de uma rota; os helpers
  já devolvem os drops de schema para o log.
- `store: true` + `buildLlmMetadata({ route, userId, sessionId })` fazem a
  chamada aparecer no Logs da OpenAI com as mesmas etiquetas do nosso painel,
  é o que permite conciliar `llm_usage_events` com a fatura. (A OpenAI retém
  prompt e resposta por 30 dias do lado dela.)
- **`recordChatUsage` / `recordAudioUsage` (`db/usage.ts`) alimentam
  `/admin/costs`.** São fire-and-forget: a rota aguarda, mas qualquer falha de
  insert é capturada e logada, observabilidade quebrada nunca vira 500 numa
  rota que funcionou. O preço por token está em `llm/pricing.ts`.

  As duas escrevem com **service-role** e recebem `userId` de quem chama
  (sempre `auth.user.id`, nunca um valor do corpo). Antes escreviam com o
  client do usuário, sob a policy `user_id = auth.uid()`, e policy de INSERT
  autoriza a escrita sem conferir o conteúdo: dava para mandar uma linha de
  custo inventada direto por `POST /rest/v1/llm_usage_events` com o anon key e
  envenenar `/admin/costs`. Migração 0039. De quebra sumiu um
  `auth.getUser()` por registro, era uma ida à rede por trecho transcrito.

  As duas também carimbam `app_version` (migração 0044), o que torna a tabela
  comparável DEPLOY A DEPLOY em `/admin/costs`, mas só enquanto a versão subir
  a cada entrega. Ver a seção "Versão e release" do `AGENTS.md` da raiz.

## Supabase: três clients, três autoridades

| Módulo | Chave | Quem pode usar |
|---|---|---|
| `supabase/client.ts` | anon | browser |
| `supabase/server.ts` | anon + cookie | server components, rotas, actions |
| `supabase/admin.ts` | **service-role** | só depois de ter afirmado admin |

**O nome do cookie de sessão é FIXADO, não derivado da URL.**
`supabase/cookie.ts` (client-safe) monta `sb-<project ref>-auth-token` a partir
de `NEXT_PUBLIC_SUPABASE_PROJECT_REF`, e os TRÊS lugares que instanciam um
client com cookie, `supabase/client.ts`, `supabase/server.ts` e o `src/proxy.ts` da
raiz, passam esse nome em `cookieOptions`. O padrão do supabase-js seria
`sb-<primeiro rótulo do host>-auth-token`, o que amarra o cookie à URL: em
produção a URL é o domínio customizado `https://auth.scriba.cc`, e sem a fixação
o nome viraria `sb-auth-auth-token`, diferente do que está no navegador de quem
já entrou. Nenhum erro apareceria na tela; toda sessão ativa cairia no deploy.
Um client novo com cookie lê o nome daqui, não reinventa. Ver
`docs/ambientes.md` §7.

`createAdminClient()` BYPASSA a RLS. Ele nunca vai ao navegador e nunca serve
request que não passou por `requireAdmin()`. Trocar um client do usuário por
ele numa mutação existente transforma a rota num IDOR sem sinal nenhum no
diff.

**Memoização por request.** `createClient` e `getAuthUser` são embrulhados em
`cache()` do React, cujo escopo é UM render pass, layout, page e
`generateMetadata` do mesmo request dividem o resultado; requests diferentes
nunca. Isso é o oposto de cache persistente: nada sobrevive à resposta.

O motivo: resolver o usuário custava uma ida à REDE. Sem memoização, um load da
Biblioteca fazia OITO delas.

**E hoje não custa nem isso: `getAuthUser()` lê `getClaims()`, não
`getUser()`.** `getUser()` é um `GET /auth/v1/user` no servidor de auth;
`getClaims()` verifica a assinatura do JWT localmente (WebCrypto contra o JWKS
do projeto) e lê a identidade do próprio token. A memoização cortou a
QUANTIDADE de idas; o `getClaims` cortou a que sobrou — e fez o mesmo no
`proxy.ts` (que roda em toda navegação, todo prefetch e toda rota de API) e no
`requireAuth`, onde `cache()` não vale e cada chamada pagava a sua.

O que se perde é FRESCOR: claims valem até o token expirar, então uma conta
desativada no meio da hora ainda passa pelo gate. É por isso que `is_active`
continua saindo da linha de `profiles` (`require-auth.ts`, `db/account.ts`), e
o RLS do Postgres revalida o mesmo JWT do outro lado. O gate diz "há sessão",
não "esta sessão pode".

**Com chave simétrica (o segredo HS256 legado) não há ganho:** sem chave
assimétrica o `getClaims()` chama o `getUser()` por baixo. Nada quebra, só não
economiza — confira as JWT signing keys no painel do Supabase.

**Prefira `getAuthUser()` a `(await createClient()).auth.getUser()`.** É a
mesma coisa, local e cobrada uma vez por request em vez de uma por chamador. As
chamadas cruas que sobraram estão no `/admin`, de propósito: é o caminho do
poder, é raro, e ali o registro canônico do servidor vale a ida.

`cache()` não vale em Route Handler nem em Server Action, eles ficam fora da
árvore de render. Lá o comportamento é o de antes: uma chamada, uma ida à
rede. Nada quebra, só não há o que deduplicar.

**Leituras de sessão têm QUATRO larguras, e a escolha é sobre o que vai pelo
fio.**

| Função | Traz | Para quem |
|---|---|---|
| `getSession` | tudo, `transcript` inclusive | o pipeline do SERVIDOR: reprocessar resumo, auditar alucinação, importar do YouTube |
| `getSessionView` | tudo menos `transcript`, mais `hasTranscript` | as TELAS: `/summary/:id` e `/summary/:id/edit` |
| `getSessionMeta` | nem `transcript` nem `final_summary` | quem só decide rota e cabeçalho |
| `getSessionTranscript` | só `transcript` + duração | o dialog da transcrição, quando abre |

A linha que importa é a segunda. A transcrição viajava no payload de toda
abertura do resumo — dezenas de KB num sermão de quarenta minutos — e a tela
fazia três usos dela, dos quais dois queriam apenas saber se ela EXISTE.
`hasTranscript` é uma coluna GERADA (migração 0061), porque o PostgREST não tem
`length()` no `select` e pedir a coluna para descobrir que ela não está vazia
traria de volta exatamente o que se estava tirando do fio.

Isso não é só higiene de payload: é o que torna o resumo leve o bastante para
ser adiantado no toque (`NavLink prefetchOnPress`) e guardado no aparelho.

As três primeiras são memoizadas porque `generateMetadata` e o corpo da página
chamam a mesma, e o Next só deduplica `fetch()`, não consulta do Supabase.

## Auth e autorização

- `supabase/require-auth.ts`: `requireAuth()` para rota de API: 401 se não há
  sessão, **403 `account_disabled` se `profiles.is_active` é `false`**. A
  conferência mora aqui porque este é o funil por onde toda rota passa; no
  proxy custaria uma consulta ao banco em todo request do site. O cabeçalho da
  migração 0007 afirmava que o proxy conferia, nunca conferiu, e por três
  meses o botão "desativar" do `/admin` pintou a linha de vermelho sem tirar
  nada de ninguém. As páginas são cobertas pela `TopBar` do app e pelo layout
  de `/partners/dashboard`, que leem `isActive` da consulta memoizada de `db/account.ts`.

  A mesma consulta traz `coin_balance` e `is_internal`, e por isso
  `auth.user.coinBalance` e `auth.user.isInternal` existem: é o que
  `coins/require-balance.ts` usa sem custar um segundo SELECT. Linha ausente ou
  erro de leitura passam, só o `false` LIDO recusa, pelo mesmo princípio de
  `getCurrentBalance` — e `isInternal` erra para o lado oposto (`=== true`),
  porque ali o engano seguro é cobrar de quem não devia, nunca liberar quem
  não é.
- `auth/require-admin.ts`: três formas, e a escolha importa:
  - `requireAdmin()` em Route Handler. Responde **404, não 403**: não
    confirmamos a existência da área administrativa a quem não deveria vê-la.
    Faz consulta própria de propósito, é o caminho que protege dinheiro e não
    divide estado com nada.
  - `isCurrentUserAdmin()` em server component. Lê da consulta memoizada.
  - `assertAdmin()` em **Server Action**. Obrigatório: uma action é um POST
    próprio, e o gate do layout não a protege.
- `auth/require-partner.ts`: gate do `/partners/dashboard`, vínculo parceiro↔conta na
  primeira visita, e o ponto onde a mesada mensal é conferida. São **duas
  consultas**, não um `.or()` com o e-mail interpolado no filtro: o valor ia
  parar dentro de um `ilike`, onde `%` é curinga, e a consulta roda com
  service-role. Um e-mail com `%` casava com qualquer parceiro e o adotava.
- `coins/require-balance.ts`: piso de saldo para as rotas de LLM. A cobrança
  por minuto é emitida pelo NAVEGADOR, então sem ele bastava não chamar
  `/api/coins/charge` para transcrever de graça. Ele recusa quem está zerado;
  ele **não** mede consumo, para isso a contagem teria de sair do cliente, que
  é mudança de produto. A conta de Backoffice passa sempre: `charge_coins` não
  debita o saldo dela, então o número em `profiles` está congelado e não diz
  nada — recusá-la por esse zero trancaria justamente a conta que existe para
  exercitar as rotas caras.

## db/: uma linha, uma leitura

`db/account.ts` lê `profiles` UMA vez por request e serve perfil, saldo, papel
e a marca de Backoffice. `getCurrentProfile`, `getCurrentBalance` e `isCurrentUserAdmin` mantêm
a assinatura de sempre e leem dali. Antes eram três SELECTs na mesma linha,
cada um com o seu próprio `getUser()`.

Se você precisar de um quarto dado de `profiles` no mesmo request, acrescente
a coluna ao SELECT de `account.ts`, não abra uma consulta nova.

`db/admin/metrics.ts` é a ÚNICA implementação das métricas de produto (funil,
ativação, receita, passivo de moedas), e já aceita recorte por período e por
`partnerId`. Não escreva uma segunda consulta de "conversão" dentro das telas
de parceiro: duas definições do mesmo número um dia discordam, e a discordância
aparece como um parceiro reclamando do próprio painel.

## O estudo saiu do produto

Havia aqui uma seção longa sobre `src/features/session/server/study/`: um
pipeline de cinco etapas (perguntar, filtrar, responder, ancorar na NVI,
redigir, selar) que produzia um artigo de três a quatro mil palavras por 50
moedas. **Ele não existe mais**, e a remoção foi total: a API
(`/api/deepening`, `/api/deepening/reprocess`), os prompts, os modelos em
`env/server.ts`, o entitlement `study_generation`, a linha de preço do painel
e a tabela `session_deepenings` (migração 0075).

O que ficou do pipeline, e por quê:

- `features/session/server/biblo/anchor.ts` — a ancoragem de uma referência
  bíblica contra a NVI local. Era o passo 3, e o Biblo o usa pela mesma razão
  que o estudo usava: impedir que o modelo PARAFRASEIE a Escritura.
- Os nomes de rota `study-*` e `deepening*` em
  `features/admin/server/db/usage.ts`, como rotas LEGADAS. `llm_usage_events`
  continua cheio delas, e sem essa lista o custo antigo cairia dentro da linha
  da gravação que o gerou. Ver `LEGACY_ACTION_KEY`.
- Os motivos `deepening` / `reprocess_deepening` em `LEGACY_CHARGE_REASONS`,
  pelo mesmo motivo do lado do ledger.

O diagnóstico e o desenho continuam legíveis em `docs/estudo-v2.md`, como
história: nenhuma linha daquele documento descreve código vivo.

## Entitlements: o que cada plano libera

Dois módulos, e a divisão é a mesma de `billing/plans.ts` × `billing/catalog.ts`:

| Módulo | Papel |
|---|---|
| `entitlements/features.ts` | **client-safe**: o catálogo `feature → plano mínimo` e a aritmética da decisão |
| `entitlements/server.ts` | **server-only**: o estado real do usuário e o gate |
| `db/feature-flags.ts` | **server-only**: kill switch e exceção por pessoa |

**O catálogo mora em CÓDIGO, não no banco.** Mesma razão de `billing/catalog.ts`:
uma linha errada numa tabela não pode virar acesso grátis a funcionalidade
paga. O `/admin/settings` MOSTRA a matriz; não a edita. Mudar qual plano libera
o quê é um commit.

O que o admin edita são as duas coisas que precisam mudar sem deploy, ambas em
`feature_switches` / `feature_overrides` (migração `0032`):

- **kill switch por feature**: desliga para todo mundo num incidente;
- **exceção por pessoa**: libera para um beta tester, revoga de um abusador.

Precedência, implementada em `evaluateFeature` e em nenhum outro lugar:
`kill switch → exceção → Backoffice → plano`. O kill switch vencer a exceção é
deliberado, ele existe para incidente, e incidente não abre exceção para
ninguém.

O terceiro degrau é a **conta de Backoffice** (`profiles.is_internal`, migração
0073): uso interno, alcança qualquer degrau, porque testar a funcionalidade é
o que ela existe para fazer. Ela entra como CONTEXTO, ao lado do kill switch e
do override, e **não** como degrau em `PLAN_ORDER` — não é um plano que alguém
compra, e a escada alimenta o MRR. Ela vem depois da exceção pelo mesmo
raciocínio de sempre: uma revogação escrita à mão para aquela pessoa é uma
decisão que alguém tomou olhando para ela, e um passe-livre que a ignorasse
seria uma quarta regra discutindo com as três. Ver
`src/features/admin/AGENTS.md`.

**Flag e entitlement são coisas diferentes, e um ponto de consulta só.** Flag é
temporária e não olha para quem é o usuário; entitlement é contratual e muda
com a assinatura. Separar as duas em duas abstrações grandes seria pior que o
problema, elas convivem como duas dimensões da mesma pergunta.

Três regras ao usar:

1. **`requireFeature(key)` em toda rota que executa a funcionalidade**, ANTES
   de cobrar moedas e antes de qualquer trabalho caro. É a proteção; o botão
   escondido é só UX.
2. **`canCurrentUserUse(key)` em server component**, e o booleano desce por
   prop até o componente cliente. Não existe store de entitlement no cliente:
   o valor já é conhecido no servidor, e buscá-lo de novo só produziria um
   piscar de botão habilitado→bloqueado.
3. **O plano efetivo NÃO é `subscription.plan`.** Uma assinatura cancelada
   mantém o plano gravado para histórico; ler o campo direto daria acesso
   vitalício a quem cancelou. `getCurrentPlan()` cruza com `isActiveStatus`.

Ler conteúdo já gerado nunca é gated, só gerar. Tirar acesso ao que a pessoa
já pagou seria confisco.

**Hoje há UMA feature no catálogo, `biblo_chat`.** A segunda era
`study_generation`, e ela saiu junto com o estudo: um kill switch e uma
exceção por pessoa para algo que ninguém pode usar são controles que não
governam nada, e girá-los não produz efeito nenhum na tela.

## Finanças: a conta mora fora da tela

`src/features/admin/finance/` é PURO e CLIENT-SAFE, e é a única implementação da aritmética do
`/admin/finance`. Quatro módulos, nenhum deles tocando banco:

| Módulo | Papel |
|---|---|
| `money.ts` | centavos inteiros, conversão de moeda, arredondamento, formatação |
| `recurrence.ts` | equivalente mensal/anual, ocorrências, próxima cobrança |
| `measured.ts` | crédito do ledger → receita em reais; custo de IA por mês |
| `aggregate.ts` | a visão mensal, os compromissos e os indicadores |
| `projection.ts` | o modelo de crescimento × churn dos cenários |

Ser puro é o que torna cada número TESTÁVEL sem banco: `npm test` roda
`node --test` sobre `src/lib/**/*.test.ts` (93 casos hoje). É o único test runner
do repositório e ele existe só por causa desta camada, a regra de "não
adicione testes sem pedido" continua valendo para o resto.

Três invariantes que atravessam os cinco módulos:

- **Dinheiro é inteiro em centavos**, e o arredondamento acontece UMA vez, na
  fronteira. Doze meses de projeção compõem qualquer erro de float justamente
  na ponta longa, que é a que se olha para decidir.
- **Percentual é basis point inteiro**, nunca fração. 7,5% é `750`.
- **Valor em dólar sem cotação é `null`, jamais `0`.** Um zero soma e some do
  total; `null` obriga quem chama a dizer quantos ficaram de fora.

`src/features/admin/server/db/finance.ts` é a camada de banco (service-role, atrás de
`requireAdmin()`) e `finance-overview.ts` monta o snapshot que as seis telas
consomem. Nenhum dos dois calcula nada. Os tipos e schemas Zod são
client-safe, em `src/lib/domain/finance.ts`.

**ARMADILHA DO ZOD 4 que este código pagou:** `.partial()` LANÇA sobre um
objeto com `.refine()`, e lança no IMPORT, o `tsc` passa e o `next build`
quebra na coleta de rotas. Por isso os schemas de escrita vêm em duas metades:
o objeto cru e o refinado. Ver o cabeçalho de `src/lib/domain/finance.ts`.

Contexto de negócio e o desenho completo: `docs/financeiro.md` e
`src/features/admin/AGENTS.md`.

## Validação de entrada

`http/validate.ts`, `parseJsonBody(request, schema)` devolve
`{ ok: true, data }` ou `{ ok: false, response }` com um 400 estruturado
pronto. **Todo endpoint que muta valida com Zod.** Cast e `typeof` na mão são
como payload não confiável entra no prompt (bomba de tokens), no jsonb do
banco, ou no caminho de render do frontend.

## Rate limit

`rate-limit.ts`, janela fixa deslizante, em memória. O estado vive no
processo, então em serverless cada instância tem o seu mapa: o limite efetivo
é `limite × instâncias ativas`. Suficiente para cortar abuso casual e rajada;
se um dia precisarmos de cota global estrita, o caminho é Upstash.

Toda rota nova chama `enforceRateLimit(request, RATE_LIMITS.foo, auth.user.id)`
logo após `requireAuth()`. O bucket vai em `RATE_LIMITS` com limite por
usuário E por IP, dimensionado pela cadência real do cliente. Os buckets
existentes trazem o raciocínio em comentário, escreva o seu junto.

## Logging

Um logger, três saídas. `createLogger(escopo)` no topo do arquivo; nunca
`console.*`.

```ts
import { createLogger } from "@/lib/log";
const log = createLogger("bible");

log.info("topup", { sessionId, credited });   // aparece em produção
log.debug("ok", { latencyMs, promptTokens }); // some em produção
log.warn("schema-drop", drop);
log.error("upstream falhou", err);            // aceita Error direto
```

- **A mensagem é constante; o que varia vira contexto.** `log.info("saved",
  { sessionId })`, nunca `log.info(\`saved ${sessionId}\`)`. É o que permite ao
  reporter alinhar coluna, ao navegador dar um objeto expandível, e a uma
  busca no painel achar todas as ocorrências do mesmo evento.
- **O nível decide o que EXISTE em produção**, e é a única escolha que quem
  chama precisa fazer. `info` = rastro que se vai querer numa auditoria
  (dinheiro, mutação de admin, atribuição de parceiro). `debug` = rastro de
  execução (o `ok` das rotas de LLM) e não sai em produção. `warn`/`error`
  sempre saem. O `ok` das rotas de LLM é `debug` de propósito: os tokens que ele
  mostra já ficam no banco por `recordChatUsage`.
- **Os reporters são escolhidos por ambiente, não por chamada**
  (`log/index.ts`): `fancy` do consola no terminal; pastilha CSS com cor
  derivada do escopo no navegador, com o contexto entregue como OBJETO vivo; e
  uma linha plana, alinhada e sem cor em produção. A troca é o campo `exports`
  do pacote `consola`, nenhum código de terminal chega ao bundle do cliente.
- **Em produção é UMA linha por evento**, e isso é requisito, não estética: o
  coletor da Vercel trata cada linha de stdout como um registro separado, então
  quebrar o contexto numa segunda linha o deixa órfão.
- **No navegador em produção o nível padrão é `warn`.** O console de quem usa o
  app não é o nosso painel. A escotilha para depurar com um usuário real sem
  deploy: `localStorage.setItem("scriba:log", "debug")`.
- **A redação de segredos (`log/format.ts`) compara por PALAVRA, não por
  substring.** `apiKey` e `accessToken` são redigidos; `promptTokens`,
  `completionTokens` e `idempotencyKey` não. Um `/token/` guloso apagaria em
  silêncio justamente os números que o log das rotas de LLM existe para
  mostrar.
- `log.child({ sessionId })` gruda contexto; `log.scoped("audit")` abre
  sub-escopo (`resumo/audit`); `log.time()` devolve o fechador que loga
  `durationMs`; `log.table()` é no-op em produção.

## Bíblia

`src/lib/bibles/` é **server-only**: a tradução em si. `loader.ts` lê a NVI do disco
na primeira chamada e a mantém em memória pelo tempo do processo (~4 MB de
JSON), deduplicando chamadas concorrentes. `BIBLE_TRANSLATION` existe para o
número sair de um lugar só, **não** para sugerir que trocá-la basta: o arquivo
precisa estar em `src/lib/bibles/`, e hoje só a NVI está. As outras dez foram
removidas — 41 MB no bundle de deploy que nenhum caminho de código lia. Se um
seletor de tradução voltar, o cache precisa virar LRU antes.

Quem entende uma REFERÊNCIA ("João 3:16", "Romanos 8") é
`src/lib/domain/reference.ts`, client-safe: a tela do resumo usa para transformar
uma referência escrita no meio de um parágrafo num link, e o servidor usa o
mesmo parser em `/api/verse`, no ancoramento das referências do Biblo e na
busca por versículo. Um segundo parser em qualquer uma dessas pontas faria a tela e o
banco discordarem sobre o que "Romanos 8" significa.

## Transcrição: qualidade

Tudo desta seção foi MEDIDO contra um sermão real gravado num salão com eco,
com transcrição de referência feita à mão. Os números, as tabelas e o que foi
tentado e não funcionou estão em **[`docs/transcricao.md`](../docs/transcricao.md)**.
Leia antes de mexer em qualquer coisa aqui, as três intuições mais naturais
(limpar o áudio, guiar o vocabulário, revisar o texto com um LLM) estão todas
medidas, e as três pioram ou empatam.

`transcription/sanitize.ts` reconhece três assinaturas de alucinação vistas em
sessões reais: eco do prompt-guia, eco da lista de vocabulário e loop de
repetição (agravado pelo `prevText`, que realimenta o loop na parte seguinte).
Qualquer assinatura marca a parte como `suspect`: o texto limpo ainda vale para
a transcrição, mas ela não volta como contexto na emenda.

`transcription/quality.ts` cruza três fontes, assinatura determinística,
confiança do modelo (média de logprobs) e densidade de texto por segundo de
áudio. As três pegam falhas diferentes: fluência alucinada confiante,
decodificação incerta, e áudio de ruído/música que rende fragmentos esparsos e
confiantes. `poor` = qualquer uma acusou.

**`poor` não troca de modelo.** Já trocou: áudio ruim era reenviado ao
`gpt-4o-transcribe`. Com `gpt-transcribe` no primeiro degrau, esse reenvio
dobra o custo para entregar um texto pior em todos os cenários medidos, então a
escalada foi removida, não existe degrau acima. Hoje `poor` faz duas coisas:
exclui a parte do `prevText` da emenda seguinte.

**`LOW_CONFIDENCE_AVG_LOGPROB` é calibrado por MODELO.** Trocar
`OPENAI_TRANSCRIBE_MODEL` sem refazer a tabela de `docs/transcricao.md` §3
desliga o aviso em silêncio: o valor herdado do `gpt-4o-mini-transcribe` (-0,6)
nunca disparava com o modelo novo, nem em áudio com 27% de WER.

## Outros

- `app-version.ts`: **client-safe**. `APP_VERSION` sai do `package.json` pelo
  `env` do `next.config.ts`, e é o mesmo número que carimba
  `llm_usage_events.app_version` e rotula o filtro do `/admin/costs`. Ele **não**
  está no schema Zod de `env/client.ts` de propósito: aquele schema valida o que
  uma PESSOA configura, e declarar esta ali convidaria alguém a criar a variável
  à mão, dois números de versão que um dia discordam. `compareVersions` existe
  porque "0.10.0" ordena antes de "0.9.0" como texto, em silêncio, justo na
  tabela que existe para dizer o que veio antes. O número só é um corte útil se
  SUBIR a cada entrega: ver `npm run release` e `docs/versionamento.md`.

  **Ele já teve um gêmeo, e o gêmeo mentia.** `lib/version.ts` exportava o mesmo
  `APP_VERSION` lendo `package.json` direto, e o cabeçalho dele afirmava que
  "não existe variável de ambiente para isto" — o oposto do que está escrito
  aqui. O rodapé da landing usava aquele, tudo o mais usava este. Dois números
  de versão que ainda não tinham discordado.
- `deploy.ts`: `IS_PRODUCTION_DEPLOY` (`VERCEL_ENV === "production"`). É a
  chave de GA4 e de indexação. Ler `process.env` não torna a rota dinâmica.
- `seo.ts`: fonte única de domínio, título e descrição. Ver `src/app/AGENTS.md`.
- `domain/mark.ts`: **client-safe**, a sintaxe do MARCA-TEXTO (`==assim==`) e o
  toggle dela. Ela é sintaxe dentro da string, e não formatação no schema,
  porque a invariante que sustenta o editor é que todo bloco é `{ type, text }`,
  string pura — ver `domain/summary.ts` e `src/app/AGENTS.md`. A leitura
  (`RichText`) e o editor (`Composer`) leem daqui; uma segunda regex em qualquer
  uma das duas pontas faria a tela e o salvamento discordarem sobre o que é uma
  marca. **E a edição não MOSTRA as cercas**: `applyDisplayEdit`,
  `displayToRaw` e `toggleMarkOnDisplay` traduzem entre o texto cru (com elas) e
  o texto visível (sem), porque uma `textarea` não sabe esconder parte do
  próprio conteúdo. A tradução é da tela, não do dado — ver "O TEXTO CRU E O
  TEXTO VISÍVEL" no arquivo.
- `idb-storage.ts`: **client-safe**. Um `AsyncStorage` de três métodos sobre o
  IndexedDB, para o persistidor do TanStack Query (`shared/components/Providers.tsx`).
  Não é `localStorage` porque aquele é SÍNCRONO: serializar o cache na thread
  principal a cada mudança travaria o toque seguinte, no app que se está
  tentando deixar instantâneo. Armazenamento bloqueado devolve `null` e engole
  a escrita — app sem cache persistido, nunca quebrado.
- `fx/usd-brl.ts`: câmbio USD→BRL, cacheado 1h, em quatro degraus:
  AwesomeAPI → Frankfurter (BCE) → valor manual num cookie do admin → **a
  última cotação guardada em `usd_brl_rates`** (migração 0049, escrita por
  `db/fx-rates.ts` a cada leitura viva). O último degrau existe porque o painel
  passou dias com TODO campo em real em branco: o câmbio multiplica cada um
  deles, as duas fontes que havia (upstream + cookie) falharam juntas, e
  "dólar sem cotação é null, jamais 0" fez o resto, sem erro nenhum na tela.
  Depois da primeira leitura guardada, o pior caso é o câmbio de ontem, e a
  tela DIZ que é. O custo por moeda é sempre MEDIDO, nunca constante.
- `coins/billable.ts` + `coins/economics.ts`, o que é uma AÇÃO cobrável e a
  conta de margem por milheiro de moeda, os dois client-safe. `pricing.ts` diz
  quanto custa em moedas; `billable.ts` diz o que é uma coisa (os quatro
  motivos por minuto que já existiram são uma linha só). Alimentam
  `/admin/costs`, ver `src/features/admin/AGENTS.md`.
- `admin/insights/`: server-only, a leitura que um modelo faz dos números do
  painel inteiro, na visão geral (`/admin`). UMA leitura, gerada só no clique; já
  foram três, uma por tela de dinheiro, e cada uma se disparava sozinha. O
  porquê está em `src/features/admin/AGENTS.md`. `briefing.ts` monta os números
  (sem calcular nada: tudo vem de `db/admin/*` e `coins/economics.ts`),
  `generate.ts` chama o modelo e `store.ts` grava a única linha de
  `admin_insights`. O tipo e o parser são client-safe, em
  `domain/admin-insights.ts`.
- `db/coupons.ts` + `domain/coupon.ts`: os cupons de convite (`/c/<codigo>`,
  migração 0055). O segundo é client-safe (formato do código, limites e o
  caminho do link, lidos pelo formulário do painel); o primeiro é service-role e
  só traduz o resultado de `redeem_signup_coupon`, onde a regra inteira mora.
  Ver `src/features/admin/AGENTS.md`.
- `db/lexicon.ts` + `domain/lexicon.ts`: o léxico das MENÇÕES, os nomes que o
  resumo marca e o cartão de cada um (migração 0063). O segundo é client-safe e
  guarda só o vocabulário — ele já foi o léxico INTEIRO, um array de ~330 strings
  compilado no bundle, e hoje as strings são cadastro editado em
  `/admin/lexicon`. O primeiro tem uma assimetria deliberada: as leituras
  PÚBLICAS passam pelo client do usuário, porque a policy já diz
  `using (published)` e service-role ali trocaria uma garantia do banco por um
  `.eq()` que alguém esquece de escrever na próxima consulta; a escrita é
  service-role, porque não há policy de escrita nenhuma. `getLexiconIndex` é
  cacheado em memória por um minuto, e o PRAZO é o que substitui a invalidação:
  em serverless a instância que atende o admin não é a que atende o leitor, e um
  `revalidate` limparia um mapa que as outras não têm.
- `coins/settings.ts`: server-only, lê do cookie o valor de venda da moeda e a
  margem alvo que o admin girou. É régua de SIMULAÇÃO: não cobra, não credita e
  não pode virar tabela. Escrita por `coins/settings-actions.ts`, com
  `assertAdmin()` dentro de cada action.
- `domain/documento.ts`: CPF/CNPJ com máscara e dígito verificador, client-safe,
  validado nas DUAS pontas. O banco guarda só os dígitos: gravada,
  "123.456.789-09" e "12345678909" viram duas pessoas na hora de conferir um
  pagamento.
