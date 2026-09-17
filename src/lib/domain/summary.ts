import { z } from "zod";

/**
 * Os blocos do sermão organizado. TODOS carregam a voz do pregador, editada
 * para leitura, nunca a voz da IA.
 *
 * Houve uma segunda camada aqui, os "comentários do Scriba": `contextCard`
 * (nota histórica, exegética ou doutrinária) e `relatedVerse` ("leia também"),
 * emitidos por uma SEGUNDA chamada de LLM depois do resumo e desenhados num
 * balão que abria ao clique. Saíram inteiros, da geração e da tela. Resumos
 * ANTIGOS no banco continuam com esses blocos no `final_summary`; nada os
 * apaga, e `BlockRenderer` cai no `default: return null` para tipo que não
 * conhece, então eles simplesmente não desenham. Não reintroduza os tipos só
 * para renderizar o passado.
 */
export const SummaryBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("h1"), text: z.string() }),
  z.object({ type: z.literal("h2"), text: z.string() }),
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("bibleQuote"), reference: z.string(), text: z.string() }),
  z.object({ type: z.literal("highlight"), text: z.string() }),
  z.object({ type: z.literal("example"), text: z.string() }),
  z.object({ type: z.literal("quote"), text: z.string(), author: z.string().optional() }),
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
 * Os blocos que uma pessoa pode ESCREVER à mão em `/escrever`, e os tetos de
 * tamanho do que ela manda.
 *
 * **Ela é hoje o vocabulário INTEIRO do resumo**, e essa igualdade não é
 * coincidência: é o que torna seguro abrir no editor um resumo que a IA
 * escreveu. Enquanto faltava um tipo, salvar por aqui apagaria em silêncio os
 * blocos daquele tipo, e era por isso que `/escrever/:id` só aceitava sessão
 * `manual` e a rota recusava o resto com 409 `not_manual`. Quem acrescentar um
 * bloco ao `SummaryBlockSchema` acrescenta aqui no MESMO commit — ou a próxima
 * edição de um resumo gerado o come sem avisar.
 *
 * - **`example` entrou**, e ele foi o último a faltar. Ficou de fora enquanto o
 *   editor era só a folha em branco: o rótulo dele na tela é "Exemplo do
 *   pregador", e num texto que a própria pessoa escreveu não haveria pregador a
 *   citar. O argumento caiu por dois lados — o editor agora abre o resumo de uma
 *   pregação, onde o pregador existe, e mesmo na folha em branco quem escreve
 *   pode estar transcrevendo à mão o sermão de outra pessoa (é a mesma razão de
 *   `speaker_name` continuar editável em `/summary`).
 * - **Não há um terceiro nível de título.** O produto desenha DOIS pesos
 *   (`h1` a 22px bold, `h2` a 18px semibold) e um terceiro cairia entre o `h2`
 *   e o parágrafo, indistinguível a um braço de distância no celular, num tipo
 *   novo que os dois renderizadores (resumo e estudo) teriam de aprender para
 *   um modelo que nunca vai emiti-lo.
 * - **A "ideia central" NÃO é bloco**, e por isso não está nesta lista: ela é
 *   o `shortSummary` do payload, o que aparece no cartão da Biblioteca e na
 *   busca. No editor ela é campo fixo no topo. O que fecha o texto, esse sim,
 *   é o bloco `conclusion`, e os dois já vestem o mesmo cartão na leitura
 *   (ver `LeadIdea`).
 *
 * Os tetos existem porque este payload vem do CLIENTE, e é o único do produto
 * que vem. Um resumo gerado nasce dentro do servidor; este chega por POST, e
 * sem limite uma aba poderia empurrar megabytes de jsonb para a linha.
 */
export const WRITTEN_BLOCK_TYPES = [
  "h1",
  "h2",
  "paragraph",
  "highlight",
  "example",
  "quote",
  "bibleQuote",
  "conclusion",
] as const;

export type WrittenBlockType = (typeof WRITTEN_BLOCK_TYPES)[number];

export const WRITTEN_LIMITS = {
  title: 200,
  shortSummary: 600,
  /** Um parágrafo folgado. Quem precisa de mais está escrevendo dois. */
  blockText: 5000,
  reference: 200,
  author: 120,
  /** Um sermão organizado à mão passa longe disto. */
  blocks: 300,
} as const;

const WrittenBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("h1"), text: z.string().max(WRITTEN_LIMITS.blockText) }),
  z.object({ type: z.literal("h2"), text: z.string().max(WRITTEN_LIMITS.blockText) }),
  z.object({ type: z.literal("paragraph"), text: z.string().max(WRITTEN_LIMITS.blockText) }),
  z.object({ type: z.literal("highlight"), text: z.string().max(WRITTEN_LIMITS.blockText) }),
  z.object({ type: z.literal("example"), text: z.string().max(WRITTEN_LIMITS.blockText) }),
  z.object({
    type: z.literal("quote"),
    text: z.string().max(WRITTEN_LIMITS.blockText),
    author: z.string().max(WRITTEN_LIMITS.author).optional(),
  }),
  z.object({
    type: z.literal("bibleQuote"),
    reference: z.string().max(WRITTEN_LIMITS.reference),
    // Vazio, e é assim de propósito: com uma faixa de versículos o
    // `BlockRenderer` IGNORA `text` e busca a NVI na hora de ler. Guardar uma
    // cópia do texto bíblico no jsonb seria uma segunda fonte para a mesma
    // passagem, que envelhece sozinha.
    text: z.string().max(WRITTEN_LIMITS.blockText),
  }),
  z.object({ type: z.literal("conclusion"), text: z.string().max(WRITTEN_LIMITS.blockText) }),
]);

export type WrittenBlock = z.infer<typeof WrittenBlockSchema>;

export const WrittenSummarySchema = z.object({
  title: z.string().max(WRITTEN_LIMITS.title).default(""),
  shortSummary: z.string().max(WRITTEN_LIMITS.shortSummary).default(""),
  blocks: z.array(WrittenBlockSchema).max(WRITTEN_LIMITS.blocks).default([]),
});

export type WrittenSummary = z.infer<typeof WrittenSummarySchema>;

/**
 * O que o editor mandou, virado no payload que o resto do produto lê.
 *
 * `thinking` nasce vazio e continua vazio: ele é o rascunho do MODELO antes de
 * escrever o resumo, e não existe quando não houve modelo. Blocos sem conteúdo
 * são descartados aqui, e não na tela: o editor mantém um bloco vazio enquanto
 * a pessoa pensa no que escrever, e salvá-lo faria a leitura mostrar um
 * parágrafo em branco no meio do texto.
 */
export function writtenToPayload(written: WrittenSummary): SummaryPayload {
  const blocks: SummaryBlock[] = [];
  for (const b of written.blocks) {
    if (b.type === "bibleQuote") {
      const reference = b.reference.trim();
      if (!reference) continue;
      blocks.push({ type: "bibleQuote", reference, text: b.text.trim() });
      continue;
    }
    const text = b.text.trim();
    if (!text) continue;
    if (b.type === "quote") {
      const author = b.author?.trim();
      blocks.push(author ? { type: "quote", text, author } : { type: "quote", text });
      continue;
    }
    blocks.push({ type: b.type, text });
  }
  return {
    thinking: "",
    title: written.title.trim(),
    shortSummary: written.shortSummary.trim(),
    blocks,
  };
}

/**
 * ONDE um bloco novo entra, dada a posição PEDIDA.
 *
 * **A conclusão é o teto de toda inserção, e nada fica abaixo dela.** Ela é o
 * fecho do texto: um parágrafo depois do fecho não é um parágrafo fora de
 * ordem, é um texto que acabou duas vezes.
 *
 * A regra tem duas metades, e a segunda é a que morde:
 *
 *  - **uma conclusão vai sempre para o FIM** (e o editor já impede a segunda,
 *    tirando-a do menu do `+` enquanto existir uma);
 *  - **todo o resto para ANTES da que existir** — pedir depois dela é pedir o
 *    lugar dela, e o lugar que sobra é imediatamente acima.
 *
 * ## Por que ela mora aqui, e não no editor
 *
 * Porque ela nasceu lá e o resto do produto não a conhecia. O `insertAt` do
 * `Composer` tinha a regra inteira; o `BibloSummaryDock` — a mesma inserção,
 * na tela de LEITURA — só grampeava o índice ao tamanho da lista. O "+" de uma
 * passagem e o trecho selecionado mandam `BIBLO_AT_END`, que quer dizer "no
 * fim", e na leitura o fim era literalmente o fim: a passagem entrava DEPOIS da
 * conclusão. Duas telas inserindo no mesmo documento por regras diferentes é
 * uma delas estar errada, e a que não tinha a regra era a errada.
 *
 * Client-safe de propósito: quem chama são as duas telas.
 */
export function insertionIndex(
  blocks: readonly WrittenBlock[],
  block: WrittenBlock,
  requested: number
): number {
  if (block.type === "conclusion") return blocks.length;
  const conclusionAt = blocks.findIndex((b) => b.type === "conclusion");
  const capped = conclusionAt >= 0 && requested > conclusionAt ? conclusionAt : requested;
  // `BIBLO_AT_END` é `Number.MAX_SAFE_INTEGER`: sem o grampo o número volta
  // para quem inseriu como um índice que não existe na tela, e a revelação do
  // bloco não acha nada. O `splice` já tratava isso como o fim.
  return Math.min(Math.max(capped, 0), blocks.length);
}

/** O caminho de volta: um payload salvo reaberto no editor. */
export function payloadToWritten(payload: SummaryPayload | null): WrittenSummary {
  if (!payload) return { title: "", shortSummary: "", blocks: [] };
  const blocks: WrittenBlock[] = [];
  for (const b of payload.blocks) {
    // Um tipo que o editor não sabe desenhar é DESCARTADO na abertura, pela
    // mesma porta por onde os blocos mortos somem da leitura — e é o que mantém
    // verdadeira a promessa de que salvar grava exatamente o que está na tela.
    //
    // Hoje quem cai aqui são só os blocos MORTOS: o `contextCard` e o
    // `relatedVerse` dos comentários do Scriba, o `distinction` do estudo, os
    // cards do feed ao vivo. Eles saíram do produto e continuam salvos no jsonb
    // de sessões antigas; a leitura já não os desenha (o `BlockRenderer` devolve
    // `null` para tipo que não conhece), e o editor os trata igual. Nenhum tipo
    // VIVO cai aqui, porque as duas listas são a mesma — ver
    // `WRITTEN_BLOCK_TYPES`.
    if (!(WRITTEN_BLOCK_TYPES as readonly string[]).includes(b.type)) continue;
    blocks.push(b as WrittenBlock);
  }
  return { title: payload.title, shortSummary: payload.shortSummary, blocks };
}
