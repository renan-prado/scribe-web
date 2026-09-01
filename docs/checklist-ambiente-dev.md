# Checklist — o que falta para o ambiente de dev funcionar

Trabalho manual em painéis externos. O código, as migrações e os arquivos de
ambiente já estão prontos — o que sobra aqui não dá para automatizar do repo.

Guia conceitual (por que cada coisa é assim): `docs/ambientes.md`.

## Estado atual

| | situação |
|---|---|
| `.env.dev` / `.env.prod` | ✅ prontos e validados contra os schemas Zod |
| Schema do Supabase de dev | ✅ 23 migrações aplicadas em `bpyibejicgswgxvbpsvg` |
| Invariantes de cobrança em dev | ✅ `grant_coins`, `clawback_coins` e `coin_balance` devolvem `42501` com a anon key |
| `dev.scriba.cc` na Vercel | ⬜ domínio criado no branch `develop`, **DNS faltando** → §1 |
| Google OAuth em dev | ⬜ desligado no Supabase → §2 e §3 |
| URLs de auth em dev | ⬜ → §3 |
| Env vars de Preview na Vercel | ⬜ → §4 |

**Ordem importa.** §1 e §2 podem ir em paralelo. §3 depende do §2 (precisa do
Client ID). §4 depende do §1 (o `APP_URL` só faz sentido com o domínio de pé).

Dados que você vai precisar em quase todo passo:

```
projeto Supabase de dev   bpyibejicgswgxvbpsvg   ("[DEV] Scriba")
projeto Supabase de prod  chnzfeisfaneuyuyzjvy   ("Scribe Web")
domínio de dev            https://dev.scriba.cc
domínio de prod           https://scriba.cc
branch de dev             develop
```

Os segredos (service_role, chaves do Stripe) estão em `.env.dev` na raiz do
repo. **Não copie nenhum deles para dentro deste arquivo** — ele vai para o git.

---

## 1. GoDaddy — o CNAME de `dev.scriba.cc`

Os nameservers de `scriba.cc` são da GoDaddy (`ns45`/`ns46.domaincontrol.com`),
então a Vercel não consegue criar registro sozinha: ela só sabe dizer qual
falta. Enquanto o registro não existir, o painel mostra **Invalid
Configuration** — que é o estado esperado, não um erro.

**Meus Produtos → `scriba.cc` → DNS → Registros → Adicionar novo registro**

| campo | valor |
|---|---|
| Tipo | `CNAME` |
| Nome | `dev` |
| Valor | `9469a80e2a9addf5.vercel-dns-017.com` |
| TTL | Personalizado, 600 segundos |

Três armadilhas da interface da GoDaddy:

- **No campo Nome vai só `dev`**, não `dev.scriba.cc`. A GoDaddy concatena o
  domínio sozinha — quem digita o nome completo acaba com
  `dev.scriba.cc.scriba.cc`, que resolve para nada e não dá nenhum aviso.
- **O ponto final** que aparece no painel da Vercel (`…-017.com.`) a GoDaddy
  adiciona sozinha. Cole sem ele.
- **TTL 600s enquanto ajusta.** O padrão de 1 hora significa esperar uma hora a
  cada tentativa errada. Volte para 1 hora depois que funcionar.

> O valor `9469a80e2a9addf5.vercel-dns-017.com` é específico deste
> projeto/domínio. Se por algum motivo o painel da Vercel mostrar outro, o do
> painel manda.

**Conferir** (de qualquer terminal):

```bash
nslookup -type=CNAME dev.scriba.cc 8.8.8.8
```

Quando devolver o `vercel-dns-017.com`, volte ao painel da Vercel e clique em
**Refresh**. O certificado TLS ela emite sozinha logo depois — não precisa
fazer nada para isso.

**Não** troque os nameservers para a Vercel (a aba "Vercel DNS" no mesmo
painel). Funciona, mas migra a zona inteira: se houver e-mail no domínio, os MX
vão junto e é fácil derrubar o e-mail sem perceber. Para um subdomínio só, o
CNAME acima basta.

---

## 2. Google Cloud Console — autorizar o projeto de dev

O botão de login usa `signInWithOAuth({ provider: "google" })`
(`src/features/auth/components/GoogleSignInButton.tsx`). Sem Google, não há
como entrar no app de dev.

Cada projeto Supabase tem a **sua própria** URL de callback, e o Google só
redireciona para URLs que estejam explicitamente listadas. A de produção já
está lá; a de dev não.

**Use o mesmo OAuth Client que a produção usa** — é o caminho mais curto e a
tela de consentimento é a mesma. (Um client separado só faria sentido se você
quisesse isolar métricas ou o consent screen, o que não é o caso hoje.)

**console.cloud.google.com → APIs e Serviços → Credenciais → o OAuth 2.0 Client
ID da web que a produção já usa → Editar**

Em **Authorized redirect URIs**, adicionar (mantendo a de produção):

```
https://bpyibejicgswgxvbpsvg.supabase.co/auth/v1/callback
```

Em **Authorized JavaScript origins**, adicionar as duas:

```
http://localhost:3000
https://dev.scriba.cc
```

Salvar. **Copie o Client ID e o Client Secret** — vão para o §3.

Dois pontos que costumam morder:

- **Propagação.** O Google avisa que a mudança pode levar de 5 minutos a
  algumas horas. Se der `redirect_uri_mismatch` logo depois de salvar, espere
  antes de sair procurando erro de digitação.
- **Publishing status da tela de consentimento.** Se estiver em **Testing**, só
  os e-mails cadastrados em *Test users* conseguem entrar — e o erro que
  aparece (`access_denied`) não diz isso. Como a produção funciona, ela
  provavelmente já está **In production**; se não estiver, ou publique ou
  acrescente o seu e-mail em *Test users*. Confira em *APIs e Serviços → Tela de
  permissão OAuth*.

---

## 3. Supabase — dashboard do projeto de dev

Tudo aqui é no projeto **`bpyibejicgswgxvbpsvg` ("[DEV] Scriba")**. Confira o
seletor de projeto no topo antes de cada mudança: os dois painéis são
idênticos, e mexer no de produção sem perceber é fácil.

O schema já está aplicado. O que falta é só o que mora no painel — provedores,
URLs e chaves não vêm em migração.

### 3.1 Authentication → Sign In / Providers → Google

Hoje está **desligado**. Verifiquei: `GET /auth/v1/settings` do projeto de dev
devolve `"google": false`; o de produção devolve `true`.

1. Ligar o toggle.
2. Colar o **Client ID** e o **Client Secret** do §2.
3. Salvar.

### 3.2 Authentication → URL Configuration

| campo | valor |
|---|---|
| Site URL | `http://localhost:3000` |
| Redirect URLs | `http://localhost:3000/**` |
| Redirect URLs | `https://dev.scriba.cc/**` |

O app manda `redirectTo = <origin>/auth/callback?next=…`
(`src/features/auth/lib/authUrl.ts`), e o Supabase recusa qualquer redirect que
não bata com a lista. Sem isso o login "funciona" — o Google aceita, a sessão é
criada — e o usuário cai numa página em branco, que é o sintoma mais confuso
desse fluxo inteiro.

> Se quiser garantia, abra o mesmo painel do projeto de **produção** numa aba ao
> lado e espelhe a lista que estiver lá, trocando `scriba.cc` por
> `dev.scriba.cc` e mantendo a entrada de localhost.

### 3.3 Authentication → Sign In / Providers → Email

"Confirm email" está **ligado** (`mailer_autoconfirm: false`). Sugestão:
**desligar em dev**.

Não é preguiça — o SMTP embutido do Supabase entrega poucos e-mails por hora,
e ao estourar o limite ele para de enviar sem erro visível: o cadastro parece
ter funcionado e o e-mail nunca chega. Em dev, onde você vai criar usuário
descartável a toda hora, isso vira meia hora perdida. Em produção fica ligado.

### 3.4 Primeiro usuário e moedas

Cadastre-se normalmente pelo app. O trigger `on_auth_user_created` (migração
0005) cria o `profiles` sozinho, já com `coin_balance = 50` (migração 0026) —
suficiente para gravar alguns minutos.

Para mais moedas ou acesso ao `/admin`, use o **SQL Editor do projeto de dev**.
`grant_coins` tem EXECUTE revogado de `anon`/`authenticated` de propósito
(verifiquei que a revogação pegou no projeto novo); o editor roda como
`postgres`, então funciona lá e só lá.

```sql
-- moedas de teste
select public.grant_coins(
  (select id from auth.users where email = 'SEU@EMAIL.com'),
  5000,
  'manual',
  'dev-seed-1'      -- external_ref é UNIQUE: mude o sufixo a cada chamada
);

-- acesso ao /admin
update public.profiles
   set role = 'admin'
 where id = (select id from auth.users where email = 'SEU@EMAIL.com');
```

Se `grant_coins` for chamada duas vezes com o mesmo `external_ref`, a segunda
não credita — é a mesma trava de idempotência que impede um webhook reentregue
de creditar duas vezes.

---

## 4. Vercel — variáveis de Preview

O domínio já está criado e apontado para o branch `develop`; falta o DNS (§1) e
faltam as variáveis. **Sem elas o deploy de preview nem sobe**: `lib/env/client.ts`
e `lib/env/server.ts` fazem `throw` no import quando a validação Zod falha, o
que é de propósito — falhar no boot é melhor que falhar na primeira gravação.

**Settings → Environment Variables → Add**, escopo **Preview**, e em *Branch*
escolha **`develop`**.

> Se você deixar o Preview sem branch, essas variáveis passam a valer para o
> preview de **qualquer** branch. Não é o fim do mundo (é tudo ambiente de
> teste), mas fixar em `develop` mantém o resto dos previews previsível.

| Variável | Valor | De onde tirar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bpyibejicgswgxvbpsvg.supabase.co` | aqui mesmo |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | `.env.dev` |
| `SUPABASE_SERVICE_ROLE_KEY` | — | `.env.dev` |
| `OPENAI_API_KEY` | — | `.env.dev` (mesma de prod) |
| `STRIPE_SECRET_KEY` | `sk_test_…` | `.env.dev` |
| `STRIPE_PRICE_PESSOAL` | `price_…` (teste) | `.env.dev` |
| `STRIPE_PRICE_ESTUDIOSO` | `price_…` (teste) | `.env.dev` |
| `STRIPE_PRICE_TOPUP_500` | `price_…` (teste) | `.env.dev` |
| `STRIPE_WEBHOOK_SECRET` | ver §6 | — |
| `APP_URL` | `https://dev.scriba.cc` | aqui mesmo |
| `CRON_SECRET` | — | `.env.dev` |

Quatro observações que evitam retrabalho:

- **`APP_URL` não é opcional aqui.** Sem ela, `lib/env/server.ts` cai no
  `VERCEL_URL`, que é a URL aleatória do deploy. O Checkout devolveria o usuário
  para `scriba-abc123-….vercel.app` em vez de `dev.scriba.cc`.
- **`STRIPE_WEBHOOK_SECRET` só depois do §6.** Enquanto não existir, as rotas
  `/api/billing/*` respondem 503 `billing_unavailable` — o app funciona, só não
  vende. Se preferir, deixe a variável fora por ora; ela é opcional no schema.
- **`NEXT_PUBLIC_*` são inlinadas no bundle em tempo de build.** Mudar depois de
  deployar exige um **redeploy** — não basta salvar a variável.
- **Não copie as de produção.** Se o preview subir com a `NEXT_PUBLIC_SUPABASE_URL`
  de prod, tudo parece funcionar e você estará gravando sermão de teste no banco
  real dos usuários.

### 4.1 Deployment Protection

Previews nascem protegidos por login da Vercel. Do jeito que está,
`dev.scriba.cc` vai pedir autenticação para quem não estiver no time — e vai
barrar também o webhook do Stripe, que chega **sem cookie**.

**Settings → Deployment Protection → Vercel Authentication**

- Se quiser o dev aberto (mais simples, e é um ambiente de teste):
  **Disabled**.
- Se quiser manter fechado: use *Protection Bypass for Automation* e cadastre o
  header de bypass no endpoint do Stripe. Mais trabalhoso, e só vale a pena se o
  ambiente de dev tiver algo que não pode ser visto.

### 4.2 O cron não roda em dev

`vercel.json` agenda `/api/billing/sweep` diariamente, mas cron da Vercel só
executa em deploys de **produção**. Em `dev.scriba.cc` a varredura simplesmente
não existe.

Isso é aceitável: o sweep é a **quarta** linha de defesa do crédito, e as três
de cima (webhook, reconciliação no retorno do checkout, e o check preguiçoso no
`GET /api/billing/summary`) funcionam normalmente em dev. Para exercitá-la à
mão:

```bash
curl -H "Authorization: Bearer <CRON_SECRET do .env.dev>" \
     http://localhost:3000/api/billing/sweep
```

---

## 5. Verificação de ponta a ponta

Depois de §1–§4, nesta ordem:

1. **DNS** — `nslookup -type=CNAME dev.scriba.cc 8.8.8.8` devolve o
   `vercel-dns-017.com`, e o painel da Vercel sai de "Invalid Configuration".
2. **Deploy** — precisa existir pelo menos um deploy do branch `develop`. O
   domínio está preso a ele: sem deploy, resolve mas não serve nada. Um push em
   `develop` (ou *Redeploy* no painel) resolve.
3. **Local** — reinicie o `npm run dev`. O banner tem de mostrar
   `supabase  bpyibejicgswgxvbpsvg`. Se mostrar `chnzfeisfaneuyuyzjvy`, você
   está falando com produção.
4. **Login com Google em `http://localhost:3000/sign-in`.** É este passo que
   prova §2 e §3 juntos. Se cair numa página em branco depois do Google, é a
   lista de Redirect URLs (§3.2). Se o Google recusar antes, é o redirect URI
   (§2).
5. **Login com Google em `https://dev.scriba.cc/sign-in`.** Prova §4.
6. **Grave uma sessão curta** em qualquer um dos dois. Confirma que o
   `coin_balance = 50` do usuário novo debitou e que a transcrição chegou.

Se o passo 6 funcionar, o ambiente está de pé. O §6 abaixo só importa se você
for testar **compra** dentro de `dev.scriba.cc`.

---

## 6. Depois (opcional) — Stripe de teste em `dev.scriba.cc`

Não é necessário para desenvolver: na sua máquina, `npm run stripe:listen` já
resolve o webhook local, e é assim que o fluxo de compra vem sendo testado.

Isto aqui só é preciso se você quiser comprar **pelo `dev.scriba.cc`**, porque
o `stripe listen` encaminha para `localhost` e não alcança a Vercel.

**Pré-requisito: Deployment Protection desligada** (§4.1). Com ela ligada, o
Stripe recebe a tela de login da Vercel em vez da sua rota e o webhook falha em
silêncio.

1. `dashboard.stripe.com` com **Test mode LIGADO** → *Developers → Webhooks →
   Add endpoint*.
2. URL: `https://dev.scriba.cc/api/stripe/webhook`
3. Eventos (os mesmos que o `stripe:doctor` cobra):
   `invoice.paid`, `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `charge.refunded`, `charge.dispute.created`.
4. Copie o **signing secret** desse endpoint (`whsec_…`) para a variável
   `STRIPE_WEBHOOK_SECRET` de **Preview** na Vercel — e faça redeploy.

> **Existem três `whsec_` diferentes e nada no formato os distingue:** o do
> `stripe listen` (sua máquina), o deste endpoint de teste (`dev.scriba.cc`) e o
> do endpoint live (`scriba.cc`). Usar o errado é a falha mais silenciosa do
> sistema inteiro — o cartão passa, a tela mostra sucesso, o webhook devolve 400
> e o saldo do usuário não muda. Não reaproveite o do `.env.dev` aqui.

Contexto completo em `docs/stripe-setup.md`.

---

## Pendências do repo

Duas coisas que ficaram para você decidir, nenhuma bloqueia o acima:

- **`.env.local.bak`** na raiz — é o `.env.local` antigo, renomeado. O conteúdo
  já está distribuído em `.env.dev` e `.env.prod`. Apague quando conferir.
- **Migrações `0012`–`0016`** (pgvector + `knowledge_sources` /
  `knowledge_chunks` / `match_knowledge`) foram removidas do repo quando o RAG
  saiu do escopo. As tabelas continuam no banco de **produção**, órfãs — nenhum
  código as usa. O projeto de dev nasceu sem elas, refletindo o schema que o
  código realmente precisa. Se quiser paridade exata, os arquivos estão em
  `git show 985ae2d`.
