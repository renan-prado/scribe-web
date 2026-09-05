import "server-only";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/log";

const log = createLogger("rate-limit");

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

/**
 * `cost` existe para o balde que conta GRANDEZA em vez de eventos.
 *
 * A cadência de `/api/transcribe` é limitada por chamada, e chamada não é a
 * unidade em que a OpenAI cobra — ela cobra por MINUTO de áudio. Duas
 * requisições idênticas para o limitador podiam custar 20 segundos e duas
 * horas. Ver `RATE_LIMITS.transcribe` e o uso na rota.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  cost = 1
): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket: Bucket = { count: cost, resetAt: now + windowMs };
    store.set(key, bucket);
    evict(now);
    return {
      ok: true,
      limit,
      remaining: Math.max(0, limit - cost),
      resetAt: bucket.resetAt,
      retryAfterSeconds: 0,
    };
  }
  existing.count += cost;
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
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}

/**
 * Orçamento de BYTES de áudio por usuário, para `/api/transcribe`.
 *
 * O limitador por chamada não protege o que importa aqui. A OpenAI cobra por
 * minuto de áudio, e o tamanho do arquivo é o único sinal de duração que o
 * servidor consegue conferir sem decodificar o áudio — o `durationMs` do
 * formulário é do cliente e serve só para a nossa telemetria.
 *
 * A conta que dimensiona o teto: uma hora de gravação real são ~206 chunks de
 * 15-20s (`RECORDER_MIN/MAX_CHUNK_MS`), a uns 80 KB cada em opus — perto de
 * **16 MB por hora**. Dois aparelhos na mesma conta, 32 MB. O teto de 240 MB é
 * quinze vezes o uso legítimo e inalcançável por acidente; para quem estava
 * atacando, corta o pior caso de ~$320/hora por conta para ~$4.
 *
 * Devolve `null` quando pode seguir.
 */
export function enforceAudioBudget(userId: string, bytes: number): NextResponse | null {
  const r = checkRateLimit(
    `transcribe:bytes:user:${userId}`,
    AUDIO_BUDGET_BYTES_PER_HOUR,
    HOUR,
    bytes
  );
  if (!r.ok) {
    log.warn("audio budget exceeded", { userId, bytes });
    return rateLimitResponse(r);
  }
  return null;
}

/**
 * Aceita `Request` ou `Headers` porque as duas formas aparecem: rotas de API
 * recebem o request inteiro, e server actions só conseguem os headers (via
 * `headers()` do next/headers).
 */
export function getClientIp(source: Request | Headers): string {
  const h = source instanceof Headers ? source : source.headers;
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
      log.warn("ip blocked", { route: config.route, ip });
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
      log.warn("user blocked", { route: config.route, userId });
      return rateLimitResponse(r);
    }
  }
  return null;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Ver `enforceAudioBudget`. 240 MB ≈ 15 horas de gravação real por hora. */
const AUDIO_BUDGET_BYTES_PER_HOUR = 240 * 1024 * 1024;

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
  // 20 por HORA, e antes eram 30 por MINUTO — noventa vezes mais.
  //
  // O número antigo veio do molde das rotas do pipeline ao vivo, que disparam a
  // cada chunk. Esta não dispara a cada chunk: ela reformata uma transcrição
  // inteira, de uma vez, e aceita 300 mil caracteres por chamada. Com 1.800
  // chamadas por hora, uma conta com uma moeda de saldo custava perto de
  // US$ 100/hora de gpt-4o-mini — a segunda maior exposição do produto, atrás
  // só do `transcribe`.
  //
  // 20/hora é a cadência de uma ação de FIM de sessão, que é o que ela é —
  // mesmo balde de `sessions-transcript`. Hoje nenhum código de cliente a
  // chama; o limite é dimensionado para o dia em que voltar a chamar.
  "format-paragraphs": {
    route: "format-paragraphs",
    perUser: { limit: 20, windowMs: HOUR },
    perIp: { limit: 60, windowMs: HOUR },
  },
  // Alerta manual de alucinação: o usuário digita uma nota, então a cadência
  // real é de alguns por sessão. Generoso o bastante para quem está frustrado
  // com o áudio insistir algumas vezes, apertado o bastante para não virar
  // um canal barato de chamadas ao gpt-4o.
  "hallucination-report": {
    route: "hallucination-report",
    perUser: { limit: 10, windowMs: HOUR },
    perIp: { limit: 40, windowMs: HOUR },
  },
  // Save de fim de gravação do modo transcrição: uma chamada por sessão
  // encerrada, com retry manual do usuário se falhar.
  "sessions-transcript": {
    route: "sessions-transcript",
    perUser: { limit: 20, windowMs: HOUR },
    perIp: { limit: 60, windowMs: HOUR },
  },
  "sessions-write": {
    route: "sessions-write",
    perUser: { limit: 60, windowMs: MIN },
    perIp: { limit: 180, windowMs: MIN },
  },
  "feed-read": {
    route: "feed-read",
    perUser: { limit: 120, windowMs: MIN },
    perIp: { limit: 300, windowMs: MIN },
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
  // Cobrança: cada clique abre UMA sessão de checkout/portal no Stripe, que é
  // uma chamada paga de API e um objeto persistido lá. Apertado de propósito —
  // uso legítimo são alguns cliques por hora, e um limite baixo aqui é a
  // primeira barreira contra alguém rodando um script de criação de sessões.
  "billing-write": {
    route: "billing-write",
    perUser: { limit: 12, windowMs: 10 * MIN },
    perIp: { limit: 40, windowMs: 10 * MIN },
  },
  // Reconciliação pós-checkout. A tela de retorno chama uma vez; os retries
  // são raros. Apertado porque cada chamada bate na API do Stripe — e porque
  // é o único endpoint autenticado capaz de creditar, ainda que só um
  // pagamento comprovadamente pago e pertencente ao próprio chamador.
  "billing-reconcile": {
    route: "billing-reconcile",
    perUser: { limit: 20, windowMs: 10 * MIN },
    perIp: { limit: 60, windowMs: 10 * MIN },
  },
  // Varredura do cron: 1 chamada/dia no uso real. O limite por IP existe só
  // para que a rota pública não vire alvo de flood/brute-force do segredo.
  "billing-sweep": {
    route: "billing-sweep",
    perIp: { limit: 10, windowMs: 10 * MIN },
  },
  // Leitura do resumo de plano/saldo. O diálogo de moedas faz polling enquanto
  // o usuário está sem crédito no meio de uma gravação, então precisa caber
  // um tick a cada poucos segundos.
  "billing-read": {
    route: "billing-read",
    perUser: { limit: 120, windowMs: MIN },
    perIp: { limit: 300, windowMs: MIN },
  },
  admin: {
    route: "admin",
    perUser: { limit: 60, windowMs: MIN },
    perIp: { limit: 120, windowMs: MIN },
  },
  // Link de parceiro (/r/<slug>). Público e sem sessão, então só por IP.
  // Generoso porque um link em stories é aberto muitas vezes em sequência e
  // uma operadora móvel coloca muita gente atrás do mesmo IP — bloquear um
  // visitante legítimo custa uma conversão. O limite existe contra o script
  // que tentaria inflar o funil de um parceiro, e o custo de estourá-lo é
  // baixo: o redirect acontece do mesmo jeito, só o clique não é contado.
  "partner-link": {
    route: "partner-link",
    perIp: { limit: 120, windowMs: MIN },
  },
} as const satisfies Record<string, RateLimitConfig>;
