# Moedas e Stripe — invariantes que não se negociam

Crédito ("moeda") é dinheiro. Cada regra abaixo existe para que nenhuma
mudança futura reabra um caminho de crédito grátis, e várias delas já foram um
bug possível. Migrações: `0026_billing_stripe.sql` (planos, assinaturas,
`grant_coins`), `0027_coin_clawback.sql` e `0028_clawback_row_lock.sql`
(estorno).

Guia de configuração, chaves e armadilhas conhecidas: `docs/stripe-setup.md`.

## Os módulos

```
lib/billing/plans.ts     catálogo CLIENT-SAFE: nome, moedas, preço de tela
lib/billing/catalog.ts   server-only: chave↔Price ID e Price ID↔moedas
lib/billing/stripe.ts    o client (null se não configurado) + helpers
lib/billing/customer.ts  getOrCreateCustomer — nunca aceita id do request
lib/billing/fulfill.ts   O ÚNICO lugar que credita
lib/billing/sweep.ts     varredura de recuperação
lib/db/billing.ts        assinaturas, grantCoins, clawbackCoins, idempotência
lib/db/coins.ts          chargeCoins — o DÉBITO
lib/coins/pricing.ts     client-safe: quanto cada ação CUSTA
```

## Todo crédito passa por `fulfill.ts` — sem exceção

Quatro pontos de entrada, três linhas de defesa em ordem de latência:

1. **`POST /api/stripe/webhook`** — segundos, o caminho normal.
2. **`POST /api/billing/reconcile`** — no retorno do checkout, cobre compras
   cujo webhook falhou.
3. **Check preguiçoso em `GET /api/billing/summary`** — assinatura viva com
   `current_period_end` vencido dispara conferência no Stripe (cooldown de
   15min), cobrindo renovações perdidas exatamente quando o usuário estranha
   o saldo.
4. **`GET /api/billing/sweep`** — cron diário (`vercel.json`), varre pagamentos
   recentes no Stripe e credita o que não estiver no ledger. Guardado por
   `CRON_SECRET` (comparação em tempo constante) e público no proxy como o
   webhook. `coinsRecovered > 0` numa passada = incidente nas camadas de cima.

Tudo idempotente pelo `external_ref` UNIQUE: os quatro caminhos sobre o mesmo
pagamento creditam UMA vez. **Um quinto caminho, se surgir, também usa
`fulfill.ts`** — duas implementações de "quanto creditar" um dia divergem.

## O que o cliente pode dizer

**O front nunca envia valor nem quantidade de moedas.** O corpo aceito por
`/api/billing/checkout` é uma chave de plano (`pessoal` / `estudioso`) ou o
pacote avulso com uma quantidade inteira clampeada. Preço vem do Price object
no Stripe; moedas vêm de `entitlementForPrice(priceId)` em `catalog.ts`. **Um
Price fora do catálogo credita zero.**

**A intenção de plano sobrevive ao login.** O CTA da landing aponta para
`/sign-in?next=%2Fbilling%2Fassinar%3Fplan%3D<plano>`, e `/billing/assinar`
(dentro de `(app)`, logo protegida) abre o Checkout. A chave viaja pela URL e
isso é seguro — ela só ENDEREÇA. Trocar `?plan=` muda qual plano é oferecido,
nunca quanto custa. Sobre o `?next=`, ver `app/AGENTS.md`.

**A reconciliação não afrouxa nada.** Ela recebe um `cs_...`, mas o id só
endereça: a sessão é buscada na API do Stripe, o `customer` dela tem de bater
com o `stripe_customer_id` de quem está autenticado (senão 403), o pagamento
tem de estar `paid`, e o `external_ref` UNIQUE faz webhook e reconciliação
juntos creditarem uma vez só. A página `/billing/retorno` segue decorativa:
forjar `?status=sucesso` não produz crédito nenhum.

**O dono do crédito vem do vínculo que NÓS gravamos**,
`profiles.stripe_customer_id`, resolvido por `findUserIdByCustomerId`. Nunca
de metadata e nunca do corpo do request.

## O banco não confia no cliente

- **`grant_coins` e `clawback_coins` têm EXECUTE revogado de `anon` e
  `authenticated`.** Só `service_role` chama. Verificado: com o anon key a RPC
  devolve 42501.
- **`profiles` tem GRANT por COLUNA.** `authenticated` só escreve
  `display_name`, `avatar_url` e `email`. `coin_balance`,
  `stripe_customer_id`, `role` e `is_active` estão fora do alcance do cliente
  — RLS não restringe coluna, GRANT sim. Antes disso, um usuário com o anon
  key podia dar `update profiles set coin_balance = 999999 where id = auth.uid()`.
- **Nunca escreva em `coin_balance` diretamente.** Todo crédito é
  `grant_coins`, todo débito é `chargeCoins`.

## Idempotência e ordem de eventos

Duas camadas: `stripe_events` (PK = id do evento) descarta reentrega;
`coin_transactions.external_ref` (UNIQUE) impede crédito duplo mesmo vindo de
eventos diferentes. Falha depois do claim → `releaseStripeEvent` + 5xx, para o
Stripe reentregar.

**Assinatura credita em `invoice.paid`**, não em `checkout.session.completed`
(que dispara com pagamento pendente). Avulso exige `payment_status === "paid"`,
e as linhas são relidas da API do Stripe, não do payload.

**O espelho `subscriptions` se cura em três pontos** (webhook, reconciliação e
o guard do checkout), sempre via `syncSubscriptionState`, e sempre a partir de
uma busca FRESCA na API — nunca do payload de um evento, porque o Stripe não
garante ordem de entrega e um `updated` atrasado sobrescreveria estado novo. O
guard anti-cobrança-dupla do checkout NUNCA confia só no espelho local: antes
de criar assinatura, ele confere no Stripe se já existe uma viva.

**Refund e chargeback estornam** (`charge.refunded`,
`charge.dispute.created`) via `clawback_coins`, que nunca deixa o saldo
negativo e loga em `warn` quando os créditos já tinham sido gastos.

## Preço de tela

`plans.ts` é a fonte única de nome, preço e créditos — lido pelo diálogo de
compra, pelo `/profile` E pelos cards de `/#planos` na landing. A landing não
tem números próprios: antes disso ela anunciava 2.000/5.000/100 créditos
contra os 1.000/2.500/50 reais, e preço de tela errado é promessa quebrada no
checkout.

## O que o usuário GASTA

`lib/coins/pricing.ts` (client-safe, espelhado pela migração) governa só o
gasto. Gravação é cobrada por minuto INICIADO, tickada do cliente a cada 60s;
aprofundar e reprocessar são cobranças únicas dentro da rota. O cliente nunca
envia valor: manda um `reason` de `CHARGE_REASONS` e o servidor resolve o
custo em `COIN_COST_BY_REASON`.

`COIN_RING_REFERENCE` (300) não é o brinde de cadastro (50) de propósito: com
um plano que enche a conta com 1.000+, ancorar o medidor em 50 o deixaria
cravado em 100% para sempre.

O que acontece quando o saldo acaba NO MEIO de uma gravação está em
`src/features/session/AGENTS.md` — a captura congela, não encerra.

## Comissão de parceiro

Ela nasce DENTRO de `fulfill.ts`, no `creditInvoice`. O porquê e as demais
regras estão em `src/features/partners/AGENTS.md`.

## Rotas e proxy

`/api/stripe` está na allowlist do `proxy.ts` porque o Stripe chega sem
cookie; a rota se defende sozinha verificando a assinatura HMAC. Ser pública é
requisito, não descuido. `/api/billing/sweep` segue o mesmo padrão com o
`CRON_SECRET`. Não remova nenhuma das duas.

Sem `STRIPE_SECRET_KEY` configurada, as rotas de billing respondem 503
`billing_unavailable` — o app sobe normalmente. Diagnóstico:
`npm run stripe:doctor`.
