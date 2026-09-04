# lib/ — a camada de servidor

Quase tudo aqui é `server-only`. As exceções client-safe estão marcadas
abaixo, e a distinção não é estilística: importar um módulo `server-only` a
partir de um `"use client"` é erro de BUILD, e é assim que tem de ser.

Cobranças, moedas e Stripe têm documento próprio: `lib/billing/AGENTS.md`.

## Fronteira servidor/cliente

`import "server-only"` no topo é obrigatório em todo módulo que toca segredo,
service-role, `serverEnv` ou o client do Supabase de servidor. Sem ele, um
import distraído a partir de um componente cliente COMPILA: o Next não inlina
env sem `NEXT_PUBLIC_` no bundle do navegador, então o `safeParse` do
`lib/env/server.ts` falhava em runtime, no cliente, derrubando o componente e
imprimindo no console os NOMES de todas as variáveis que faltaram. Com o
guard, o mesmo import vira erro na máquina de quem escreveu.

**Corolário:** número que a TELA lê mora em módulo client-safe. Uma constante
puxada de um módulo `server-only` para um componente cliente arrasta o
Supabase com service-role para o bundle e o build recusa — corretamente. Já
aconteceu com `DEFAULT_PARTNER_MONTHLY_COINS`, que teve de mudar de
`partners/allowance.ts` para `partners/economics.ts`.

Client-safe de propósito: `coins/pricing.ts`, `coins/billable.ts`,
`coins/economics.ts`, `billing/plans.ts`, `entitlements/features.ts`,
`partners/economics.ts`, `br/documento.ts`,
`domain/*` (tipos e schemas), `bible/detect.ts`, `bible/guard.ts`,
`deploy.ts`, `seo.ts`, `utils.ts`, `vocabulario.ts`, `chunk-store.ts`
(IndexedDB, só roda no browser).

## Env — estrito de propósito

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
  chamada aparecer no Logs da OpenAI com as mesmas etiquetas do nosso painel —
  é o que permite conciliar `llm_usage_events` com a fatura. (A OpenAI retém
  prompt e resposta por 30 dias do lado dela.)
- **`recordChatUsage` / `recordAudioUsage` (`db/usage.ts`) alimentam
  `/admin/usage`.** São fire-and-forget: a rota aguarda, mas qualquer falha de
  insert é capturada e logada — observabilidade quebrada nunca vira 500 numa
  rota que funcionou. O preço por token está em `llm/pricing.ts`.

## Supabase — três clients, três autoridades

| Módulo | Chave | Quem pode usar |
|---|---|---|
| `supabase/client.ts` | anon | browser |
| `supabase/server.ts` | anon + cookie | server components, rotas, actions |
| `supabase/admin.ts` | **service-role** | só depois de ter afirmado admin |

`createAdminClient()` BYPASSA a RLS. Ele nunca vai ao navegador e nunca serve
request que não passou por `requireAdmin()`. Trocar um client do usuário por
ele numa mutação existente transforma a rota num IDOR sem sinal nenhum no
diff.

**Memoização por request.** `createClient` e `getAuthUser` são embrulhados em
`cache()` do React, cujo escopo é UM render pass — layout, page e
`generateMetadata` do mesmo request dividem o resultado; requests diferentes
nunca. Isso é o oposto de cache persistente: nada sobrevive à resposta.

O motivo: `supabase.auth.getUser()` NÃO é decode local do JWT — é um
`GET /auth/v1/user` na rede, toda vez (é por validar no servidor de auth que
ele é preferível a `getSession()`). Sem memoização, um load de `/feed` fazia
OITO dessas idas. Hoje faz duas.

**Prefira `getAuthUser()` a `(await createClient()).auth.getUser()`.** É a
mesma coisa, cobrada uma vez por request em vez de uma por chamador.

`cache()` não vale em Route Handler nem em Server Action — eles ficam fora da
árvore de render. Lá o comportamento é o de antes: uma chamada, uma ida à
rede. Nada quebra, só não há o que deduplicar.

**Leituras de sessão têm duas larguras.** `getSession` traz `transcript`,
`feed_items` e `final_summary`; `getSessionMeta` não. As quatro páginas que
nunca renderizam transcrição (live, audio, transcribe, deepening) usam a
segunda — abrir um gravador vazio não deve trazer o sermão inteiro. Ambas são
memoizadas porque `generateMetadata` e o corpo da página chamavam as duas, e o
Next só deduplica `fetch()`, não consulta do Supabase.

## Auth e autorização

- `supabase/require-auth.ts` — `requireAuth()` para rota de API: 401 se não há
  sessão.
- `auth/require-admin.ts` — três formas, e a escolha importa:
  - `requireAdmin()` em Route Handler. Responde **404, não 403**: não
    confirmamos a existência da área administrativa a quem não deveria vê-la.
    Faz consulta própria de propósito — é o caminho que protege dinheiro e não
    divide estado com nada.
  - `isCurrentUserAdmin()` em server component. Lê da consulta memoizada.
  - `assertAdmin()` em **Server Action**. Obrigatório: uma action é um POST
    próprio, e o gate do layout não a protege.
- `auth/require-partner.ts` — gate do `/partners`, vínculo parceiro↔conta na
  primeira visita, e o ponto onde a mesada mensal é conferida.

## db/ — uma linha, uma leitura

`db/account.ts` lê `profiles` UMA vez por request e serve perfil, saldo e
papel. `getCurrentProfile`, `getCurrentBalance` e `isCurrentUserAdmin` mantêm
a assinatura de sempre e leem dali. Antes eram três SELECTs na mesma linha,
cada um com o seu próprio `getUser()`.

Se você precisar de um quarto dado de `profiles` no mesmo request, acrescente
a coluna ao SELECT de `account.ts` — não abra uma consulta nova.

`db/admin/metrics.ts` é a ÚNICA implementação das métricas de produto (funil,
ativação, receita, passivo de moedas), e já aceita recorte por período e por
`partnerId`. Não escreva uma segunda consulta de "conversão" dentro das telas
de parceiro: duas definições do mesmo número um dia discordam, e a discordância
aparece como um parceiro reclamando do próprio painel.

## O estudo é um pipeline, não uma chamada

A definição de produto que governa `lib/study/`:

```
resumo  responde  →  o que foi ensinado nesta pregação?
estudo  responde  →  agora que entendi o tema, o que preciso aprender sobre ele?
```

Cinco etapas, três de LLM e **duas determinísticas**:

```
[1]  lib/prompts/study-questions.ts  LLM   interroga o sermão: 25-30 perguntas
[1b] lib/prompts/study-guard.ts      mini  corta a que o resumo já responde
[2]  lib/prompts/study-answers.ts    LLM   ESCOLHE as 10-14 que rendem e responde
[3]  lib/study/anchor.ts             ---   resolve as referências citadas na NVI
[4]  lib/prompts/study-write.ts      LLM   vira um artigo corrido
[4b] lib/prompts/study-guard.ts      mini  tese repetiu o resumo? reescreve 1x
[5]  lib/study/seal.ts               ---   versículo da NVI; fonte sem obra cai
```

Orquestrador: `lib/study/generate.ts`. Chamado por `/api/deepening` e
`/api/deepening/reprocess`.

**A representação intermediária é PERGUNTA, não taxonomia.** A versão anterior
pedia um plano de eixos com disciplinas ("exegese", "teologia sistemática") e
não funcionou: taxonomia é formulário, preenchível por qualquer modelo, e não
diz nada sobre a qualidade do que virá. Uma pergunta é autovalidável — dá para
ler "Graça é libertinagem?" e saber que rende.

Regra que decorre disso, e que decide onde investir prompt:

> **A qualidade do estudo é a qualidade das perguntas.** Estudo ruim: olhe o
> questionador primeiro.

Quatro decisões que parecem detalhe e não são:

- **O questionador não seleciona.** Gera 25-30 e entrega todas. Pedir poucas
  produz as óbvias — as boas aparecem depois da décima. A seleção é do passo 2,
  porque quem melhor julga se uma pergunta vale é quem vai ter de respondê-la.
- **As respostas saem numa chamada só**, com todas as perguntas à vista. Uma
  chamada por pergunta faz dez respostas reestabelecerem a mesma definição.
- **Divergência entre tradições é conteúdo, não risco.** Onde protestantes
  concordam, o texto AFIRMA; onde divergem, nomeia os lados. A leitura ingênua
  ("não ofenda ninguém") produz "alguns entendem X, outros Y" — o genérico que
  a reforma existe para matar. Vive no campo `tension` de cada resposta.
- **O sermão sai do pipeline depois do passo 1.** Só o questionador vê a
  transcrição e o resumo; respondedor e redator recebem um ASSUNTO e as
  perguntas. Entregar o resumo "para não repetir" a um modelo que vai escrever
  é priming, não proteção — era assim que a expressão cunhada pelo pregador
  virava título de seção do estudo.
- **Ninguém escreve citação entre aspas.** Não temos o texto das obras, e uma
  frase entre aspas que o autor não escreveu é invenção com aparência de prova.
  Os autores entram por atribuição em prosa (nomeando a obra) e por blocos
  `reading`. O tipo `quote` continua existindo para os payloads antigos.
- **O redator tem licença para reordenar, fundir, descartar e desdobrar.** Sem
  ela, ele tira os pontos de interrogação e entrega um FAQ disfarçado. Teste:
  se o artigo tem tantas seções quanto respostas, ele não fez o trabalho.

**Não há cota de nada** — nem de citação, nem de versículo, nem de seção. As
cotas mínimas do prompt antigo eram a maior fonte de invenção do sistema: cota
é concreta, "não invente" é vago, e cota vence. O comprimento vem do número de
perguntas boas respondidas, nunca de uma instrução para escrever longo.

**Não há passo de auditoria de conteúdo**, e é deliberado: o artigo fala do
ASSUNTO, não do que o pregador disse, e o que um auditor pegaria — citação sem
origem, versículo parafraseado — a selagem pega melhor, porque é código.

**O guardião é a única verificação que sobrou, e ele faz uma pergunta só:
"isto repete o resumo?"** Roda duas vezes num modelo barato a temperatura zero.
O corte [1b] mata na fonte (pergunta que o resumo já responde produz,
necessariamente, parágrafo que repete o resumo); o corte [4b] pega o que o
primeiro não alcança — o redator colapsando o artigo de volta na tese do
sermão na hora de amarrar tudo, que foi a falha observada em produção.

Três invariantes do guardião, todas contra o mesmo risco de trocar um problema
de qualidade por um de disponibilidade:

- **Falha do guardião nunca derruba a geração.** Sem o filtro o estudo ainda
  sai, só com mais risco de repetir.
- **Se sobrarem menos de seis perguntas, seguimos com todas.** Corte excessivo
  é sinal de questionador preguiçoso; responder duas sobras dá estudo
  raquítico, e vazio é pior que repetido.
- **[4b] dispara UMA reescrita, nunca duas.** Se a segunda também repetir, o
  estudo é entregue: o usuário já pagou as moedas, e 502 depois de cobrar é
  pior que um texto imperfeito. Fica o `warn` e o registro em
  `StudyRecord.guard`.

As perguntas são **persistidas** (`session_deepenings.plan`, migração 0033 — a
coluna nasceu guardando um plano de eixos e hoje guarda um `StudyRecord`) e
lidas em `/admin/studies`. É o que separa "as perguntas eram rasas" de "eram
boas e foram mal respondidas", que são consertos em modelos diferentes.

Quatro env vars (`OPENAI_STUDY_QUESTIONS_MODEL`, `_ANSWERS_`, `_WRITE_`,
`_GUARD_`) e quatro rotas em `llm_usage_events`, para dar para trocar uma etapa
de modelo e medir o efeito isoladamente.

**Nenhum default é `gpt-4o`, e isso foi MEDIDO.** Com 4o, os mesmos prompts
produziam respostas de 186 palavras (o prompt pedia 350-500) e um artigo de 723
a 1.330 palavras a partir de 2 mil palavras de material. Três rodadas de ajuste
de prompt não furaram esse teto; a troca de modelo levou o artigo a 4 mil
palavras na primeira tentativa. Antes de reescrever prompt de novo, pergunte se
o teto não é do modelo.

**Mas só o RESPONDEDOR é `gpt-5.1`; questionador e redator rodam em
`gpt-5-mini`.** Com os três no modelo caro o estudo fechava a −16% de margem, e
a medição mostrou que token de saída é 85% da conta. O respondedor é a única
etapa que carrega obra, controvérsia, data e referência bíblica — é onde uma
invenção vira erro do produto. O questionador levanta um andaime que é
descartado em dois terços por desenho, e o redator recebe a substância já
fixada, as passagens já conferidas contra a NVI e os autores já filtrados. **O
modelo caro fica só onde moram os fatos** — e é essa a justificativa retroativa
de o pipeline ser separado em etapas. Números e a proibição de fundir [2] com
[4] em `docs/estudo-v2.md` §4.

Isso trouxe uma consequência para o `callChat`: a família de raciocínio recusa
`max_tokens` (é `max_completion_tokens`) e só aceita a `temperature` padrão.
`lib/llm/openai.ts` detecta por prefixo e troca os parâmetros; quem regula a
etapa ali é `reasoningEffort`. Um `gpt-4o` configurado de volta continua
recebendo a temperatura de sempre.

**O orçamento de tempo é apertado.** O pipeline mede ~255s, as rotas declaram
`maxDuration = 300`, e as chamadas [2] e [4] passam `timeoutMs` de 240s. É esse
teto que explica o esforço baixo no redator e o prazo da reescrita do guardião
(`REWRITE_DEADLINE_MS`): estourar a função depois de já ter debitado moedas é
um estrago maior que entregar um texto imperfeito.

**A capa do bloco `reading` não vem do modelo.** `lib/study/covers.ts` resolve
contra a Google Books API e confere autor+título antes de deixar a URL entrar
no payload — o parser de `domain/study.ts` DESCARTA um `coverUrl` que venha do
LLM, de propósito. Sem `GOOGLE_BOOKS_API_KEY` (opcional) nada é chamado e a UI
desenha uma capa tipográfica, que é o caso normal, não um fallback degradado.
Medido: sem chave o Google responde 429 sempre, e a Open Library em busca livre
devolve a capa de outro livro do mesmo autor.

Para medir qualquer uma dessas coisas de novo, o harness é
`tmp/dev-scripts/study-eval.mts` (roda o pipeline de verdade sobre uma sessão
real e imprime perguntas, vereditos e o artigo) e `guard-eval.mts` (compara
modelos só no filtro). Os dois vivem em `tmp/`, que é gitignored.

**As chamadas [2] e [4] passam `timeoutMs` explícito de 180s.** O padrão de
`callChat` é 60s, e essas duas são grandes — um timeout ali abortaria trabalho
que o usuário já pagou em moedas.

Diagnóstico e desenho completos: `docs/estudo-v2.md`.

## Entitlements — o que cada plano libera

Dois módulos, e a divisão é a mesma de `billing/plans.ts` × `billing/catalog.ts`:

| Módulo | Papel |
|---|---|
| `entitlements/features.ts` | **client-safe**: o catálogo `feature → plano mínimo` e a aritmética da decisão |
| `entitlements/server.ts` | **server-only**: o estado real do usuário e o gate |
| `db/feature-flags.ts` | **server-only**: kill switch e exceção por pessoa |

**O catálogo mora em CÓDIGO, não no banco.** Mesma razão de `billing/catalog.ts`:
uma linha errada numa tabela não pode virar acesso grátis a funcionalidade
paga. O `/admin/features` MOSTRA a matriz; não a edita. Mudar qual plano libera
o quê é um commit.

O que o admin edita são as duas coisas que precisam mudar sem deploy, ambas em
`feature_switches` / `feature_overrides` (migração `0032`):

- **kill switch por feature** — desliga para todo mundo num incidente;
- **exceção por pessoa** — libera para um beta tester, revoga de um abusador.

Precedência, implementada em `evaluateFeature` e em nenhum outro lugar:
`kill switch → exceção → plano`. O kill switch vencer a exceção é deliberado —
ele existe para incidente, e incidente não abre exceção para ninguém.

**Flag e entitlement são coisas diferentes, e um ponto de consulta só.** Flag é
temporária e não olha para quem é o usuário; entitlement é contratual e muda
com a assinatura. Separar as duas em duas abstrações grandes seria pior que o
problema — elas convivem como duas dimensões da mesma pergunta.

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

Ler conteúdo já gerado nunca é gated — só gerar. Tirar acesso ao que a pessoa
já pagou seria confisco.

Diagnóstico e desenho completos: `docs/estudo-v2.md` §8.

## Validação de entrada

`http/validate.ts` — `parseJsonBody(request, schema)` devolve
`{ ok: true, data }` ou `{ ok: false, response }` com um 400 estruturado
pronto. **Todo endpoint que muta valida com Zod.** Cast e `typeof` na mão são
como payload não confiável entra no prompt (bomba de tokens), no jsonb do
banco, ou no caminho de render do frontend.

## Rate limit

`rate-limit.ts` — janela fixa deslizante, em memória. O estado vive no
processo, então em serverless cada instância tem o seu mapa: o limite efetivo
é `limite × instâncias ativas`. Suficiente para cortar abuso casual e rajada;
se um dia precisarmos de cota global estrita, o caminho é Upstash.

Toda rota nova chama `enforceRateLimit(request, RATE_LIMITS.foo, auth.user.id)`
logo após `requireAuth()`. O bucket vai em `RATE_LIMITS` com limite por
usuário E por IP, dimensionado pela cadência real do cliente. Os buckets
existentes trazem o raciocínio em comentário — escreva o seu junto.

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
  execução (pipelines ao vivo, fila de chunks, o `ok` das rotas de LLM) e não
  sai em produção. `warn`/`error` sempre saem. O `ok` das rotas de LLM é
  `debug` de propósito: dispara a cada chunk por usuário ativo, e os tokens
  que ele mostra já ficam no banco por `recordChatUsage`.
- **Os reporters são escolhidos por ambiente, não por chamada**
  (`log/index.ts`): `fancy` do consola no terminal; pastilha CSS com cor
  derivada do escopo no navegador, com o contexto entregue como OBJETO vivo; e
  uma linha plana, alinhada e sem cor em produção. A troca é o campo `exports`
  do pacote `consola` — nenhum código de terminal chega ao bundle do cliente.
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
  sub-escopo (`deepening/audit`); `log.time()` devolve o fechador que loga
  `durationMs`; `log.table()` é no-op em produção.

## Bíblia

Dois módulos com nomes parecidos e papéis distintos:

- `bible/detect.ts` + `bible/guard.ts` — **client-safe**, são o gate de duas
  camadas do pipeline ao vivo. Explicados em `src/features/session/AGENTS.md`.
- `bibles/` — **server-only**, a tradução em si. `loader.ts` lê a NVI do disco
  na primeira chamada e a mantém em memória pelo tempo do processo (~4 MB de
  JSON), deduplicando chamadas concorrentes. `BIBLE_TRANSLATION` existe para o
  número sair de um lugar só, **não** para sugerir que trocá-la basta: o
  arquivo precisa estar em `lib/bibles/`, e hoje só a NVI está. As outras dez
  foram removidas — 41 MB no bundle de deploy que nenhum caminho de código
  lia. Se um seletor de tradução voltar, o cache precisa virar LRU antes.

## Transcrição — qualidade e escalada

`transcription/sanitize.ts` reconhece três assinaturas de alucinação vistas em
sessões reais: eco do prompt-guia, eco da lista de vocabulário e loop de
repetição (agravado pelo `prevText`, que realimenta o loop no chunk seguinte).
Qualquer assinatura marca o chunk como `suspect`: o texto limpo ainda vale
para a transcrição, mas o chunk não volta como contexto nem alimenta os
pipelines.

`transcription/quality.ts` cruza três fontes — assinatura determinística,
confiança do modelo (média de logprobs) e densidade de texto por segundo de
áudio. As três pegam falhas diferentes: fluência alucinada confiante,
decodificação incerta, e áudio de ruído/música que rende fragmentos esparsos e
confiantes. `poor` = qualquer uma acusou, e é o sinal que dispara a escalada de
modelo no servidor.

## Outros

- `deploy.ts` — `IS_PRODUCTION_DEPLOY` (`VERCEL_ENV === "production"`). É a
  chave de GA4 e de indexação. Ler `process.env` não torna a rota dinâmica.
- `seo.ts` — fonte única de domínio, título e descrição. Ver `app/AGENTS.md`.
- `fx/usd-brl.ts` — câmbio USD→BRL da AwesomeAPI, cacheado 1h. Quando o
  upstream falha, cai num valor que o admin digitou e ficou num cookie
  server-readable. O custo por moeda é sempre MEDIDO, nunca constante.
- `coins/billable.ts` + `coins/economics.ts` — o que é uma AÇÃO cobrável e a
  conta de margem por milheiro de moeda, os dois client-safe. `pricing.ts` diz
  quanto custa em moedas; `billable.ts` diz o que é uma coisa (gerar e
  reprocessar estudo são dois motivos no ledger e um produto só). Alimentam
  `/admin/precificacao` — ver `src/features/admin/AGENTS.md`.
- `admin/insights/` — server-only, a leitura de um modelo sobre os números de
  `/admin/precificacao`, `/admin/usage` e `/admin/metricas`. `briefing.ts`
  monta os números (sem calcular nada: tudo vem de `db/admin/*` e
  `coins/economics.ts`), `generate.ts` chama o modelo e `store.ts` grava a
  linha em `admin_insights`. O tipo e o parser são client-safe, em
  `domain/admin-insights.ts`. Ver `src/features/admin/AGENTS.md`.
- `coins/settings.ts` — server-only, lê do cookie o valor de venda da moeda e a
  margem alvo que o admin girou. É régua de SIMULAÇÃO: não cobra, não credita e
  não pode virar tabela. Escrita por `coins/settings-actions.ts`, com
  `assertAdmin()` dentro de cada action.
- `chunk-store.ts` — IndexedDB dos chunks de áudio à espera de upload. Degrada
  em silêncio onde IndexedDB não existe. Ver `src/features/session/AGENTS.md`.
- `br/documento.ts` — CPF/CNPJ com máscara e dígito verificador, client-safe,
  validado nas DUAS pontas. O banco guarda só os dígitos: gravada,
  "123.456.789-09" e "12345678909" viram duas pessoas na hora de conferir um
  pagamento.
