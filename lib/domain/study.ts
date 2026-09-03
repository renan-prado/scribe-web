/**
 * O estudo ("Gerar estudo" / aprofundamento) — tipos, plano e parsers.
 *
 * Client-safe: o renderer precisa da união de blocos, e o `/admin` precisa do
 * vocabulário de abordagens. Nada aqui toca segredo.
 *
 * ⚠️ Este módulo deixou de ser um alias de `SummaryPayload`, e a mudança é
 * deliberada. Enquanto o estudo falava exatamente o vocabulário de blocos do
 * resumo, ele não tinha como parecer outra coisa: não existia bloco para
 * objeção, para distinção, para leitura recomendada, para pergunta em aberto.
 * "A estrutura deve surgir do assunto" não era um problema de prompt — era o
 * tipo que não expressava estrutura nenhuma além da do resumo.
 * Diagnóstico completo em `docs/estudo-v2.md` §1.7.
 *
 * Os quatro tipos novos saem do modelo com CAMPOS, não com prosa. É o que
 * permite à selagem (`lib/study/seal.ts`) conferir mecanicamente — mesmo
 * princípio de `bibleQuote.reference` vs `bibleQuote.text`.
 */

/** As disciplinas com que um eixo pode ser tratado. Ver `docs/estudo-v2.md` §5.3. */
export const STUDY_APPROACHES = [
  "exegese",
  "contexto-historico",
  "teologia-biblica",
  "teologia-sistematica",
  "historia-da-igreja",
  "filosofia",
  "pastoral",
  /**
   * A saída honesta para o sermão em que nenhuma disciplina ilumina: explicar
   * bem o conceito, com exemplo e analogia. É escolha legítima do plano, não
   * fallback envergonhado — sem ela, o modelo força uma disciplina que não
   * cabe e produz o estudo genérico que esta reforma existe para matar.
   */
  "conceitual",
] as const;

export type StudyApproach = (typeof STUDY_APPROACHES)[number];

export function isStudyApproach(v: unknown): v is StudyApproach {
  return typeof v === "string" && (STUDY_APPROACHES as readonly string[]).includes(v);
}

export const APPROACH_LABELS: Record<StudyApproach, string> = {
  exegese: "Exegese",
  "contexto-historico": "Contexto histórico",
  "teologia-biblica": "Teologia bíblica",
  "teologia-sistematica": "Teologia sistemática",
  "historia-da-igreja": "História da Igreja",
  filosofia: "Filosofia",
  pastoral: "Pastoral",
  conceitual: "Explicação conceitual",
};

/**
 * Vocabulário FECHADO de temas. Fechado de propósito: é o que permite juntar
 * "este eixo trata de X" com "este autor escreveu sobre X" por igualdade de
 * string — sem embedding, e sem deixar ao modelo a decisão de quem é
 * pertinente, que é a que ele mais erra.
 */
export const STUDY_TOPICS = [
  "graca",
  "fe",
  "justificacao",
  "santificacao",
  "pecado",
  "sofrimento",
  "soberania",
  "providencia",
  "cristologia",
  "trindade",
  "espirito-santo",
  "escritura",
  "igreja",
  "sacramentos",
  "oracao",
  "missao",
  "escatologia",
  "criacao",
  "etica",
  "justica-social",
  "apologetica",
  "duvida",
  "amor",
  "alegria",
  "morte",
  "lei-e-evangelho",
  "alianca",
  "lideranca-pastoral",
] as const;

export type StudyTopic = (typeof STUDY_TOPICS)[number];

export function isStudyTopic(v: unknown): v is StudyTopic {
  return typeof v === "string" && (STUDY_TOPICS as readonly string[]).includes(v);
}

// ── O plano (passo 1 do pipeline) ────────────────────────────────────────────

/**
 * Um eixo de aprofundamento: um mergulho, com a disciplina já escolhida.
 *
 * `rationale` existe para ser LIDO por um humano na avaliação — é a resposta
 * a "por que este ponto merecia profundidade?", que antes acontecia dentro de
 * um forward pass e ninguém conseguia inspecionar.
 */
export type StudyAxis = {
  /** Vira o h1 do estudo. Precisa nomear algo deste sermão. */
  title: string;
  approach: StudyApproach;
  topics: StudyTopic[];
  /** Por que ESTE ponto merece profundidade, e o resumo não deu conta. */
  rationale: string;
  /** A pergunta que o eixo responde. Guia a redação. */
  question: string;
  /** Referências bíblicas candidatas — resolvidas contra a NVI no passo 2. */
  passages: string[];
};

export type StudyPlan = {
  /** O tema real: texto, personagem ou doutrina. Nunca a anedota de abertura. */
  theme: string;
  /** O(s) texto(s) base do sermão. */
  primaryPassages: string[];
  /** O que o resumo JÁ entregou — o estudo não repete. */
  alreadyCovered: string[];
  /** 1 a 3. Um só é resposta legítima para sermão com pouco material. */
  axes: StudyAxis[];
  /**
   * Avaliação honesta do material disponível. Quando é `"raso"`, o estudo sai
   * curto — e sair curto é sucesso, não falha. Ver `docs/estudo-v2.md` §2.
   */
  depth: "raso" | "medio" | "denso";
};

// ── Os blocos (passos 3-5) ───────────────────────────────────────────────────

export type StudyBlock =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bibleQuote"; reference: string; text: string }
  | { type: "highlight"; text: string }
  | { type: "example"; text: string }
  /**
   * `work` é OBRIGATÓRIA. Um `quote` sem obra nomeável é descartado na
   * selagem — não avaliado, descartado. Ver `docs/estudo-v2.md` §6.
   */
  | { type: "quote"; text: string; author: string; work: string }
  /** Uma objeção honesta ao que foi pregado, com a resposta. */
  | { type: "objection"; text: string; response: string }
  /** Dois conceitos que o sermão colapsou. */
  | { type: "distinction"; a: string; b: string; text: string }
  /** Indicação de leitura. Campos separados para poderem ser validados. */
  | { type: "reading"; author: string; title: string; note: string }
  /** Pergunta em aberto — o leitor continua pensando depois de fechar. */
  | { type: "question"; text: string }
  | { type: "conclusion"; text: string };

export type StudyBlockType = StudyBlock["type"];

export type StudyPayload = {
  title: string;
  /** A tese do estudo, como afirmação. */
  shortSummary: string;
  blocks: StudyBlock[];
};

/** Compat: a tabela e as rotas continuam se chamando `deepening`. */
export type DeepeningPayload = StudyPayload;

export const emptyStudyPayload = (): StudyPayload => ({
  title: "",
  shortSummary: "",
  blocks: [],
});

// ── Parsers ──────────────────────────────────────────────────────────────────

function str(rec: Record<string, unknown>, key: string): string {
  const v = rec[key];
  return typeof v === "string" ? v.trim() : "";
}

function strArray(rec: Record<string, unknown>, key: string): string[] {
  const v = rec[key];
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
}

/**
 * Plano vindo do passo 1. Um plano sem eixos é plano inválido: o chamador
 * trata como falha e não segue para a redação — escrever sem plano é
 * exatamente o comportamento antigo que queremos eliminar.
 */
export function parseStudyPlanFromLLM(content: string): StudyPlan | null {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const src = obj as Record<string, unknown>;

  const rawAxes = Array.isArray(src.axes) ? src.axes : [];
  const axes: StudyAxis[] = [];
  for (const a of rawAxes) {
    if (!a || typeof a !== "object") continue;
    const rec = a as Record<string, unknown>;
    const title = str(rec, "title");
    const approach = rec.approach;
    if (!title || !isStudyApproach(approach)) continue;
    axes.push({
      title,
      approach,
      topics: strArray(rec, "topics").filter(isStudyTopic),
      rationale: str(rec, "rationale"),
      question: str(rec, "question"),
      passages: strArray(rec, "passages"),
    });
    // Teto duro: o plano pede 1-3 e o prompt repete, mas um modelo generoso
    // devolve seis e o estudo vira o "tour" que a versão anterior era.
    if (axes.length === 3) break;
  }
  if (axes.length === 0) return null;

  const depth = src.depth;
  return {
    theme: str(src, "theme"),
    primaryPassages: strArray(src, "primaryPassages"),
    alreadyCovered: strArray(src, "alreadyCovered"),
    axes,
    depth: depth === "raso" || depth === "denso" ? depth : "medio",
  };
}

/**
 * Payload vindo dos passos 3 e 4. Só descarta o que está estruturalmente
 * quebrado (campo obrigatório vazio, tipo desconhecido) — o julgamento de
 * conteúdo é do auditor, e a verificação de fonte é da selagem.
 */
export function parseStudyFromLLM(content: string): StudyPayload {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return emptyStudyPayload();
  }
  if (!obj || typeof obj !== "object") return emptyStudyPayload();

  const src = obj as Record<string, unknown>;
  const rawBlocks = Array.isArray(src.blocks) ? src.blocks : [];
  const blocks: StudyBlock[] = [];

  for (const b of rawBlocks) {
    if (!b || typeof b !== "object") continue;
    const rec = b as Record<string, unknown>;
    const type = typeof rec.type === "string" ? rec.type : "";
    const text = str(rec, "text");

    switch (type) {
      case "h1":
      case "h2":
      case "paragraph":
      case "highlight":
      case "example":
      case "question":
      case "conclusion": {
        if (text) blocks.push({ type, text });
        break;
      }
      case "bibleQuote": {
        const reference = str(rec, "reference");
        // Sem referência não há o que ancorar contra a NVI no passo 5.
        if (reference) blocks.push({ type: "bibleQuote", reference, text });
        break;
      }
      case "quote": {
        const author = str(rec, "author");
        const work = str(rec, "work");
        if (text && author && work) blocks.push({ type: "quote", text, author, work });
        break;
      }
      case "objection": {
        const response = str(rec, "response");
        // Objeção sem resposta é provocação solta — não entra.
        if (text && response) blocks.push({ type: "objection", text, response });
        break;
      }
      case "distinction": {
        const a = str(rec, "a");
        const b2 = str(rec, "b");
        if (a && b2 && text) blocks.push({ type: "distinction", a, b: b2, text });
        break;
      }
      case "reading": {
        const author = str(rec, "author");
        const title = str(rec, "title");
        if (author && title) {
          blocks.push({ type: "reading", author, title, note: str(rec, "note") });
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    title: str(src, "title"),
    shortSummary: str(src, "shortSummary"),
    blocks,
  };
}
