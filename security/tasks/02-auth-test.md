# 02 — Teste de autenticação

**Status:** ✅ Concluído — 2 achados LOW de código corrigidos e reverificados.
O achado MEDIUM desta rodada ("provedor de e-mail LIGADO em prod") foi
**refutado pela tarefa 06**: batendo nos endpoints reais, todos os fluxos de
e-mail recusam com `email_provider_disabled` nos dois ambientes — o `email:true`
do `/auth/v1/settings` era enganoso. Ver a correção no fim desta seção e o
detalhe em `06-rate-limit-bruteforce.md`.

## Objetivo

Atacar cada caminho de autenticação como se quisesse entrar: sessão, senha,
reset e verificação de e-mail.

## Prompt para a IA

```
Attack my authentication like you want in. Walk every auth path in this repo:

1. List every route and API endpoint and whether it verifies a valid session.

Flag any that skip it.

2. Session handling: where tokens live, whether they expire, whether logout and

password change kill them

3. Password rules: minimum length, breached-password check, anything my auth

provider offers that I left off

4. Password reset and email verification: can I reset someone else's password,

or use the app with an unverified email?

Output: flow | weakness | exact exploit steps | severity | fix.

Any endpoint that trusts a user ID from the request body instead of the session

is CRITICAL.
```

## Checklist de validação

- [x] Toda rota em `app/api/**/route.ts` que não seja pública de propósito
      (ex.: `app/api/stripe/webhook`, que se autentica pela assinatura do
      Stripe, não por sessão) passa por `lib/supabase/require-auth.ts` — ou
      equivalente — antes de tocar em dado de usuário.
- [x] Nenhuma rota lê um `userId`/`accountId` do corpo da requisição para
      decidir de quem é o dado — o ID vem sempre da sessão verificada no
      servidor.
- [x] `app/api/admin/*` exige não só sessão válida, mas papel de admin —
      confirme que `canCurrentUserUse`/checagem equivalente roda no servidor,
      não só esconde o link no `app/admin` (UI).
- [x] `app/partners/layout.tsx` e as rotas de parceiro fazem a mesma
      checagem de identidade + papel, não só sessão genérica.
- [x] Logout e troca de senha invalidam a sessão anterior (não dá para
      continuar usando um token antigo depois).
- [x] Regras de senha, proteção contra senha vazada (breached-password
      check) e confirmação de e-mail usam o que o Supabase Auth já oferece.
      **Sem objeto:** a tarefa 06 provou que não há login por senha em nenhum
      dos dois ambientes (`grant_type=password`, `signup`, `otp` e `recover`
      recusam com `email_provider_disabled`). Sem senha, não há regra de senha
      nem HIBP a configurar.
- [x] Fluxo de reset de senha: link de uso único, expira, não reseta a conta
      de outro. **Sem objeto:** `recover` está desligado nos dois ambientes.
      O app nunca teve tela de reset.
- [x] Não é possível usar funcionalidades pagas ou sensíveis com e-mail não
      verificado, se a verificação de e-mail estiver ligada no projeto.
      (`mailer_autoconfirm: false` nos dois projetos: sem confirmar, não há
      sessão; e o único fluxo do app é OAuth do Google, que já entrega
      e-mail verificado.)

## Áreas do repositório a inspecionar

- `lib/supabase/require-auth.ts`
- `lib/entitlements/` (quem decide o que cada plano libera — ver
  `AGENTS.md` na raiz: nunca deve haver `plan === "..."` solto fora daqui)
- `app/api/admin/**`, `app/admin/**`
- `app/partners/layout.tsx`, `app/api/**` sob rotas de parceiro
- `app/sign-in`, `app/sign-up`, `app/auth`

## Critério de aceite

Toda rota da tabela de saída com "skip session check" corrigida, e nenhum
endpoint restante confia em identificador vindo do client sem cruzar com a
sessão do servidor.

---

## Rodada 2026-09-05

Ataque real, não leitura: duas contas de teste criadas no Supabase de **dev**
(`sec-audit-a@` e `sec-audit-b@`, via `admin/generate_link` + `/auth/v1/verify`),
cookie `sb-<ref>-auth-token` montado no mesmo formato do `@supabase/ssr`, e as
rotas batidas com `curl` contra `npm run dev`.

### 1. Inventário de sessão — 34 rotas

As 28 rotas de dado de usuário responderam **307** (o proxy manda para
`/sign-in`) sem cookie, e o `requireAuth`/`requireAdmin` de dentro reconfere.
As seis restantes são públicas de propósito e cada uma se defende sozinha:

| Rota | Como se autentica | Sem credencial |
|---|---|---|
| `/api/stripe/webhook` | HMAC da assinatura do Stripe | 400 |
| `/api/billing/sweep` | `CRON_SECRET` | 401 |
| `/auth/callback` | code do PKCE | redirect com erro |
| `/auth/sign-out` | nenhuma (idempotente) | 303 |
| `/r/[slug]` | pública por desenho (link do parceiro), rate limit por IP | 302 |
| `/` `/sign-in` `/terms` `/privacy` | páginas públicas | 200 |

### 2. Achados

| Fluxo | Fraqueza | Passo do exploit | Severidade | Correção |
|---|---|---|---|---|
| `PATCH` e `DELETE /api/sessions/:id` | devolviam **200 para sessão alheia** | B: `PATCH /api/sessions/<id de A>` `{"title":"HACKED"}` → `{"ok":true}`. A RLS bloqueou a escrita (conferido com service-role: `title` seguiu `null`, dono inalterado, linha não apagada), mas o PATCH ainda promovia speaker/location na conta de B, e a resposta mentia | LOW | ✅ `getSessionMeta` antes do trabalho, 404 se não é do chamador — `app/api/sessions/[id]/route.ts`. Reverificado: 404 para B, 404 para uuid inexistente, 200 + efeito real para o dono |
| `/auth/callback` | montava o redirect com `https://${x-forwarded-host}` sem validar o header | não reproduzível: o ramo só roda fora de `NODE_ENV=development`, o header não é definível cross-origin e a Vercel o reescreve. O risco era a proteção ser de infraestrutura, não nossa — igual ao que `proxy.ts` já documenta para a allowlist de origem | LOW | ✅ allowlist de host (`scriba.cc`, `www.`, `dev.`, previews `-renanprados-projects`), com queda para o `origin` — `app/auth/callback/route.ts` |
| ~~Supabase Auth de **produção**: provedor e-mail LIGADO~~ | **REFUTADO na tarefa 06** | Baseei-me em `/auth/v1/settings` → `"email":true`. Mas os endpoints REAIS (`token?grant_type=password`, `signup`, `otp`, `recover`) recusam com `email_provider_disabled` **nos dois ambientes** — 12 tentativas em prod, 12 recusas. O `settings` mentia; não há superfície de senha | ~~MEDIUM~~ → INFORMATIONAL | Sem correção de código. Ver item 6 da tarefa 06 |
| Senha vazada (HIBP) e comprimento mínimo | Sem objeto: não há login por senha (acima), logo não há senha a proteger | — | INFORMATIONAL | Nada a fazer enquanto o provedor de e-mail seguir desligado |

**Nenhum endpoint confia em id vindo do cliente.** O único `userId` de corpo de
requisição está em `POST /api/admin/features` (exceção por pessoa), que é o
propósito da rota e roda atrás de `requireAdmin()`.

### 3. O que foi reproduzido e passou

- **IDOR nas rotas que gastam dinheiro:** B pedindo `final-summary`,
  `final-summary/reprocess` e `hallucination-report` sobre a sessão de A recebe
  `session_not_found` **antes** de qualquer chamada à OpenAI; A na mesma sessão
  recebe `session_not_finalized`, ou seja, a leitura enxergou a linha. O gate é
  o `getSession`/`getSessionMeta` com o client do usuário (RLS).
- **Admin:** `GET /api/admin/users` com sessão comum → **404** (não 403 — não
  confirmamos a existência da área). `app/admin/layout.tsx` faz `notFound()`, e
  as três actions privilegiadas (`coins/settings-actions.ts`, `fx/actions.ts`)
  chamam `assertAdmin()` dentro de si.
- **Parceiro:** `/partners` é gated por `getCurrentPartner()` no layout, com
  `notFound()`; não há rota de API de parceiro. O casamento por `invited_email`
  escapa curinga de `ilike` e exige `user_id is null`.
- **Logout mata a sessão de verdade:** `signOut()` do auth-js usa
  `scope: 'global'` por padrão. Replay do MESMO cookie depois do logout →
  307 no app, e o `access_token` antigo direto no `/auth/v1/user` do Supabase →
  **403**.
- **Conta desativada:** com `profiles.is_active = false`, `/api/coins/balance` e
  `/api/transcribe` devolvem **403 `account_disabled`**; volta a 200 ao
  reativar.

### 4. Correção deste relatório (rodada da tarefa 06)

O achado MEDIUM acima foi **derrubado por teste mais fundo na tarefa 06**. Eu
havia lido `/auth/v1/settings` (`"email":true` em prod) e concluído que o login
por senha estava aberto. Estava errado: batendo nos endpoints que realmente
autenticam, os quatro recusam com `email_provider_disabled`, em dev E em prod.
O campo do `settings` não reflete o estado operacional do provedor.

Consequência: não há superfície de força bruta, de reset, de signup por e-mail
nem de senha vazada — porque não há senha. A única porta de entrada é o OAuth
do Google, nos dois ambientes.

**Único resíduo, INFORMATIONAL (opcional):** o `settings` reportar `email:true`
em prod é cosmético/confuso; vale uma olhada no painel
(**Authentication → Providers → Email**) para deixar o flag coerente com o
comportamento. Não é urgente e não é vulnerabilidade. Se um dia o provedor de
e-mail for de fato ligado, esta tarefa e a 06 voltam a ter objeto (aí sim:
HIBP, regras de senha, CAPTCHA, rate limit de borda).
