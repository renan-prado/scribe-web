/**
 * Index a Bible translation into knowledge_sources/knowledge_chunks.
 *
 * Usage:
 *   npm run index:bible -- --translation NAA
 *   npm run index:bible -- --translation NAA --dry-run
 *   npm run index:bible -- --translation NAA --only-book Rm
 *
 * Environment: reads from `.env.local`. Requires
 *   OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL.
 *
 * Creates one knowledge_sources row per (book, translation) — e.g.
 * "NAA — Romanos" — and chunks it via chunkBibleChapter. Idempotency
 * is NOT guaranteed: re-running against the same DB will create
 * duplicate sources. Use `--dry-run` first, and query
 * `select count(*) ... where source_type='bible' and tags @> ARRAY['naa']`
 * before re-running to be sure.
 *
 * Cost guard: aborts if the estimated cost exceeds
 * INDEX_BIBLE_MAX_COST_USD (default $5). Real cost is invariably
 * under $0.10 for a full Bible at text-embedding-3-small@512, so
 * hitting the guard means something is wrong (wrong translation,
 * corrupted JSON, etc.).
 */

import { loadBible } from "../lib/bibles/loader";
import { bookDisplayFor, chunkBibleChapter } from "../lib/knowledge/chunk";
import { estimateTokens, indexKnowledgeSource } from "../lib/knowledge/ingest";

type Args = {
  translation: string;
  dryRun: boolean;
  onlyBook: string | null;
  verseWindow: number;
  overlap: number;
};

const PRICE_PER_1M_TOKENS_USD = 0.02; // text-embedding-3-small
const DEFAULT_MAX_COST_USD = Number.parseFloat(process.env.INDEX_BIBLE_MAX_COST_USD ?? "5");

function parseArgs(argv: string[]): Args {
  const args: Args = {
    translation: "",
    dryRun: false,
    onlyBook: null,
    verseWindow: 8,
    overlap: 2,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--translation") args.translation = (argv[++i] ?? "").toUpperCase();
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--only-book") args.onlyBook = argv[++i] ?? null;
    else if (a === "--verse-window") args.verseWindow = Number.parseInt(argv[++i] ?? "8", 10);
    else if (a === "--overlap") args.overlap = Number.parseInt(argv[++i] ?? "2", 10);
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: npm run index:bible -- --translation NAA [--dry-run] [--only-book Rm] [--verse-window 8] [--overlap 2]"
      );
      process.exit(0);
    }
  }
  if (!args.translation) {
    console.error("Missing --translation. Example: --translation NAA");
    process.exit(2);
  }
  return args;
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();
  console.log(
    `[index-bible] start { translation: ${args.translation}, dryRun: ${args.dryRun}, onlyBook: ${args.onlyBook ?? "*"}, window: ${args.verseWindow}, overlap: ${args.overlap} }`
  );

  const bible = await loadBible(args.translation);
  if (!bible) {
    console.error(
      `Could not load translation ${args.translation}. Check lib/bibles/${args.translation}.json exists.`
    );
    process.exit(1);
  }

  const books = args.onlyBook
    ? bible.filter((b) => b.abbrev.toLowerCase() === args.onlyBook?.toLowerCase())
    : bible;
  if (books.length === 0) {
    console.error(`No matching book for --only-book=${args.onlyBook ?? ""}.`);
    process.exit(1);
  }

  // Dry-run pass: sum tokens without embedding or writing.
  let totalChunks = 0;
  let totalTokens = 0;
  for (const book of books) {
    for (let chapterIdx = 0; chapterIdx < book.chapters.length; chapterIdx++) {
      const chunks = chunkBibleChapter(
        args.translation,
        book.abbrev,
        chapterIdx + 1,
        book.chapters[chapterIdx],
        { verseWindow: args.verseWindow, overlap: args.overlap }
      );
      totalChunks += chunks.length;
      for (const c of chunks) totalTokens += estimateTokens(c.content);
    }
  }
  const estCostUsd = (totalTokens / 1_000_000) * PRICE_PER_1M_TOKENS_USD;
  console.log(
    `[index-bible] estimate { books: ${books.length}, chunks: ${totalChunks}, tokens: ~${totalTokens}, costUsd: ~${fmtUsd(estCostUsd)} }`
  );

  if (estCostUsd > DEFAULT_MAX_COST_USD) {
    console.error(
      `[index-bible] estimated cost ${fmtUsd(estCostUsd)} exceeds INDEX_BIBLE_MAX_COST_USD=${DEFAULT_MAX_COST_USD}. Aborting.`
    );
    process.exit(3);
  }

  if (args.dryRun) {
    console.log("[index-bible] dry run — no writes performed.");
    return;
  }

  let sourcesCreated = 0;
  let chunksInserted = 0;
  let tokensBilled = 0;
  const embedLatencies: number[] = [];

  for (const book of books) {
    const bookDisplay = bookDisplayFor(book.abbrev);
    const preparedChunks = [] as ReturnType<typeof chunkBibleChapter>;
    for (let chapterIdx = 0; chapterIdx < book.chapters.length; chapterIdx++) {
      preparedChunks.push(
        ...chunkBibleChapter(
          args.translation,
          book.abbrev,
          chapterIdx + 1,
          book.chapters[chapterIdx],
          { verseWindow: args.verseWindow, overlap: args.overlap }
        )
      );
    }

    if (preparedChunks.length === 0) continue;

    const perBookStart = Date.now();
    try {
      const result = await indexKnowledgeSource({
        title: `${args.translation} — ${bookDisplay}`,
        author: null,
        sourceType: "bible",
        license: "public_domain",
        tags: [
          "bible",
          args.translation.toLowerCase(),
          ...(preparedChunks[0]?.metadata &&
          (preparedChunks[0].metadata as { testament?: string }).testament
            ? [(preparedChunks[0].metadata as { testament: string }).testament.toLowerCase()]
            : []),
        ],
        chunks: preparedChunks,
      });
      sourcesCreated++;
      chunksInserted += result.chunkCount;
      tokensBilled += result.tokensUsed;
      embedLatencies.push(result.embedLatencyMs);
      const took = Date.now() - perBookStart;
      console.log(
        `[index-bible] book ok { book: '${book.abbrev}', chapters: ${book.chapters.length}, chunks: ${result.chunkCount}, tokens: ${result.tokensUsed}, took: ${took}ms }`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[index-bible] book failed { book: '${book.abbrev}', error: ${message} }`);
      // continue to next book — do not abort the whole run
    }
  }

  const totalMs = Date.now() - started;
  const avgEmbedMs = embedLatencies.length
    ? Math.round(embedLatencies.reduce((a, b) => a + b, 0) / embedLatencies.length)
    : 0;
  const actualCostUsd = (tokensBilled / 1_000_000) * PRICE_PER_1M_TOKENS_USD;
  console.log(
    `[index-bible] done { translation: ${args.translation}, sources: ${sourcesCreated}, chunks: ${chunksInserted}, tokens: ${tokensBilled}, actualCostUsd: ${fmtUsd(actualCostUsd)}, avgEmbedMs: ${avgEmbedMs}, totalMs: ${totalMs} }`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
