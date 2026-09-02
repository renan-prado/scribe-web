# Programa de Parceiros — plano de execução

Regras de negócio em [`parceiros.md`](./parceiros.md). Este documento é o
plano técnico: o que construir, em que ordem, e onde encostar no código que
já existe.

Branch: `feat/parceiros`. **Fases 0 a 7 entregues** — o que cada uma resolveu
está no corpo do commit correspondente. As invariantes que precisam sobreviver
a refactors foram promovidas para o `AGENTS.md`.

---

## Princípios que guiam o desenho

1. **Comissão é dinheiro, logo é ledger.** Vale o mesmo rigor de
   `coin_transactions`: linha append-only, `external_ref` UNIQUE, saldo
   derivado por `SUM()`, nunca um contador incrementado.
2. **A comissão nasce dentro de `lib/billing/fulfill.ts`.** Os quatro caminhos
   de crédito (webhook, reconcile, summary, sweep) já convergem lá. Pendurar a
   comissão em qualquer outro lugar significaria que uma compra creditada pelo
   sweep não geraria comissão.
3. **Nada de Stripe novo.** A atribuição é 100% nossa (cookie + código no
   cadastro). Nenhum Coupon, nenhum Promotion Code, nenhuma mudança em
   `app/api/billing/checkout/route.ts`.
4. **A landing page continua estática.** Nenhuma leitura de cookie em
   `app/page.tsx`. O link de parceiro é uma rota própria que redireciona.
5. **O parceiro nunca vê uma pessoa.** Todas as consultas do painel devolvem
   agregados. Não existe endpoint que liste indicados.

---

## Fase 0 — Migração `0029_partners.sql`

### Tabelas

```
partners
  id                    uuid pk
  user_id               uuid null references auth.users  -- null até o 1º login
  invited_email         text not null unique             -- e-mail do convite
  slug                  text not null unique             -- o /r/<slug> e o código
  display_name          text not null
  socials               jsonb   -- {instagram, tiktok, youtube}
  doc                   text    -- CPF/CNPJ
  pix_key               text
  commission_rate_bps   int not null default 3000        -- 30,00%, editável por parceiro
  signup_bonus_coins    int not null default 150
  bonus_budget_coins    int null                         -- teto opcional
  status                text not null default 'active'   -- active | suspended
  created_at, updated_at

partner_clicks                        -- rollup diário, não evento cru
  partner_id, day  (pk composta)
  clicks int, uniques int

partner_commissions
  id                    uuid pk
  partner_id            uuid not null
  referred_user_id      uuid not null UNIQUE   -- a regra "1x por pessoa"
  external_ref          text not null unique   -- 'commission:user:<uid>'
  stripe_invoice_id     text
  plan                  text
  gross_cents           int not null
  commission_cents      int not null           -- congelado no momento
  rate_bps              int not null           -- taxa vigente, para auditoria
  status                text not null          -- pending|available|paid|reversed
  available_at          timestamptz not null   -- paid_at + 30d
  payout_id             uuid null references partner_payouts
  created_at

partner_payouts
  id, partner_id, period (date), amount_cents, paid_at, note, created_at
```

`referred_user_id UNIQUE` é o coração da regra "uma comissão por pessoa na
vida". Não precisa de `if` no código: cancelar e reassinar seis meses depois
colide na constraint e não credita. Mesma filosofia do `external_ref`.

`commission_cents` e `rate_bps` são **congelados na linha**. Mudar a taxa de um
parceiro amanhã não pode reescrever o que ele já ganhou.

### Colunas em `profiles`

```
partner_id             uuid null references partners
partner_attributed_at  timestamptz null
attribution_source     text null      -- 'link' | 'code'
```

⚠️ `profiles` tem **GRANT por coluna** (ver AGENTS.md). As três colunas novas
ficam **fora** do alcance de `authenticated` — senão o usuário troca o próprio
parceiro usando o anon key.

### Funções

**`attach_partner(p_user_id, p_slug) → text`** — SECURITY DEFINER, atômica.
Faz tudo o que o vínculo precisa em uma ida ao banco:

1. `select ... for update` no profile;
2. se `partner_id` não é null → retorna `already_attributed`;
3. se o usuário foi criado há mais de N minutos → `not_new` (impede que um
   usuário antigo clicando num link seja atribuído e ganhe bônus retroativo —
   buraco fácil de deixar aberto);
4. resolve o slug para um parceiro `active`; se não achar → `unknown_slug`;
5. se `partner.user_id = p_user_id` → `self_referral`;
6. se `bonus_budget_coins` estourado → vincula, mas **sem** bônus;
7. grava o vínculo e chama `grant_coins(..., 'partner_bonus', 'partner-bonus:<uid>')`;
8. retorna `ok`.

**`record_partner_click(p_slug, p_unique bool)`** — SECURITY DEFINER, um
`insert ... on conflict do update` no rollup diário. Sem tabela de evento cru:
o volume não justifica e o painel só mostra agregado.

Ambas com `revoke ... from anon, authenticated` e `grant execute to
service_role`, exatamente como `grant_coins`.

### RLS

O parceiro lê **as próprias linhas agregadas** de `partner_clicks`,
`partner_commissions` e `partner_payouts` por policy
(`partner_id in (select id from partners where user_id = auth.uid())`).
Nunca lê `profiles`.

**Verificação:** com o anon key, um `select` em `partner_commissions` de outro
parceiro devolve 0 linhas e `rpc('attach_partner')` devolve 42501.

---

## Convenções de cookie (vale para as fases 1 e 2)

Dois cookies novos, e nenhuma string solta no meio do código.

**`lib/partners/cookies.ts`** — nome, TTL e opções de cada cookie em
constantes exportadas, no mesmo padrão de `MANUAL_FX_COOKIE`
(`lib/fx/usd-brl.ts`) e do `SIDEBAR_COOKIE_NAME` do shadcn:

```ts
export const REF_COOKIE = "scriba_ref";
export const REF_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;   // 30 dias
export const VISIT_COOKIE = "scriba_visit";
export const VISIT_COOKIE_MAX_AGE = 24 * 60 * 60;      // 24h
export const refCookieOptions = { httpOnly: true, sameSite: "lax",
  secure: process.env.NODE_ENV === "production", path: "/" } as const;
```

**Os dois são `httpOnly`.** O cliente nunca faz `document.cookie` — escrita e
leitura acontecem só no servidor. Isso tem duas consequências no desenho:

1. **O campo de código do `/sign-up` não escreve o cookie direto.** Ele chama
   uma server action (`setReferralCode`), no padrão exato de
   `lib/fx/actions.ts`. A action valida o slug e grava com as opções acima.
2. **Para a UI saber que há indicação ativa** (mostrar "você foi indicado, vai
   ganhar 150 moedas"), o server component do `/sign-up` lê `cookies()` e
   passa por prop. Nada de criar um segundo cookie legível por JS só para
   exibir — seria estado duplicado e uma superfície a mais para adulterar.

**Hook e store, onde cada um entra.** `useReferralField()`
(`src/features/partners/hooks/`) cuida do **estado do formulário** — valor
digitado, validação, pendência do submit — e não do cookie. Store zustand só
se o estado precisar cruzar componentes distantes, como em
`src/features/coins/store.ts`; um campo de formulário não precisa, e criar um
store para ele é cerimônia sem ganho.

---

## Fase 1 — Captura do clique

- **`app/r/[slug]/route.ts`** — rota dinâmica. Seta o cookie `scriba_ref`
  (30 dias, `httpOnly`, `sameSite=lax`, `secure`), seta `scriba_visit` (24h,
  para deduplicar), chama `record_partner_click` e devolve `302` para `/`.
  Slug inexistente redireciona para `/` sem gravar nada — link velho não pode
  virar erro na cara do visitante.
- **`proxy.ts`** — `/r` entra em `PUBLIC_PREFIXES`. O early-return de `/`
  continua intacto: o clique é gravado em `/r/<slug>`, não na LP.
- `sameSite=lax` é obrigatório: o retorno do OAuth do Google é uma navegação
  de terceiro para o nosso domínio, e `strict` faria o cookie sumir exatamente
  no momento do cadastro.

**Verificação:** `/r/teste` responde 302 com `Set-Cookie`; o output do build
continua marcando `/` como `○ Static`.

---

## Fase 2 — Atribuição e bônus

- **Campo de código no `/sign-up`** — input opcional. Como o login é só
  Google, o valor digitado é gravado no mesmo cookie `scriba_ref` **antes** do
  redirect para o OAuth (`src/features/auth/components/`). O código atravessa
  o roundtrip do Google porque é cookie de primeira parte no mesmo host.
- **`app/auth/callback/route.ts`** — depois do `exchangeCodeForSession`, se
  existir cookie `scriba_ref`, chama `attach_partner`. Sai cedo quando não há
  cookie: custo zero para o login normal.
- **`lib/db/partners.ts`** — wrappers tipados sobre as duas RPCs, no padrão de
  `lib/db/billing.ts`.
- **`GrantReason`** ganha `"partner_bonus"` (`lib/db/billing.ts:152`).
- **Extrato de moedas** passa a mostrar a linha "bônus de indicação".

O bônus **soma** às 50 de boas-vindas (que vêm do `DEFAULT` da coluna, sem
linha no ledger). O bônus, ao contrário, é uma linha explícita — como todo
crédito.

**Verificação:** dois logins seguidos com o mesmo cookie creditam uma vez só
(pelo `external_ref` UNIQUE); usuário existente que abre o link não é
atribuído.

---

## Fase 3 — Comissão

- **`lib/billing/fulfill.ts`** — `creditInvoice()` ganha, depois do
  `grantCoins`, uma chamada a `accruePartnerCommission({ invoice, userId,
  entitlement, source })`. Só para `entitlement.kind === "subscription"` —
  avulso não comissiona, por decisão de negócio.
  Um erro na comissão **não pode derrubar o crédito de moedas**: try/catch,
  log em `error`, e segue. Moeda é contrato com o usuário; comissão é
  reconciliável depois.
- **`lib/db/partners.ts`** — `insertCommission()` com
  `on conflict (referred_user_id) do nothing`. `status = 'pending'`,
  `available_at = now() + 30 days`.
- **`app/api/stripe/webhook/route.ts`** — onde hoje chama `clawbackCoins` em
  `charge.refunded` / `charge.dispute.created`, chama também
  `reversePartnerCommission(userId)`. Se a comissão já tiver `payout_id` (foi
  paga), não reverte: loga em `warn` — mesmo padrão do clawback quando as
  moedas já foram gastas.
- **Promoção `pending → available`** resolvida em query
  (`status = 'pending' and available_at <= now()`), não por cron. Menos peça
  móvel, e o estado é sempre verdadeiro.

**Verificação:** no Stripe de teste, assinar gera uma linha; cancelar e
reassinar continua uma linha; reembolsar marca `reversed`.

---

## Fase 4 — Métricas de produto no admin (base)

Independente do programa de parceiros, mas **pré-requisito das telas dele**:
toda métrica do parceiro é uma métrica de produto filtrada por `partner_id`.
Construir a base uma vez evita duas implementações divergentes de "conversão".

Hoje o `/admin` mostra usuários, custo e custo por 1.000 moedas
(`loadAdminUsageSummary`). Falta o funil inteiro. Tudo é derivável do que já
existe — `profiles.created_at`, `subscriptions`, `coin_transactions`,
`sessions` — sem nenhuma tabela nova.

**`lib/db/admin/metrics.ts`**, com recorte por período e por coorte:

- **Aquisição** — cadastros por dia/semana/mês.
- **Ativação** — % que gravou ao menos uma sessão; moedas gastas nos 7
  primeiros dias; distribuição do consumo das 50 moedas iniciais (gastou 0 /
  1–25 / 26–50 / zerou o saldo). Quem zera o saldo é o sinal mais forte de
  intenção de compra que temos.
- **Conversão** — cadastro → assinante (%), por coorte de mês; tempo médio até
  a primeira assinatura; mix Pessoal × Estudioso.
- **Receita** — assinantes ativos, MRR, ARPU, receita de avulso, cancelamentos
  agendados (`cancel_at_period_end`) e churn mensal.
- **Margem** — receita − Stripe − custo de moedas, reusando o câmbio e o custo
  medido que o `/admin` já calcula.
- **Passivo de moedas** — moedas creditadas menos gastas. Como os créditos
  acumulam de um mês para o outro, o saldo não gasto é custo de OpenAI já
  vendido e ainda não incorrido. É a métrica que ninguém lembra de olhar até
  ela doer.

Tela: `/admin/metricas`, no padrão de `/admin/usage`.

---

## Fase 5 — Admin de parceiros (`/admin/partners`)

- Lista, cadastro e edição de parceiro (nome, e-mail do convite, redes, slug,
  CPF/PIX, **taxa**, bônus, teto, status).
- Métricas por parceiro — o mesmo `metrics.ts` da Fase 4, filtrado.
- **Registro de pagamento**: seleciona parceiro, período e valor; cria a linha
  em `partner_payouts` e carimba as comissões `available` com o `payout_id`.
  É este passo que faz o "a receber" do painel voltar a zero.
- Entra no `AdminSidebar`; rotas sob `app/api/admin/partners/` seguindo o
  padrão de `app/api/admin/users/`, com
  `enforceRateLimit(..., RATE_LIMITS.admin, ...)`.

### Simulador de comissão

A taxa é editável por parceiro, então o formulário precisa mostrar a
consequência **enquanto** o número é digitado — nunca depois de salvo.

**`lib/partners/economics.ts`** — função pura, client-safe, sem segredo:

```ts
simulatePartner({
  ratePct, plan, costPerThousandCoins, bonusCoins,
  conversionPct, bonusUsagePct,
}) => {
  partnerEarns, scribaMonth1, scribaRecurring,
  breakEvenMonths, warning
}
```

Ela é a **única** implementação da conta. As tabelas de `parceiros.md`, o
painel do parceiro e este formulário leem daqui — três cópias divergentes de
"quanto sobra" é como se descobre tarde que uma delas estava errada.

O `costPerThousandCoins` vem **medido** de `loadAdminUsageSummary`, não
fixado em constante: ele muda com câmbio e com preço de modelo, e o simulador
tem que refletir a realidade de hoje.

Na tela, ao lado do campo de taxa:

- **o que o parceiro ganha** por assinante, nos dois planos;
- **o que o Scriba recebe** no mês 1 e o recorrente do mês 2 em diante;
- **quantas conversões** o parceiro precisa para atingir o mínimo de R$ 50;
- faixa de aviso conforme o resultado do mês 1: saudável → atenção →
  **negativo**, com o texto dizendo o valor ("a 90% você fica R$ X negativo no
  primeiro mês, recuperado no mês 2 em Y dias").

Aviso, não bloqueio. Pode existir motivo comercial para uma taxa agressiva em
um parceiro específico; o que não pode é ela ser escolhida às cegas.

---

## Fase 6 — Painel do parceiro (`/partners`)

Estrutura espelhando `app/admin/`:

```
app/partners/layout.tsx     -- isCurrentUserPartner() → notFound()
app/partners/page.tsx       -- dashboard
src/features/partners/      -- componentes
lib/auth/require-partner.ts -- irmão de lib/auth/require-admin.ts
```

Fica **fora** de `(app)` (shell próprio, como o admin), e o `proxy.ts` já o
protege por não estar na allowlist pública. O gate por papel mora no
`layout.tsx`, **não no proxy** — proxy com leitura de papel custa uma ida ao
banco em toda requisição do site.

Conteúdo: link e código com botão de copiar (reusar
`src/features/admin/components/CopyButton.tsx`), funil (visitas → cadastros →
assinantes), valores (a liberar / disponível / já pago) e histórico mensal.

Só agregados. Nenhuma query toca `profiles` além de `count(*)`.

---

## Fase 7 — Documentação

- `AGENTS.md`: seção "Parceiros" com as invariantes (comissão só via
  `fulfill.ts`; `referred_user_id` UNIQUE; atribuição imutável; o painel nunca
  expõe usuário).
- `.env.example` se surgir variável nova (não deve surgir).
- Fechar as pendências de `parceiros.md`.

---

## Riscos conhecidos

| risco | mitigação |
|---|---|
| Usuário antigo clica no link e ganha bônus | checagem de idade da conta no `attach_partner` |
| Auto-indicação | `partner.user_id = p_user_id` → `self_referral` |
| Farm de contas para minerar bônus | login só Google eleva o custo; `bonus_budget_coins` como teto |
| Comissão paga sobre pagamento contestado | carência de 30 dias + reversão no webhook |
| Comissão duplicada pelos 4 caminhos de crédito | `external_ref` + `referred_user_id` UNIQUE |
| Erro de comissão derrubar crédito de moedas | try/catch isolado dentro do `creditInvoice` |

---

## O que ficou de fora

Decisões conscientes, não esquecimentos:

- **Sem e-mail de convite.** O parceiro é avisado fora do sistema e entra com
  a conta Google dele; o vínculo se resolve sozinho na primeira visita a
  `/partners`. Um fluxo de convite por e-mail só se paga quando houver
  parceiros demais para avisar à mão.
- **Sem exportação de relatório.** O painel responde às perguntas que o
  parceiro faz; um CSV é trabalho até alguém pedir.
- **Sem histórico de cliques por dia na tela.** O rollup diário existe no
  banco (`partner_clicks`), então o gráfico é aditivo quando fizer falta.
- **Sem notificação de comissão nova.** O parceiro descobre no painel.
- **A promoção `pending → available` é resolvida em query**, não por cron.
  Menos peça móvel, e o estado é sempre verdadeiro no instante em que se olha.

## O que testar antes de convidar o primeiro parceiro

O que foi verificado em dev está no corpo de cada commit. Falta o que só
existe em produção:

1. Um pagamento REAL no Stripe live gerando comissão (o caminho foi testado
   com comissões inseridas à mão, não com uma fatura de verdade).
2. Um reembolso real revertendo a comissão.
3. O primeiro PIX de verdade, conferindo que o valor do painel bate com o que
   foi enviado.
4. As variáveis de ambiente: nenhuma nova foi criada, mas vale confirmar que
   `APP_URL` está correta em produção — é dela que sai o link do parceiro.
