import { z } from "zod";

/**
 * A FeedItem is a single card the live view surfaces during a recording. Two
 * flavors: items EXTRACTED from what the speaker actually said (rendered with
 * the "recording" treatment) and items SUGGESTED by the LLM to enrich the
 * reflection (rendered with the "ai" treatment). The origin is derived from
 * the kind — see `feedItemOrigin` — so the wire schema stays flat.
 */

const CitedVerseSchema = z.object({
  kind: z.literal("citedVerse"),
  reference: z.string(),
  text: z.string().default(""),
});

const SpeakerHighlightSchema = z.object({
  kind: z.literal("speakerHighlight"),
  text: z.string(),
});

const SpeakerCitationSchema = z.object({
  kind: z.literal("speakerCitation"),
  text: z.string(),
  author: z.string(),
});

const RelatedVerseSchema = z.object({
  kind: z.literal("relatedVerse"),
  reference: z.string(),
  reason: z.string().default(""),
});

const ContextSchema = z.object({
  kind: z.literal("context"),
  label: z.string(),
  text: z.string(),
  source: z.string().optional(),
});

const SuggestedQuoteSchema = z.object({
  kind: z.literal("suggestedQuote"),
  text: z.string(),
  author: z.string(),
  reason: z.string().default(""),
});

export const FeedItemSchema = z.discriminatedUnion("kind", [
  CitedVerseSchema,
  SpeakerHighlightSchema,
  SpeakerCitationSchema,
  RelatedVerseSchema,
  ContextSchema,
  SuggestedQuoteSchema,
]);

export type FeedItem = z.infer<typeof FeedItemSchema>;
export type FeedItemKind = FeedItem["kind"];
export type FeedItemOrigin = "recording" | "ai";

const RECORDING_KINDS: ReadonlySet<FeedItemKind> = new Set<FeedItemKind>([
  "citedVerse",
  "speakerHighlight",
  "speakerCitation",
]);

const AI_KINDS: ReadonlySet<FeedItemKind> = new Set<FeedItemKind>([
  "relatedVerse",
  "context",
  "suggestedQuote",
]);

export function feedItemOrigin(item: FeedItem): FeedItemOrigin {
  return RECORDING_KINDS.has(item.kind) ? "recording" : "ai";
}

/**
 * Stable, content-based dedup key. Used on the client to reject repeat items
 * across successive extract/suggest calls, and inside the parsers to drop
 * duplicates within a single LLM response.
 */
export function feedItemDedupKey(item: FeedItem): string {
  switch (item.kind) {
    case "citedVerse":
    case "relatedVerse":
      return `${item.kind}:${normalizeReference(item.reference)}`;
    case "speakerHighlight":
      return `speakerHighlight:${normalizeText(item.text)}`;
    case "speakerCitation":
      return `speakerCitation:${normalizeText(item.author)}|${normalizeText(item.text)}`;
    case "context":
      return `context:${normalizeText(item.label)}|${normalizeText(item.text).slice(0, 60)}`;
    case "suggestedQuote":
      return `suggestedQuote:${normalizeText(item.author)}|${normalizeText(item.text)}`;
  }
}

function normalizeReference(ref: string): string {
  return ref.trim().toLowerCase().replace(/\s+/g, "").replace(/[.,]/g, "");
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function safeJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function itemsArrayFrom(parsed: unknown): unknown[] {
  if (!parsed || typeof parsed !== "object") return [];
  const items = (parsed as { items?: unknown }).items;
  return Array.isArray(items) ? items : [];
}

export type FeedParseDrop = {
  reason: "not-object" | "schema" | "kind-not-allowed" | "dedup";
  kind?: string;
  detail?: string;
  snippet: string;
};

export type FeedParseResult = {
  items: FeedItem[];
  drops: FeedParseDrop[];
};

/**
 * Parse the extract-route LLM response. Filters to kinds that come from the
 * speaker's own words (citedVerse / speakerHighlight / speakerCitation) and
 * drops anything whose dedup key is already present in `existingKeys`. Also
 * returns the transient `thinking` note the model uses to power the status
 * line at the bottom of the session view.
 *
 * `drops` surfaces per-item rejections (bad shape, disallowed kind, dedup) so
 * the route can log them — otherwise a model that drifts into the wrong shape
 * loses items silently.
 */
export function parseExtractFromLLM(
  content: string,
  existingKeys: Set<string>
): { items: FeedItem[]; thinking: string; readingMode: boolean; drops: FeedParseDrop[] } {
  const { items, drops } = parseFeedItems(content, existingKeys, RECORDING_KINDS);
  const parsed = safeJson(content);
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const thinking = typeof record.thinking === "string" ? record.thinking.trim().slice(0, 200) : "";
  const readingMode = record.readingMode === true;
  return { items, thinking, readingMode, drops };
}

/**
 * Parse the suggest-route LLM response. Filters to AI-generated kinds
 * (relatedVerse / context / suggestedQuote) and drops anything already in
 * `existingKeys`.
 */
export function parseSuggestFromLLM(content: string, existingKeys: Set<string>): FeedParseResult {
  return parseFeedItems(content, existingKeys, AI_KINDS);
}

function parseFeedItems(
  content: string,
  existingKeys: Set<string>,
  allowedKinds: ReadonlySet<FeedItemKind>
): FeedParseResult {
  const raw = itemsArrayFrom(safeJson(content));
  const seen = new Set<string>(existingKeys);
  const out: FeedItem[] = [];
  const drops: FeedParseDrop[] = [];
  for (const entry of raw) {
    const snippet = safeSnippet(entry);
    if (!entry || typeof entry !== "object") {
      drops.push({ reason: "not-object", snippet });
      continue;
    }
    const kindHint = readKindHint(entry);
    const parsed = FeedItemSchema.safeParse(entry);
    if (!parsed.success) {
      drops.push({
        reason: "schema",
        kind: kindHint,
        detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        snippet,
      });
      continue;
    }
    if (!allowedKinds.has(parsed.data.kind)) {
      drops.push({ reason: "kind-not-allowed", kind: parsed.data.kind, snippet });
      continue;
    }
    const key = feedItemDedupKey(parsed.data);
    if (seen.has(key)) {
      drops.push({ reason: "dedup", kind: parsed.data.kind, snippet });
      continue;
    }
    seen.add(key);
    out.push(parsed.data);
  }
  return { items: out, drops };
}

function readKindHint(entry: unknown): string | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  const k = (entry as { kind?: unknown }).kind;
  return typeof k === "string" ? k : undefined;
}

function safeSnippet(entry: unknown): string {
  try {
    return JSON.stringify(entry).slice(0, 200);
  } catch {
    return String(entry).slice(0, 200);
  }
}
