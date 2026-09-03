# src/features/partners — programa de divulgadores

Indicação por convite. Regras de negócio em `docs/parceiros.md`, plano técnico
em `docs/parceiros-plano.md`. Migrações: `0029_partners.sql` e
`0030_partner_allowance_and_receipt.sql`.

Cada regra abaixo existe porque já foi um bug possível.

## Onde o código vive

```
src/features/partners/components/   ReferralField (tela de entrada),
                                    ReferralLinkCard, PartnerTabs,
                                    EarningsByPlan, RefreshPanelButton
app/r/[slug]/route.ts               o link de divulgação
app/partners/{layout,page}.tsx      o painel
lib/partners/cookies.ts             nomes, prazos e opções dos cookies
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
`lib/partners/cookies.ts`. `strict` faria o cookie sumir na volta do OAuth do
Google, que é exatamente o único momento em que ele importa. **Nenhum código
de navegador lê ou escreve esses cookies:** a tela de entrada recebe a
indicação por prop, resolvida no servidor.

## O painel nunca expõe uma pessoa

Só agregados — nem no HTML, nem numa rota. Não crie endpoint que liste
indicados.

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
