import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { clientEnv } from "@/lib/env/client";

/**
 * Next.js 16 proxy (formerly middleware). Refreshes the Supabase auth cookie
 * on every non-static request and gates protected routes. Follows the
 * @supabase/ssr contract — do NOT insert code between createServerClient and
 * supabase.auth.getUser(), as rewriting cookies mid-flight breaks the
 * session-refresh handshake.
 *
 * Route buckets:
 *   PUBLIC     — /, /sign-in, /sign-up, /auth/*, /about, /contact, /terms, /privacy
 *   PROTECTED  — a known app area (KNOWN_APP_PREFIXES) behind the login
 *   UNKNOWN    — neither: passed through so the Next router answers a real 404
 *
 * Unauth users hitting a protected route → /sign-in?next=<original-path>.
 * Auth users hitting /sign-in or /sign-up → /feed (already in).
 * `GET /` with `Accept: text/markdown` → rewritten to /index.md.
 */

/**
 * `/api/stripe` entra aqui porque o webhook do Stripe chega SEM cookie de
 * sessão: sem a exceção, este proxy responderia com um 307 para /sign-in e
 * toda entrega de evento falharia silenciosamente. A rota se defende sozinha
 * verificando a assinatura HMAC do payload — ser pública é requisito, não
 * descuido. Ver app/api/stripe/webhook/route.ts.
 */
// "/api/billing/sweep" segue o mesmo padrão do webhook: público no proxy (o
// cron da Vercel não tem cookie de sessão), autenticado por CRON_SECRET dentro
// da própria rota.
//
// "/r" é o link do parceiro (/r/<slug>): quem chega por ele é, por definição,
// um visitante anônimo vindo de fora. Sem esta entrada, o proxy responderia
// 307 para /sign-in e o link de divulgação levaria a uma tela de login em vez
// da landing page. Ver app/r/[slug]/route.ts.
const PUBLIC_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/auth",
  "/terms",
  "/privacy",
  "/about",
  "/contact",
  "/r",
  "/api/stripe",
  "/api/billing/sweep",
];
const AUTH_ONLY_PREFIXES = ["/sign-in", "/sign-up"];

/**
 * Áreas do app que EXISTEM e ficam atrás do login.
 *
 * Um caminho que não é público e não bate com nenhuma delas não é rota
 * nenhuma: deixamos o Next renderizar `app/not-found.tsx` e responder 404 de
 * verdade, em vez de mandar um `307 → /sign-in` que a Vercel entrega como 200
 * com a casca do app. Esse soft-404 fazia rastreador e agente concluírem que
 * TODA URL existe.
 *
 * A lista é manual porque o proxy roda antes do roteamento e não enxerga a
 * árvore de `app/`. Rota nova numa área nova entra aqui no mesmo commit.
 */
const KNOWN_APP_PREFIXES = [
  "/feed",
  "/list",
  "/studies",
  "/profile",
  "/recording",
  "/billing",
  "/admin",
  "/partners",
  "/session",
  "/api",
];

// `dev.scriba.cc` é o ambiente de desenvolvimento: mesmo projeto na Vercel,
// domínio fixado no branch `develop`, com env vars de Preview apontando para o
// Supabase e o Stripe de teste. Ver docs/ambientes.md.
const STATIC_ALLOWED_ORIGINS = new Set([
  "https://scriba.cc",
  "https://www.scriba.cc",
  "https://dev.scriba.cc",
]);
// localhost / 127.0.0.1 on any port, plus Vercel preview URLs scoped to this
// project (e.g. scribe-<hash>-renanprados-projects.vercel.app).
//
// O sufixo `-renanprados-projects` NÃO é decoração. O padrão era
// `scribe-[a-z0-9-]+\.vercel\.app`, e `vercel.app` é um namespace público:
// qualquer pessoa cria um projeto chamado `scribe-qualquercoisa` e ganha
// `scribe-qualquercoisa.vercel.app`, que casava. Com
// `Access-Control-Allow-Credentials: true`, isso é uma origem controlada por
// terceiro na allowlist. Hoje o estrago é contido pelo `SameSite=Lax` do
// cookie do Supabase, que não acompanha XHR cross-site — ou seja, a proteção
// era um default de biblioteca, não uma decisão nossa. Ancorar no slug do time
// devolve a decisão para cá.
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost(?::\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
  /^https:\/\/scribe-[a-z0-9-]+-renanprados-projects\.vercel\.app$/,
];

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
} as const;

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthOnly(pathname: string): boolean {
  return AUTH_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isKnownAppPath(pathname: string): boolean {
  return KNOWN_APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * O request prefere Markdown? (negociação de conteúdo — acceptmarkdown.com)
 *
 * Só conta `text/markdown` EXPLÍCITO e com q pelo menos igual ao de
 * `text/html`. O `Accept` de navegador (que lista `text/html` e um curinga
 * genérico) e um curinga puro continuam recebendo o HTML.
 */
function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const parts = accept.toLowerCase().split(",");
  const q = (type: string): number | null => {
    const hit = parts.find((p) => p.trim().startsWith(type));
    if (hit === undefined) return null;
    const m = hit.match(/;\s*q=([0-9.]+)/);
    return m ? Number.parseFloat(m[1]) : 1;
  };
  const md = q("text/markdown");
  if (md === null || md === 0) return false;
  const html = q("text/html");
  return html === null || md >= html;
}

/**
 * Sanitiza um `?next=` antes de redirecionar para ele.
 *
 * Exige caminho relativo à nossa origem e recusa as formas que os navegadores
 * resolvem como host externo — `//evil.com`, `/\evil.com`, `/%2F...`. Sem
 * isso, um link `/sign-in?next=...` publicado por terceiros viraria um
 * open redirect com a credibilidade do nosso domínio, que é o vetor clássico
 * de phishing sobre fluxo de login.
 */
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  // "//host" e "/\host" são resolvidos como URL absoluta pelos navegadores.
  if (raw.startsWith("//")) return null;
  if (raw.startsWith("/\\")) return null;
  // "/%2F..." e "/%5C..." viram as formas acima depois da decodificação.
  if (/^\/%2f/i.test(raw)) return null;
  if (/^\/%5c/i.test(raw)) return null;
  return raw;
}

function isAllowedOrigin(origin: string): boolean {
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

/**
 * Content-Security-Policy.
 *
 * POR QUE ELA IMPORTA MAIS AQUI DO QUE NUM APP QUALQUER. O cookie de sessão do
 * `@supabase/ssr` é `httpOnly: false` por DESENHO — o client do navegador lê o
 * token com `document.cookie`, e não há como ligar o flag sem quebrar a
 * biblioteca (ver `DEFAULT_COOKIE_OPTIONS` em @supabase/ssr). Ou seja: aqui um
 * XSS não rouba "alguns dados", rouba a sessão inteira, com um refresh token
 * que o mesmo default deixa válido por 400 dias.
 *
 * POR QUE NÃO TEM NONCE, que é a forma forte. Um nonce muda a cada requisição,
 * então a página que o carrega no HTML não pode ser cacheada — usar nonce
 * OBRIGA renderização dinâmica. E `app/page.tsx` ser estática é invariante
 * declarada deste repositório (ver "Landing page — o que não pode voltar" em
 * app/AGENTS.md): a LP é a única página que um anônimo carrega, e torná-la
 * dinâmica devolve `no-store`, `X-Vercel-Cache: MISS` e HTML remontado na
 * origem a cada visita. Trocar isso por CSP é uma decisão de produto, não de
 * segurança, e não cabe a esta função tomá-la em silêncio.
 *
 * O QUE ESTA VERSÃO COMPRA, então, sem nonce:
 *
 *  - `connect-src` restrito é a peça que mais vale contra o risco descrito
 *    acima. Roubar o cookie só serve se der para MANDÁ-LO para algum lugar, e
 *    daqui só saem requisições para nós, para o Supabase e para o GA.
 *  - `script-src` sem `'unsafe-eval'` (em produção — ver a nota adiante) e com
 *    allowlist de host bloqueia o `<script src="//evil.com">` injetado. NÃO
 *    bloqueia inline: `'unsafe-inline'` é obrigatório enquanto o Next emitir o
 *    bootstrap dele inline sem nonce, e o `ThemeScript` também é inline. Esta é
 *    a folga que o nonce fecharia.
 *  - `object-src 'none'`, `base-uri 'self'` (impede sequestro de URL relativa
 *    por `<base>` injetada) e `form-action 'self'` (impede que um formulário
 *    injetado poste para fora).
 *  - `frame-ancestors 'none'` é o `X-Frame-Options: DENY` do next.config.ts na
 *    forma que os navegadores modernos leem de verdade.
 *
 * `img-src https:` é frouxo de propósito: imagem não executa, e a lista real
 * (avatar do Google, capa do Google Books, sticker local, blob do gravador)
 * mudaria a cada funcionalidade nova, quebrando a tela por um ganho de zero.
 *
 * `'unsafe-eval'` SÓ EM DESENVOLVIMENTO, e a exceção é do React, não nossa: o
 * build de desenvolvimento dele usa `eval()` para remontar callstack vinda de
 * outro ambiente e outras ferramentas de depuração — sem a diretiva, o
 * `next dev` derruba um erro de console em toda página. O build de produção do
 * React nunca chama `eval`, então a folga não precisa existir lá, e é por isso
 * que ela é condicional em vez de constante: uma CSP de produção com
 * `'unsafe-eval'` devolve ao atacante exatamente o primitivo que o resto desta
 * política existe para negar.
 *
 * `NODE_ENV` é fixado pelo comando — `next dev` dá "development", `next build`
 * dá "production" mesmo quando o `scripts/with-env.mjs` injetou o `.env.dev`
 * (é o caso do `npm run build:dev`). Ou seja: nenhum deploy sai com a folga,
 * nem o de preview.
 */
function contentSecurityPolicy(): string {
  const supabase = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).origin;
  const scriptSrc = [
    "script-src 'self' 'unsafe-inline'",
    process.env.NODE_ENV === "development" ? "'unsafe-eval'" : null,
    "https://www.googletagmanager.com",
  ]
    .filter(Boolean)
    .join(" ");
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // O gravador toca um áudio silencioso de keepalive e reproduz blobs locais.
    "media-src 'self' blob:",
    // `sw.js` e qualquer worker que o Next crie a partir de um blob.
    "worker-src 'self' blob:",
    `connect-src 'self' ${supabase} ${supabase.replace(/^https:/, "wss:")} https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const CSP = contentSecurityPolicy();

/**
 * A CSP entra em TODA resposta que o proxy devolve — inclusive no early-return
 * do visitante anônimo e nos redirects. Uma política que só cobre o caminho
 * feliz é uma política que o atacante contorna pedindo outro caminho.
 */
function applyCsp<T extends NextResponse>(response: T): T {
  response.headers.set("Content-Security-Policy", CSP);
  return response;
}

function applyCorsHeaders(response: NextResponse, origin: string, allowed: boolean) {
  response.headers.append("Vary", "Origin");
  if (!allowed) return;
  response.headers.set("Access-Control-Allow-Origin", origin);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    response.headers.set(k, v);
  }
}

export async function proxy(request: NextRequest) {
  const { pathname: earlyPath } = request.nextUrl;
  const origin = request.headers.get("origin") ?? "";
  const isApi = earlyPath.startsWith("/api/");
  const allowedOrigin = origin ? isAllowedOrigin(origin) : false;

  // Negociação de conteúdo Markdown para a landing. Um agente que manda
  // `Accept: text/markdown` recebe `/index.md` (o mesmo texto de `/llms.txt`)
  // em vez do HTML da LP. A resposta Markdown leva `Vary: Accept`.
  //
  // O HTML da LP NÃO leva `Vary: Accept`: o Next é dono desse header nas rotas
  // do App Router e descarta o valor que o proxy ou o `next.config` tentam
  // acrescentar (testado). Não é problema de correção — este proxy roda em todo
  // request, antes de qualquer cache, então quem pede Markdown SEMPRE cai aqui
  // e é reescrito; só um cache de terceiro no meio do caminho ficaria sem o
  // sinal.
  if (earlyPath === "/" && prefersMarkdown(request.headers.get("accept"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/index.md";
    const rewrite = NextResponse.rewrite(url);
    rewrite.headers.set("Vary", "Accept");
    return applyCsp(rewrite);
  }

  // Preflight for API routes: answer before touching Supabase (preflights
  // carry no cookies, so the auth check would just redirect them uselessly).
  if (isApi && request.method === "OPTIONS") {
    const headers: Record<string, string> = { ...CORS_HEADERS, Vary: "Origin" };
    if (allowedOrigin) headers["Access-Control-Allow-Origin"] = origin;
    // Sem CSP: a resposta de um preflight não tem corpo nem contexto de
    // navegação, então não há o que a política governe.
    return new NextResponse(null, { status: 204, headers });
  }

  // Visitante anônimo na landing page ou chegando por um link de parceiro:
  // não há sessão para renovar nem rota a proteger, então saímos ANTES de
  // instanciar o client — economiza uma ida ao Supabase nas duas rotas de
  // entrada do site, que são justamente as que decidem se a pessoa fica. A
  // ausência de cookie `sb-*` é o sinal barato de "não há sessão": o
  // @supabase/ssr guarda o token em cookies com esse prefixo, e sem nenhum
  // deles o `getUser()` só devolveria `null` depois de uma ida à rede.
  //
  // O early-return fica aqui em cima, ANTES do `createServerClient`. Enfiá-lo
  // no meio do handshake violaria o contrato do @supabase/ssr descrito acima.
  const isAnonEntry = earlyPath === "/" || earlyPath.startsWith("/r/");
  if (isAnonEntry && !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    return applyCsp(NextResponse.next({ request }));
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    // Caminho que não é público nem bate com nenhuma área do app: não há rota
    // nem sessão a proteger. Deixa passar para o Next responder 404 de verdade
    // (`app/not-found.tsx`), em vez de mandar para o login e devolver 200.
    if (!isKnownAppPath(pathname)) {
      if (isApi) applyCorsHeaders(supabaseResponse, origin, allowedOrigin);
      return applyCsp(supabaseResponse);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    if (pathname !== "/sign-in") {
      url.searchParams.set("next", pathname + search);
    }
    const redirect = NextResponse.redirect(url);
    if (isApi) applyCorsHeaders(redirect, origin, allowedOrigin);
    return applyCsp(redirect);
  }

  // Quem já está logado não tem o que fazer na landing page — vai para o feed.
  //
  // Esta checagem MORAVA em `app/page.tsx`, e era só por causa dela que a LP
  // precisava ser uma rota dinâmica (ver o comentário lá). Aqui o `user` já
  // foi resolvido para os outros guards, então o redirect sai de graça e a
  // página volta a ser estática e cacheável na CDN para o visitante anônimo.
  if (user && pathname === "/") {
    return applyCsp(NextResponse.redirect(new URL("/feed", request.nextUrl.origin)));
  }

  if (user && isAuthOnly(pathname)) {
    // Preserva a INTENÇÃO. Um usuário já logado que clica em "Assinar Pessoal"
    // na landing page chega aqui com `?next=/billing/assinar?plan=pessoal`;
    // jogá-lo em /feed descartaria a escolha e ele teria de recomeçar.
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    const url = new URL(next ?? "/feed", request.nextUrl.origin);
    return applyCsp(NextResponse.redirect(url));
  }

  if (isApi) applyCorsHeaders(supabaseResponse, origin, allowedOrigin);
  return applyCsp(supabaseResponse);
}

/**
 * Arquivos que TÊM de responder sem cookie de sessão.
 *
 * Sem esta exceção o proxy trata `/sitemap.xml` como rota protegida e devolve
 * `307 → /sign-in` para o Googlebot, que registra "Não foi possível buscar o
 * sitemap" e não indexa nada. O mesmo 307 quebrava o `robots.txt` (o rastreador
 * lê um HTML de login no lugar das diretivas), o `manifest.webmanifest` e o
 * `sw.js` (instalação do PWA) e o `opengraph-image` (prévia dos links no
 * WhatsApp e nas redes).
 *
 * `offline.html` entrou pelo mesmo motivo, com um detalhe a mais: quem a busca
 * é o service worker, no `install`, para guardá-la no cache. Atrás do proxy,
 * um visitante ainda anônimo receberia o 307 para `/sign-in`, e o
 * `cache.addAll` REJEITA resposta redirecionada — a instalação inteira do SW
 * falharia, e com ela a instalabilidade do PWA.
 *
 * São recursos públicos por definição — não existe sessão para renovar neles,
 * então pular o proxy também economiza uma ida ao Supabase por requisição.
 *
 * `llms\.txt` e `.*\.md$` (hoje só `/index.md`) são conteúdo para agentes,
 * servidos por route handler a partir de `src/shared/content/llms.ts`. Ficam
 * fora do gate para serem buscáveis direto; a reescrita de `/` para `/index.md`
 * por `Accept` acontece no corpo do proxy, antes de o matcher importar.
 *
 * A lista fica INLINE de propósito: o Next exige que `matcher` seja constante
 * literal para analisá-lo em build-time — montar a string a partir de uma
 * variável faz o matcher inteiro ser IGNORADO, em silêncio.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|sw\\.js|offline\\.html|llms\\.txt|opengraph-image|.*\\.md$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
