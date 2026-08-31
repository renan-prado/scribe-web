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

const SpeakerEchoSchema = z.object({
  kind: z.literal("speakerEcho"),
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
  SpeakerEchoSchema,
  SpeakerCitationSchema,
  RelatedVerseSchema,
  ContextSchema,
  SuggestedQuoteSchema,
]);

export type FeedItem = z.infer<typeof FeedItemSchema>;
type FeedItemKind = FeedItem["kind"];
export type FeedItemOrigin = "recording" | "ai";

const RECORDING_KINDS: ReadonlySet<FeedItemKind> = new Set<FeedItemKind>([
  "citedVerse",
  "speakerHighlight",
  "speakerEcho",
  "speakerCitation",
]);

const BIBLE_KINDS: ReadonlySet<FeedItemKind> = new Set<FeedItemKind>(["citedVerse"]);

const ECHO_KINDS: ReadonlySet<FeedItemKind> = new Set<FeedItemKind>(["speakerEcho"]);

const INSIGHTS_KINDS: ReadonlySet<FeedItemKind> = new Set<FeedItemKind>([
  "speakerHighlight",
  "speakerCitation",
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
    case "speakerEcho":
      // Shared prefix so an echo and a highlight of the same phrase collide in
      // dedup — extract and sermon-echo can both surface the same sentence,
      // and we only want one card for it.
      return `speakerText:${normalizeText(item.text)}`;
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

/**
 * Coerce an untrusted client-supplied array into valid FeedItems. Silently
 * drops entries that don't match the schema — used on live-pipeline routes
 * (bible/insights/sermon-echo) where the array is *only* prompt dedup
 * context and a malformed entry shouldn't fail the whole request.
 *
 * Callers that persist the array (final-summary) MUST NOT use this — they
 * should reject with 400 so the client learns its bug instead of silently
 * losing cards.
 */
export function coerceFeedItemsLoose(input: unknown, max = 500): FeedItem[] {
  if (!Array.isArray(input)) return [];
  const out: FeedItem[] = [];
  for (const entry of input.slice(0, max)) {
    const parsed = FeedItemSchema.safeParse(entry);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export type ParsedVerseReference = {
  /** Normalized book name for equality checks: lowercase, no punctuation. */
  book: string;
  /** Original-case book name for reassembling display references. */
  bookDisplay: string;
  chapter: number;
  startVerse?: number;
  endVerse?: number;
};

const VERSE_REFERENCE_RE = /^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/;

export function parseVerseReference(ref: string): ParsedVerseReference | null {
  const m = VERSE_REFERENCE_RE.exec(ref.trim());
  if (!m) return null;
  const [, bookRaw, chapterStr, startStr, endStr] = m;
  const chapter = Number.parseInt(chapterStr, 10);
  if (!Number.isFinite(chapter)) return null;
  const startVerse = startStr ? Number.parseInt(startStr, 10) : undefined;
  const endVerse = endStr ? Number.parseInt(endStr, 10) : startVerse;
  const bookDisplay = bookRaw.trim().replace(/\s+/g, " ").replace(/[.,]/g, "");
  return {
    book: bookDisplay.toLowerCase(),
    bookDisplay,
    chapter,
    startVerse,
    endVerse,
  };
}

/**
 * React key for feed items that stays stable when a citedVerse range grows.
 * `feedItemDedupKey` uses the exact reference, which changes when
 * `Tiago 1:1` gets superseded by `Tiago 1:1-4` — that would remount the
 * card and blank the whole verse text. Keying by book+chapter+startVerse
 * lets React reconcile the passage in place as its end grows; individual
 * verse paragraphs each key on their verse number so already-rendered
 * ones stay mounted.
 *
 * Including startVerse is important — two non-overlapping passages in the
 * same chapter (e.g. `Romanos 7:1` and `Romanos 7:14-25` from a preacher
 * jumping around) must render as separate cards, not collide on one key.
 */
export function feedItemStableKey(item: FeedItem): string {
  if (item.kind === "citedVerse") {
    const parsed = parseVerseReference(item.reference);
    if (parsed) {
      const start = parsed.startVerse ?? 0;
      return `citedVerse:${parsed.book}:${parsed.chapter}:${start}`;
    }
  }
  return feedItemDedupKey(item);
}

/**
 * True when `broader` strictly covers `narrower` — same book/chapter, and
 * narrower's verse range fits inside broader's. Chapter-only refs never cover
 * verse-specific refs (matches the extract-prompt exception at lib/prompts/extract.ts).
 * Exact equality returns false; those are handled by the exact-key dedup path.
 */
export function referenceStrictlyContains(broader: string, narrower: string): boolean {
  const b = parseVerseReference(broader);
  const n = parseVerseReference(narrower);
  if (!b || !n) return false;
  if (b.book !== n.book || b.chapter !== n.chapter) return false;
  if (b.startVerse == null || b.endVerse == null) return false;
  if (n.startVerse == null || n.endVerse == null) return false;
  if (b.startVerse > n.startVerse) return false;
  if (b.endVerse < n.endVerse) return false;
  return b.startVerse < n.startVerse || b.endVerse > n.endVerse;
}

/**
 * True when `specific` resolves the verse assumption of a chapter-only ref:
 * same book+chapter, `specific` carries a verse number and `chapterOnly`
 * doesn't. The live feed renders a chapter-only citedVerse assuming the
 * reading starts at verse 1; once the speaker names the actual verse, the
 * specific reference replaces the assumed card (see enqueueFeedItems).
 */
export function referenceResolvesChapterOnly(specific: string, chapterOnly: string): boolean {
  const s = parseVerseReference(specific);
  const c = parseVerseReference(chapterOnly);
  if (!s || !c) return false;
  if (s.book !== c.book || s.chapter !== c.chapter) return false;
  return s.startVerse != null && c.startVerse == null;
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
 * Parse the bible-route LLM response. Filters to citedVerse only and drops
 * anything whose dedup key is already present in `existingKeys`. Also returns
 * the transient `thinking` note.
 *
 * `drops` surfaces per-item rejections (bad shape, disallowed kind, dedup) so
 * the route can log them — otherwise a model that drifts into the wrong shape
 * loses items silently.
 */
export function parseBibleFromLLM(
  content: string,
  existingKeys: Set<string>
): {
  items: FeedItem[];
  drops: FeedParseDrop[];
} {
  return parseFeedItems(content, existingKeys, BIBLE_KINDS);
}

/**
 * Parse the insights-route LLM response. Filters to the 5 non-citedVerse
 * kinds (speakerHighlight, speakerCitation, relatedVerse, context,
 * suggestedQuote) and drops anything already in `existingKeys`.
 */
export function parseInsightsFromLLM(content: string, existingKeys: Set<string>): FeedParseResult {
  return parseFeedItems(content, existingKeys, INSIGHTS_KINDS);
}

/**
 * Parse the sermon-echo-route LLM response. Only accepts speakerEcho items;
 * dedup runs against the SHARED speakerText key, so an echo whose text matches
 * an existing speakerHighlight is rejected here (same phrase, different kind).
 */
export function parseEchoFromLLM(content: string, existingKeys: Set<string>): FeedParseResult {
  return parseFeedItems(content, existingKeys, ECHO_KINDS);
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
