# Configuração do Stripe — passo a passo

Guia para ligar a cobrança do zero, sem conta criada. O código já está pronto;
o que falta é criar os objetos no Stripe e colar 5 variáveis de ambiente.

Enquanto as variáveis não existirem, o app **funciona normalmente** — só as
telas de compra respondem "pagamento ainda não está disponível". Nada quebra.

---

## Visão geral do que você vai criar

| No Stripe | Vira esta env var |
|---|---|
| Chave secreta da API | `STRIPE_SECRET_KEY` |
| Product "Pessoal" → Price R$ 19,90/mês | `STRIPE_PRICE_PESSOAL` |
| Product "Estudioso" → Price R$ 44,90/mês | `STRIPE_PRICE_ESTUDIOSO` |
| Product "500 créditos" → Price R$ 10,00 avulso | `STRIPE_PRICE_TOPUP_500` |
| Endpoint de webhook → signing secret | `STRIPE_WEBHOOK_SECRET` |

Mais uma que não vem do Stripe:

| | |
|---|---|
| URL pública do app (ex.: `https://scriba.cc`) | `APP_URL` |

---

## 1. Criar a conta

1. Acesse <https://dashboard.stripe.com/register>.
2. Crie a conta com o seu e-mail. Confirme o e-mail.
3. Na pergunta de país, escolha **Brasil**.

Você cai no dashboard em **modo de teste** (chave "Test mode" ligada no canto
superior direito). Faça tudo abaixo primeiro em modo de teste — nada é cobrado
de verdade e existem cartões falsos para testar.

> ⚠️ **Teste e live são duas contas separadas na prática.** Produtos, preços,
> clientes e webhooks criados num modo **não existem** no outro, e a chave de
> um não enxerga os objetos do outro. Além disso, `stripe listen` só encaminha
> eventos de **teste** — com uma chave live no `.env.dev`, o webhook local
> nunca receberia a confirmação e nenhum crédito entraria.
>
> Confirme no canto superior direito que **Test mode está LIGADO** antes de
> criar qualquer coisa, e que sua chave começa com `sk_test_`.

> Para receber dinheiro de verdade depois, o Stripe pede a ativação da conta:
> CNPJ ou CPF, dados bancários e alguns dados de negócio. Isso pode ficar para
> depois de você testar tudo.

---

## 2. Pegar a chave secreta

1. Menu **Desenvolvedores → Chaves de API** (`/apikeys`).
2. Copie a **Secret key** (começa com `sk_test_...`).

```
STRIPE_SECRET_KEY=sk_test_...
```

> Essa chave dá acesso total à sua conta Stripe. Ela nunca vai para o
> navegador: só é lida em `lib/billing/stripe.ts`, que é server-only.
> Não existe nenhuma chave publicável (`pk_`) neste projeto — o pagamento
> acontece inteiramente no domínio do Stripe.

---

## 3. Criar os produtos e preços

Menu **Catálogo de produtos → Produtos → + Adicionar produto** (`/products`).

### 3.1 Plano Pessoal

- **Nome:** `Scriba Pessoal`
- **Descrição:** `1.000 créditos por mês`
- **Modelo de preços:** Padrão / valor fixo
- **Valor:** `19,90` — moeda **BRL**
- **Cobrança:** **Recorrente**, período **Mensal**
- Salvar.

Na página do produto, na seção de preços, clique nos `...` do preço e em
**Copiar ID do preço**. É um `price_1Abc...`.

```
STRIPE_PRICE_PESSOAL=price_...
```

⚠️ Copie o **ID do preço** (`price_...`), não o do produto (`prod_...`). O
código procura pelo preço.

### 3.2 Plano Estudioso

Mesma coisa:

- **Nome:** `Scriba Estudioso`
- **Descrição:** `2.500 créditos por mês`
- **Valor:** `44,90` BRL, **Recorrente**, **Mensal**

```
STRIPE_PRICE_ESTUDIOSO=price_...
```

### 3.3 Pacote avulso de créditos

- **Nome:** `500 créditos Scriba`
- **Descrição:** `Pacote avulso de créditos, sem assinatura`
- **Valor:** `10,00` BRL
- **Cobrança:** **Único** / *One-off*, **não** recorrente

```
STRIPE_PRICE_TOPUP_500=price_...
```

> ⚠️ **O erro mais fácil de cometer.** O formulário do Stripe vem com
> "Recorrente" pré-selecionado. Se você salvar assim, a compra falha com
> `You specified 'payment' mode but passed a recurring price`.
>
> **Um preço não pode trocar de tipo depois de criado** — é preciso criar um
> novo. Na página do produto: **+ Adicionar outro preço** → **Único / One-off**
> → `10,00` BRL → salvar → copiar o novo `price_...` para
> `STRIPE_PRICE_TOPUP_500` → reiniciar o `npm run dev`. Opcionalmente,
> arquive o preço recorrente antigo pelos `...` para não confundir depois.
>
> O inverso também vale: os planos Pessoal e Estudioso **têm** que ser
> recorrentes mensais.

O servidor confere o tipo do preço antes de abrir o checkout e, se estiver
errado, escreve no log qual variável consertar — em vez de deixar o erro
genérico do Stripe chegar na tela.

O usuário pode comprar mais de um pacote de uma vez (até 20): a quantidade vai
como `quantity` na linha do checkout e o Stripe multiplica o valor sozinho.

> **Importante:** o valor cobrado é sempre o que está no Stripe. Os números em
> `lib/billing/plans.ts` (`priceCents`) são só a legenda mostrada na tela. Se
> você mudar o preço no Stripe, atualize lá também — senão a tela mente.
> Já a **quantidade de créditos** vem do código (`coins`), e o webhook só
> credita para preços que estão nas variáveis acima. Um preço criado no
> dashboard e não configurado aqui **não gera crédito nenhum**.

---

## 4. Ativar o portal de faturamento

É a tela onde o usuário troca de plano, atualiza o cartão e cancela.

1. Menu **Configurações → Faturamento → Portal do cliente**
   (`/settings/billing/portal`).
2. Ative **Permitir que os clientes atualizem assinaturas** e marque os
   produtos Pessoal e Estudioso como opções de troca.
3. Ative **Permitir que os clientes cancelem assinaturas**.
4. Ative **Atualizar métodos de pagamento** e **Histórico de faturas**.
5. Salvar.

Sem esse passo, o botão "Gerenciar assinatura" dá erro.

---

## 5. Criar o webhook

É o passo que faz os créditos entrarem. Sem ele, o pagamento acontece e nada
é creditado.

1. Menu **Desenvolvedores → Webhooks → + Adicionar destino** (`/webhooks`).
2. **URL do endpoint:** `https://SEU-DOMINIO/api/stripe/webhook`
   (em produção: `https://scriba.cc/api/stripe/webhook`)
3. **Eventos a escutar** — selecione exatamente estes 8:
   - `invoice.paid`
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `charge.dispute.created`
4. Criar. Na página do endpoint, clique em **Revelar** no *Signing secret*.
   É um `whsec_...`.

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

> Esse segredo é o que impede alguém de dar um POST forjado em
> `/api/stripe/webhook` dizendo "fulano pagou". Cada requisição é verificada
> com HMAC contra o corpo cru antes de qualquer leitura.

### Testando o webhook localmente

O Stripe não alcança `localhost`. Instale o Stripe CLI
(<https://docs.stripe.com/stripe-cli>), faça `stripe login`, e rode num
terminal separado (é um processo que fica aberto):

```bash
stripe listen   --api-key "$(grep '^STRIPE_SECRET_KEY=' .env.dev | cut -d= -f2-)"   --forward-to localhost:3000/api/stripe/webhook
```

O comando imprime um `whsec_...` **diferente** de qualquer outro, só para o
encaminhamento local. É ESSE que vai no `.env.dev`.

Ou, mais simples, o atalho que já faz tudo isso:

```bash
npm run stripe:listen              # porta 3000
npm run stripe:listen -- --port 3001
npm run stripe:listen -- --write   # grava o whsec no .env.dev
```

Ele fixa o ambiente pela chave do `.env.dev`, recusa chave live, e compara o
`whsec_` impresso pelo CLI com o do arquivo — avisando em destaque se
divergirem.

> **Por que `--api-key`, e não `stripe listen` puro?** O CLI atual abre em
> contexto **live** e responde
> `You're in live mode. Add --live to run the command, or run 'stripe switch
> context' to select a sandbox`.
>
> Não siga a sugestão do `switch context`: ela lista **sandboxes**, que no
> modelo novo do Stripe são ambientes *separados* do test mode clássico — cada
> um com seus próprios produtos, preços e chaves. Se a sua conta usa o test
> mode clássico (os preços criados com a `sk_test_` voltam com
> `livemode: false`), escolher um sandbox leva a um ambiente vazio e o erro
> vira "preço não existe nesta conta/modo".
>
> `--api-key` fixa o CLI exatamente no ambiente da chave que a aplicação usa,
> sem ambiguidade. O `$(grep ...)` evita a chave secreta cair no histórico do
> shell.

---

## 6. Colar as variáveis

O projeto tem dois arquivos de ambiente, `.env.dev` e `.env.prod`, escolhidos
explicitamente pelo script de npm (`npm run dev` / `npm run prod`). Os valores
de **teste** vão no primeiro, os de **live** no segundo — e nunca se misturam,
porque os IDs de preço de um modo não existem no outro. Ver `docs/ambientes.md`.

### Local — `.env.dev`

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PESSOAL=price_...
STRIPE_PRICE_ESTUDIOSO=price_...
STRIPE_PRICE_TOPUP_500=price_...
APP_URL=http://localhost:3000
```

### Produção — Vercel

**Project → Settings → Environment Variables**, ambiente **Production**, as
mesmas 5 chaves (com valores de modo **live**, não de teste) mais:

```
APP_URL=https://scriba.cc
```

`APP_URL` tem fallback automático (`scriba.cc` em produção, `VERCEL_URL` em
preview, `localhost:3000` em dev), então só é obrigatória se o domínio mudar.

Depois de salvar, **faça um redeploy** — variáveis novas só valem em builds
novos.

---

## 7. Testar de ponta a ponta

Com tudo em modo de teste:

1. Entre no app, clique no **chip de moedas** no topo.
2. Compre 1 pacote de 500 créditos.
3. Na tela do Stripe use o cartão de teste:
   - Número `4242 4242 4242 4242`
   - Validade: qualquer data futura (ex.: `12/34`)
   - CVC: qualquer 3 dígitos
   - Nome/CEP: qualquer coisa
4. Você volta para `/billing/retorno`. Em poucos segundos a tela troca para
   "Créditos adicionados!" e o saldo sobe.
5. Repita com um plano para conferir a assinatura, e confira em
   `/profile` se o card mostra o plano e a data da próxima recarga.

**Cartões de teste úteis** (<https://docs.stripe.com/testing>):

| Cenário | Número |
|---|---|
| Sucesso | `4242 4242 4242 4242` |
| Recusado | `4000 0000 0000 0002` |
| Exige autenticação (3DS) | `4000 0025 0000 3155` |

### Testar o congelamento por falta de crédito

1. No Supabase, `update profiles set coin_balance = 5 where id = '<seu id>';`
2. Comece uma gravação em Modo Estudo (5 créditos/min).
3. No primeiro minuto o saldo zera e a gravação **congela** com o overlay
   "Seus créditos acabaram" — nada é perdido.
4. Compre créditos pelo botão do overlay. Ao voltar para a aba, a trava cai
   sozinha e o botão "Retomar gravação" reaparece.

---

## 8. Ir para produção (quando quiser cobrar de verdade)

1. Complete a ativação da conta no Stripe (dados fiscais e bancários).
2. Desligue o **Test mode** no dashboard.
3. **Refaça os passos 2, 3, 4 e 5 em modo live** — produtos, preços e webhooks
   de teste **não** existem em live. Você terá novos `sk_live_...`,
   `price_...` e `whsec_...`.
4. Coloque esses valores nas variáveis de **Production** da Vercel e faça
   redeploy.
5. Faça uma compra real de R$ 10 no seu próprio cartão para validar, e
   estorne pelo dashboard (o estorno devolve os créditos automaticamente).

---

## Coisas que confundem

**`charges_enabled: false` é normal antes da ativação, e vem `false` nos dois
modos.** Ele descreve a conta real: só impede cobranças de verdade. O modo de
teste funciona normalmente enquanto a análise do Stripe não sai — é por isso
que o `stripe-doctor` trata isso como problema só com chave live, e confirma o
resto criando uma sessão de sondagem em vez de deduzir da flag.

**`APP_URL` decide para onde o Checkout devolve o usuário.** Em
desenvolvimento ela precisa ser `http://localhost:3000`; apontando para
produção, você paga no localhost e cai no site publicado.

**"Paguei e o crédito não entrou" tem duas causas, e o sintoma é idêntico:**
pagamento aprovado no Stripe e tabela `stripe_events` VAZIA.

1. **O `stripe listen` não estava rodando.** É a causa mais comum e a mais
   fácil de não perceber: o CLI aborta na largada (contexto live, sessão
   expirada, porta errada) e a janela fica lá parada com a mensagem de erro
   enquanto você testa na outra aba. Nada é encaminhado. Use
   `npm run stripe:listen`, que falha alto em vez de silenciosamente.
2. **O `whsec_` errado.** Existem TRÊS e nada no formato os distingue: o que o
   `stripe listen` imprime, o de um endpoint de teste no dashboard e o do
   endpoint live. Com o errado, o webhook devolve `400` e o resultado é o
   mesmo. `npm run stripe:listen` compara os dois e avisa.

Para separar as duas: se a janela do `stripe listen` mostra a linha do evento
(`checkout.session.completed [400]`), é o caso 2. Se não mostra nada, é o 1.

**Desde a reconciliação, nenhum dos dois deveria custar créditos ao usuário.**
Ao voltar do Checkout, a tela de retorno chama `POST /api/billing/reconcile`,
que confirma a sessão direto com o Stripe e credita se o webhook não creditou.
Se mesmo assim o saldo não subir, o problema não é a entrega do evento —
procure `[billing/reconcile]` no log do servidor.

## As três linhas de defesa do crédito

O mesmo pagamento pode ser creditado por quatro pontos de entrada — todos
idempotentes entre si (o `external_ref` UNIQUE garante crédito único):

| Camada | Latência | Cobre |
|---|---|---|
| Webhook | segundos | tudo (caminho normal) |
| Reconciliação no retorno do checkout | segundos | compras, se o webhook falhar |
| Check preguiçoso no resumo de cobrança | minutos | renovações, quando o usuário abre o diálogo de moedas |
| Varredura diária (`/api/billing/sweep`, Vercel Cron) | até 1 dia | qualquer coisa que sobrou |

Para ativar a varredura em produção:

1. Gere um segredo: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
2. Na Vercel: *Settings → Environment Variables* → `CRON_SECRET` = o valor, ambiente Production.
3. O cron já está declarado em `vercel.json` (diário, 6h30 UTC). A Vercel envia
   o `CRON_SECRET` como `Authorization: Bearer ...` sozinha — nada mais a fazer.
4. No plano Hobby da Vercel, crons diários são permitidos; o horário pode variar ±1h.

No log, `[billing:sweep] pass complete` com `coinsRecovered: 0` é o normal.
Um valor > 0 significa que as camadas mais rápidas falharam naquele dia —
o crédito foi entregue mesmo assim, mas vale investigar o porquê.

## Diagnóstico rápido

```bash
npm run stripe:doctor
```

Só leitura — não cria nem cobra nada. Confere de uma vez: modo da chave,
se a conta pode cobrar (e o que falta), métodos de pagamento ligados, e se
cada `price_...` existe no modo certo com o tipo certo. É o primeiro comando
a rodar quando um checkout falhar, e de novo ao virar a chave para live.

## Onde olhar quando algo der errado

Logs do servidor, todos prefixados:

| Log | Significa |
|---|---|
| `[stripe/webhook] signature verification failed` | `STRIPE_WEBHOOK_SECRET` errado (o caso comum: usar o do endpoint live com o `stripe listen`), ou alguém tentando forjar evento |
| **nenhum log de webhook** depois de um pagamento aprovado | Ninguém encaminhou o evento — o `stripe listen` não está de pé. Rode `npm run stripe:listen` |
| `[stripe/webhook] unknown price ... nothing credited` | O `price_...` pago não bate com nenhuma env var |
| `[stripe/webhook] no user for customer` | O `stripe_customer_id` não está vinculado a nenhum perfil |
| `[stripe/webhook] duplicate delivery ignored` | Normal — reentrega do Stripe sendo descartada |
| `[stripe/webhook] coins clawed back` | Refund ou chargeback estornou créditos |
| `[billing/checkout] STRIPE_PRICE_... points to a recurring price but a one_time price is required` | O pacote avulso foi criado como recorrente — ver 3.3 |
| `[billing/checkout] STRIPE_PRICE_... points to an ARCHIVED price` | O preço foi arquivado no dashboard; crie outro e atualize a variável |
| `[billing/checkout] a conta do Stripe não tem método de pagamento disponível` | Com chave **live**: a conta ainda não foi ativada (`charges_enabled: false`) ou não tem método ligado. Com chave de **teste** isso não acontece — rode `npm run stripe:doctor` |
| `[billing/checkout] ...` | Falha ao abrir o checkout |

No dashboard do Stripe, **Desenvolvedores → Webhooks → seu endpoint** mostra
cada entrega, o payload e a resposta do nosso servidor, com botão de reenviar.

Auditoria no banco: a tabela `coin_transactions` é um livro-razão completo —
todo crédito e todo débito, com `external_ref` apontando para a fatura ou
sessão de checkout que o originou.
