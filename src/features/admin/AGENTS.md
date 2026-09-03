# src/features/admin — painel interno

Telas de `/admin`: métricas de produto, uso de LLM, usuários e parceiros.

## O gate

`app/admin/layout.tsx` chama `isCurrentUserAdmin()` e responde `notFound()` —
**404, não 403**. Não confirmamos a existência da área administrativa a quem
não deveria vê-la. As rotas `/api/admin/*` usam `requireAdmin()`, que devolve
404 pela mesma razão.

**Server Action de admin reconfere com `assertAdmin()`.** O gate do layout
decide o que RENDERIZA, não o que executa: uma action é um endpoint POST
próprio, e o id dela é um hash estável embutido no bundle, não um segredo. É o
que a documentação do Next diz em "Data Security". As actions de câmbio
(`lib/fx/actions.ts`) são o exemplo no repositório.

O client service-role (`lib/supabase/admin.ts`) BYPASSA a RLS. Ele só entra
depois de ter afirmado admin, e nunca vai para o navegador.

## As telas privilegiadas não vazam no bundle

Os itens de admin e de parceiro do menu do avatar são um **server component**
(`PrivilegedMenuItems`) entregue ao `UserMenu` por slot. Atrás de um
`isAdmin &&` dentro do componente cliente, as strings "Admin", "Área do
parceiro", "/admin" e "/partners" viajavam no chunk que TODO usuário logado
baixa: o `false` escondia o item na tela, não o código que o desenha.

Consequência prática: **constante lida por server component não pode morar num
arquivo `"use client"`** — o compilador do Next transforma todo export daquele
módulo em referência de cliente e a string não chega. Foi por isso que
`MENU_ITEM_CLASS` teve de sair para um módulo simples.

## Uma definição por número

`lib/db/admin/metrics.ts` é a ÚNICA implementação das métricas de produto —
funil, ativação, receita, passivo de moedas — e já aceita recorte por período
e por `partnerId`. Não escreva uma segunda consulta de "conversão" dentro das
telas de parceiro: duas definições do mesmo número um dia discordam, e a
discordância aparece como um parceiro reclamando do próprio painel.

O mesmo vale para a conta do programa de parceiros: ela mora em
`lib/partners/economics.ts`, e o simulador do admin lê de lá.

## Custo

`/admin/usage` lê `llm_usage_events`, alimentada por `recordChatUsage` /
`recordAudioUsage` em cada rota de LLM. O preço por token está em
`lib/llm/pricing.ts`; a conversão para reais usa o câmbio de
`lib/fx/usd-brl.ts`, que busca na AwesomeAPI e cai num valor manual persistido
em cookie quando o upstream falha.

**O custo por moeda é sempre MEDIDO** (uso real + câmbio), nunca uma
constante. O painel mostra custo por 1.000 moedas porque por unidade o número
some no arredondamento.

A ordenação do "top de usuários" é por **moedas gastas**, não por dólar: dólar
mistura modelos de preços diferentes e a lista deixava de responder à pergunta
que ela existe para responder.

## Parceiros

O cadastro, a taxa de comissão e o registro de pagamento (PIX) vivem aqui, mas
as invariantes do programa estão em `src/features/partners/AGENTS.md` — leia
antes de mexer em `registerPayout` ou em qualquer coisa que toque
`partner_commissions`.

Dois pontos que mordem deste lado:

- O cadastro é client component. Uma constante que ele exibe não pode vir de
  um módulo `server-only`.
- O comprovante do PIX é um LINK https, validado no CHECK da coluna e no
  schema da rota — não um upload.
