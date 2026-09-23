# Créditos na tela: o número que assusta

> **Status: implementado**, menos a §7 — nada dali existe, e é para continuar
> assim. Nasceu junto com o preço
> do Biblo ([`biblo-implementacao.md`](./biblo-implementacao.md) §1.2) e é
> metade da mesma decisão: **cobrar por mensagem só é aceitável se o saldo
> deixar de ser um número descendo na barra do app.**

---

## 1. O problema, em uma frase

**O chip do saldo mostra um número absoluto que só anda para baixo, e isso
ensina a pessoa a usar menos o produto.**

Não é uma suspeita de usabilidade: é o que a mecânica faz. Toda ação do app
subtrai daquele odômetro, nada o soma até a renovação, e quem tem 1.000 créditos
no dia 3 vê 740 no dia 12. A leitura correta daquele movimento é *"estou usando
o que eu paguei"*. A leitura que a cabeça faz é *"está acabando"*.

Para quem **não assina**, esse medo é informação verdadeira: 50 créditos são
tudo o que existe, ninguém vai repor, e ver o número cair é exatamente o que
precisa acontecer. **Para quem assina, é mentira** — aquilo volta todo mês, e
ainda acumula (`PLANS[*].coins`, "créditos acumulam de um mês para o outro").

## 2. E o anel já está quebrado para quem assina

`CoinBalance` desenha um anel dourado cheio na proporção `balance /
COIN_RING_REFERENCE`, com `COIN_RING_REFERENCE = 300`. O comentário da constante
em `features/coins/pricing.ts` já admite o problema:

> *"Deliberadamente NÃO o grant de cadastro: como um plano enche a conta a
> 1.000+ créditos, ancorar o medidor em 50 o deixaria em 100% para sempre."*

Só que 1.000 e 2.500 também deixam. **Para todo assinante o anel está em 100%
desde o primeiro dia e nunca sai de lá** — ele é um enfeite dourado que não
informa nada, ao lado de um número que informa a coisa errada. Os dois elementos
do chip estão com defeito para o público que paga.

## 3. A decisão

**O número absoluto é a verdade de quem NÃO renova. A porcentagem é a verdade
de quem renova.**

| | conta gratuita | assinante |
|---|---|---|
| anel | saldo / `COIN_RING_REFERENCE`, como hoje | **crédito do mês restante** |
| número | o saldo, como hoje | **nenhum** |
| ao tocar | `BillingDialog`, como hoje | os detalhes da §5 |

Não muda nada para quem não assina, e é de propósito: ali o número é a
informação certa, e escondê-lo seria esconder o que a pessoa precisa saber para
decidir se grava o culto de domingo.

### Por que nenhum número para o assinante

Porque **não há nada que ele possa fazer com o número**, e é isso que separa
informação de ansiedade. "Faltam 740" não muda nenhuma decisão de quem tem
renovação marcada — mas cobra um cálculo ("740 dá para quantas gravações?") toda
vez que passa pelo campo de visão.

**O número volta quando ele passa a importar**, e aí ele volta inteiro: anel
âmbar e o saldo escrito, quando o crédito do mês acabou E a reserva acumulada
está abaixo de uma gravação de meia hora (150 moedas). Aí a informação é
acionável, e é dever nosso dá-la sem rodeio.

### De que "mês" estamos falando: a última recarga, não o Stripe

O ciclo começa **no instante em que a franquia foi creditada** — e esse instante
já está gravado, no lugar mais óbvio possível:

```sql
-- o começo do ciclo E o tamanho da franquia, na mesma linha
select created_at, amount
  from coin_transactions
 where user_id = $1 and reason = 'subscription_grant'
 order by created_at desc
 limit 1;

-- o gasto desde então
select coalesce(-sum(amount), 0)
  from coin_transactions
 where user_id = $1 and amount < 0 and created_at >= $2;
```

`subscription_grant` é o motivo que `features/billing/server/fulfill.ts` escreve
a cada fatura paga do plano (`creditInvoice`), e o índice
`coin_transactions (user_id, created_at desc)` da migração 0017 serve as duas
consultas.

**Isto substitui a coluna `current_period_start` que este documento pedia**, e
não é só economia de migração — é mais correto:

- **`past_due` continua ativo no produto** (`ACTIVE_SUBSCRIPTION_STATUSES`
  inclui, e de propósito: o Stripe ainda está tentando cobrar e ninguém deve
  perder acesso no primeiro retry falho). Nesse estado o período do Stripe VIRA,
  mas a recarga não acontece. Com a data do Stripe, o anel encheria sozinho e
  diria "0% usado" a quem não recebeu crédito nenhum. Com a última recarga, a
  janela simplesmente não avança, e o número continua verdadeiro.
- **A franquia vem do `amount` daquela mesma linha**, não de
  `PLANS[plano].coins`. É o que foi REALMENTE creditado, então proração, a
  quantidade clampeada do `creditInvoice` e qualquer mudança futura de plano
  entram certas sem o cálculo precisar saber que elas existem.
- **Troca de plano no meio do mês** gera uma fatura `subscription_update` que
  credita (`GRANTING_BILLING_REASONS`): novo crédito, novo ciclo. Que é o
  comportamento certo — a pessoa acabou de receber moedas.
- **A recarga atrasada que o `sweep` conserta** (`lazySubscriptionCheck`) move o
  começo do ciclo para quando o dinheiro de fato chegou, não para quando ele
  deveria ter chegado.
- **Zero mudança no webhook, zero migração, zero backfill.** A conta funciona
  para todo assinante que existe hoje, retroativamente, porque o dado sempre
  esteve lá.

**Quem nunca teve um `subscription_grant` cai no modo da conta gratuita** — sem
linha, sem ciclo, e o saldo absoluto volta a ser a informação certa. É a mesma
regra da §3 escrita de outro jeito, e ela cobre de graça o assinante cuja
primeira fatura ainda não caiu.

```
crédito do mês restante = grant − gasto desde a recarga
       o anel = clamp(0, 1, isso / grant)
```

**A base é a FRANQUIA, não o saldo total**, e isso importa quando há reserva
acumulada. Um assinante com 3.400 créditos que gastou 280 viu 8% do saldo ir
embora — um número tão pequeno que não diz nada. O que ele quer saber é se está
vivendo dentro do plano, e a resposta é "usou 280 dos 1.000 do mês". Passar de
100% não é erro nem alarme: é o mês em que se usou mais do que o plano dá, e a
reserva existe exatamente para isso.

**Pacote avulso comprado no meio do ciclo (`topup_pack`) não mexe no anel**, e
está certo: ele é crédito, não gasto, e entra na reserva. Comprar um pacote não
deve "devolver" o mês — o mês é a franquia, e ela é o que ela é.

## 4. O que aparece no chip

```
┌───────────────────┐        ┌───────────────────┐
│  ◕  Pessoal       │        │  ◔  740           │   ← gratuito: como hoje
└───────────────────┘        └───────────────────┘
   assinante: o anel
   e o nome do plano
```

O rótulo é **o nome do plano**, não um número e não uma palavra nova. Ele diz a
coisa que o assinante quer confirmar de relance ("estou no Pessoal, está tudo
certo"), ocupa o espaço que o odômetro deixou, e transforma o chip de um
medidor de combustível num crachá.

**O odômetro animado não morre**, continua em uso na conta gratuita — e é ali
que ele sempre fez sentido, porque é ali que cada moeda conta.

## 5. Os detalhes, quando se toca

O `BillingDialog` já é o que abre ao tocar no chip. Ele ganha, no topo, o que o
chip parou de dizer:

> **Plano Pessoal** · renova em 3 de outubro
> Você usou **280 dos 1.000 créditos** deste mês.
> `▓▓▓░░░░░░░` 28%
> Reserva acumulada: 2.400 créditos.

Três regras para esse bloco:

1. **O número real está sempre aqui.** Esconder no chip é uma decisão sobre
   ATENÇÃO, não sobre transparência; quem procura, acha, e acha em dois toques.
2. **"Reserva acumulada" e não "saldo"**, porque é o que ela é: o que sobrou dos
   meses anteriores. A palavra faz o trabalho de dizer "isto aqui é uma folga,
   não é o seu limite".
3. **Nada de "você economizou X" nem de comparação com o mês passado.** Isso
   transforma o uso do produto numa pontuação, e a pontuação puxa para baixo: a
   melhor nota é sempre a de quem não usou.

## 6. Onde isto toca o código

**Nenhuma migração, e nenhuma linha no webhook** — ver §3.

| arquivo | o quê |
|---|---|
| `lib/db/coins.ts` | `getCycleUsage()`: as duas consultas da §3 |
| `app/api/coins/balance/route.ts` | devolve o ciclo JUNTO com o saldo |
| `app/api/billing/summary/route.ts` | o mesmo, para o diálogo |
| `features/billing/plans.ts` | `BillingSummary.cycle` |
| `features/coins/store.ts` + `CoinsSync.tsx` | o ciclo na store, semeado pelo layout |
| `features/coins/components/CoinBalance.tsx` | os dois modos da §3 |
| `features/coins/pricing.ts` | `COIN_RING_REFERENCE` só vale para conta gratuita |
| `features/billing/components/BillingDialog.tsx` | o bloco da §5 |
| `app/(app)/(shell)/layout.tsx` | lê plano e ciclo, e desce os dois |
| `app/(app)/(shell)/profile/page.tsx` | a mesma regra na pastilha do perfil |

**O chip do header não ganhou requisição nenhuma.** O layout de `(shell)` já lia
o saldo no servidor; passou a ler o ciclo na mesma leva e a semeá-lo pelo
`CoinsSync`. E o ciclo viaja no MESMO `GET /api/coins/balance` que a store já
chama para ressincronizar — os dois envelhecem pelo mesmo débito, e buscá-los
em rotas separadas faria o anel e o número discordarem por um instante a cada
gasto.

## 7. O que fica de fora

- **Projeção** ("neste ritmo seus créditos duram até o dia 24"). É a ansiedade
  de volta, agora com data marcada.
- **Alerta por e-mail de saldo baixo.** Outro assunto, e ele tem um custo de
  incômodo que precisa ser decidido sozinho.
- **Mudar o preço de qualquer ação.** Este documento é sobre COMO o saldo
  aparece, e nada aqui altera um débito.
- **Esconder o custo de uma ação antes dela acontecer.** O `CoinCost` que aparece
  no botão de gravar, importar e aprofundar continua igual: dizer o preço ANTES
  de alguém escolher é o oposto de um odômetro passivo no canto da tela, e é o
  que mantém a transparência de pé mesmo com o saldo escondido.

## 8. Por que isto anda junto com o Biblo

Duas moedas por mensagem são o preço mais barato do produto e, ainda assim, o
único que a pessoa pagaria **enquanto pensa**. Gravar é uma decisão por semana;
conversar são quarenta decisões numa tarde. Com o odômetro de hoje na barra,
cada pergunta teria um número piscando em resposta, e a feature que existe para
a pessoa se demorar no texto viraria a que ensina a não perguntar.

Por isso os dois entram na mesma entrega (passo 11 da §12 de
`biblo-implementacao.md`), e não em ondas separadas.
