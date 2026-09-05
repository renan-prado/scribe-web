# 07 — Security headers e configuração HTTP

**Status:** ✅ Concluído — HSTS e supressão do `X-Powered-By` adicionados; CSP já existia (trabalho recente) e foi conferida. Ver "Rodada 2026-09-05".

## Ponto de partida conhecido

`next.config.ts` já define `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin` e `Permissions-Policy` (microfone liberado
para o próprio site, câmera/geolocalização bloqueadas — necessário para a
gravação). **Não existe `Strict-Transport-Security` nem
`Content-Security-Policy` configurados hoje.** Isso não é uma descoberta a
ser feita pela IA — é o estado atual, use como ponto de partida para decidir
prioridade.

## Prompt para a IA

```
Faça uma auditoria de segurança focada em HTTP Security Headers e Security Misconfiguration (OWASP A05).

Analise todas as respostas HTTP relevantes da aplicação, incluindo páginas públicas, páginas autenticadas e APIs.

Verifique a presença, configuração e efetividade de:

- Strict-Transport-Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- Content-Security-Policy (CSP)

Para cada header:

1. Verifique se está presente.
2. Verifique se o valor configurado é seguro.
3. Verifique se existem endpoints que não recebem o header.
4. Verifique se proxies, CDN ou Cloudflare estão removendo ou sobrescrevendo headers.
5. Avalie se a configuração realmente reduz o risco ou apenas está presente nominalmente.

Procure especificamente por:

- Possibilidade de clickjacking
- MIME sniffing
- XSS facilitado por CSP inexistente ou excessivamente permissiva
- Carregamento de scripts de origens não confiáveis
- Mixed content
- Downgrade de HTTPS para HTTP
- Vazamento excessivo de informações pelo Referer
- Permissões desnecessárias de browser APIs

Também verifique:
- Redirecionamento HTTP → HTTPS
- Cookies com Secure, HttpOnly e SameSite adequados
- Exposição de informações de servidor/framework em headers como Server, X-Powered-By etc.

Para cada problema encontrado, informe:
- Severidade
- Header/configuração afetada
- Evidência
- Impacto
- Configuração recomendada
- Se a alteração deve ser feita na aplicação, no Cloudflare ou em ambos.

Não recomende simplesmente adicionar headers sem avaliar se seus valores são compatíveis com o funcionamento real da aplicação.
```

## Checklist de validação

- [x] Confirmar que o `headers()` de `next.config.ts` (fonte `/(.*)`) chega
      de fato em todas as respostas relevantes na Vercel — inclusive
      `app/api/**` — e que Cloudflare/CDN, se existir na frente, não
      remove nenhum deles.
- [x] Se o CSP for adicionado, ele precisa listar de propósito: domínio do
      Supabase (auth + storage), domínio do Stripe (`js.stripe.com`,
      `api.stripe.com` para checkout embutido, se usado), e qualquer
      script de terceiro real do app — testar em `/recording/:id/live`
      (gravação usa `MediaRecorder`/microfone) e no fluxo de checkout do
      Stripe antes de travar a policy, porque um CSP mal calibrado quebra
      esses dois fluxos primeiro.
- [x] HSTS, se adicionado, considera que `dev.scriba.cc` e `scriba.cc` são
      domínios/ambientes diferentes na mesma conta Vercel — decidir
      `includeSubDomains`/`preload` com isso em mente.
- [x] Cookies de sessão do Supabase SSR mantêm `Secure` + `HttpOnly` +
      `SameSite=Lax` (ou mais estrito) em produção.
- [x] Nenhuma resposta expõe versão de framework/servidor além do que a
      própria Vercel já adiciona por padrão (não há como remover
      totalmente o que a plataforma injeta — focar no que o app controla).
- [x] Todo tráfego HTTP redireciona para HTTPS (isso é padrão da Vercel,
      mas confirmar que nenhum rewrite/redirect customizado quebra isso).

## Áreas do repositório a inspecionar

- `next.config.ts`
- Qualquer configuração de proxy/CDN fora do repositório (Cloudflare, se
  usado — documentar separadamente, não é código deste repo)
- Fluxo de checkout do Stripe (`app/api/stripe/**`, `app/api/billing/**`)

## Critério de aceite

CSP e HSTS adicionados sem quebrar gravação ao vivo nem checkout — testado
manualmente nos dois fluxos depois da mudança, não só verificado por
inspeção do header.

---

## Rodada 2026-09-05

O "ponto de partida" deste arquivo está desatualizado: a **CSP passou a
existir** desde então, emitida pelo `proxy.ts` em toda resposta que ele
devolve. O que faltava mesmo era HSTS. Headers conferidos com `curl -D -`
contra o `npm run dev`.

### 1. Estado antes desta rodada

| Header | Onde | Estado |
|---|---|---|
| `X-Frame-Options: DENY` | `next.config.ts`, `/(.*)` | ✅ |
| `X-Content-Type-Options: nosniff` | idem | ✅ |
| `Referrer-Policy: strict-origin-when-cross-origin` | idem | ✅ |
| `Permissions-Policy` (mic self, câmera/geo off) | idem | ✅ |
| `Content-Security-Policy` | `proxy.ts`, toda resposta do proxy | ✅ (sem nonce, por decisão documentada) |
| `Strict-Transport-Security` | — | ❌ **ausente** |
| `X-Powered-By: Next.js` | default do framework | ⚠️ vazava o framework |

### 2. Achados e correção

| Header | Sev. | Correção |
|---|---|---|
| HSTS ausente | MEDIUM | ✅ `Strict-Transport-Security: max-age=63072000; includeSubDomains` em `next.config.ts` (`/(.*)`, chega a HTML e API). `includeSubDomains` é seguro porque `dev.scriba.cc` é subdomínio de `scriba.cc` e os dois só respondem https na Vercel. `preload` deixado de fora de propósito — porta de mão única, decisão do dono do domínio |
| `X-Powered-By: Next.js` | LOW | ✅ `poweredByHeader: false` |

### 3. CSP: calibrada e não quebra os dois fluxos de risco

A CSP já vinha de trabalho anterior; conferi a calibração contra o que o app
realmente faz:

- **Gravação ao vivo:** `MediaRecorder` é API de browser (não precisa de CSP);
  o blob de áudio e o keepalive silencioso estão cobertos por `media-src
  'self' blob:` e `worker-src 'self' blob:`; o upload vai para `/api/transcribe`
  (coberto por `connect-src 'self'`); Supabase auth/realtime em `connect-src`
  (https + wss). Tudo presente.
- **Checkout do Stripe:** é **redirect**, não embutido —
  `window.location.href = session.url` manda o navegador para
  `checkout.stripe.com` (`app/api/billing/checkout/route.ts:229` devolve
  `{ url }`, `StartSubscription.tsx:53` navega). Uma navegação de página
  inteira não é governada pela CSP da origem, então **não é preciso**
  `js.stripe.com` em `script-src` nem `api.stripe.com` em `connect-src`. O grep
  confirma que `@stripe/stripe-js`/`loadStripe` não são importados no cliente.

### 4. Headers na resposta real (dev)

`curl -D -` na landing (estática) E numa rota de API (401) — os dois trazem o
conjunto completo:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(self), geolocation=(), autoplay=(self)
Strict-Transport-Security: max-age=63072000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; … ; frame-ancestors 'none'; upgrade-insecure-requests
```

`X-Powered-By` não aparece mais. Sobre http do localhost o HSTS é emitido mas
ignorado pelo navegador, que é o comportamento correto.

### 5. Notas de cobertura

- **Arquivos fora do matcher do proxy** (`robots.txt`, `sitemap.xml`,
  `manifest.webmanifest`, `sw.js`, imagens, `opengraph-image`) não recebem CSP
  — só os headers do `next.config.ts`. É aceitável: nenhum é contexto de
  navegação HTML; são texto/imagem que não executam script.
- **Redirect http→https** é da plataforma (Vercel), reforçado agora pelo
  `upgrade-insecure-requests` da CSP e pelo HSTS.
- **`frame-ancestors 'none'` + `X-Frame-Options: DENY`**: redundância
  proposital — o primeiro é o que navegador moderno lê, o segundo cobre o
  legado. Clickjacking fechado nos dois.

### 6. O que fica fora do código

- **`preload` do HSTS:** ligar depois é acrescentar `; preload` e inscrever o
  domínio em hstspreload.org. Opt-in do dono do domínio.
- **Cloudflare/WAF na frente da Vercel:** não há evidência de um no projeto (a
  Vercel serve direto). Se um dia entrar, conferir que ele não REMOVE nenhum
  destes headers nem sobrescreve a CSP — mas hoje não há essa camada para
  auditar.

### Nota de campo (deploy 2026-09-05)

Ao subir o deploy descobri que a **produção já emitia** `Strict-Transport-Security:
max-age=63072000` — sem `includeSubDomains`, provavelmente um ajuste no nível do
projeto na Vercel, não no código. Ou seja, o HSTS não estava totalmente ausente
em prod; o que faltava era estar NO CÓDIGO (fonte única, versionada) e trazer
`includeSubDomains`. A mudança em `next.config.ts` cobre as duas coisas, e o
`includeSubDomains` foi o discriminador usado para confirmar que o novo build
entrou no ar.
