# Ambientes: dev e produção

> Este documento explica **como funciona**. Para o que ainda falta configurar
> nos painéis (GoDaddy, Google Cloud, Supabase, Vercel), o passo a passo está em
> [`checklist-ambiente-dev.md`](./checklist-ambiente-dev.md).

O scribe-web roda contra dois conjuntos independentes de recursos.

| | dev | produção |
|---|---|---|
| Supabase | `[DEV] Scriba` (`bpyibejicgswgxvbpsvg`) | `Scribe Web` (`chnzfeisfaneuyuyzjvy`) |
| Stripe | modo **teste** (`sk_test_…`) | modo **live** (`sk_live_…`) |
| URL local | `http://localhost:3000` | `https://scriba.cc` |
| URL na Vercel | `https://dev.scriba.cc` (branch `develop`) | `https://scriba.cc` (branch `master`) |
| Arquivo local | `.env.dev` | `.env.prod` |

---

## 1. Como o ambiente é escolhido

Existem exatamente dois arquivos, e **nenhum dos dois é carregado pelo Next
automaticamente**. Quem escolhe é `scripts/with-env.mjs`, a partir do script de
npm que você digitou.

```
npm run dev    → scripts/with-env.mjs dev  -- next dev   → .env.dev
npm run prod   → scripts/with-env.mjs prod -- next dev   → .env.prod
```

### Por que não `.env.local`

Porque o carregamento automático é justamente o problema. O Next lê sozinho
`.env`, `.env.local`, `.env.development[.local]` e `.env.production[.local]`
(ver `loadEnvConfig` em `@next/env`). Com um `.env.local` na pasta, um `next dev`
distraído sobe apontando para o Supabase e o Stripe de **produção** sem dizer
nada — e num app onde crédito é dinheiro, "sem dizer nada" é o pior modo de
falhar.

Com nomes que o Next ignora, subir sem escolher ambiente simplesmente não
funciona: o Zod de `lib/env/server.ts` derruba o processo no import. E o
`with-env` **aborta** se encontrar qualquer arquivo da lista acima na raiz,
porque a presença dele desfaz a garantia: variáveis que o script não definiu
seriam preenchidas por ele pelas costas.

> Se você vier de uma checkout antiga com `.env.local`, mova o conteúdo para
> `.env.dev` / `.env.prod` e apague o original. O modelo sem valores está em
> `.env.example` — é o único arquivo da família que vai para o git.

### O que o `with-env` confere antes de subir

A variável **ausente** o Zod pega no boot. A classe de erro que este script
cobre é a outra: a variável **presente e errada** — que não quebra nada na
hora, só depois e em cima de dados reais.

- `sk_live_…` no `.env.dev` → **aborta**. Um checkout dali cobraria de verdade
  e o crédito nem entraria, porque `stripe listen` só encaminha eventos de teste.
- `.env.dev` e `.env.prod` com o **mesmo** `NEXT_PUBLIC_SUPABASE_URL` → aborta.
  Ambiente separado com o mesmo banco é uma etiqueta sem nada por trás.
- `sk_test_…` no `.env.prod`, `APP_URL` local em prod, `APP_URL` remota em dev
  → avisa, mas deixa passar.

E imprime sempre um cabeçalho dizendo em que ambiente você está — vermelho e
com moldura quando é produção.

---

## 2. Comandos

```bash
npm run dev                    # next dev + .env.dev
npm run prod                   # next dev + .env.prod  ← dados REAIS, Stripe LIVE
npm run build:dev              # next build com env de dev (checar o bundle)

npm run db:push                # migrações no Supabase de dev
npm run db:push:prod -- --yes  # migrações no Supabase de produção

npm run stripe:listen          # webhook local (sempre teste, sempre .env.dev)
npm run stripe:doctor          # diagnóstico da config de teste
npm run stripe:doctor:prod     # diagnóstico da config live
```

Duas armadilhas que os scripts já cobrem:

- **`.next/` é compartilhado entre os ambientes.** As `NEXT_PUBLIC_*` são
  inlinadas no bundle do cliente, então um build de dev reaproveitado depois de
  `npm run prod` (ou o contrário) pode servir um bundle falando com a URL
  errada. Ao alternar, `rm -rf .next` resolve. O `with-env` marca o ambiente em
  `SCRIBA_ENV` para o caso de você precisar depurar isso.
- **O CLI do Supabase guarda um único projeto vinculado por pasta**
  (`supabase/.temp/`). O `db-push.mjs` deriva o ref do arquivo de ambiente e
  religa antes de aplicar, então vale o script que você digitou — não um
  `supabase link` que alguém rodou semana passada.

---

## 3. Montando o Supabase de dev

As migrações cobrem tabelas, funções, RLS e GRANTs. **Não cobrem** nada que
mora no dashboard: provedores de auth, URLs de redirect, chaves do Google.
São dois passos, nesta ordem.

### 3.1 Schema

Preencha no `.env.dev`:

```
NEXT_PUBLIC_SUPABASE_URL=https://bpyibejicgswgxvbpsvg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
```

Depois:

```bash
npm run db:push
```

Ele religa o CLI no projeto de dev e aplica `supabase/migrations/` do zero.
Já foi rodado: as 23 migrações estão aplicadas, e os três invariantes de
cobrança foram conferidos contra o projeto novo — `grant_coins` e
`clawback_coins` devolvem `42501` com a anon key, e um
`update profiles set coin_balance` com a mesma chave também.

> **Sobre a lacuna 0012–0016.** Esses arquivos existiram (pgvector +
> `knowledge_sources` / `knowledge_chunks` / `match_knowledge`) e foram
> removidos quando a feature de RAG saiu do escopo. As tabelas ainda existem no
> banco de **produção**, mas nenhum código as usa hoje. O projeto de dev nasce
> sem elas, e é assim que deve ser: o dev reflete o schema que o código
> realmente precisa. Se o RAG voltar, as migrações voltam numerada à frente
> (`0029…`), não no buraco.

### 3.2 Auth (dashboard)

**Authentication → URL Configuration**

- *Site URL*: `http://localhost:3000`
- *Redirect URLs* (adicione as duas):
  - `http://localhost:3000/**`
  - `https://dev.scriba.cc/**`

Sem isso, o `exchangeCodeForSession` de `app/auth/callback/route.ts` até
funciona, mas o Supabase recusa o redirect de volta e o login morre em branco.

**Authentication → Providers → Google** — hoje está **desligado** no projeto de
dev (`GET /auth/v1/settings` devolve `"google": false`; em produção, `true`).

O app usa `signInWithOAuth({ provider: "google" })`
(`src/features/auth/components/GoogleSignInButton.tsx`), então o Google precisa
estar ligado ou não há como entrar.

1. No Google Cloud Console, no mesmo OAuth Client que a produção usa, adicione
   em *Authorized redirect URIs*:
   `https://bpyibejicgswgxvbpsvg.supabase.co/auth/v1/callback`
   — cada projeto Supabase tem a sua, e é ela que o Google valida.
2. Cole *Client ID* e *Client Secret* no provedor Google do Supabase de dev.

**Authentication → Providers → Email**: "Confirm email" está **ligado**
(`mailer_autoconfirm: false`). Desligar em dev poupa a ida à caixa de entrada a
cada usuário de teste — e evita esbarrar no limite do SMTP embutido do Supabase,
que é de poucos e-mails por hora e some sem aviso. É uma escolha de
conveniência; em produção fica ligado.

### 3.3 Primeiro usuário

Cadastre-se normalmente. O trigger `on_auth_user_created` (migração 0005) cria
o `profiles` sozinho, já com `coin_balance` = 50 (migração 0026), suficiente
para gravar alguns minutos.

Para mais moedas ou para virar admin, use o **SQL Editor** do projeto de dev —
`grant_coins` tem EXECUTE revogado de `anon`/`authenticated` de propósito, e o
editor roda como `postgres`:

```sql
-- moedas de teste
select public.grant_coins(
  (select id from auth.users where email = 'voce@exemplo.com'),
  5000, 'manual', 'dev-seed-1'   -- external_ref é UNIQUE: mude a cada chamada
);

-- acesso ao /admin
update public.profiles set role = 'admin'
 where id = (select id from auth.users where email = 'voce@exemplo.com');
```

---

## 4. Stripe por ambiente

Já estava resolvido, só não estava separado. Produtos e preços **não são
compartilhados** entre live e teste — por isso `.env.dev` e `.env.prod` têm IDs
de preço diferentes, e trocar só a chave dá "preço não existe nesta conta/modo".

O guia completo é `docs/stripe-setup.md`. O que mudou aqui:

- `npm run stripe:listen` opera sempre sobre `.env.dev`. Não existe cenário em
  que apontá-lo para produção faça sentido: ele encaminha eventos de teste.
- `npm run stripe:doctor` lê `.env.dev`; `stripe:doctor:prod` lê `.env.prod`.

Se o ambiente de dev na Vercel (`dev.scriba.cc`) for fazer compras de teste,
cadastre um segundo endpoint de webhook **em modo teste** apontando para
`https://dev.scriba.cc/api/stripe/webhook` e use o signing secret dele na env
var de Preview — não o do `stripe listen`, que só vale para a sua máquina.

---

## 5. Vercel

Um projeto só. O branch `master` publica em `scriba.cc` (Production); o branch
`develop` publica em `dev.scriba.cc` (Preview).

### 5.1 Domínio

*Settings → Domains* → adicionar `dev.scriba.cc` → em **Git Branch**, digitar
`develop`. A Vercel aponta o domínio sempre para o último deploy desse branch.

No DNS de `scriba.cc`, um `CNAME dev → cname.vercel-dns.com`.

### 5.2 Variáveis

*Settings → Environment Variables*, escopo **Preview**. A Vercel permite fixar
um valor por branch (*Preview* → branch específico): use `develop`, senão as
envs de dev valem para o preview de qualquer branch.

| Variável | Valor no Preview |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | projeto de dev |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | projeto de dev |
| `SUPABASE_SERVICE_ROLE_KEY` | projeto de dev |
| `OPENAI_API_KEY` | pode ser a mesma |
| `STRIPE_SECRET_KEY` | `sk_test_…` |
| `STRIPE_PRICE_*` | IDs do modo teste |
| `STRIPE_WEBHOOK_SECRET` | do endpoint de teste apontando para `dev.scriba.cc` |
| `APP_URL` | `https://dev.scriba.cc` |
| `CRON_SECRET` | valor próprio de dev |

`APP_URL` importa: sem ela, `lib/env/server.ts` cai no `VERCEL_URL`, que é a URL
aleatória do deploy, e o retorno do Checkout leva para lá em vez de
`dev.scriba.cc`.

### 5.3 Duas consequências desta escolha

**Deployment Protection.** Previews nascem protegidos por login da Vercel —
`dev.scriba.cc` vai pedir autenticação a quem não estiver no time. Para deixar
aberto: *Settings → Deployment Protection → Vercel Authentication → Disabled*
(ou "Only Preview Deployments" desligado). Enquanto estiver ligado, o webhook de
teste do Stripe **também** é barrado, porque chega sem cookie — se for testar
compra em `dev.scriba.cc`, ou desative a proteção ou cadastre um bypass em
*Protection Bypass for Automation*.

**O cron não roda.** `vercel.json` agenda `/api/billing/sweep` diariamente, e
crons da Vercel só executam em deploys de **produção**. Em `dev.scriba.cc` a
varredura não existe. Isso é aceitável — ela é a quarta linha de defesa do
crédito, e as três de cima (webhook, reconciliação no retorno, check preguiçoso
no `summary`) funcionam normalmente. Para exercitá-la em dev, chame na mão:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/billing/sweep
```

### 5.4 CORS

`proxy.ts` valida a origem contra `STATIC_ALLOWED_ORIGINS`, onde
`https://dev.scriba.cc` já está. Um subdomínio novo que precise falar com a API
tem de ser adicionado lá — não há wildcard, de propósito.

---

## 6. Subdomínios futuros

`blog.`, `admin.`, `auth.` e `partners.scriba.cc` não são deste trabalho, mas o
que foi feito aqui não atrapalha nenhum deles: `dev.` é um domínio ligado a um
branch, não uma estrutura de roteamento. Quando chegar a hora, cada um vira ou
um projeto separado na Vercel (blog, partners — deploys e times independentes)
ou um rewrite no projeto atual (admin, que já existe em `/admin` e
compartilha sessão). `auth.` é o caso que exige cuidado de verdade: cookie de
sessão em subdomínio pai muda a configuração do Supabase SSR e do `proxy.ts`,
e é melhor decidir isso com o problema na frente.
