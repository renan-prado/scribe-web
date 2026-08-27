import { z } from "zod";

export const SummaryBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("h1"), text: z.string() }),
  z.object({ type: z.literal("h2"), text: z.string() }),
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("bibleQuote"), reference: z.string(), text: z.string() }),
  z.object({ type: z.literal("highlight"), text: z.string() }),
  z.object({ type: z.literal("example"), text: z.string() }),
  z.object({ type: z.literal("quote"), text: z.string(), author: z.string().optional() }),
  // AI-voice blocks — rendered as visually-distinct collapsible cards so the
  // reader can distinguish sermon content (speaker's voice) from Scriba
  // enrichment. Emitted only by /api/final-summary.
  z.object({
    type: z.literal("contextCard"),
    label: z.string(),
    text: z.string(),
    source: z.string().optional(),
  }),
  z.object({
    type: z.literal("relatedVerse"),
    reference: z.string(),
    text: z.string().default(""),
    reason: z.string().default(""),
  }),
  z.object({ type: z.literal("conclusion"), text: z.string() }),
]);

export type SummaryBlock = z.infer<typeof SummaryBlockSchema>;

export const SummaryPayloadSchema = z.object({
  thinking: z.string().default(""),
  title: z.string().default(""),
  shortSummary: z.string().default(""),
  blocks: z.array(SummaryBlockSchema).default([]),
});

export type SummaryPayload = z.infer<typeof SummaryPayloadSchema>;

export type SummaryPhase = "intro" | "developing" | "mature" | "final";

const emptyPayload = (): SummaryPayload => ({
  thinking: "",
  title: "",
  shortSummary: "",
  blocks: [],
});

/**
 * Parse the raw LLM JSON string and apply phase-based filtering to blocks.
 * Blocks whose type is not permitted in the current phase are dropped; blocks
 * with empty text are dropped. Kept behavior-identical to the previous inline
 * normalizePayload in app/api/summarize/route.ts.
 */
export function parseSummaryFromLLM(content: string, phase: SummaryPhase): SummaryPayload {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return emptyPayload();
  }
  if (!obj || typeof obj !== "object") return emptyPayload();

  const src = obj as Record<string, unknown>;
  const thinking = typeof src.thinking === "string" ? src.thinking.trim() : "";
  const title = typeof src.title === "string" ? src.title.trim() : "";
  const shortSummary = typeof src.shortSummary === "string" ? src.shortSummary.trim() : "";
  const rawBlocks = Array.isArray(src.blocks) ? src.blocks : [];
  const blocks: SummaryBlock[] = [];

  for (const b of rawBlocks) {
    if (!b || typeof b !== "object") continue;
    const rec = b as Record<string, unknown>;
    const type = typeof rec.type === "string" ? rec.type : "";
    const text = typeof rec.text === "string" ? rec.text.trim() : "";

    switch (type) {
      case "h1": {
        if (phase === "intro" || phase === "developing") break;
        if (text) blocks.push({ type: "h1", text });
        break;
      }
      case "h2":
      case "paragraph":
      case "highlight":
      case "example": {
        if (phase === "intro") break;
        if (text) blocks.push({ type, text });
        break;
      }
      case "bibleQuote": {
        const reference = typeof rec.reference === "string" ? rec.reference.trim() : "";
        if (reference) blocks.push({ type: "bibleQuote", reference, text });
        break;
      }
      case "quote": {
        if (phase === "intro") break;
        if (!text) break;
        const author = typeof rec.author === "string" ? rec.author.trim() : "";
        blocks.push(author ? { type: "quote", text, author } : { type: "quote", text });
        break;
      }
      case "contextCard": {
        if (phase !== "final") break;
        const label = typeof rec.label === "string" ? rec.label.trim() : "";
        if (!label || !text) break;
        const source = typeof rec.source === "string" ? rec.source.trim() : "";
        blocks.push(
          source
            ? { type: "contextCard", label, text, source }
            : { type: "contextCard", label, text }
        );
        break;
      }
      case "relatedVerse": {
        if (phase !== "final") break;
        const reference = typeof rec.reference === "string" ? rec.reference.trim() : "";
        if (!reference) break;
        const reason = typeof rec.reason === "string" ? rec.reason.trim() : "";
        blocks.push({ type: "relatedVerse", reference, text, reason });
        break;
      }
      case "conclusion": {
        if (phase !== "final") break;
        if (text) blocks.push({ type: "conclusion", text });
        break;
      }
      default:
        break;
    }
  }

  return { thinking, title, shortSummary, blocks };
}

/**
 * Insertion output from the enrichment call. Each entry says: insert `block`
 * AFTER the block at `afterBlockIndex` in the original organized-sermon array.
 * Index -1 means "at the very beginning". Only contextCard and relatedVerse
 * are valid enrichment types — anything else is rejected by parseEnrichment.
 */
const EnrichmentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("contextCard"),
    label: z.string(),
    text: z.string(),
    source: z.string().optional(),
  }),
  z.object({
    type: z.literal("relatedVerse"),
    reference: z.string(),
    text: z.string().default(""),
    reason: z.string().default(""),
  }),
]);

export type EnrichmentBlock = z.infer<typeof EnrichmentBlockSchema>;

export type EnrichmentInsertion = {
  afterBlockIndex: number;
  block: EnrichmentBlock;
};

/**
 * Parse the enrichment LLM output. Silently drops malformed entries (bad
 * type, missing fields, non-integer index) — enrichment is best-effort, we
 * never fail the whole final-summary just because one card was wrong.
 */
export function parseEnrichmentFromLLM(content: string): EnrichmentInsertion[] {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return [];
  }
  if (!obj || typeof obj !== "object") return [];
  const raw = (obj as { insertions?: unknown }).insertions;
  if (!Array.isArray(raw)) return [];

  const out: EnrichmentInsertion[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const idxRaw = rec.afterBlockIndex;
    if (typeof idxRaw !== "number" || !Number.isFinite(idxRaw)) continue;
    const afterBlockIndex = Math.trunc(idxRaw);

    const blockCandidate = rec.block;
    if (!blockCandidate || typeof blockCandidate !== "object") continue;
    // Trim string fields before validating so the discriminated union sees
    // clean input. contextCard.label/text and relatedVerse.reference are
    // required non-empty in practice — enforce here since the schema uses
    // z.string() (which allows empty).
    const normalized = normalizeEnrichmentBlock(blockCandidate as Record<string, unknown>);
    if (!normalized) continue;
    const parsed = EnrichmentBlockSchema.safeParse(normalized);
    if (!parsed.success) continue;
    out.push({ afterBlockIndex, block: parsed.data });
  }
  return out;
}

// contextCards that name a specific historical figure or use a vague-tradition
// phrase without a concrete `source` are dropped. Prompt-level guidance keeps
// failing here — the model repeatedly writes "reformadores como Lutero…" with
// no attribution. Silent drop is more reliable than another prompt round.
const UNSOURCED_ATTRIBUTION_PATTERN = new RegExp(
  [
    // Reformadores e magisteriais
    "Lutero",
    "Luther",
    "Calvino",
    "Calvin",
    "Zw[ií]nglio",
    "Zwingli",
    "Melanchthon",
    // Patrística e medieval
    "Agostinho",
    "Augustinho",
    "Augustine",
    "(?:Tom[aá]s de\\s+)?Aquino",
    "Aquinas",
    "Atan[aá]sio",
    "Athanasius",
    "Cris[oó]stomo",
    "Chrysostom",
    "Jer[oô]nimo",
    "Jerome",
    "Or[ií]genes",
    "Origen",
    "Tertuliano",
    "Tertullian",
    "Irineu",
    "Irenaeus",
    "Anselmo",
    "Anselm",
    // Modernos
    "Wesley",
    "Spurgeon",
    "Bonhoeffer",
    "Karl Barth",
    "Jonathan Edwards",
    "Whitefield",
    "Kuyper",
    "Lloyd-Jones",
    "J\\.\\s*I\\.\\s*Packer",
    "John Piper",
    "Tim Keller",
    "John Stott",
    "Wayne Grudem",
    "R\\.\\s*C\\.\\s*Sproul",
    "John Owen",
    "John Bunyan",
    "Richard Baxter",
    "Warfield",
    "Machen",
    "Schaeffer",
    "Chesterton",
    "C\\.\\s*S\\.\\s*Lewis",
    "Tozer",
    // Fórmulas vagas (o problema principal)
    "reformadores?",
    "Reforma Protestante",
    "durante a Reforma",
    "na Reforma",
    "pais da igreja",
    "padres da igreja",
    "tradi[çc][ãa]o\\s+(?:reformada|crist[ãa]|protestante|cat[oó]lica|patr[ií]stica|puritana|evang[eé]lica)",
    "l[ií]deres\\s+(?:como|protestantes|reformados|crist[ãa]os)",
    "te[oó]logos?\\s+(?:como|contempor[âa]neos|reformados|crist[ãa]os)",
    "puritanos",
    "escol[aá]sticos",
  ]
    .map((p) => `\\b${p}\\b`)
    .join("|"),
  "i"
);

function normalizeEnrichmentBlock(rec: Record<string, unknown>): Record<string, unknown> | null {
  const type = typeof rec.type === "string" ? rec.type : "";
  if (type === "contextCard") {
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    if (!label || !text) return null;
    const source = typeof rec.source === "string" ? rec.source.trim() : "";
    if (!source && UNSOURCED_ATTRIBUTION_PATTERN.test(text)) return null;
    return source ? { type, label, text, source } : { type, label, text };
  }
  if (type === "relatedVerse") {
    const reference = typeof rec.reference === "string" ? rec.reference.trim() : "";
    if (!reference) return null;
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    const reason = typeof rec.reason === "string" ? rec.reason.trim() : "";
    return { type, reference, text, reason };
  }
  return null;
}

/**
 * Splice enrichment insertions into the organized sermon. Each insertion
 * lands AFTER the block at its afterBlockIndex; indices refer to the ORIGINAL
 * array, so we sort descending and splice in reverse to keep indices stable.
 *
 * Guards:
 * - afterBlockIndex is clamped to [-1, blocks.length - 1].
 * - Never inserts after the conclusion block (conclusion must remain last);
 *   insertions targeting >= conclusionIndex are re-anchored to conclusionIndex-1.
 * - When multiple insertions share an afterBlockIndex, their input order is
 *   preserved.
 */
export function mergeEnrichmentIntoBlocks(
  blocks: SummaryBlock[],
  insertions: EnrichmentInsertion[]
): SummaryBlock[] {
  if (insertions.length === 0) return blocks;
  const conclusionIndex = blocks.findIndex((b) => b.type === "conclusion");
  const maxAllowed = conclusionIndex >= 0 ? conclusionIndex - 1 : blocks.length - 1;

  // Group insertions by their (clamped) anchor, preserving input order within a group.
  const buckets = new Map<number, EnrichmentBlock[]>();
  insertions.forEach((ins) => {
    let idx = ins.afterBlockIndex;
    if (idx > maxAllowed) idx = maxAllowed;
    if (idx < -1) idx = -1;
    const bucket = buckets.get(idx) ?? [];
    bucket.push(ins.block);
    buckets.set(idx, bucket);
  });

  const out: SummaryBlock[] = [];
  const leading = buckets.get(-1);
  if (leading) out.push(...leading);
  blocks.forEach((block, i) => {
    out.push(block);
    const trailing = buckets.get(i);
    if (trailing) out.push(...trailing);
  });
  return out;
}

/**
 * Prepares the previous summary so the LLM sees only the fields that matter
 * for continuation. The transient "thinking" field never round-trips.
 * Returns null when there is no meaningful content to send.
 */
export function normalizePreviousForPrompt(
  prev: SummaryPayload | undefined
): SummaryPayload | null {
  if (!prev || typeof prev !== "object") return null;
  const title = typeof prev.title === "string" ? prev.title : "";
  const shortSummary = typeof prev.shortSummary === "string" ? prev.shortSummary : "";
  const blocks = Array.isArray(prev.blocks) ? prev.blocks : [];
  const hasContent = title || shortSummary || blocks.length > 0;
  if (!hasContent) return null;
  return { thinking: "", title, shortSummary, blocks };
}
