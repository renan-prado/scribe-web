# 06 — Rate limit e força bruta

**Status:** ✅ Concluído — sem achado de código. A auditoria CORRIGIU o achado da tarefa 02 (ver abaixo): os fluxos de e-mail/senha estão desligados de fato nos dois ambientes. Só resta uma verificação de painel, agora rebaixada a INFORMATIONAL. Ver "Rodada 2026-09-05".

## Objetivo

Auditoria focada exclusivamente em autenticação e proteção contra força
bruta — sem sobrepor com a tarefa 02 (que cobre lógica de sessão/senha em
geral) nem a 05 (custo).

## Prompt para a IA

```
Faça uma auditoria de segurança focada exclusivamente em autenticação e proteção contra ataques de força bruta.

Analise a aplicação procurando principalmente por:

1. Ausência de rate limiting no login
   - Verifique se é possível realizar dezenas ou centenas de tentativas de login consecutivas sem bloqueio, atraso progressivo ou limitação.
   - Verifique se o rate limiting existe por IP, por conta/identificador e/ou por sessão.
   - Verifique se diferentes endpoints de autenticação possuem a mesma proteção.
   - Procure formas de contornar o rate limiting utilizando múltiplos IPs, headers, IPv4/IPv6, endpoints alternativos ou variações da requisição.

2. Proteção contra automação
   - Verifique se CAPTCHA ou mecanismo equivalente é acionado quando há comportamento suspeito.
   - Avalie se o CAPTCHA pode ser facilmente contornado ou se existe algum endpoint de autenticação que não passa por essa proteção.

3. Enumeration de contas
   - Verifique se mensagens, status codes ou tempos de resposta permitem descobrir se um e-mail/usuário existe.
   - Verifique também os fluxos de recuperação de senha, cadastro e alteração de senha.

4. Proteção de credenciais
   - Verifique armazenamento, transmissão e tratamento das credenciais.
   - Procure senhas, tokens ou segredos expostos em logs, respostas HTTP, URLs, localStorage, cookies ou código frontend.

Para cada vulnerabilidade encontrada, informe:
- Severidade: Critical / High / Medium / Low
- Evidência
- Endpoint ou componente afetado
- Como a vulnerabilidade poderia ser explorada
- Impacto
- Correção recomendada
- Se a correção deve ser feita na aplicação, no Cloudflare/WAF ou em ambos.

Não considere "ocultar" o endpoint uma correção válida para uma vulnerabilidade de autenticação.
```

## Checklist de validação

- [x] `app/sign-in`, `app/sign-up`, e o fluxo de reset de senha usam a
      autenticação do Supabase (não um login customizado) — confirmar
      quais proteções de rate limit/CAPTCHA o próprio Supabase Auth já
      oferece e quais estão de fato ligadas no painel do projeto (dev e
      prod separadamente).
- [x] Nenhum endpoint de autenticação alternativo (ex.: um `route.ts`
      próprio em `app/api/` que faça login/verificação por fora do
      Supabase Auth) escapa da mesma proteção.
- [x] Resposta de "e-mail não encontrado" vs. "senha incorreta" não difere
      de forma que permita enumerar contas — nem por mensagem, nem por
      status HTTP, nem por tempo de resposta perceptível.
- [x] Nenhuma credencial, token de sessão ou chave aparece em log
      (`createLogger` de `@/lib/log` — confirmar que nenhum call site loga
      o corpo inteiro da requisição de login/reset).
- [x] Cookies de sessão do Supabase SSR têm `Secure`, `HttpOnly` e
      `SameSite` adequados (isso é comportamento padrão do
      `@supabase/ssr` — confirmar que nada no projeto sobrescreve).
- [~] Se a Vercel está atrás de Cloudflare/WAF em produção, verificar se
      existe alguma regra de rate limit no nível de borda para
      `/sign-in`, `/sign-up` e rotas de reset — e se ela cobre IPv6 e
      headers alternativos de IP (`X-Forwarded-For` forjado), não só o IP
      "óbvio".

## Áreas do repositório a inspecionar

- `app/sign-in`, `app/sign-up`, `app/auth`
- `lib/supabase/require-auth.ts` e qualquer client de auth em `lib/`
- `lib/log` (verificar o que é logado nos fluxos de auth)

## Critério de aceite

Uma sequência de tentativas de login automatizada (script simples, sem
credencial válida) encontra bloqueio, atraso progressivo ou CAPTCHA antes de
completar dezenas de tentativas — e o mesmo vale trocando o IP/header entre
tentativas.

---

## Rodada 2026-09-05

### 1. A superfície de autenticação do app é UMA: Google OAuth

`app/sign-in` e `app/sign-up` renderizam só o `GoogleSignInButton`, que chama
`supabase.auth.signInWithOAuth({ provider: "google" })` e manda o navegador
para o Google. Não há campo de senha, não há endpoint próprio de login em
`app/api/**` (busca por `signInWithPassword`, `grant_type`, `/auth/v1/token`:
nenhum resultado). A força bruta de credencial e a checagem de senha são
problema do Google, não nosso.

### 2. Os fluxos de e-mail do Supabase estão DESLIGADOS — nos dois ambientes

Isto **corrige o achado MEDIUM da tarefa 02**, que se baseou em
`/auth/v1/settings` reportar `"email":true` em produção. Batendo nos endpoints
REAIS, todos recusam:

| Endpoint | dev | prod |
|---|---|---|
| `POST /auth/v1/token?grant_type=password` | 422 `email_provider_disabled` | 422 `email_provider_disabled` |
| `POST /auth/v1/signup` | 400 `email_provider_disabled` | 400 `email_provider_disabled` |
| `POST /auth/v1/otp` (magiclink) | 422 `email_provider_disabled` | 422 `email_provider_disabled` |
| `POST /auth/v1/recover` (reset) | 400 `email_provider_disabled` | 400 `email_provider_disabled` |

Doze tentativas seguidas de `grant_type=password` em produção: doze
`email_provider_disabled`, nenhuma passa perto de validar credencial. O campo
`email` do `settings` é enganoso — o provedor está de fato desativado. Não há
superfície de força bruta, de enumeração por reset/signup, nem de spam de
e-mail, porque não há fluxo de e-mail.

### 3. Enumeração de contas

Sem fluxo de e-mail, não há resposta que difira entre "existe" e "não existe".
O único endpoint público que confirma a existência de ALGO é a server action
`applyReferralCode` (código de parceiro digitado no login) — e ela já é
limitada a **20 tentativas por 10 min por IP** com o comentário explicando que
existe justamente para não virar oráculo de enumeração de slugs. Não é
enumeração de conta.

### 4. Credenciais em log

`app/auth/callback` loga só `error.message` e a atribuição de parceiro
(`slug`, `source`, `result`) — nunca token, code ou corpo da requisição. O
`code` do PKCE fica na query da URL do callback (padrão do OAuth) e é
descartado na troca. Nenhum call site loga o corpo de uma requisição de auth.

### 5. Flags do cookie de sessão

`@supabase/ssr` (`DEFAULT_COOKIE_OPTIONS`): `sameSite: "lax"`, `path: "/"`,
`maxAge` 400 dias, e `Secure` acrescentado automaticamente sob https (em
produção, portanto, sim). **`httpOnly: false` é por DESENHO** — o client do
navegador lê o token com `document.cookie`, e é exatamente por isso que o
`proxy.ts` emite uma CSP com `connect-src` restrito: um XSS aqui vaza a sessão,
então a defesa é impedir que o cookie roubado chegue a algum lugar. Nada no
projeto sobrescreve essas opções (só repassa o que o SDK entrega). Coerente com
o desenho documentado.

### 6. Achado (rebaixado da tarefa 02)

| Item | Sev. | Situação |
|---|---|---|
| `/auth/v1/settings` reporta `email:true` em prod, mas todos os fluxos de e-mail recusam com `email_provider_disabled` | INFORMATIONAL | Vale uma olhada no painel para deixar o flag coerente, mas **não é vulnerabilidade**: funcionalmente os fluxos estão fechados. A proteção contra senha vazada (HIBP) e regras de senha ficam sem objeto — não há senha no produto |

### 7. O que fica no painel/WAF (não fecha por código)

- **CAPTCHA / rate limit de borda** para os fluxos de auth: como só existe o
  OAuth do Google, que é rate-limitado pelo próprio Google, não há endpoint de
  auth nosso para uma regra de Cloudflare proteger. Se um dia o provedor de
  e-mail for ligado, aí sim CAPTCHA + HIBP + regra de WAF passam a ser
  necessários — e a tarefa 02 volta a ter objeto.

### Critério de aceite

Atendido por ausência de superfície: não há login por credencial no app para
automatizar. A única entrada é o OAuth do Google.
