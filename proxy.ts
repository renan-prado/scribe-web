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
 *   PUBLIC     — /, /sign-in, /sign-up, /auth/*
 *   PROTECTED  — everything else the matcher lets through
 *
 * Unauth users hitting a protected route → /sign-in?next=<original-path>.
 * Auth users hitting /sign-in or /sign-up → /feed (already in).
 */

const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/auth"];
const AUTH_ONLY_PREFIXES = ["/sign-in", "/sign-up"];

const STATIC_ALLOWED_ORIGINS = new Set(["https://scriba.cc", "https://www.scriba.cc"]);
// localhost / 127.0.0.1 on any port, plus Vercel preview URLs scoped to this
// project (e.g. scribe-<hash>-renanprados-projects.vercel.app).
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost(?::\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
  /^https:\/\/scribe-[a-z0-9-]+\.vercel\.app$/,
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

function isAllowedOrigin(origin: string): boolean {
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
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

  // Preflight for API routes: answer before touching Supabase (preflights
  // carry no cookies, so the auth check would just redirect them uselessly).
  if (isApi && request.method === "OPTIONS") {
    const headers: Record<string, string> = { ...CORS_HEADERS, Vary: "Origin" };
    if (allowedOrigin) headers["Access-Control-Allow-Origin"] = origin;
    return new NextResponse(null, { status: 204, headers });
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
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    if (pathname !== "/sign-in") {
      url.searchParams.set("next", pathname + search);
    }
    const redirect = NextResponse.redirect(url);
    if (isApi) applyCorsHeaders(redirect, origin, allowedOrigin);
    return redirect;
  }

  if (user && isAuthOnly(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isApi) applyCorsHeaders(supabaseResponse, origin, allowedOrigin);
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
