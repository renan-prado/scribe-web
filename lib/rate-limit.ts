import "server-only";
import { NextResponse } from "next/server";

/**
 * In-memory sliding fixed-window rate limiter. State lives in the process,
 * so on serverless (Vercel Fluid Compute) each instance keeps its own map —
 * the effective limit is `limit * activeInstances`. Enough to blunt casual
 * abuse and burst attacks; upgrade to Upstash if we ever need strict global
 * quotas or per-account billing enforcement.
 */

type Bucket = { count: number; resetAt: number };

const CAPACITY = 10_000;
const store = new Map<string, Bucket>();

function evict(now: number) {
  if (store.size <= CAPACITY) return;
  for (const [k, v] of store) {
    if (v.resetAt <= now) store.delete(k);
    if (store.size <= CAPACITY * 0.9) return;
  }
  const excess = store.size - Math.floor(CAPACITY * 0.9);
  let i = 0;
  for (const k of store.keys()) {
    if (i >= excess) break;
    store.delete(k);
    i++;
  }
}

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket: Bucket = { count: 1, resetAt: now + windowMs };
    store.set(key, bucket);
    evict(now);
    return {
      ok: true,
      limit,
      remaining: limit - 1,
      resetAt: bucket.resetAt,
      retryAfterSeconds: 0,
    };
  }
  existing.count++;
  if (existing.count > limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  // Refresh LRU position so eviction favors truly cold keys.
  store.delete(key);
  store.set(key, existing);
  return {
    ok: true,
    limit,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}

export function getClientIp(request: Request): string {
  const h = request.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export type RateLimitBucket = { limit: number; windowMs: number };

export type RateLimitConfig = {
  route: string;
  perUser?: RateLimitBucket;
  perIp?: RateLimitBucket;
};

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: "rate_limited", retryAfterSeconds: result.retryAfterSeconds },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
      },
    }
  );
}

/**
 * Applies IP + optional per-user limits for a route. Returns a 429 response
 * when a bucket is exceeded, or `null` when the request may proceed. Always
 * checks the IP bucket first (cheap, protects unauthed routes too), then
 * the per-user bucket if a userId is provided.
 */
export function enforceRateLimit(
  request: Request,
  config: RateLimitConfig,
  userId?: string | null
): NextResponse | null {
  if (config.perIp) {
    const ip = getClientIp(request);
    const r = checkRateLimit(`${config.route}:ip:${ip}`, config.perIp.limit, config.perIp.windowMs);
    if (!r.ok) {
      console.warn("[rate-limit] ip blocked", { route: config.route, ip });
      return rateLimitResponse(r);
    }
  }
  if (config.perUser && userId) {
    const r = checkRateLimit(
      `${config.route}:user:${userId}`,
      config.perUser.limit,
      config.perUser.windowMs
    );
    if (!r.ok) {
      console.warn("[rate-limit] user blocked", { route: config.route, userId });
      return rateLimitResponse(r);
    }
  }
  return null;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

/**
 * Per-route limits. Sized against the pipeline cadence documented in
 * AGENTS.md so legitimate recording sessions never trip them, then padded
 * for retries. Anything meaningfully higher than these numbers is either
 * a bug on the client or abuse.
 *
 * - transcribe fires roughly every 30s per active recording — 40/min covers
 *   ~20min of continuous audio with headroom for parallel sessions on the
 *   same account (mobile + desktop).
 * - bible/insights/echo are chunk-driven; cadence bounded by transcribe.
 * - final-summary/deepening are once-per-session and expensive.
 * - sessions/coins/verse/format are cheap plumbing but still capped.
 */
export const RATE_LIMITS = {
  transcribe: {
    route: "transcribe",
    perUser: { limit: 40, windowMs: MIN },
    perIp: { limit: 120, windowMs: MIN },
  },
  bible: {
    route: "bible",
    perUser: { limit: 60, windowMs: MIN },
    perIp: { limit: 180, windowMs: MIN },
  },
  insights: {
    route: "insights",
    perUser: { limit: 30, windowMs: MIN },
    perIp: { limit: 90, windowMs: MIN },
  },
  "sermon-echo": {
    route: "sermon-echo",
    perUser: { limit: 30, windowMs: MIN },
    perIp: { limit: 90, windowMs: MIN },
  },
  "final-summary": {
    route: "final-summary",
    perUser: { limit: 20, windowMs: HOUR },
    perIp: { limit: 60, windowMs: HOUR },
  },
  "final-summary-reprocess": {
    route: "final-summary-reprocess",
    perUser: { limit: 10, windowMs: HOUR },
    perIp: { limit: 40, windowMs: HOUR },
  },
  deepening: {
    route: "deepening",
    perUser: { limit: 30, windowMs: HOUR },
    perIp: { limit: 100, windowMs: HOUR },
  },
  "deepening-reprocess": {
    route: "deepening-reprocess",
    perUser: { limit: 10, windowMs: HOUR },
    perIp: { limit: 40, windowMs: HOUR },
  },
  verse: {
    route: "verse",
    perUser: { limit: 60, windowMs: MIN },
    perIp: { limit: 180, windowMs: MIN },
  },
  "format-paragraphs": {
    route: "format-paragraphs",
    perUser: { limit: 30, windowMs: MIN },
    perIp: { limit: 90, windowMs: MIN },
  },
  "sessions-write": {
    route: "sessions-write",
    perUser: { limit: 60, windowMs: MIN },
    perIp: { limit: 180, windowMs: MIN },
  },
  "entity-search": {
    route: "entity-search",
    perUser: { limit: 120, windowMs: MIN },
    perIp: { limit: 300, windowMs: MIN },
  },
  "coins-read": {
    route: "coins-read",
    perUser: { limit: 120, windowMs: MIN },
    perIp: { limit: 300, windowMs: MIN },
  },
  "coins-write": {
    route: "coins-write",
    perUser: { limit: 60, windowMs: MIN },
    perIp: { limit: 180, windowMs: MIN },
  },
  admin: {
    route: "admin",
    perUser: { limit: 60, windowMs: MIN },
    perIp: { limit: 120, windowMs: MIN },
  },
} as const satisfies Record<string, RateLimitConfig>;
