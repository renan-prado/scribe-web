# Biblo: o documento de implementação

> **Status: IMPLEMENTADO**, os treze passos da §12 — migração 0062,
> `/api/biblo`, a gaveta nas duas telas e o saldo do assinante
> ([`creditos-na-tela.md`](./creditos-na-tela.md)), que subiu junto como a §1.2
> exige. O [`biblo.md`](./biblo.md) diz
> **o que** o Biblo é e **por que** ele existe; este arquivo diz **como** ele é
> construído — as decisões que estavam em aberto lá, agora fechadas com número,
> e a ordem em que o código nasce. Quando ele existir, os dois arquivos
> continuam: o de lá vira a descrição do produto, este vira a descrição do
> mecanismo.

O escopo é **a feature inteira numa entrega só**, como o `biblo.md` a descreve:
gaveta, conversa persistida, chips derivados, inserção de bloco no resumo com
desfazer, nas duas telas (`/summary/:id` e `/escrever/:id`).

---

## 1. As três decisões que estavam travando

O `biblo.md` §9 diz: *"nada começa a ser construído antes disto"*. Está decidido.

### 1.1 O Biblo é dos planos pagos, e a conta gratuita ganha um presente

**Entitlement novo, `biblo_chat`, com `minPlan: "pessoal"`** — o mesmo degrau do
estudo, pela mesma razão que está escrita em `lib/entitlements/features.ts`:
prender a única coisa boa no plano de cima deixa o Pessoal sem nada que o
Gratuito não tenha.

**E a conta gratuita ganha 10 mensagens, uma vez, de presente.** Não é um teste
que expira nem um saldo que se acusa: é um presente, e o texto na tela diz isso
com essas palavras. Quando ele acaba, ninguém é cobrado de nada — o Biblo
agradece e conta onde ele continua morando.

**Uma vez por CONTA, nunca por sessão**, e a diferença é a feature inteira: uma
sessão nova é de graça (`/escrever` não cobra nada), então dez mensagens por
sessão são infinitas mensagens com um passo a mais. Um presente tem fim, ou não
é presente, é um preço mal cobrado. A conta do que ele custa: dez mensagens são
~R$ 0,10 uma vez na vida da conta, contra os R$ 1,00 de valor que
`INITIAL_COIN_BALANCE` já dá de graça no cadastro — é um arredondamento numa
exposição que já existe, e paga a única chance de alguém descobrir por que
valeria assinar.

A diferença entre as duas frases não é cosmética:

| ❌ o que não escrevemos | ✅ o que escrevemos |
|---|---|
| "Você usou 10 de 10 mensagens gratuitas." | "Espero ter ajudado nestas primeiras conversas." |
| "Assine para continuar usando." | "O Biblo continua com você nos planos Pessoal e Estudioso." |
| um contador visível durante a conversa | nada na tela enquanto o presente corre |

**Nada de contador enquanto o presente está correndo.** Um número descendo no
canto é a coisa mais rápida de transformar "estou pensando sobre Jonas" em
"estou gastando". O aviso aparece UMA vez, na última mensagem do presente, e é
uma linha gentil — não um diálogo, não um bloqueio.

### 1.2 O preço: duas moedas por mensagem, cobradas em silêncio

**Duas moedas por mensagem.** Não há bloco, não há pacote, não há parede no meio
da conversa. Vale para quem tem plano pago; a conta gratuita não gasta moeda
nenhuma — ela tem o presente, e depois o convite.

```ts
// features/coins/pricing.ts
bibloMessage: 2,                          // COIN_COSTS
export const BIBLO_GIFT_MESSAGES = 10;    // o presente, uma vez por CONTA

// features/session/server/biblo/answer.ts — as duas amarras da margem
export const BIBLO_ANSWER_MAX_TOKENS = 400;
export const BIBLO_SUMMARY_TOKEN_BUDGET = 2_500;
```

**2 é o número de PARTIDA, e o ajuste provável é para BAIXO.** Foi 1 num
rascunho deste documento, e a troca tem uma razão que vale mais que a conta:
**é fácil baixar um preço e caro subir.** Começar em 2 e cair para 1 depois da
medição é um presente que se anuncia; começar em 1 e subir para 2 é a única
mudança de preço que gera reclamação. Com uma estimativa não medida, erra-se
para o lado que tem saída.

E a elegância de "uma moeda por mensagem" não compra nada aqui, **porque o preço
é invisível**: o desenho esconde o saldo (§1.3), então ninguém lê a unidade. O
que a pessoa sente é a velocidade com que o anel anda, e a 2 moedas uma conversa
de 40 mensagens são 8% de um plano Pessoal — num saldo que ninguém esgota
conversando.

**Cobrar por mensagem só é aceitável porque o saldo deixa de ser um número na
cara** — ver [`creditos-na-tela.md`](./creditos-na-tela.md). Com o odômetro de
hoje, uma moeda por pergunta seria o pior dos mundos: a pessoa veria o número
cair a cada coisa que perguntasse, e a feature morreria de medo, não de preço.
As duas decisões são uma só, e não devem ser implementadas separadas.

**Não existe cortesia por sessão, nem para quem paga.** Ela chegou a existir
neste documento, para amortecer a parede de um bloco pago ("mais dez por 15
moedas"). Sem parede, ela não amortece nada: daria R$ 0,10 por sessão sem
ninguém perceber, porque o saldo está escondido e a gentileza aconteceria no
escuro. E "por sessão" é o degrau errado em qualquer caso — abrir uma sessão não
custa nada, então toda cortesia por sessão é uma cortesia infinita com um passo
a mais.

**A conta — e agora ela é MEDIDA.** Na régua de
`DEFAULT_COIN_PRICE_PER_THOUSAND_BRL` (R$ 20 o milheiro, uma moeda ≈ R$ 0,02),
uma mensagem rende R$ 0,04. Quatro execuções reais em `gpt-4.1-mini` sobre um
resumo de cinco blocos (`tmp/dev-scripts/biblo-eval.mts`), com a janela da §1.4
e as duas amarras no lugar:

| | entrada | saída | latência | custo | margem a **2** |
|---|---|---|---|---|---|
| cache frio | ~1.300 | ~250 | 4,0–4,8s | R$ 0,0046–0,0055 | **86–88%** |
| cache quente | ~1.270 (1.024 em cache) | ~250 | 3,7s | R$ 0,0032 | **92%** |

**A estimativa que fixou o preço era R$ 0,0103, e ela errou para o lado seguro
por um fator de dois.** Um resumo de verdade é maior que o do teste (~2.000
tokens contra ~500), o que acrescenta na casa de R$ 0,003 por mensagem: o caso
real deve ficar perto de R$ 0,008 no pior cenário, com margem ~80%. **Nenhum
cenário medido chega perto do prejuízo.**

O cenário que ainda é estimativa, e o único que preocupava:

| cenário | custo | margem a **2** | (a 1 moeda) |
|---|---|---|---|
| **sem** as amarras: resumo longo, cache frio, resposta de 800 tokens | R$ 0,0237 | 41% | **−19%** |

**Essa linha é o motivo de as duas amarras existirem**, e ela é a que condenou
o preço de 1 moeda: sem teto no tamanho da resposta e do resumo, o custo de uma
mensagem não tem limite superior nenhum, e a 1 moeda ele passava a receita. A 2
ele ainda fecha, e é essa folga que se está comprando. O cache automático
da OpenAI cobra o prefixo a 25% (`cachedInputPer1M` na família 4.1), e ele é a
metade do custo de uma mensagem — mas ele expira, e uma conversa sobre um sermão
é exatamente o caso em que a pessoa lê, pensa e volta dez minutos depois. Um
preço que só fecha com o cache quente é um preço que não fecha.

Então:

- **`maxTokens: 400` na resposta.** Uma resposta de 800 tokens dobra a parcela
  mais cara da conta, e é pior de ler: o `biblo.md` §5 já pede resposta curta, e
  isto é a mesma regra escrita onde ela é obrigatória em vez de pedida.
- **Teto no resumo que vai no prompt.** Quase todo resumo cabe folgado em 2.500
  tokens; o que não couber entra truncado pelo fim. Sem isso, o custo de uma
  mensagem passa a depender do tamanho do texto sobre o qual se conversa, que é
  justamente o que o preço fixo não pode deixar acontecer — é a mesma armadilha
  que o teto de 2h do YouTube (`YOUTUBE_MAX_DURATION_MS`) resolve lá.

Com as duas, o medido fica entre **86% e 92%**, e o caso real projetado em
~80% — acima da régua de `DEFAULT_TARGET_MARGIN_PCT` e da faixa do resto do
produto (63% a 75%). Não é o Biblo se pagando na mensagem: ele se paga na
assinatura que a pessoa não cancela. É só que uma feature de retenção não
precisa, ainda por cima, ser a que queima margem — e, com esta medição, o
caminho para 1 moeda ficou bem mais curto do que este documento supunha.

> ⚠️ **A medição acima é de BANCADA**: resumo pequeno, conversa vazia atrás,
> quatro execuções. Ela desmente a estimativa para o lado bom, mas não substitui
> o tráfego real — uma conversa de trinta mensagens sobre um sermão de uma hora
> não foi medida. Assim que houver uso, `/admin/custos` mostra a linha **Biblo**,
> e é ali que a decisão de **cair para 1 moeda** se toma com número. Ver §1.5.

### 1.3 Quem não pode, vê o quê

**A gaveta abre para todo mundo.** O botão nunca some, a conversa antiga sempre
aparece. O que muda é o que está no rodapé dela quando não há mensagem
disponível:

| quem | rodapé |
|---|---|
| plano pago, com saldo | o campo de digitar, e **nada mais** — nenhum preço, nenhum contador |
| plano pago, sem saldo | o convite para comprar créditos (o mesmo de hoje) |
| gratuito, com presente | o campo de digitar, e nada mais |
| gratuito, presente acabou | a linha gentil da §1.1 + o link do plano |
| kill switch ligado | "O Biblo está em manutenção." |

**A primeira linha é a mais importante da tabela.** Não há "1 moeda" escrito em
lugar nenhum da gaveta, nem no campo, nem no botão de enviar, nem no chip. Quem
quiser saber o que gastou abre os detalhes do saldo, como em qualquer outra ação
do produto — é lá que a resposta mora, e é de lá que ela não deve sair
([`creditos-na-tela.md`](./creditos-na-tela.md)).

Esconder o botão seria pior das duas pontas: quem pagou perde o caminho, e quem
não pagou nunca descobre que a coisa existe.

### 1.4 A janela deslizante, e por que ela não é detalhe de performance

**O custo por mensagem não pode crescer com a conversa.** Se cada resposta
relê tudo o que veio antes, a vigésima mensagem custa quatro vezes a primeira, e
o preço por mensagem passa a estar errado justamente no caso que mais consome
— a conversa longa, que é a boa. O `biblo.md` §9 chamou isso de "teto por
conversa"; o teto certo não é uma parede na cara do usuário, é uma janela:

> **Vai para o modelo:** as instruções + o resumo (até
> `BIBLO_SUMMARY_TOKEN_BUDGET`) + **os últimos 6 pares de mensagens** + um
> parágrafo curto do que já foi conversado antes disso.

O parágrafo (o "fio da conversa") é reescrito pela própria chamada que responde
— sai no mesmo JSON, custa zero chamada extra — e é o que impede a conversa de
ficar amnésica ao passar da sexta troca. Com isso o custo por mensagem vira
**constante**, e a tabela da §1.2 vale na mensagem 40 igual à mensagem 2.

O teto que sobra é de abuso, não de produto: `RATE_LIMITS.biblo`, 30 mensagens
por hora por usuário.

### 1.5 O que mexer quando algo estiver errado

Quatro manetes, **e o preço é a última**:

1. **A mensagem está custando mais que o estimado** → encolha
   `BIBLO_ANSWER_MAX_TOKENS` (400 → 300). É a parcela mais cara da conta e a que
   o usuário menos sente: uma resposta de chat que encurta 25% quase sempre
   melhora.
2. **Ainda está cara** → encolha `BIBLO_SUMMARY_TOKEN_BUDGET`. O resumo entra
   truncado, e o efeito aparece só nas sessões muito longas.
3. **A qualidade está curta** → troque `OPENAI_BIBLO_MODEL`, meça a diferença
   por versão em `/admin/usage` e reconfira a tabela da §1.2. É uma linha de env.
4. **Só então, o preço — e a direção provável é para baixo.** Ele é a única
   manete que a pessoa SENTE, porque aparece no ritmo em que o saldo dela anda.
   Subir (2 → 3) é o último recurso, e é cobrar do usuário um problema que é
   nosso; **descer (2 → 1) é o movimento esperado** assim que a medição
   confirmar o caso típico da §1.2, e aí é uma gentileza que se anuncia.

---

## 2. O caminho de uma mensagem

```
 pessoa digita / toca num chip
        │
        ▼
 POST /api/biblo  { sessionId, text }
        │
        ├─ 1. requireAuth
        ├─ 2. enforceRateLimit (RATE_LIMITS.biblo)
        ├─ 3. getSession → 404/403 se não for dela
        ├─ 4. resolveBibloAllowance(user, session)   ← §4
        │        gift | coins | denied
        ├─ 5. se coins → chargeCoins("biblo_message")       ← 402 se não houver saldo
        ├─ 6. insertMessage(role:"user", billing)            ← grava ANTES de chamar o modelo
        ├─ 7. buildPrompt: instruções + final_summary + janela + fio  ← §5
        ├─ 8. callChat(gpt-4.1-mini, response_format json)
        ├─ 9. BibloReplySchema.safeParse                     ← §6
        ├─ 10. resolveVerses(answer, suggestion)             ← §7, NVI local
        ├─ 11. insertMessage(role:"assistant", chips, suggestion, thread)
        └─ 12. recordChatUsage({ route: "biblo" })
        │
        ▼
 { message, chips, suggestion, allowance }
```

**A cobrança acontece antes da chamada, e o débito não volta se o upstream
falhar** — é a mesma decisão (e o mesmo comentário) de `/api/deepening`. A
diferença de escala está a nosso favor: ali um erro custava 50 moedas ao
usuário, aqui custa UMA, e uma moeda perdida num erro não é assunto para
código de estorno.

**Uma linha no ledger por mensagem**, e isso é muito menos volume do que parece:
a gravação já escreve uma linha por MINUTO (`recording_minute`, pulsado a cada
60s), então uma conversa de vinte mensagens é menos ledger que um sermão de meia
hora. Em troca, `/admin/custos` soma o Biblo pela mesma via que soma tudo o
mais, sem nenhum contador paralelo.

**A mensagem do usuário é gravada antes da resposta.** Se o modelo falhar, a
pergunta continua na tela e na conversa, com um "não consegui responder, tente
de novo" no lugar da resposta — e não some levando junto o que a pessoa
escreveu.

---

## 3. O banco

`supabase/migrations/0062_biblo.sql` (o próximo número livre é 0062).

```sql
create table if not exists public.biblo_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  -- Só em linhas do assistente: os chips que acompanharam a resposta, a
  -- sugestão de bloco (um SummaryBlock + posição) e o fio da conversa.
  chips       jsonb,
  suggestion  jsonb,
  thread      text,
  -- Só em linhas do usuário: como ESTA mensagem foi paga.
  billing     text check (billing in ('gift', 'coins')),
  created_at  timestamptz not null default now(),
  constraint biblo_messages_billing_only_on_user
    check ((role = 'user') = (billing is not null))
);

create index if not exists biblo_messages_session_idx
  on public.biblo_messages (session_id, created_at);

-- Índice parcial: a única pergunta feita fora do escopo de uma sessão é
-- "quanto do presente desta conta já foi usado?".
create index if not exists biblo_messages_gift_idx
  on public.biblo_messages (user_id) where billing = 'gift';
```

**Não existe tabela de conversa**, e a ausência é deliberada: uma conversa POR
SESSÃO (`biblo.md` §3) quer dizer que `session_id` já É a conversa. Uma tabela
`biblo_conversations` com uma linha por sessão seria uma chave estrangeira para
guardar nada.

**`billing` na linha é o que torna as três contas possíveis sem contador
paralelo:**

- presente usado pela conta = `count(*) where user_id = … and billing = 'gift'`
- mensagens pagas = as linhas `'coins'`, que batem uma a uma com
  `coin_transactions.reason = 'biblo_message'`

Nenhuma coluna de contador em `profiles`, nada que possa divergir do ledger, e
o `/admin` ganha de graça a resposta para "quanto o presente está nos
custando". **A conferência dos dois lados é uma query**: se o número de linhas
`'coins'` de uma conta não bate com o número de débitos `biblo_message` dela,
alguma mensagem foi respondida sem ser cobrada (ou cobrada sem ser respondida),
e é assim que se descobre.

### RLS e GRANT

**`select` para o dono, e mais nada.** Nem `insert`, nem `update`, nem `delete`
para `authenticated`: toda escrita passa pelo cliente de service-role dentro da
rota, como já acontece com `charge_coins` (0037) e `llm_usage_events` (0039). O
motivo é direto — quem pudesse inserir escolheria o próprio `billing`, e
`'gift'` é o valor que não custa nada.

```sql
alter table public.biblo_messages enable row level security;

create policy "biblo_messages_select_own" on public.biblo_messages
  for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.biblo_messages from authenticated;
grant select on public.biblo_messages to authenticated;
```

**Apagar a sessão apaga a conversa** (`on delete cascade`), e apagar a conta
também. Nada a acrescentar em `/api/account/delete`.

---

## 4. Quem pode mandar a próxima mensagem

`src/features/session/server/biblo/allowance.ts` (server-only). Uma função,
uma decisão, na ordem:

```ts
export type BibloAllowance =
  | { kind: "coins" }                      // plano pago: 1 moeda, em silêncio
  | { kind: "gift"; remaining: number }    // presente da conta gratuita
  | { kind: "denied"; reason: "disabled" | "gift_exhausted" | "revoked" };
```

1. **Kill switch primeiro.** `feature_switches` desligado recusa TODO mundo,
   inclusive o presente e inclusive o override — é a precedência que já está
   escrita em `evaluateFeature`, e um incidente não abre exceção.
2. **Plano pago** (`evaluateFeature("biblo_chat")` permite) → `coins`. O saldo
   insuficiente não é decidido aqui: ele é o 402 que `chargeCoins` devolve no
   passo 5 da §2, como em toda outra rota que cobra.
3. **Recusado por `"plan"`** (conta gratuita) → presente enquanto houver;
   depois, `"gift_exhausted"`.
4. **Recusado por `"revoked"`** (override do admin) → `"denied"`, sem presente.

**O passo 3 é a única coisa deste documento que o `entitlements` de hoje não
sabe fazer**, e ele NÃO deve aprender: `requireFeature` continua respondendo
sim ou não, e é a rota do Biblo que trata o "não por plano" como "talvez, se
ainda houver presente". Ensinar cortesia ao catálogo de features criaria uma
terceira resposta que as outras cinco rotas teriam de entender sem precisar.

O mesmo cálculo é exposto ao cliente em `GET /api/biblo?sessionId=`, junto da
conversa, para a gaveta desenhar o rodapé da §1.3 sem adivinhar. **`remaining`
só existe no `gift`**, e é de propósito: é o único caso em que a gaveta precisa
saber que há um fim chegando, para dizer a linha gentil na última. Quem paga não
recebe número nenhum, porque não há nada que a gaveta possa fazer com ele além
de mostrá-lo.

---

## 5. O prompt

`src/features/session/server/prompts/biblo.ts`.

**Contrato positivo, não lista de proibições.** O diagnóstico §1.1 do
`estudo-v2.md` vale inteiro aqui: um prompt que é majoritariamente "não faça"
produz um texto que passa o tempo inteiro desviando. O sistema diz o que o
Biblo É:

```
Você é o Biblo, que conversa com quem prepara ou acaba de resumir uma pregação.
Você ajuda com: passagens ligadas ao tema (sempre com a razão de terem vindo),
contexto histórico, personagens e lugares, dúvidas diretas, perspectivas que o
sermão não pegou, e referências para ler.
Você fala em segunda pessoa, em frases curtas, sem jargão sem tradução.
Uma resposta curta e honesta é uma boa resposta.
```

E quatro regras duras, porque cada uma delas já custou caro em outro lugar do
produto:

1. **Texto bíblico você não escreve, você aponta.** Marque `[[Jonas 1:1-3]]`; o
   servidor põe o texto. (§7)
2. **Aspas em alguém só com fonte.** Sem ela, fale do autor e da ideia — o nome
   quase nunca está errado, a frase atribuída a ele está (`estudo-v2.md` §1.3).
3. **Não há cota de nada.** Nem número de versículos, nem de citações, nem de
   parágrafos. Cota é a máquina de alucinação do §1.2 de lá.
4. **"Não sei" e "as igrejas divergem aqui" são respostas**, e dizer que há
   divergência é o conteúdo, não a falta dele.

**A recusa de escrever o sermão é a única proibição com nome**, porque é a
única que destrói o produto se ceder uma vez: *"escreva uma pregação de 20
minutos sobre Jonas"* recebe uma contraproposta ("posso te dar os três
movimentos e as passagens de cada um — o texto é seu"), não um sermão.

**E ele nunca soa mais espiritual do que o usuário.** Informa, provoca e
sugere; não abençoa, não exorta, não corrige a fé de ninguém.

### O que vai no contexto

| vai | não vai |
|---|---|
| `final_summary` até `BIBLO_SUMMARY_TOKEN_BUDGET` (§1.2) | a transcrição |
| os últimos 6 pares da conversa | o estudo, quando existir |
| o fio (§1.4) | outras sessões da Biblioteca |
| `speaker_name` e a data, quando existem | |

**A transcrição fica de fora na v1, e é uma decisão, não um esquecimento.** Ela
tem dezenas de milhares de tokens; mandá-la em toda mensagem multiplicaria a
tabela da §1.2 por três ou quatro e faria o preço da §1.2 estar errado. Quando
a pergunta for sobre o que foi DITO na pregação ("ele falou de dízimo em algum
momento?"), a v1 responde com honestidade que está lendo o resumo. A onda
seguinte é um recorte da transcrição por busca, nunca a fita inteira — é o que
o `biblo.md` §11.5 já antecipava.

---

## 6. O contrato da resposta

Uma chamada devolve **tudo** — resposta, próximos chips, sugestão de bloco e o
fio. `src/lib/domain/biblo.ts` (client-safe, é o que a gaveta desenha):

```ts
export const BibloReplySchema = z.object({
  answer: z.string().min(1),
  /** Até 4 PERGUNTAS. O que passa de 90 caracteres é aparado fora da lista. */
  chips: /* array de string, aparado */,
  /** O bloco, quando ela PEDIU um. Malformado vira null, não derruba nada. */
  suggestion: BibloSuggestionSchema.nullable().catch(null).default(null),
  /** A OFERTA de escrever, na voz dela. Vira a última pastilha da fileira. */
  offer: /* string | null */,
  /** Reescrito a cada resposta, é a memória além da janela. */
  thread: /* string, cortada em 600 */,
});
```

### Nada neste contrato derruba uma resposta já paga

Os três campos acessórios são **aparados, nunca fatais**: chip comprido sai da
lista, fio comprido é cortado, sugestão malformada vira `null`. A resposta
chega.

Não é zelo abstrato — os dois primeiros aconteceram na bancada no mesmo dia. Os
chips eram `.max(48)`; quando o prompt passou a pedir perguntas faladas, um chip
de 58 caracteres derrubava o schema inteiro e o `POST` devolvia `unparseable`
**depois de ter debitado as duas moedas**. Uma decoração não pode custar o
produto.

### A OFERTA tem campo próprio, e o motivo é medido

Ela nasceu dentro de `chips` e simplesmente **não acontecia**: os chips são
pedidos como perguntas ("escreva-os como ELA perguntaria"), e uma oferta não é
uma pergunta — com quatro vagas e uma instrução de pergunta, o modelo enchia as
quatro de perguntas, três rodadas seguidas. Um campo que precisa ser preenchido
ou dito nulo é a diferença entre pedir e obter.

O servidor a junta a `chips` antes de gravar. Daí para baixo ela é uma pastilha
como as outras: a gaveta desenha, a pessoa toca, e o texto dela vira a próxima
mensagem — por isso a oferta vai **na voz dela, no imperativo** ("Escreve um
parágrafo sobre isso"), e não na do Biblo ("Posso escrever um parágrafo?"), que
foi a primeira coisa que o modelo tentou.

**A sugestão é um `SummaryBlock`, e isso é a regra inteira da §6 do
`biblo.md` virada em tipo.** Se o que o Biblo quer oferecer não couber nos oito
tipos que o editor já desenha, não há sugestão — a resposta fica na conversa e a
pessoa copia. Um "bloco de texto do Biblo" seria um nono tipo que o
`BlockRenderer`, o `Composer` e o `WRITTEN_BLOCK_TYPES` teriam de aprender, e o
cabeçalho de `domain/summary.ts` já conta o que aconteceu da última vez que
existiu um tipo que só um lado conhecia.

**Chips derivados, nunca fixos** — eles saem desta mesma chamada, puxados do que
acabou de ser dito. A exceção é a abertura, §8.

**E eles são perguntas FALADAS, não entradas de índice.** A primeira versão
pedia "no máximo 6 palavras" e produzia telegrama — *"O que Társis
representa?"*, *"E os marinheiros, o que pensam?"*. Uma pergunta que alguém faz
em voz alta é específica, e é a especificidade que a faz caber numa frase
inteira: *"O que Társis representava para a época?"*, *"E os marinheiros junto a
Jonas, o que pensavam da situação?"*. O teto virou 12 palavras, com a ressalva
de que uma pergunta já específica em quatro fica em quatro — esticar *"Por que
Deus escolheu Nínive?"* só para cumprir tamanho a piora.

### O modelo escolhe o bloco; o SERVIDOR escreve o texto

Isto já valia para `bibleQuote` (§7) e agora vale para a prosa, pela mesma
razão de sempre — e por uma medição que custou seis formulações de prompt:

> Quando a pessoa pedia *"escreve um parágrafo sobre isso"*, o modelo escrevia o
> parágrafo em `answer` e deixava `suggestion` nula.

Do ponto de vista dele o trabalho estava feito, e repetir cento e tantos tokens
que já estão na resposta é exatamente o que o resto do prompt manda não fazer. O
sintoma era o pior possível: **quem PEDIU o botão ficava sem o botão, depois de
pagar.**

Hoje o modelo manda o bloco com `"text": ""` — só o TIPO e a POSIÇÃO, que é
barato e que ele faz de bom grado — e `verifySuggestion` preenche com a resposta
já resolvida. Vale para `paragraph`, `highlight`, `conclusion` e `example`;
`h2` e `quote` ficam de fora (um subtítulo não é a resposta inteira, e citação
sem autor não é citação) e são descartados se vierem vazios.

**Mesmo assim ele acerta ~2 em 3** na bancada, e o terço restante entrega o
texto na resposta sem o botão — a pessoa copia. Antes de mexer no prompt de
novo: o pedido curto (*"Escreve um parágrafo sobre isso"*, que é o que a própria
oferta escreve) acerta mais que o longo (*"Escreve um parágrafo explicando por
que…"*), que o modelo lê como pedido de explicação.

---

## 7. O texto bíblico não se gera

**Onze traduções estão em `src/lib/bibles/`, e é de lá que sai todo versículo.**

O modelo escreve `[[Jonas 1:1-3]]` no meio da prosa. Antes de gravar a resposta,
o servidor:

1. acha os marcadores;
2. `parseVerseReference` (`lib/domain/reference.ts`) resolve livro/capítulo/versículos;
3. `lookupPassage` (`lib/bibles/lookup.ts`) traz o texto da NVI;
4. o marcador vira uma referência clicável, com o texto ao lado — o mesmo
   `PassageVerses` da leitura e do editor;
5. **marcador que não resolve é removido**, não deixado como texto.

E na sugestão: quando `block.type === "bibleQuote"`, o modelo preenche só
`reference`. **O campo `text` é sempre escrito pelo servidor**, a partir da
Bíblia local — se a referência não resolver, a sugestão inteira é descartada.
Um versículo inventado entrando no resumo de alguém é o pior defeito que este
produto pode ter, e o único jeito de ele ser impossível é o modelo nunca ter a
caneta.

---

## 8. A abertura não custa chamada

**O cumprimento e os primeiros chips são DERIVADOS, não gerados.** Abrir a
gaveta não gasta presente, não gasta moeda, não gasta dólar e não espera
nada — é instantâneo.

Do `final_summary` já se tira tudo o que a primeira frase precisa:

| do payload | vira |
|---|---|
| `title` + o primeiro nome de quem abriu | *"Olá, **{nome}**! Vi que você está lendo sobre **"{título}"**, de **{pregador}**. Tem algum trecho ou tema que você queira conversar a respeito?"* |
| cada bloco `bibleQuote` | chip **"Contexto de {referência}"** |
| referências no meio da prosa (as mesmas já extraídas para a busca por versículo, migração 0041) | chip **"Contexto de {referência}"** |
| `shortSummary` | chip **"Outras passagens sobre isto"** |
| sempre | **"Uma pergunta que incomode"**, **"O que ler sobre isso"** |

Três a cinco chips por vez, nunca a lista inteira (`biblo.md` §4). **Sessão
vazia** — alguém que acabou de abrir o `/escrever` — recebe o cumprimento sem
fingir que sabe de algo e os chips genéricos: *"sobre qual passagem você quer
escrever?"*.

**O cumprimento chama a pessoa pelo nome, e o VERBO olha o modo da sessão.** O
nome sai de `display_name` (a conta vem do Google, quase sempre existe) e vem de
carona na consulta que o `requireAuth` já faz; sem nome usável, o "Olá!" fica
sozinho — ninguém se reconhece em "Olá, usuário!". E o texto do `/escrever` é
algo que a pessoa está ESCREVENDO, não lendo: dizer "vi que você está lendo"
para quem está com a própria página aberta erra logo na frase que todo mundo lê.

Uma abertura gerada por LLM custaria uma chamada a cada gaveta aberta, inclusive
as que ninguém usa, e ela é a única parte da conversa cujo material está todo na
tela. Chips com inteligência de verdade são os da §6 — os que vêm DEPOIS de uma
resposta.

---

## 9. A tela

### Onde ele mora: o mesmo gesto que o `+` e o hambúrguer

**Um botão flutuante no canto inferior direito, nas DUAS telas.** Não é desenho
novo: é a terceira instância de um gesto que o produto já tem duas vezes, e o
cabeçalho do `AdminMenu` já disse por quê —

> *"É o `CreateDock` da Biblioteca com outro glifo e outro conteúdo, e a
> semelhança é o ponto — são o mesmo gesto em dois lugares do produto."*

Agora são três, e o Biblo herda a peça inteira, não só a posição:

| o que herda | de onde |
|---|---|
| `fixed inset-x-0 bottom-0` com o botão `pointer-events-auto` dentro | os dois |
| disco de vidro `size-14` (`bg-v2-glass-button`, `--v2-glass-sheen`, `ring-v2-glass-edge`, `backdrop-blur-xl`) | os dois |
| sem véu: apanhador de toque transparente atrás | os dois |
| o glifo NÃO gira para virar "×" — quem diz que está aberto é o botão aceso e o `aria-expanded` | `AdminMenu` |
| **não some ao rolar** | `AdminMenu` |

**O glifo é o rosto do Biblo**, não um ícone do lucide — é o único lugar do
produto onde o botão flutuante tem cara em vez de símbolo, e é o que faz
"conversar com o Scriba" virar "perguntar ao Biblo" (`biblo.md` §7).

**Por que ele não some ao rolar, ao contrário do `+` da Biblioteca.** Lá o botão
se esconde na descida porque "rolar para baixo é LER e o botão cobre o que se
está lendo". Aqui o argumento se inverte: **a pergunta nasce no meio da
descida**, no parágrafo doze, e um botão que foge exatamente quando a dúvida
aparece é o pior momento possível para ele sumir. O que resolve o "cobre o que
se está lendo" é o material, não o esconde-esconde: o disco é de VIDRO com
`backdrop-blur`, e o texto continua legível através dele — é a mesma razão de o
`AdminMenu` poder ficar parado sobre uma tabela.

**O botão some enquanto a gaveta está aberta.** Ele não é um interruptor aceso:
virou a gaveta, e a gaveta tem o próprio fechar.

### O canto é dividido com o `BackToTop`

No `/summary` já mora um disco ali. O permanente fica embaixo, o eventual
empilha por cima:

| | Biblo | BackToTop |
|---|---|---|
| quando | sempre | depois de 1,5 tela de rolagem |
| onde | o canto | **acima do Biblo** |
| peso | vidro, `size-14`, com rosto | disco discreto de 40px, como hoje |

O contrário — o condicional embaixo — faria o botão principal pular de lugar
toda vez que alguém rolasse a página.

### O teclado: o botão sobe junto

No `/escrever` o teclado abre por baixo, e é ali que um `fixed bottom-0`
desaparece: **nenhuma das duas plataformas resolve isso sozinha.** No Chrome
Android o padrão (`interactive-widget=resizes-visual`) não encolhe o viewport de
layout, então o botão fica atrás do teclado; no iOS Safari o `fixed` também não
acompanha, e `interactive-widget` nem existe lá. **O app não trata teclado em
lugar nenhum hoje** — não há um `visualViewport` em `src/`.

Uma medida, um `hook`, e a mesma expressão nos três botões flutuantes:

```ts
// src/shared/hooks/useKeyboardInset.ts — escreve --kb-inset no <html>
const vv = window.visualViewport;
const update = () =>
  document.documentElement.style.setProperty(
    "--kb-inset",
    `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`
  );
```

```
bottom-[calc(1.25rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))]
```

Duas coisas não óbvias, e as duas importam:

- **`max()` e não soma.** Com o teclado aberto, a faixa do gesto do iPhone está
  COBERTA por ele; somar os dois empurraria o botão para o meio da tela.
- **A fórmula vale nos dois modos de viewport.** Sem `resizes-content`,
  `innerHeight` fica cheio e `visualViewport.height` encolhe → a conta dá a
  altura do teclado. Com `resizes-content`, os dois encolhem juntos → a conta dá
  ~0, e o botão já está acima do teclado porque o layout inteiro subiu. Nenhum
  `if` de plataforma, e nenhuma mudança no `viewport` do `app/layout.tsx`.

O `hook` mora em `shared/` e não na feature porque **o `CreateDock` e o
`AdminMenu` têm o mesmo problema** — hoje os dois somem atrás de um teclado
aberto, só que em nenhuma das duas telas há campo de texto para abri-lo. Quando
houver, a correção já está escrita.

Componentes novos, em `src/features/session/components/`:

| arquivo | o que é |
|---|---|
| `BibloDock.tsx` | o botão flutuante, irmão de `CreateDock` e `AdminMenu` |
| `BibloDrawer.tsx` | a gaveta: lista, chips, campo, rodapé da §1.3 |
| `BibloMessage.tsx` | uma mensagem, com "copiar" e o cartão de sugestão |
| `shared/brand/BibloAvatar.tsx` | o rosto |
| `shared/hooks/useKeyboardInset.ts` | a medida acima |

**Como a gaveta abre fica para a implementação.** O `CreateDock` e o `AdminMenu`
abrem um painel de vidro ao lado do botão, crescendo em `origin-bottom-right` —
e os dois cabem nisso porque são três e oito atalhos. Uma conversa não cabe num
painel de atalho: ela tem lista rolável, campo de texto e teclado. A decisão
entre crescer a partir do botão até virar folha, subir do rodapé ou entrar pela
lateral no desktop se toma com a coisa na tela, no passo 9 da §12.

### O rosto: o blobatar faz muito mais do que a proposta supunha

**`blobatar@2.7.0`, MIT, ~4,4 KB gzipped, sem dependências.** O `biblo.md` §7
registra que a biblioteca resolve identidade e *"não resolve a atuação… isso, se
quisermos, é trabalho nosso por cima"*. **Isso está errado, e o parágrafo de lá
foi corrigido junto com este documento.** Ela resolve a atuação também:

```tsx
import { Blobatar } from "@blobatar/react";
import { thinking } from "blobatar/expression";
import { useGaze } from "@blobatar/react/gaze";
import "blobatar/motion.css";
import "blobatar/gaze.css";
```

O que vem pronto, e que eu tinha orçado como CSS nosso:

- **Oito expressões**: `idle`, `happy`, `sad`, `mad`, `love`, `shy`, `sick`,
  **`thinking`** — a última é exatamente o estado que este documento dizia que
  teríamos de inventar.
- **Animação**: `animate="hover" | "always"`, e ela **respeita
  `prefers-reduced-motion`** sozinha.
- **Olhar que segue o ponteiro**: `useGaze({ travel: 3, lookAt: "pointer" })`.
- **`traits`, `hue`, `tone`, `background`** para fixar a aparência em vez de
  deixá-la ao acaso da string.

**Três expressões, e só três:**

| momento | expressão |
|---|---|
| parado | `idle` |
| resposta a caminho | `thinking` |
| sugestão aceita ("Adicionar") | `happy`, por um instante, e volta a `idle` |

**`sad`, `mad`, `sick`, `love` e `shy` ficam fora, e a regra que os exclui é de
produto, não de gosto: a expressão diz o estado da MÁQUINA, nunca uma opinião
sobre o CONTEÚDO.** Um Biblo entristecido ou irritado com uma pergunta sobre
doutrina é o avatar tomando um partido que o `biblo.md` §8 proíbe o texto de
tomar — e a cara é mais difícil de desmentir que o parágrafo.

**O olhar que segue o ponteiro entra, no desktop.** No celular não há ponteiro e
ele simplesmente não acontece — degrada sozinho, sem `if`.

**A aparência é FIXADA, e isto é o único risco real da dependência.** O Biblo é
UM personagem, não um avatar por usuário: a string é constante, e `hue`, `tone`,
`traits` e principalmente **`gen`** ficam presos no `BibloAvatar`. O README
descreve `gen` como "geração atual" — quer dizer que uma `gen=3` um dia muda o
desenho. Num avatar por usuário isso é cosmético; **num personagem, é a cara
dele mudando num `npm update`**. Preso o `gen`, um major da lib vira uma
conferência a olho, não uma surpresa em produção.

**O `hue` é 250 e o `tone` 0,85, o que dá `#9fbfe0` — um azul claro,
esbranquiçado. As duas metades disso custaram caro.**

A primeira: ele saía do amarelo da marca, `44`, o matiz HSL de `--scriba-yellow`.
Mas a lib pinta em **OKLCh**, onde 44° é laranja queimado — o Biblo nasceu
vermelho, e ninguém percebeu até a cara dele estar na tela. Para conferir um
valor sem abrir o navegador, o pacote exporta `palette(hue, enforce, tone)`, que
devolve os três hexadecimais. A régua, em OKLCh: ~29 vermelho, ~88 amarelo, ~145
verde, ~250 azul.

A segunda, e a que importa: **o amarelo não devia ser a cor dele de qualquer
jeito.** No Scriba o amarelo é a MOEDA (`src/shared/AGENTS.md`: saldo, preço,
marca-texto), e um rosto amarelo flutuando no canto em que o app fala de crédito
diria "isto custa" antes de dizer "isto conversa" — justamente o que a §9 quer
evitar. O azul não pertence a nenhuma das três famílias semânticas, que é o que
um personagem precisa.

O `tone` **não é contínuo**: a lib escolhe entre meia dúzia de amostras daquele
matiz, e 0,80–0,90 inteiro dá o mesmo hexadecimal. Os valores vizinhos são
`#1c89e4` (o azul médio, faixa 0,65–0,75) e `#2a394a` (quase o grafite do fundo,
em 0,95) — por isso 0,85 fica no MEIO da faixa, e não na borda dela.

O fundo do avatar é transparente: a lib desenha só cabeça e olhos, e o `bg`
quase branco que a `palette()` devolve nunca vai para a tela. É o que permite
um tom claro — a cabeça pousa direto no vidro do dock, sobre o grafite.

A regra de "nada de cor literal" do `AGENTS.md` fala de `className`, e aqui é um
número numa prop — mas o espírito vale: o comentário diz de onde o número vem e
como conferi-lo.

**E o `Sparkles` do lucide continua proibido aqui** (regra do `AGENTS.md` da
raiz): o Biblo tem rosto próprio, não precisa de enfeite emprestado.

### A conversa é de BALÕES, e a cor de cada lado é uma decisão

| quem | superfície | canto aparado |
|---|---|---|
| Biblo | `--secondary` (#3A3B41), o degrau de realce que o app já usa | superior esquerdo |
| quem pergunta | `--biblo-bubble-me` (#2C4A6B), o azul do rosto dele | inferior direito |

**O canto aparado aponta para a origem da fala**, e é ele que faz um retângulo
arredondado virar balão: o do Biblo encosta no rosto dele, que está em cima e à
esquerda; o de quem pergunta encosta no canto de onde ela escreveu. Raio igual
nos quatro cantos lê como cartão, não como fala.

A resposta do Biblo já foi texto solto ao lado de um avatar, e o que se lia não
era conversa: era um documento com uma carinha do lado.

**O balão de quem pergunta já foi âmbar** (`--scriba-gold-soft`, a família da
MOEDA), e âmbar sobre fundo escuro lê como AVISO — a própria pergunta da pessoa
parecia algo que precisava de atenção. O azul não carrega estado nenhum no
produto, e amarra a conversa ao personagem em vez de amarrá-la ao preço.

### O cabeçalho é do tamanho do que ele tem a dizer

Ele tinha o rosto do Biblo, o nome dele e um fio embaixo. **O rosto saiu**: ele
se repete em cada balão de resposta, e ali ele faz trabalho — diz de quem é a
fala. Em cima, ao lado do nome, só repetia. O fio saiu junto: o que separa a
linha da conversa é o espaço, não um traço.

Ficaram o nome, na Poppins da marca e com maiúscula — a caixa baixa é do
logotipo, onde "scriba" é a MARCA; aqui a palavra é o nome de alguém com quem se
conversa —, e o fechar. Nenhum dos dois é dispensável: sem o fechar a
gaveta não fecha, já que o botão flutuante sai da tela enquanto ela está aberta,
e sem o nome a gaveta abre sem dizer o que é — a conversa pode estar vazia, e um
× sozinho no canto não é cabeçalho, é um botão perdido.

**O rosto `thinking` do "Pensando…" passou a importar mais por causa disso**: é
o único sinal DENTRO da gaveta de que a resposta está a caminho, já que o outro
é o botão flutuante, que só se vê com ela fechada.

### Ele se apresenta nas TRÊS primeiras conversas

Na primeira vez a gaveta abre e a pessoa não sabe o que perguntar ali. A
apresentação responde a pergunta que ela tem de fato — *"o que eu pergunto
aqui?"* — e por isso diz o que ele FAZ, não o que ele é: *"Meu nome é Biblo.
Posso explicar uma passagem, contar o contexto de quem a escreveu, apresentar um
personagem ou levantar um ângulo que ninguém trouxe."* São as mesmas quatro
capacidades da §2 do `biblo.md`, e as mesmas que os chips logo abaixo oferecem.

Ela não diz nada sobre a SITUAÇÃO — quem diz é a frase seguinte, que sabe se a
pessoa está lendo um sermão, escrevendo o próprio texto ou diante de uma folha
em branco. A primeira versão abria com *"eu leio junto com você"*, e no
`/escrever` isso estava simplesmente errado.

**Quem conta é um COOKIE, e o atalho é deliberado.** O fato existe no banco
(`biblo_messages` sabe em quantas sessões a pessoa já falou), mas um
`count(distinct session_id)` não sai do PostgREST sem uma função nova e um
GRANT, e nada disso se paga para decidir o tom de uma frase de boas-vindas. O
preço é que o contador é por APARELHO: quem troca de celular para o computador
ouve a apresentação de novo. Numa atribuição de comissão isso seria inaceitável
(é por isso que `features/referrals/` mora no banco); aqui o pior caso é ser
cumprimentado uma vez a mais por um assistente simpático — e aparelho novo é
contexto novo.

**Ele conta CONVERSA, não abertura de gaveta.** Sobe no `POST`, e só quando a
sessão ainda não tinha mensagem nenhuma. Abrir, olhar e fechar sem dizer nada
não gasta apresentação — que é o comportamento de quem ainda não entendeu para
que ele serve, ou seja, exatamente quem a apresentação existe para alcançar.

Três porque é onde o hábito pega sem virar ladainha: na primeira a pessoa não
sabe o que ele faz, na terceira ela já sabe e a frase começa a atrapalhar o que
ela veio perguntar.

### A abertura da gaveta é três pontos no centro

Era *"Abrindo a conversa…"* no canto superior esquerdo: uma linha de texto solta
no alto de uma área vazia, que lê como uma mensagem sem balão — justamente o que
a gaveta inteira não é.

Hoje são os três pontos cinzas do `ListeningDots`, o mesmo componente do feed ao
vivo, centrado nos dois eixos. **Reaproveitar foi a decisão:** o desenho é o
componente, a frase é de quem chama (`label`), e um segundo trio de pontos em
outro arquivo divergiria no primeiro ajuste de tamanho. O rótulo continua
existindo para quem usa leitor de tela, onde ponto cinza não diz nada.

Ele é o próprio filho flexível da gaveta, e não um `h-full` dentro da lista:
`height: 100%` dentro de um item de flex depende de o item ter altura definida,
o que nem sempre acontece.

### O campo de digitar cresce, até seis linhas

Era `rows={1}` fixo, e quem escrevia uma pergunta de três linhas via a primeira
sumir por cima enquanto digitava a terceira — reler o que se escreveu virava
rolar um campo de uma linha.

O teto é seis porque a gaveta tem altura fixa (85dvh no celular) e um campo sem
limite come a conversa que a pessoa está lendo para responder. Passando disso
ele rola por dentro; o teto duro continua sendo `BIBLO_MAX_QUESTION_CHARS`.

**As constantes da altura andam junto com o `className` do `<textarea>`:** a
conta é feita em pixels no componente e o `leading-6` / `py-2.5` de lá é o que a
torna verdadeira. Mudar o `leading` sem mudar a constante erra por uma linha,
em silêncio.

### A pergunta entra ANTES da rede

Ela aparecia junto com a resposta, quatro segundos depois de enviada, e nesses
quatro segundos a tela não tinha registro nenhum do que a pessoa fez: o campo
esvaziava e nada acontecia. Num chat isso é o app parecendo ter perdido a
mensagem, e a reação de quem usa é mandar de novo — e mandar de novo aqui custa
duas moedas.

A pergunta é a única coisa desta conversa que **não precisa de servidor para ser
verdade**: quem a escreveu foi a pessoa, e o que o servidor devolve depois é só
o id dela. Nos três caminhos de falha ela sai da lista e volta para o campo,
onde pode ser reenviada — o otimismo termina onde a certeza termina.

### A rolagem tem DOIS destinos

Ao enviar, o fim da lista: a pergunta e o "Pensando…" são as duas últimas
coisas, e a pessoa quer ver as duas.

**Ao receber, o INÍCIO do balão da resposta.** Parar no fim de uma resposta de
três parágrafos deixa a primeira linha meia tela acima, e a pessoa tem de subir
para começar a ler o que acabou de pedir.

### O "pensando"

Sem streaming (`biblo.md` §10, e `AGENTS.md`: o produto não tem SSE). **Medido:
3,7 a 4,8 segundos** por resposta no `gpt-4.1-mini` — um pouco acima dos 2 a 4
que este documento supunha, e dentro do que o `thinking` do avatar cobre. É
também o número que decide se um dia vale trazer SSE para o produto: abaixo de
5s, um texto aparecendo letra a letra compra pouco; se a resposta passar disso
(um modelo maior, um contexto maior), a conta muda.

**E ele pensa também com a gaveta fechada.** Quem fecha para reler o versículo
enquanto a resposta não chega vê o rosto no canto pensando, e voltando a `idle`
quando ela chega. É o aviso de "terminei" sem badge, sem ponto vermelho e sem
notificação.

**E a resposta ASSENTA, em vez de simplesmente aparecer.** Sem streaming ela
chega inteira de um quadro para o outro, e um bloco de texto que surge pronto
não diz de onde veio. Os parágrafos entram com `animate-biblo-in` (260ms) e um
atraso crescente **com teto de 240ms**. O teto é a parte que importa: sem ele,
uma resposta de sete parágrafos faria a pessoa esperar por um texto que já está
em mãos — o defeito do streaming, copiado de graça por um efeito que existe para
o contrário. **Não é digitação, e não deve virar uma.**

Só a resposta que ACABOU de chegar anima. Reabrir a gaveta amanhã é ler uma
conversa guardada, e ver dez respostas antigas entrando em cascata seria o app
fingindo que elas estão chegando agora.

## 10. Da conversa para o resumo

**Ele nunca escreve sozinho — e agora nem RASCUNHA sozinho.** Todo cartão de
sugestão tem "Adicionar", e nada entra no texto sem esse toque.

A primeira versão ia um passo além do necessário: qualquer resposta que desse um
bom trecho vinha com o parágrafo já escrito embaixo. O resultado era texto
pronto sob perguntas que eram só curiosidade ("qual o contexto histórico
disso?"), e texto escrito antes de alguém querer é texto morto — ocupa a tela,
paga saída de modelo e, pior, responde por quem escreve.

Hoje o bloco pronto só vem em dois casos: uma PASSAGEM (que custa uma referência
e nada mais) e um trecho que a pessoa PEDIU. Nos demais, a oferta vira pastilha
("Escreve um parágrafo sobre isso"), e a pastilha tocada é o pedido do segundo
caso.

**O preço disso é honesto e está aqui para ser revisto**: aceitar um parágrafo
passou a custar duas mensagens em vez de uma — quatro moedas. A troca vale
porque a maioria das perguntas nunca ia virar texto, e essas agora não pagam
nada além da própria resposta.

O caminho é diferente nas duas telas, e isso é bom:

| tela | "Adicionar" faz |
|---|---|
| `/escrever/:id` | `insertAt(afterIndex + 1, block)` no rascunho local do `Composer`. O salvamento automático que já existe leva ao banco. |
| `/summary/:id` | `POST /api/sessions/written` com o payload atual + o bloco inserido. |

**A segunda linha só é possível porque aquela rota deixou de exigir sessão
`manual`** — ela salva o resumo de qualquer modo, e o `/escrever/:id` abre
qualquer modo (ver os cabeçalhos dos dois arquivos). Se aquele `409 not_manual`
ainda existisse, o Biblo do `/summary` não teria onde escrever, e o desenho
desta seção seria outro.

**Desfazer**: o cartão recém-inserido mostra "remover" enquanto a conversa
estiver aberta, e o remover é a operação inversa, no mesmo caminho. Não é
histórico: é o arrependimento dos próximos segundos.

**Copiar é a segunda porta, e não a de serviço.** Todo trecho da conversa tem
"copiar", com o mesmo peso visual do "Adicionar" — às vezes o parágrafo vai para
o caderno, para o WhatsApp do grupo, para um slide.

---

## 11. Telemetria, ou como saber se deu certo

Quatro listas ganham uma linha, e nenhuma delas é opcional:

```ts
// lib/db/usage.ts             → USAGE_ROUTES:     "biblo"
// features/coins/pricing.ts    → CHARGE_REASONS:   "biblo_message"
// features/coins/billable.ts   → BILLABLE_ACTIONS: { key: "biblo", unit: "mensagem" }
// lib/entitlements/features.ts → FEATURE_KEYS:     "biblo_chat"
```

**`gpt-4.1-mini` já está em `CHAT_PRICES`** (`lib/llm/pricing.ts`), então o
custo entra medido desde a primeira mensagem — não é o caso do `gpt-5.1`, que
rodou meses custando zero no painel. Se `OPENAI_BIBLO_MODEL` for trocado por
qualquer coisa, **confira a tabela de preços ANTES do deploy**.

E, porque o preço nasceu de estimativa (§1.2), há uma pergunta específica a
responder no `/admin/custos` depois das primeiras cem conversas:

1. Quanto custa uma mensagem de verdade, contra os R$ 0,0103 estimados? E
   **qual fatia das chamadas pegou o cache** (`cachedTokens` em
   `llm_usage_events` responde isso sozinho) — é a diferença entre os 48% e os
   22% da tabela da §1.2.
2. Quantas mensagens tem uma conversa mediana? Abaixo de 5, o Biblo está sendo
   aberto e abandonado, e o problema é a abertura, não o preço.
3. Quanto o presente custou no mês, e quantas contas gratuitas viraram pagas
   depois de usá-lo?
4. Alguém chegou a ficar sem saldo POR CAUSA do Biblo? Uma conversa de 40
   mensagens são 40 moedas — 4% de um plano Pessoal. Se isso estiver acontecendo
   com frequência, o problema não é a margem, é que o produto virou caro para o
   uso que ele quer incentivar.

---

## 12. Ordem de implementação

Uma entrega, um `npm run release`. A ordem existe para cada passo compilar
sozinho:

1. **`0062_biblo.sql`** + `npm run db:push` (permissão permanente, §Comandos do
   `AGENTS.md`).
2. **`lib/domain/biblo.ts`** — `BibloReplySchema`, `BibloSuggestionSchema`,
   tipos da gaveta. Client-safe.
3. **`features/coins/pricing.ts`** + `billable.ts` + `lib/entitlements/features.ts`
   + `lib/db/usage.ts` — as quatro listas da §11, com o comentário de cada
   número (a tabela de margem da §1.2, as duas amarras e o que fazer se a
   medição desmentir a estimativa moram no comentário de `bibloMessage`, como a
   conta das 30 moedas mora no de `youtubeImport`).
4. **`lib/db/biblo.ts`** — `listMessages`, `insertMessage`, as três contagens da
   §3. Service-role nas escritas.
5. **`features/session/server/biblo/allowance.ts`** — a decisão da §4.
6. **`features/session/server/prompts/biblo.ts`** + **`server/biblo/answer.ts`**
   — prompt, `callChat`, parse, resolução de versículos (§5–§7).
7. **`app/api/biblo/route.ts`** — `POST` e `GET`, na ordem da §2.
   `maxDuration = 60`, `RATE_LIMITS.biblo` em `lib/rate-limit.ts`.
8. **`server/biblo/opening.ts`** — cumprimento e chips derivados (§8). Sem LLM.
9. **A gaveta** — `npm i blobatar @blobatar/react`, depois `BibloAvatar`,
   `BibloDrawer`, `BibloMessage`, `BibloDock` e `useKeyboardInset` (§9):
   flutuante nas DUAS telas, com o `BackToTop` empilhado acima no `/summary`.
10. **A inserção** (§10) nos dois caminhos, com o desfazer.
11. **Os textos da §1.1 e §1.3**, escritos como estão lá — é a parte que mais
    facilmente vira "você atingiu o limite" no meio de uma pressa.
    **`creditos-na-tela.md` entra aqui**, e não depois: com o odômetro de hoje
    na barra, cobrar por mensagem é a pior versão desta feature (§1.2).
12. **Documentos, no MESMO commit:** `biblo.md` sai de "proposta" e ganha os
    números decididos; `docs/README.md` atualiza as duas menções; este arquivo
    troca o cabeçalho de status; `src/app/AGENTS.md` e
    `src/features/session/AGENTS.md` ganham o parágrafo do Biblo.
13. `npm run typecheck` → `npm run check` → commit → `npm run release` →
    `git push --follow-tags origin develop`.

---

## 13. O que este documento NÃO decidiu

- **Reprocessar apaga o que o Biblo acrescentou.** A conversa sobrevive (ela
  mora em tabela própria), mas todo bloco inserido no resumo é descartado, como
  já acontece com qualquer edição à mão. O aviso do diálogo de reprocessar
  precisa ganhar essa frase — **e isso é trabalho do passo 10**, não de uma
  onda futura. O que fica em aberto é se o aviso precisa ficar mais forte do
  que uma frase.
- **O que acontece com o estudo.** As rotas e as tabelas continuam de pé, sem
  botão. Se o Biblo entrega em pedaços o que o estudo entregava em bloco, ou o
  estudo morre de vez ou volta como "juntar esta conversa num documento". Não é
  decisão desta entrega, e nada aqui a atrapalha.
- **Ajudar a COMEÇAR um texto do zero** (`biblo.md` §11.2). A sessão vazia abre
  com cumprimento e chips genéricos (§8), e o Biblo continua sem escrever o
  texto de ninguém — a regra da §5 não tem exceção para folha em branco. Se um
  dia virar um modo próprio, é outra conversa, e provavelmente outro preço.
- **A transcrição no contexto** (§5). Recorte por busca, numa onda seguinte.
- **Conversar sobre a Biblioteca inteira**, voz, streaming, buscar na internet e
  compartilhar a conversa continuam fora (`biblo.md` §10). Quando a camada de
  conhecimento curado existir (`scriba-rag-proposta-claude.md`), o Biblo é o
  primeiro cliente dela, e é ali que "sugerir livros e frases" deixa de ser
  risco de invenção.
