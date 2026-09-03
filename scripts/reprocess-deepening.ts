/**
 * Ad-hoc script to reproduce /api/deepening/reprocess end-to-end from the CLI,
 * bypassing auth + rate-limit + coin charge. Uses the service-role key so we
 * can UPDATE session_deepenings regardless of the missing UPDATE RLS policy
 * (that's a separate fix — this script exists to prove the LLM chain works
 * and to A/B-compare payloads before/after).
 *
 * Usage: npx tsx scripts/reprocess-deepening.ts <sessionId>
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "@/lib/log";

const log = createLogger("reprocess");

// Load .env.local manually — this runs outside Next's env plumbing.
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  process.env[m[1]] ??= m[2];
}

const { DEEPENING_SYSTEM_PROMPT } = await import("../lib/prompts/deepening");
const { DEEPENING_AUDIT_SYSTEM_PROMPT } = await import("../lib/prompts/deepening-audit");
const { parseDeepeningFromLLM } = await import("../lib/domain/deepening");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const MODEL = process.env.OPENAI_DEEPENING_MODEL ?? "gpt-4o";
const AUDIT_MODEL = process.env.OPENAI_DEEPENING_AUDIT_MODEL ?? "gpt-4o";

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("usage: tsx scripts/reprocess-deepening.ts <sessionId>");
  process.exit(1);
}

async function sbGet(path: string): Promise<unknown> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!r.ok) throw new Error(`sb ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbPatch(path: string, body: unknown): Promise<unknown> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`sb patch ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

type Msg = { role: "system" | "user"; content: string };
async function chat(model: string, messages: Msg[], temperature: number): Promise<string> {
  const t0 = Date.now();
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 16000,
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`openai: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as {
    choices: [{ message: { content: string }; finish_reason: string }];
    usage: { prompt_tokens: number; completion_tokens: number };
  };
  const dt = Date.now() - t0;
  log.debug("chat", {
    model,
    latencyMs: dt,
    finishReason: j.choices[0].finish_reason,
    promptTokens: j.usage.prompt_tokens,
    completionTokens: j.usage.completion_tokens,
  });
  return j.choices[0].message.content;
}

(async () => {
  log.info("sessão", { sessionId });

  const sessionRow = (await sbGet(
    `sessions?id=eq.${sessionId}&select=id,title,transcript,final_summary,feed_items`
  )) as Array<{
    id: string;
    title: string;
    transcript: string;
    final_summary: unknown;
    feed_items: unknown;
  }>;
  if (sessionRow.length === 0) throw new Error("session not found");
  const s = sessionRow[0];
  log.info("carregada", { title: s.title, chars: s.transcript.length });

  const existingRow = (await sbGet(
    `session_deepenings?session_id=eq.${sessionId}&select=payload`
  )) as Array<{ payload: unknown }>;
  const previous = existingRow[0]?.payload as
    | { title?: string; shortSummary?: string; blocks?: unknown[] }
    | undefined;
  log.info("aprofundamento atual", {
    blocks: previous?.blocks?.length ?? 0,
    title: previous?.title ?? "",
  });

  // ─── Passe 1: draft ────────────────────────────────────────────────
  log.info("passe 1 · draft");
  const userMessage = [
    `finalSummary:\n${JSON.stringify(s.final_summary)}`,
    `feedItems:\n${JSON.stringify(s.feed_items)}`,
    `transcript:\n${s.transcript.trim()}`,
  ].join("\n\n---\n");
  const draftRaw = await chat(
    MODEL,
    [
      { role: "system", content: DEEPENING_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    0.6
  );
  const draft = parseDeepeningFromLLM(draftRaw);
  log.info("draft pronto", { blocks: draft.blocks.length, title: draft.title });

  // ─── Passe 2: audit ────────────────────────────────────────────────
  log.info("passe 2 · audit");
  const auditUser = [
    `finalSummary:\n${JSON.stringify(s.final_summary)}`,
    `draft:\n${JSON.stringify(draft)}`,
  ].join("\n\n---\n");
  const auditedRaw = await chat(
    AUDIT_MODEL,
    [
      { role: "system", content: DEEPENING_AUDIT_SYSTEM_PROMPT },
      { role: "user", content: auditUser },
    ],
    0.15
  );
  const audited = parseDeepeningFromLLM(auditedRaw);
  log.info("audit pronto", { blocks: audited.blocks.length, title: audited.title });

  // ─── Persistir via service role (bypass RLS) ────────────────────────
  await sbPatch(`session_deepenings?session_id=eq.${sessionId}`, {
    payload: audited,
  });
  log.success("persistido", { sessionId });

  // ─── A/B ────────────────────────────────────────────────────────────
  const summarize = (
    p: { blocks?: unknown[]; title?: string; shortSummary?: string } | undefined
  ) => ({
    title: p?.title ?? "",
    short: p?.shortSummary ?? "",
    counts:
      (p?.blocks as Array<{ type: string }> | undefined)?.reduce<Record<string, number>>(
        (acc, b) => {
          acc[b.type] = (acc[b.type] ?? 0) + 1;
          return acc;
        },
        {}
      ) ?? {},
    bibleRefs: ((p?.blocks as Array<{ type: string; reference?: string }> | undefined) ?? [])
      .filter((b) => b.type === "bibleQuote")
      .map((b) => b.reference),
    quotesAuthors: ((p?.blocks as Array<{ type: string; author?: string }> | undefined) ?? [])
      .filter((b) => b.type === "quote")
      .map((b) => b.author),
    highlights: ((p?.blocks as Array<{ type: string; text?: string }> | undefined) ?? [])
      .filter((b) => b.type === "highlight")
      .map((b) => (b.text ?? "").slice(0, 80)),
  });

  console.log("\n===== ANTES =====");
  console.log(JSON.stringify(summarize(previous), null, 2));
  console.log("\n===== DEPOIS =====");
  console.log(JSON.stringify(summarize(audited), null, 2));

  const summaryBlocks =
    (s.final_summary as { blocks?: Array<{ type: string; reference?: string }> })?.blocks ?? [];
  const summaryRefs = new Set(
    summaryBlocks
      .filter((b) => b.type === "bibleQuote" || b.type === "relatedVerse")
      .map((b) => b.reference ?? "")
      .filter(Boolean)
  );
  const auditedRefs =
    ((audited.blocks as Array<{ type: string; reference?: string }>) ?? [])
      .filter((b) => b.type === "bibleQuote")
      .map((b) => b.reference ?? "") ?? [];
  const overlap = auditedRefs.filter((r) => summaryRefs.has(r));
  console.log(
    `\n[check] bibleQuotes no estudo: ${auditedRefs.length} — sobreposição com o resumo: ${overlap.length} (${overlap.join(", ")})`
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
