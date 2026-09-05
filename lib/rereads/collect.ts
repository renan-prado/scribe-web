import "server-only";
import { type FeedItem, parseVerseReference, referenceStrictlyContains } from "@/lib/domain/feed";
import type { RereadOrigin } from "@/lib/domain/rereads";
import type { SummaryPayload } from "@/lib/domain/summary";

/**
 * Um item candidato a virar releitura. Só origens não-IA — a chamada de
 * fill vira `ai-fill` num passo separado.
 */
export type RereadPoolItem = {
  reference: string;
  text: string;
  reason: string;
  origin: Exclude<RereadOrigin, "ai-fill">;
};

/**
 * Colhe candidatos a releitura das fontes já disponíveis (feed live +
 * final summary) e devolve intercalado por origem. A ordem de saída é o
 * que o assembler vai mapear direto contra REREAD_DAY_OFFSETS ascendente,
 * então o "diversificar tipos ao longo do tempo" acontece aqui: a gente
 * faz round-robin cited → related → summary. Se uma família esgota, as
 * demais seguem preenchendo.
 *
 * Deduplicação:
 * - Por referência normalizada (case/whitespace/pontuação insensível).
 * - Por containment: se `Tiago 1:1-4` já está no pool, `Tiago 1:1` é
 *   descartado (mesma perícope, faixa mais larga vence). Feito na ordem
 *   de inserção, então o primeiro ganha se coincidir exatamente.
 */
export function collectRereadPool(
  feedItems: FeedItem[],
  summary: SummaryPayload
): RereadPoolItem[] {
  const cited: RereadPoolItem[] = [];
  const related: RereadPoolItem[] = [];
  const summaryPool: RereadPoolItem[] = [];

  const push = (into: RereadPoolItem[], candidate: RereadPoolItem) => {
    if (isUsableReference(candidate.reference)) into.push(candidate);
  };

  for (const item of feedItems) {
    if (item.kind === "citedVerse") {
      push(cited, {
        reference: item.reference,
        text: item.text ?? "",
        reason: "",
        origin: "cited",
      });
    } else if (item.kind === "relatedVerse") {
      push(related, {
        reference: item.reference,
        text: "",
        reason: item.reason ?? "",
        origin: "related",
      });
    }
  }

  for (const block of summary.blocks) {
    if (block.type === "bibleQuote") {
      // Duplica muito com cited (o resumo re-cita o que o pastor leu). Não
      // categorizamos como "cited" — se a mesma ref já está lá pelo feed,
      // o dedup abaixo derruba; se não, entra como "summary".
      push(summaryPool, {
        reference: block.reference,
        text: block.text ?? "",
        reason: "",
        origin: "summary",
      });
    } else if (block.type === "relatedVerse") {
      push(related, {
        reference: block.reference,
        text: block.text ?? "",
        reason: block.reason ?? "",
        origin: "related",
      });
    }
  }

  const interleaved = roundRobin([cited, related, summaryPool]);
  return dedupeByReference(interleaved);
}

/**
 * Uma referência só entra no pool se for uma PASSAGEM — livro e capítulo, no
 * mínimo.
 *
 * O gate existe porque as fontes deste pool não prometem isso. Um `citedVerse`
 * pode chegar como menção de capítulo sem número, e um `bibleQuote` do resumo
 * pode trazer só o nome do livro. "Judas" atravessava: `parseVerseReference`
 * devolvia `null`, a busca na NVI não tinha o que buscar, e o card do /feed
 * saía com a pastilha "Judas" e nada embaixo — uma releitura sem texto para
 * reler. O lugar de barrar isso é aqui, antes de o item ocupar um dos dez
 * slots; barrar na tela só esconde o slot desperdiçado.
 */
function isUsableReference(reference: string): boolean {
  return parseVerseReference(reference) !== null;
}

function roundRobin<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const cursors = lists.map(() => 0);
  let anyRemaining = true;
  while (anyRemaining) {
    anyRemaining = false;
    for (let i = 0; i < lists.length; i++) {
      const cursor = cursors[i];
      const list = lists[i];
      if (cursor < list.length) {
        out.push(list[cursor]);
        cursors[i] = cursor + 1;
        anyRemaining = true;
      }
    }
  }
  return out;
}

function normalizeRef(ref: string): string {
  return ref.trim().toLowerCase().replace(/\s+/g, "").replace(/[.,]/g, "");
}

/**
 * Remove duplicatas exatas por referência normalizada. Depois, remove
 * qualquer item cuja referência é estritamente contida por outro item já
 * mantido (ex.: `Tiago 1:1` cai se `Tiago 1:1-4` está presente). O primeiro
 * item vence — o round-robin já ordenou por prioridade cited > related > summary.
 */
function dedupeByReference(pool: RereadPoolItem[]): RereadPoolItem[] {
  const seen = new Set<string>();
  const step1: RereadPoolItem[] = [];
  for (const item of pool) {
    const key = normalizeRef(item.reference);
    if (seen.has(key)) continue;
    seen.add(key);
    step1.push(item);
  }
  const step2: RereadPoolItem[] = [];
  for (const item of step1) {
    const isContained = step2.some(
      (kept) =>
        referenceStrictlyContains(kept.reference, item.reference) ||
        // Se um item já mantido é MAIS específico e o novo é MAIS amplo,
        // mantemos o amplo (perícope maior) trocando o kept.
        false
    );
    if (isContained) continue;
    // Se o item atual estritamente contém algum já mantido, substitui.
    const containedIdx = step2.findIndex((kept) =>
      referenceStrictlyContains(item.reference, kept.reference)
    );
    if (containedIdx >= 0) {
      step2[containedIdx] = item;
      continue;
    }
    step2.push(item);
  }
  return step2;
}

/**
 * Só as referências normalizadas — usado tanto pra alimentar o prompt de
 * fill quanto pra evitar duplicatas ao mesclar o fill de volta.
 */
export function referencesFromPool(pool: { reference: string }[]): string[] {
  return pool
    .map((p) => p.reference)
    .filter((r) => {
      const parsed = parseVerseReference(r);
      return parsed !== null;
    });
}
