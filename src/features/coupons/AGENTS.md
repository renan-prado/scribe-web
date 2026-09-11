# src/features/coupons: o cupom de convite

A pasta é pequena de propósito: aqui mora **uma peça de tela**, o selo que a
página de entrada mostra a quem chegou por um cupom. Todo o resto do recurso
vive fora, e saber onde é metade do que este arquivo tem a dizer:

```
src/features/coupons/components/CouponNotice.tsx  o selo da tela de entrada
app/c/[code]/route.ts                             o link: grava o cookie, 302
app/admin/cupons/page.tsx                         a emissão (painel)
src/features/admin/components/CouponsManager.tsx  o formulário e a tabela
app/api/admin/coupons/route.ts                    criar, desativar, apagar
lib/domain/coupon.ts                              client-safe: formato, limites
lib/db/coupons.ts                                 server-only: leitura e resgate
lib/referrals/cookies.ts                          COUPON_COOKIE, junto dos outros
supabase/migrations/0055_signup_coupons.sql       as tabelas e a RPC
```

**As invariantes do recurso estão em `src/features/admin/AGENTS.md`**, na seção
"Cupons de convite", e no cabeçalho da migração 0055. Leia antes de mexer em
qualquer coisa aqui. O resumo do que não pode ser desfeito: todo cupom tem teto
de usos, o resgate é uma vez por pessoa na vida, a regra inteira roda dentro da
RPC, e cupom resgatado se desativa, não se apaga.

## Por que existe uma pasta para um componente só

Porque o selo é a única parte do cupom que uma pessoa de fora vê, e ele não
pertence a nenhuma das vizinhas. `src/features/referrals` é o programa aberto de
indicação e `src/features/partners` é o de divulgadores: os dois descrevem uma
relação com alguém que trouxe a pessoa, e os dois pagam alguém do outro lado. O
cupom não tem outro lado. Enfiá-lo numa das duas pastas faria o próximo leitor
procurar um padrinho que não existe.

## O selo não decide nada

Ele recebe um número e desenha. Quem lê o cookie é `app/sign-in/page.tsx`, quem
resolve o valor é `getCouponPublicByCode`, e quem credita é
`redeem_signup_coupon`, no `/auth/callback`.

**E ele só aparece se o cupom AINDA for resgatável.** `getCouponPublicByCode`
devolve `null` para cupom inativo, expirado ou esgotado, que são exatamente três
das recusas da RPC: anunciar um bônus que ela vai negar é prometer moeda que não
será creditada, e a pessoa só descobre isso depois de criar a conta. A quarta
recusa (`not_new`) não cabe aqui, quem está nessa tela ainda não tem conta.

Ao contrário do `ProspectNotice`, o selo do cupom aparece MESMO havendo
indicação ativa, e não é descuido: os dois brindes são de fato creditados (ver o
cabeçalho da migração 0055), então esconder um faria a tela prometer menos do
que vai entregar.
