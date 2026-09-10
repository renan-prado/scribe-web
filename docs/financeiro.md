# Controle financeiro do Scriba

O `/admin/financeiro` existe para responder a uma pergunta só:

> **Se eu olhar para o Scriba hoje e para os próximos meses, sei exatamente
> quanto estamos ganhando, quanto estamos gastando, quanto devemos e para onde
> estamos indo?**

Este documento explica o desenho. As invariantes de código estão em
`src/features/admin/AGENTS.md` (telas) e `lib/AGENTS.md` (a camada de conta);
o porquê de cada tabela está no cabeçalho de `supabase/migrations/0043_finance.sql`.

---

## 1. A decisão que governa tudo: metade já é medida

Antes de escrever qualquer tabela, a pergunta foi **quanto do dinheiro do
Scriba o banco já sabe**. A resposta é: quase todo o que se move sozinho.

| O que | Onde já está | Como vira dinheiro |
|---|---|---|
| Receita de assinatura e pacotes | `coin_transactions` (`subscription_grant`, `topup_pack`) | `lib/finance/measured.ts` casa a quantidade de moedas com `PLANS`/`TOPUP` |
| Custo de IA | `llm_usage_events` × `lib/llm/pricing.ts` | × câmbio de `lib/fx/usd-brl.ts` |
| Taxa de pagamento | - | `stripeFeeCents` de `lib/partners/economics.ts` |
| Comissão de parceiro | `partner_commissions` / `partner_payouts` | direto, em centavos |
| MRR, ARPU, assinantes | `subscriptions` × `PLANS` | mesma conta de `lib/db/admin/metrics.ts` |

**Nada disso é digitado.** Digitar seria criar uma segunda definição de um
número que já existe, e duas definições do mesmo número um dia discordam, a
lição que `lib/db/admin/metrics.ts` já tinha aprendido com as telas de
parceiro.

O que se lança à mão são as despesas que ninguém mede por nós: Vercel,
Supabase, domínio, ferramentas, impostos, marketing, dívidas com plataformas,
e receitas fora do Stripe.

### A armadilha que decorre disso

Lançar "assinaturas de setembro, R$ 5.000" à mão **conta duas vezes**. O
painel avisa: `buildFinanceOverview` devolve um `warnings` que acusa qualquer
mês com receita medida E receita lançada. O aviso aparece antes dos números,
não depois.

### A limitação honesta da receita medida

O crédito de moedas é o único registro DATADO de "entrou dinheiro" que o banco
tem, mas ele guarda moedas, não reais. A conversão usa o preço de TABELA do
plano. Hoje o Scriba não tem cupom nem preço promocional, então tabela e
cobrado coincidem; é coincidência de configuração, não garantia.

O caminho para eliminar isso, quando fizer diferença: gravar `amount_paid` do
invoice numa coluna de `coin_transactions` no momento do fulfill. Não foi feito
agora porque não conserta o passado, o dado não existe lá atrás, só o
futuro.

---

## 2. O modelo de dados

Cinco tabelas (`0043_finance.sql`), e o corte entre elas é conceitual:

```
finance_categories   o vocabulário. Também onde mora "fixo × variável"
finance_recurring    o CONTRATO  ("Vercel, R$ 200, todo mês")
finance_entries      o FATO ou a OBRIGAÇÃO datada
finance_scenarios    as PREMISSAS de uma projeção
finance_settings     saldo em caixa, alíquota, câmbio das projeções
```

### Por que o contrato não é uma coluna do lançamento

Se recorrência fosse um campo de `finance_entries`, "quanto gastamos em
setembro" precisaria expandir templates dentro da mesma tabela que guarda
fatos, e não haveria como registrar "a fatura da Vercel veio R$ 213 este mês".

Separadas, o contrato PREVÊ e o lançamento REALIZA. O `recurring_id` amarra as
duas: **um lançamento vinculado substitui a provisão do contrato no mês dele**,
e é isso que impede o custo de dobrar.

### Por que dívida não é um tipo

Uma dívida é uma despesa com `status <> 'paid'` e `due_date`; um valor a
receber é uma receita na mesma situação. `/admin/financeiro/compromissos` é um
RECORTE da mesma tabela.

Um terceiro `kind` daria três somas para o mesmo dinheiro, a despesa, o
compromisso e o pagamento dele, e a primeira quitação faria as três
discordarem. O pagamento parcial é `paid_cents`, e o que resta é
`amount_cents - paid_cents`: derivado, nunca digitado, pelo mesmo princípio que
faz o saldo de moedas sair do ledger.

**Limitação conhecida:** um pagamento parcial não tem data própria, então ele
não aparece no fluxo de caixa do mês em que foi feito, só a quitação total
aparece, em `settled_at`. Se pagamentos parciais passarem a precisar de
atribuição mensal, o próximo passo é uma tabela `finance_payments`.

### Fixo × variável mora na CATEGORIA

E em nenhum outro lugar. Permitir sobrescrever por lançamento produziria "custo
fixo" somando duas coisas diferentes no mesmo mês. Consequência: trocar a
`nature` de uma categoria reescreve a leitura de todo o histórico, por isso a
mudança tem log próprio, e por isso categoria se **arquiva**, nunca se apaga
(sem categoria, um custo é tratado como variável, e apagar "Infraestrutura"
faria o custo fixo do histórico inteiro despencar sem explicação).

---

## 3. Os dois regimes

O painel mostra os dois, com nomes diferentes, e eles **nunca somam**.

| | Competência | Caixa |
|---|---|---|
| Pergunta | quanto o Scriba custa e rende por mês | quanto entrou e saiu da conta |
| Domínio de R$ 1.200/ano | R$ 100 em cada um dos 12 meses | R$ 1.200 em março, zero nos outros |
| Eixo de data | `competence_date` | `settled_at` |
| Serve para | comparar meses, base da projeção | burn rate, runway |

Misturar os dois é o erro clássico do painel financeiro caseiro: ou o mês da
cobrança anual vira um pico inexplicável, ou o mês seco vira economia que não
existe.

### Realizado × previsto × projetado

| | O que é | Onde vive |
|---|---|---|
| **Realizado** | aconteceu | `status = 'paid'` + a receita medida |
| **Firmado** | obrigação/direito conhecido | `status = 'pending'` |
| **Previsto** | sabemos que deve acontecer, nada firmado | `status = 'planned'` |
| **Projetado** | estimativa sobre premissas | não se guarda, `project()` recalcula |

`planned` fica FORA dos totais do mês e aparece numa linha própria. Projeção
não é lançamento e por isso não tem status: o que se grava em
`finance_scenarios` são as premissas, nunca o resultado. Um resultado guardado
envelheceria em silêncio enquanto a base dele (assinantes, ARPU, custo por
cliente) muda sozinha.

---

## 4. Moedas

Um lançamento guarda o valor na moeda ORIGINAL e o câmbio quando faz sentido:

- **Liquidado → câmbio CONGELADO** (`fx_rate`). Uma despesa em dólar já paga
  custou o que custou; reconvertê-la faria o lucro de julho mudar porque o
  dólar mexeu em setembro.
- **Pendente ou previsto → câmbio VIVO.** Uma dívida vale a cotação de hoje,
  porque é hoje que ela seria quitada.

**Sem cotação, um valor em dólar vale `null`, nunca zero.** Zero soma e some do
total sem avisar, e um total que esconde uma despesa é pior que um total que
se recusa a existir. Toda soma da camada devolve quantos itens ficaram de fora,
e a tela diz.

O câmbio do histórico é o de `lib/fx/usd-brl.ts` (AwesomeAPI, com fallback
manual em cookie, o mesmo de `/admin/usage`). O das PROJEÇÕES é separado, em
`finance_settings.projection_usd_brl`, para uma projeção de doze meses não
mudar de resultado entre dois carregamentos porque o dólar oscilou.

---

## 5. Os indicadores, e por que só estes

A especificação pedia para não adicionar métrica por ser métrica comum de SaaS.
Cada um destes muda uma decisão:

| Indicador | A decisão que ele muda |
|---|---|
| MRR e crescimento | tudo |
| ARPU | o ticket-base da projeção |
| Custo por assinante | se o preço se paga |
| Fatia de IA no custo | onde vale otimizar |
| Custos fixos × variáveis | quanto do custo some se o produto parar |
| Burn rate | o ritmo |
| **Runway** | por quanto tempo o dinheiro dá, a única resposta que muda o que se faz amanhã |
| Margem | a saúde da unidade econômica |

**Ficaram de fora, de propósito:**

- **Churn medido.** Só se sabe `cancel_at_period_end`, que é churn ANUNCIADO,
  não realizado. Publicar isso como "churn" seria um número sistematicamente
  otimista. O churn entra na projeção como PREMISSA, que é honesto.
- **CAC e LTV.** Não há atribuição confiável de gasto de marketing a cadastro.
  Um CAC calculado sobre marketing total ÷ novos clientes seria um número que
  parece preciso e não é.

O **custo por assinante** divide o custo TOTAL do mês, inclusive o que a base
gratuita consome, pelos assinantes pagantes. É deliberado: é o custo que a
base paga precisa cobrir. A tela diz isso.

O **burn rate** ignora o mês corrente. No dia 3 ele tem três dias de custo e
zero de fatura, e entraria como lucro recorde. São os três últimos meses
FECHADOS, e três em vez de um porque um mês com a cobrança anual do domínio não
descreve o ritmo.

---

## 6. A projeção

O que ela **não** é: `receita atual × meses`. Essa conta ignora as duas forças
que movem um SaaS.

```
clientes[n] = clientes[n-1] · (1 + crescimento − churn) + novos_absolutos
receita[n]  = clientes[n] · ticket
lucro[n]    = receita − taxa_pagamento − variável − fixo − imposto
```

Crescimento e churn incidem sobre a base do mês anterior, na mesma composição:
10% de crescimento com 5% de churn não é 5% sobre a base inicial, é 5% ao mês
**composto**, e a diferença em doze meses é o dobro.

Os novos absolutos existem à parte porque nem toda aquisição é proporcional:
uma campanha traz N pessoas, não N%. Com base pequena, o caso do Scriba hoje,
o termo percentual sozinho projeta estagnação eterna, porque 10% de 30 é 3.

### A base é medida; as premissas são digitadas

| Base (medida) | De onde vem |
|---|---|
| clientes | assinaturas vivas |
| ticket | ARPU real |
| custo variável / cliente | custo de IA do último mês fechado ÷ assinantes |
| custo fixo | equivalente mensal das recorrências fixas |
| taxa de pagamento | `stripeFeeCents` sobre o MRR, virado percentual |

| Premissa (digitada) | Onde |
|---|---|
| crescimento, churn, novos/mês, ticket alternativo, fixo extra, alíquota, horizonte | `finance_scenarios` |

É essa separação que faz a projeção valer alguma coisa, e a tela mostra as
duas metades etiquetadas, para ninguém ler "R$ 40 mil no mês 12" como previsão.

**Clientes andam em fração dentro do laço** e só são arredondados na saída.
Arredondar a cada mês trava a projeção de uma base pequena: 30 clientes a 5%
viram 31,5 → 31 → 32,5 → 32, e meio cliente por mês vira um mês inteiro de
receita em doze.

A projeção começa no mês SEGUINTE. O corrente já tem meia realidade dentro
dele, e misturá-la com premissa daria um primeiro mês que não é nem realizado
nem projetado.

### Cenários

Três nascem com a migração (Conservador / Base / Otimista). Três e não um
porque uma projeção única é lida como previsão, lado a lado, elas dizem
sozinhas que o número depende do que se supôs.

A tabela comparativa traz receita e lucro em 6 e 12 meses, clientes no fim,
primeiro mês no lucro, e o mês em que o caixa acabaria. O campo de payback
responde ao "em quanto tempo este investimento se paga?" em cada cenário, e
devolve "além do horizonte" em vez de extrapolar, porque extrapolar seria
projetar sobre projeção.

---

## 7. As telas

```
/admin/financeiro                → Visão geral + evolução mensal
/admin/financeiro/lancamentos    → CRUD com os filtros do §17
/admin/financeiro/recorrentes    → contratos, equivalentes, próxima cobrança
/admin/financeiro/compromissos   → o que devemos e o que temos a receber
/admin/financeiro/projecoes      → base medida, cenários, mês a mês
/admin/financeiro/configuracoes  → categorias, saldo, alíquota, câmbio
```

**Os avisos vêm antes dos números.** Um painel financeiro erra em silêncio:
sem cotação do dólar, sem custo recorrente cadastrado, com a receita contada
duas vezes ou com assinaturas que nunca passaram pelo checkout, o total
continua sendo um número plausível. O sintoma é sempre uma conta boa demais,
que é a que ninguém investiga. É a mesma razão do aviso de modelo sem preço em
`/admin/usage`.

Os avisos implementados hoje (`buildFinanceOverview`):

- sem cotação do dólar com lançamentos em US$;
- valores que não puderam ser convertidos;
- créditos do ledger que não casaram com o catálogo;
- receita lançada à mão sobre mês que já tem receita medida;
- MRR acima de zero e nenhum crédito de assinatura no ledger.

---

## 8. Segurança

As cinco tabelas seguem o molde de `admin_insights` (0034), não o de
`feature_switches`: **RLS ligada, nenhuma policy, nenhum grant** para `anon`
nem para `authenticated`. Sem policy, a tabela é inalcançável pelo PostgREST
com a chave anon, só o `service_role`, atrás de `requireAdmin()`.

Uma policy de SELECT para `authenticated` aqui publicaria margem, dívida e
saldo em caixa do Scriba para qualquer conta cadastrada.

As nove rotas de `/api/admin/finance/*` chamam `requireAdmin()` (404, não 403)
antes de qualquer coisa, aplicam `RATE_LIMITS.admin` e validam o corpo com Zod.
Mutação de dinheiro por admin é logada em `info`, com o `id` de quem fez.

---

## 9. Onde mora cada conta

| Módulo | O que faz | Testado |
|---|---|---|
| `lib/finance/money.ts` | centavos, câmbio, arredondamento, formatação, parse | ✅ |
| `lib/finance/recurrence.ts` | equivalentes, ocorrências, próxima cobrança | ✅ |
| `lib/finance/measured.ts` | ledger → receita; custo de IA por mês | ✅ |
| `lib/finance/aggregate.ts` | visão mensal, compromissos, indicadores, avisos | ✅ |
| `lib/finance/projection.ts` | cenários, payback, entradas medidas | ✅ |
| `lib/domain/finance.ts` | tipos, schemas Zod, rótulos (client-safe) | - |
| `lib/db/admin/finance.ts` | CRUD e o lado medido (service-role) | - |
| `lib/db/admin/finance-overview.ts` | o snapshot que as telas consomem | - |

Os cinco primeiros são **puros e client-safe**: nenhuma página calcula nada, e
cada número é verificável com `npm test` sem banco.

```
npm test          # node --test sobre lib/**/*.test.ts
```

Este é o único test runner do repositório e existe por causa desta camada,
`AGENTS.md` da raiz continua dizendo que não se acrescenta teste sem pedido
para o resto do código.

---

## 10. O que deliberadamente ficou de fora

- **Integração bancária ou com o Stripe para importar lançamentos.** A entrada
  é manual por decisão da especificação; a estrutura suporta automatizar
  depois (é uma escrita a mais em `finance_entries`).
- **Histórico de pagamentos parciais** (`finance_payments`). Ver §2.
- **Valor real cobrado por fatura.** Ver §1.
- **Câmbio histórico.** A série inteira é convertida por uma cotação só, para
  os meses continuarem comparáveis entre si, a alternativa faria a variação
  do dólar aparecer como variação de custo do produto.
- **Centro de custo, rateio por produto, conciliação bancária.** Não há
  segundo produto nem conta separada para ratear.
