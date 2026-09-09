# src/features/partners — programa de divulgadores

Indicação por convite. Regras de negócio em `docs/parceiros.md`, plano técnico
em `docs/parceiros-plano.md`. Migrações: `0029_partners.sql`,
`0030_partner_allowance_and_receipt.sql` e `0045_referrals.sql` (as moedas por
cadastro).

**O irmão aberto deste programa é `src/features/referrals/`** — leia o
`AGENTS.md` de lá antes de mexer aqui. Os dois dividem o cookie de atribuição,
o campo de código da tela de entrada e o selo "indicado por"; é nessa fronteira
que moram os bugs possíveis.

Cada regra abaixo existe porque já foi um bug possível.

## Onde o código vive

```
src/features/partners/components/   ReferralField (tela de entrada),
                                    ReferralLinkCard, PartnerTabs,
                                    EarningsByPlan, RefreshPanelButton
app/r/[slug]/route.ts               o link de divulgação
app/partners/{layout,page}.tsx      o painel
lib/referrals/cookies.ts             nomes, prazos e opções dos cookies
lib/partners/economics.ts           a conta do programa (client-safe)
lib/partners/allowance.ts           server-only: a mesada mensal
lib/partners/socials.ts             normaliza @handle
lib/auth/require-partner.ts         gate + vínculo + conferência da mesada
lib/db/partners.ts                  attachPartner, comissão, estorno
lib/db/partner-panel.ts             agregados do painel
lib/db/admin/partners.ts            CRUD + registerPayout
```

## A comissão nasce dentro de `fulfill.ts`

No `creditInvoice`, e **não numa rota**. É por ali que passam os quatro
caminhos de crédito (webhook, reconciliação, resumo, sweep); pendurá-la em um
deles faria uma compra recuperada pelos outros três não comissionar —
justamente a compra que já deu trabalho.

O `try/catch` em volta é obrigatório: falha de comissão não pode derrubar o
crédito de moedas. Se derrubar, o webhook devolve 5xx, o Stripe reentrega, e o
usuário fica sem saldo por um problema que não é dele.

## As travas são do banco, não do código

- **"Uma comissão por pessoa na vida" é uma CONSTRAINT.**
  `partner_commissions.referred_user_id` é UNIQUE. Renovação e reassinatura
  seis meses depois colidem e não criam nada. A regra vale para caminhos que
  ainda não existem.
- **`commission_cents` e `rate_bps` são congelados na linha.** A taxa é
  editável por parceiro; mudá-la amanhã não pode reescrever o que ele já
  ganhou.
- **A atribuição é imutável.** `profiles.partner_id` é gravado uma vez, por
  `attach_partner()`. As três colunas de atribuição ficam fora do GRANT de
  coluna concedido a `authenticated` em 0026 — `partner_id` decide para quem
  vai dinheiro.
- **`attach_partner()` recusa conta que não é nova.** Sem essa checagem, um
  usuário antigo que abrisse `/r/<slug>` seria vinculado no login seguinte e
  ganharia moedas de graça — de novo a cada link diferente que abrisse.
- **A atribuição é EXCLUSIVA entre os dois programas.** `attach_partner()`
  recusa quem já tem `referred_by_user_id`, e `attach_referrer()` recusa quem
  já tem `partner_id` (migração 0045). Uma conta tem um padrinho só; o cookie
  é um só, e vale o último link clicado.
- **O bônus passa por `grant_coins`**, como todo crédito. Não escreva em
  `coin_balance`.

## Nada de Stripe novo

A atribuição é 100% nossa: cookie mais código. Não existe Coupon nem Promotion
Code de parceiro, e `billing/checkout` não sabe que este programa existe.

## O link e os cookies

`app/r/[slug]/route.ts` grava o clique e redireciona. Três detalhes que
parecem cosméticos e não são:

- **302, não 308.** Um permanente seria memorizado pelo navegador, e o parceiro
  perderia a contagem a partir do segundo clique da mesma pessoa.
- **Redireciona mesmo com slug inválido.** Um 404 puniria o visitante por um
  erro que não é dele.
- **A landing continua estática.** O clique é gravado NA ROTA, nunca em
  `app/page.tsx` — ver `app/AGENTS.md`.

Os cookies são `httpOnly` e `sameSite: "lax"`, com nomes e prazos só em
`lib/referrals/cookies.ts` — que serve aos DOIS programas, e por isso mudou de
`lib/partners/` para lá. A única exceção ao `httpOnly` é o cookie-PISTA
(`scriba_ref_hint`), que vale `1` e existe para o selo do hero da landing page
não precisar perguntar ao servidor em toda visita anônima; ele não carrega nome
nem código, justamente para não haver dois lugares dizendo quem é o padrinho. `strict` faria o cookie sumir na volta do OAuth do
Google, que é exatamente o único momento em que ele importa. **Nenhum código
de navegador lê ou escreve esses cookies:** a tela de entrada recebe a
indicação por prop, resolvida no servidor.

## O painel nunca expõe uma pessoa

Só agregados — nem no HTML, nem numa rota. Não crie endpoint que liste
indicados.

## As moedas por cadastro

O parceiro ganha `partners.signup_reward_coins` (50 por padrão, editável) por
cada conta atribuída a ele — antes e independentemente de a pessoa assinar. É a
resposta ao "não quero ficar na mão trazendo lead que não converte".

**Elas ACUMULAM em vez de serem creditadas na hora**, e isso não é preguiça de
implementação: `partners.user_id` nasce NULL, porque o parceiro é cadastrado
antes de existir como conta e pode divulgar o link antes do primeiro login. A
linha nasce em `referral_rewards` com `credited_at` nulo e vira moeda em
`flush_partner_signup_rewards`, no caminho preguiçoso de `getCurrentPartner()`.
Não troque isso por um `if (partner.user_id)` que credita direto: o ramo do
`else` é o parceiro recém-convidado, que é justamente quem mais divulga.

**O `bonus_budget_coins` NÃO limita esta ponta.** Aquele teto existe para
conter o custo do brinde ao INDICADO; se ele calasse também a remuneração do
parceiro, um orçamento estourado viraria um corte de pagamento que ninguém
anunciou. Se um teto para as moedas dele for necessário, nasce como coluna
própria.

O simulador do cadastro do admin já inclui estas moedas na conta do mês 1 —
elas amortizam como o bônus, mas sem a fração de uso, porque o parceiro é
usuário ativo por desenho do programa (é essa a razão da mesada).

## A mesada mensal

Crédito, logo passa por `grant_coins`. `lib/partners/allowance.ts`, com
renovação **preguiçosa** (sem cron): o crédito sai quando o parceiro aparece,
disparado por `getCurrentPartner()` — que o layout de `(app)` chama para
decidir o item "Área do parceiro" no menu, e é por isso o único caminho por
onde todo parceiro passa.

Duas travas, nesta ordem: `partners.allowance_month` (comparação em memória,
evita ir ao banco em toda visita) e `coin_transactions.external_ref` UNIQUE
(`partner_allowance:<id>:<AAAA-MM>` — a trava de verdade). Discordando as
duas, quem manda é o ledger.

**A função nunca lança.** Ela roda no caminho de render de todas as páginas do
app: falhar em creditar cortesia não pode derrubar quem só queria abrir o
feed.

**Número que a TELA lê fica em `economics.ts`, não em `allowance.ts`.** O
cadastro do admin é client component, e importar constante de um módulo
`server-only` arrasta o Supabase com service-role para o bundle do navegador —
o build recusa, corretamente. Foi o que aconteceu com
`DEFAULT_PARTNER_MONTHLY_COINS`.

## Pagamento é ledger, não contador

`registerPayout` cria a linha em `partner_payouts` **E** carimba as comissões
com o `payout_id`. Sem o carimbo, o "a receber" nunca diminui e o primeiro PIX
pago deixa o número mentindo para sempre.

A rota não aceita valor no corpo: o servidor soma o que está disponível, para
que pagamento e comissões sempre fechem.

**`PAYOUT_MINIMUM_CENTS` é política, não trava.** O botão de pagar aparece com
qualquer valor disponível e o diálogo apenas AVISA abaixo do mínimo. A regra
do próprio programa — saldo pago integralmente a quem sai — descreve um
pagamento que quase sempre nasce abaixo dele; escondendo o botão, a saída
seria mexer no banco à mão.

**O comprovante do PIX é um LINK, não um upload.** `partner_payouts.receipt_url`,
com https obrigatório num CHECK da coluna e no schema da rota — um "mandei no
zap" salvo ali vira botão quebrado no painel do parceiro.

## A conta mora num lugar só

`lib/partners/economics.ts` é a ÚNICA implementação. Simulador do admin,
painel do parceiro e as tabelas do doc leem dela. O custo por moeda é sempre
MEDIDO (usage + câmbio), nunca constante.

Métrica de produto por parceiro sai de `lib/db/admin/metrics.ts`, que já
aceita recorte por `partnerId`. Não escreva uma segunda consulta de conversão
aqui: duas definições do mesmo número um dia discordam, e a discordância
aparece como um parceiro reclamando do próprio painel.
