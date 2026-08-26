import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Uniform JSON-body validation for API routes. `parseJsonBody(req, schema)`
 * either returns `{ ok: true, data }` or `{ ok: false, response }` where
 * `response` is a ready-to-return NextResponse (400 with structured error).
 *
 * Every mutating endpoint should validate its body with a Zod schema:
 * casts + hand-rolled `typeof` checks are how untrusted payloads sneak into
 * the LLM prompt (token bombs), the DB (jsonb pollution), or the frontend
 * render path.
 */
export type ParseJsonResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<ParseJsonResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid_json" }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid_input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Route param guard for `/[id]` handlers. */
export function parseUuidParam(
  id: string | undefined
): { ok: true; id: string } | { ok: false; response: NextResponse } {
  if (!isUuid(id)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid_id" }, { status: 400 }),
    };
  }
  return { ok: true, id };
}

/** Zod schema for a UUID string (matches PostgreSQL uuid type). */
export const UuidSchema = z.string().regex(UUID_RE, "invalid_uuid");
/** Optional UUID field for request bodies — accepts undefined only, not null. */
export const OptionalUuidSchema = UuidSchema.optional();

/**
 * Body schema shared by the three live-pipeline routes (bible, insights,
 * sermon-echo). All three accept the same shape: recent transcript tail +
 * existing feed for prompt dedup + timing metadata + session id.
 *
 * `existingItems` is deliberately typed as `unknown[]` here — validation of
 * individual items happens via `coerceFeedItemsLoose` in the route, which
 * silently drops malformed entries so a single bad card can't fail the
 * whole live tick.
 */
export const LivePipelineBodySchema = z
  .object({
    text: z.string().max(12_000).optional(),
    existingItems: z.array(z.unknown()).max(500).optional(),
    sermonAtMs: z
      .number()
      .finite()
      .nonnegative()
      .max(24 * 60 * 60 * 1000)
      .optional(),
    sessionId: OptionalUuidSchema,
  })
  .strict();
export type LivePipelineBody = z.infer<typeof LivePipelineBodySchema>;
