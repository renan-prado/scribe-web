import "server-only";
import type { StudyBlock, StudyPayload } from "@/lib/domain/study";
import { findTheologian } from "@/lib/prompts/theologians";
import type { AnchoredPassage } from "@/lib/study/anchor";
import { coverKey } from "@/lib/study/covers";

/**
 * PASSO 5 — a SELAGEM. Sem LLM.
 *
 * O último passo do pipeline, e o único que não pode falhar por prompt. Ele
 * aplica em código as três regras que o prompt anterior pedia com maiúsculas e
 * o modelo obedecia quando dava:
 *
 *   1. O texto de todo `bibleQuote` é REESCRITO a partir da NVI. O que o
 *      modelo escreveu no campo é ignorado — inclusive quando está certo, para
 *      que nunca haja dúvida sobre a procedência do que o leitor lê como
 *      Escritura. Referência fora das ancoradas: bloco removido.
 *   2. Todo `quote` sem obra nomeável, ou com autor fora do índice, é
 *      REMOVIDO. Não avaliado, não sinalizado — removido. Ver
 *      `docs/estudo-v2.md` §6: uma fonte só entra se um humano conseguir
 *      conferi-la em menos de um minuto.
 *   3. Todo `reading` sem autor conhecido é removido pela mesma razão.
 *
 * Também limpa markdown que escapou e garante que o documento termine em
 * `conclusion` — duas coisas que o prompt pedia e que não custam nada aqui.
 *
 * `SealReport` existe para o log: quantos blocos caíram e por quê. Sem isso,
 * uma regressão no redator (começa a citar sem obra) some silenciosamente
 * como "o estudo saiu curto hoje".
 */

export type SealReport = {
  droppedBibleQuotes: number;
  droppedQuotes: number;
  droppedReadings: number;
  rewrittenVerses: number;
};

const MARKDOWN_NOISE = /[*_#`>]/g;

function clean(text: string): string {
  return text.replace(MARKDOWN_NOISE, "").replace(/\s+/g, " ").trim();
}

export function sealStudy(
  payload: StudyPayload,
  anchored: AnchoredPassage[],
  /** `"autor||título" → url`, de `resolveCovers`. Vazio quando não há chave. */
  covers: Map<string, string> = new Map()
): { payload: StudyPayload; report: SealReport } {
  const byReference = new Map(anchored.map((p) => [normalizeRef(p.reference), p]));
  const report: SealReport = {
    droppedBibleQuotes: 0,
    droppedQuotes: 0,
    droppedReadings: 0,
    rewrittenVerses: 0,
  };

  const blocks: StudyBlock[] = [];

  for (const block of payload.blocks) {
    switch (block.type) {
      case "bibleQuote": {
        const match = byReference.get(normalizeRef(block.reference));
        if (!match) {
          report.droppedBibleQuotes++;
          break;
        }
        // O texto vem SEMPRE da NVI, mesmo quando o modelo acertou. É a única
        // forma de o leitor nunca precisar se perguntar se aquilo é a
        // Escritura ou uma paráfrase convincente.
        if (block.text.trim() !== match.text) report.rewrittenVerses++;
        blocks.push({ type: "bibleQuote", reference: match.reference, text: match.text });
        break;
      }
      case "quote": {
        const author = findTheologian(block.author);
        if (!author || !block.work.trim()) {
          report.droppedQuotes++;
          break;
        }
        blocks.push({
          type: "quote",
          text: clean(block.text),
          // Normaliza para a grafia do índice: "Agostinho" e "Santo Agostinho"
          // são a mesma pessoa e não devem virar dois autores na tela.
          author: author.name,
          work: clean(block.work),
        });
        break;
      }
      case "reading": {
        const author = findTheologian(block.author);
        if (!author) {
          report.droppedReadings++;
          break;
        }
        const title = clean(block.title);
        // A capa entra AQUI, e só aqui: é o único ponto do pipeline em que a
        // URL tem procedência conhecida (o resolvedor conferiu autor e título
        // contra a API). O que o modelo tivesse escrito já foi descartado no
        // parser.
        const cover = covers.get(coverKey(author.name, title));
        blocks.push({
          type: "reading",
          author: author.name,
          title,
          note: clean(block.note),
          ...(cover ? { coverUrl: cover } : {}),
        });
        break;
      }
      case "distinction": {
        blocks.push({
          type: "distinction",
          a: clean(block.a),
          b: clean(block.b),
          text: clean(block.text),
        });
        break;
      }
      case "objection": {
        blocks.push({
          type: "objection",
          text: clean(block.text),
          response: clean(block.response),
        });
        break;
      }
      default: {
        const text = clean(block.text);
        if (text) blocks.push({ ...block, text });
        break;
      }
    }
  }

  return {
    payload: {
      title: clean(payload.title),
      shortSummary: clean(payload.shortSummary),
      blocks: ensureConclusionLast(blocks),
    },
    report,
  };
}

function normalizeRef(ref: string): string {
  return ref.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Move a conclusão para o fim se ela não estiver lá, e descarta conclusões
 * extras. Um estudo com dois fechos lê como dois estudos colados, e é um
 * defeito que o revisor às vezes introduz ao remover blocos do meio.
 */
function ensureConclusionLast(blocks: StudyBlock[]): StudyBlock[] {
  const conclusions = blocks.filter((b) => b.type === "conclusion");
  if (conclusions.length === 0) return blocks;
  const rest = blocks.filter((b) => b.type !== "conclusion");
  return [...rest, conclusions[conclusions.length - 1]];
}
