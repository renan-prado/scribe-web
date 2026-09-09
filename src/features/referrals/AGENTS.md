# src/features/referrals — indique a um amigo

O programa de indicação ABERTO: todo usuário tem um link e ganha moedas por
quem trouxer. Regras de negócio em `docs/indicacao.md`. Migrações: `0045_referrals.sql` e
`0046_referral_rewards_delete.sql`.

O irmão fechado é `src/features/partners/` — leia o `AGENTS.md` de lá antes de
mexer aqui, porque **as duas features dividem cookie, tela de entrada e
caminho de atribuição**, e quase todo bug possível mora nessa fronteira.

## Onde o código vive

```
src/features/referrals/components/  ReferralField (tela de entrada, os DOIS
                                    programas), InviteLinkCard, InviteFriendCard
src/shared/components/HeroEyebrow      o selo do hero da LP (cliente)
src/shared/components/ReferrerAvatar   foto ou iniciais de quem indicou
app/i/[code]/route.ts               o link de indicação
app/(app)/indicar/page.tsx          a página do usuário
app/api/referral/active/route.ts    quem indicou esta visita (público)
lib/referrals/economics.ts          os números (client-safe)
lib/referrals/cookies.ts            cookies dos DOIS programas (client-safe)
lib/referrals/active.ts             server-only: resolve o selo
lib/referrals/actions.ts            server action do campo de código
lib/db/referrals.ts                 attach, recompensas, painel
```

## Um cookie, uma atribuição

Os dois programas gravam em `scriba_ref`, com o programa embutido no valor
(`<id>.<origem>.<p|f>`). **Não crie um segundo cookie de atribuição.** Dois
cookies vivos significam duas indicações ativas ao mesmo tempo e uma regra de
precedência para alguém escrever errado depois; um cookie significa "vale o
último link clicado", que é a regra do documento.

Valor sem o terceiro campo é PARCEIRO — havia cookies de 30 dias no formato
antigo em circulação quando este programa nasceu. Não remova esse fallback sem
que 30 dias tenham passado desde o deploy que o introduziu.

A exclusividade é reforçada no BANCO: `attach_partner` e `attach_referrer`
conferem a coluna um do outro (`partner_id` / `referred_by_user_id`) antes de
gravar a sua. Um cookie adulterado à mão não consegue dois padrinhos.

## As travas são do banco

- **"Uma recompensa por pessoa, por evento, para sempre" é o
  `external_ref` UNIQUE de `referral_rewards`**, derivado do INDICADO
  (`referral-signup:<uuid>`, `referral-subscription:<uuid>`). Cancelar e
  reassinar colide e não credita. Vale para caminhos de crédito que ainda não
  existem.
- **`attach_referrer` recusa conta que não é nova** (30 minutos), como a de
  parceiro. Sem isso, um usuário de um ano atrás abrindo um link viraria
  indicação no login seguinte — de novo a cada link diferente.
- **O teto mensal é contado no livro-razão**, não num contador em coluna. Saldo
  derivado por `count()` não desanda; contador incrementado desanda em
  silêncio.
- **Toda moeda passa por `grant_coins`.** Não escreva em `coin_balance`.
- **`beneficiary_user_id` é CASCADE, não `set null`** (migração 0046). Com
  `set null`, apagar a conta de quem indicou tentava produzir a linha sem
  beneficiário que o CHECK proíbe, e o DELETE em `auth.users` era abortado com
  um "Database error deleting user" que não apontava para lugar nenhum. Foi
  descoberto ao limpar as contas de um teste de fumaça; a exclusão de conta é
  requisito da App Store, então isso ia aparecer cedo ou tarde.

## Os valores vêm de `economics.ts`, não do banco

`attach_referrer` e `award_referral_subscription` recebem as moedas por
PARÂMETRO. É seguro porque as duas têm EXECUTE revogado de
`anon`/`authenticated` — quem passa o valor é o nosso servidor.

A razão é a de sempre neste repositório: a tela precisa MOSTRAR esses números,
e uma cópia no banco seria a segunda definição da mesma coisa. Compare com
`partners.signup_bonus_coins`, que é coluna porque é negociado por parceiro.

## A recompensa do parceiro ACUMULA

`partners.user_id` nasce nulo: o parceiro é cadastrado antes de existir como
conta e pode divulgar o link antes do primeiro login. Então a linha de
`referral_rewards` do programa `partner` nasce com `credited_at` nulo e vira
moeda em `flush_partner_signup_rewards`, no caminho preguiçoso de
`getCurrentPartner()` — o mesmo da mesada, e pelo mesmo motivo (é por onde todo
parceiro passa).

Não "resolva" isso creditando na hora com um `if (partner.user_id)`: o ramo do
`else` é justamente o parceiro novo, que é quem mais divulga.

## O painel nunca expõe uma pessoa

Só agregados, como em `/partners`. `referral_rewards` tem RLS ligada e NENHUMA
policy — o cliente não lê essa tabela. Quem indicou vê "3 amigos entraram",
nunca quem são. Não crie rota que liste indicados.

## O selo do hero, e a LP estática

`app/page.tsx` é ESTÁTICA por invariante (ver `app/AGENTS.md`). O selo
"indicado por Fulano" NÃO pode ser resolvido no servidor lá — a leitura de
cookie derruba a estaticidade e devolve `no-store` para toda visita anônima.

O desenho é de quatro peças, e cada uma existe por uma razão:

1. **`scriba_ref_hint`**, cookie legível por JS, gravado pelas rotas de link.
   Vale `1` e nada mais. Sem ele, o hero perguntaria ao servidor em toda visita
   para ouvir "não há indicação" em 99% delas.
2. **`HeroEyebrowScript`**, um script que roda ANTES DO PRIMEIRO PAINT e marca
   `data-scriba-ref` no `<html>` se a pista existe. Irmão do `ThemeScript`.
3. **`HeroEyebrow`**, cliente, só busca se a pista existe.
4. **`/api/referral/active`**, que lê o cookie `httpOnly` no servidor.

## Por que existe um esqueleto, e por que ele não é estado do React

A primeira versão mostrava a frase padrão e a trocava quando a resposta
chegava. Quem vinha indicado lia "Ouça, relembre e coloque em prática." e a via
sumir — um pisca no elemento acima do `<h1>`, que é a pior posição possível
para um.

Não dá para consertar isso com `useState`: **o React só age depois do paint**,
e o paint é o problema. Por isso o estado inicial é decidido pelo script (peça
2) e aplicado por CSS, não por JSX:

| pista | primeiro paint | depois da resposta |
|---|---|---|
| ausente (99% das visitas) | a frase padrão | nada muda, e não há requisição |
| presente | **esqueleto** | "Indicado por Fulano" |
| presente, sem indicação viva | esqueleto | a frase padrão |

Sem JavaScript nada disso roda e a frase padrão aparece — o desfecho certo: o
selo é enfeite de conversão, e a LP tem de funcionar sem ele.

**O `display` das duas classes mora no `globals.css`, nunca num utilitário do
Tailwind.** Utilitário vive numa `@layer` posterior e vence a regra por ordem
de camada, independentemente de especificidade — a armadilha que o comentário
do `.lp-cta-soft` já documentava. Um `contents` de utilitário no
`.lp-eyebrow-idle` deixaria a frase padrão visível DEBAIXO do esqueleto, que é
exatamente o pisca que estamos evitando.

**`AbortError` NÃO é resposta**, e confundir os dois foi um bug entregue duas
vezes. Abortar diz "desisti da pergunta"; tratá-lo como "não há indicação" faz
a pílula resolver para a frase padrão e depois trocar de novo quando a
requisição de verdade chega — o pisca triplo (esqueleto → frase → selo) que o
esqueleto existia para eliminar. Em desenvolvimento isso acontece SEMPRE: o
StrictMode monta o efeito, roda a limpeza (que aborta) e monta outra vez.

A checagem é pelo NOME do erro, não por `instanceof DOMException`: o navegador
rejeita com DOMException, mas polyfill e runtime de teste rejeitam com um Error
comum de mesmo nome, e um `instanceof` que falha traz o pisca de volta em
silêncio.

**A limpeza do atributo vem DEPOIS do commit**, num efeito com dependência em
`settled` — nunca junto do `setState`. `setState` é assíncrono: entre um
`removeAttribute` síncrono e o commit do React existe uma janela em que o DOM
ainda é o par frase+esqueleto sem o atributo que escondia a frase, e o
navegador pinta essa janela. É a mesma classe de erro do parágrafo acima,
por outro caminho.

**Como medir isso, já que o olho não é confiável aqui:** ponha um atraso
temporário na rota `/api/referral/active`, instale um amostrador por
`requestAnimationFrame` com `page.addInitScript` (ANTES do `goto`, senão a
hidratação já passou) e registre a transição de estados. As três sequências
corretas são `FRASE-PADRAO` sozinha (sem pista, e sem nenhuma chamada à API),
`esqueleto → SELO` e `esqueleto → FRASE-PADRAO`. Qualquer sequência com três
estados é o bug.

**O esqueleto tem prazo** (`SETTLE_TIMEOUT_MS`, 4s). A rota é local e responde
em milissegundos, mas rede de igreja, aba em segundo plano e deploy no meio do
caminho existem — e um esqueleto eterno no hero é pior que não personalizar
nada, porque é o único desfecho que não se resolve sozinho.

**A pista não carrega nome nem foto, e isso não é economia de bytes.** Se
carregasse, haveria dois lugares dizendo quem é o padrinho — e no dia em que
divergissem, a página anunciaria uma pessoa e o cadastro creditaria outra.

**Quem cura a pista quando ela falta é o `proxy.ts`** (`healReferralHint`), e
isso não é zelo: a pista nasceu DEPOIS do cookie de atribuição, então todo
visitante que já tinha um `scriba_ref` vivo no dia do deploy não tinha pista
nenhuma — e para ele o selo simplesmente não aparecia, sem erro em lugar
algum. Foram 30 dias de gente nessa situação, e foi assim que o defeito
apareceu no primeiro teste manual: o navegador de quem estava testando o
programa de parceiros já carregava o cookie antigo.

A cura mora no proxy porque ele é o único lugar que roda em toda requisição, já
escreve cookies, e **não custa a estaticidade da LP** — ele roda antes do cache
de qualquer jeito. Um `cookies()` dentro de `app/page.tsx` faria exatamente o
oposto. A regra geral que fica: quando a landing page precisar reagir a um
cookie, o cookie é preparado no proxy ou numa rota, nunca lido na página.

A tela de entrada não usa nada disso: ela já é dinâmica e resolve no servidor,
pelo mesmo `readActiveReferral`.

## A foto vem do Google, por `next/image`

`app/AGENTS.md` proíbe `<img>` para host externo. O `remotePatterns` do
`next.config.ts` é o caminho que RESPEITA essa regra: a imagem passa a ser
servida otimizada do nosso domínio, com width/height, sem CLS. **Um host só**
(`lh3.googleusercontent.com`) — `remotePatterns` frouxo transforma
`/_next/image` num proxy de imagem aberto.

Sem foto (parceiro que nunca logou, avatar removido) e foto que não carrega
caem no mesmo lugar: as iniciais, em `ReferrerAvatar`. O `onError` não é
detalhe — sem ele, uma URL expirada do Google vira imagem quebrada no elemento
mais visível da landing page.

## O card do feed dorme, não desaparece

`InviteFriendCard` guarda uma data no `localStorage` (duas semanas ao
dispensar, um mês ao aceitar). Ele começa ESCONDIDO e aparece depois que o
efeito lê o storage — o contrário do `InstallAppCard`, que não persiste nada.
Renderizar visível e sumir produziria a piscada de um card se retirando na cara
de quem pediu para não vê-lo.

Sorteio (mostrar em 1 de cada N visitas) foi descartado: dois carregamentos
seguidos caem no mesmo lado da moeda, e o resultado é ou um convite que
persegue, ou um que nunca aparece.
