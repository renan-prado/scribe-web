/**
 * O estudo ("Gerar estudo") — tipos, roteiro e parsers.
 *
 * Client-safe: o renderer precisa da união de blocos e o `/admin` precisa das
 * perguntas. Nada aqui toca segredo.
 *
 * ## A definição de produto, que governa tudo abaixo
 *
 *     resumo  responde  →  o que foi ensinado nesta pregação?
 *     estudo  responde  →  agora que entendi o tema, o que preciso aprender
 *                          sobre ele?
 *
 * É por isso que a representação intermediária do pipeline são PERGUNTAS, e
 * não uma taxonomia de eixos e disciplinas. Uma taxonomia é um formulário para
 * o modelo preencher, e "Eixo: a graça em Efésios 2 / abordagem: teologia
 * sistemática" não diz nada sobre se o estudo vai prestar. Uma pergunta é
 * autovalidável: "Graça é libertinagem?" se recomenda sozinha, e "O que a
 * graça nos ensina?" se denuncia sozinha.
 *
 * Consequência prática: **a qualidade do estudo é a qualidade das perguntas.**
 * É onde vale investir prompt.
 *
 * ⚠️ Este módulo não é alias de `SummaryPayload`, e a diferença é deliberada.
 * Enquanto o estudo falava o vocabulário de blocos do resumo, ele não tinha
 * como parecer outra coisa. Ver `docs/estudo-v2.md`.
 */

/**
 * Vocabulário FECHADO de temas. Fechado de propósito: é o que permite juntar
 * "esta pergunta trata de X" com "este autor escreveu sobre X" por igualdade
 * de string — sem embedding, e sem deixar ao modelo a decisão de quem é
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

// ── Passo 1: as perguntas ────────────────────────────────────────────────────

/**
 * `media` — a pergunta que um ouvinte atento faria ao sair do culto.
 * `alta`  — a que exige distinção conceitual, história da doutrina ou tensão
 *           entre textos para ser respondida.
 *
 * Não há nível "baixa" de propósito: a pergunta cuja resposta já está no
 * resumo não é uma pergunta de estudo, é o resumo de novo.
 */
export type StudyQuestionDepth = "media" | "alta";

export type StudyQuestion = {
  text: string;
  topics: StudyTopic[];
  depth: StudyQuestionDepth;
  /** Por que ela importa. Curto — serve ao respondedor na hora de escolher. */
  why: string;
};

// ── Passo 2: as respostas ────────────────────────────────────────────────────

export type StudySource = {
  author: string;
  work: string;
  /** O que o autor argumenta sobre este ponto. */
  claim: string;
};

export type StudyAnswer = {
  /** A pergunta respondida, copiada do passo 1. */
  question: string;
  text: string;
  /** Referências bíblicas citadas. Conferidas contra a NVI no passo 3. */
  passages: string[];
  /**
   * Os autores em que a resposta se apoia. Não é bibliografia decorativa: é o
   * material com que o redator monta atribuições e indicações de leitura. Uma
   * resposta sem fontes vira um trecho sem nenhuma voz além da do modelo — que
   * foi exatamente o que a primeira avaliação mediu (zero citações no artigo).
   */
  sources: StudySource[];
  /**
   * Onde as tradições protestantes divergem de fato, a divergência é
   * CONTEÚDO, não risco a evitar. Vazio quando há consenso — e aí a resposta
   * afirma com convicção em vez de hedgear.
   */
  tension: string;
};

/**
 * O que fica gravado ao lado do estudo (`session_deepenings.plan`, migração
 * 0033). Guarda o que foi PERGUNTADO e o recorte que virou texto.
 *
 * Sem isto, avaliar o estudo exige adivinhar o que o modelo pensou. Com isto,
 * dá para ler as trinta perguntas, ver quais o respondedor escolheu, e
 * descobrir se o problema estava na pergunta ou na resposta — que são
 * consertos completamente diferentes.
 */
export type StudyRecord = {
  /** O ASSUNTO, desgrudado da moldura deste sermão: "a alegria cristã". */
  theme: string;
  /**
   * Como ESTE sermão recortou o assunto. Guardado só para diagnóstico: se o
   * artigo ecoar a moldura, dá para ver aqui o que ele estava ecoando.
   */
  frame?: string;
  /** TODAS as perguntas levantadas, inclusive as descartadas. */
  questions: StudyQuestion[];
  /** As que o respondedor escolheu responder, na ordem em que respondeu. */
  answered: string[];
  /** Ausente nos estudos anteriores ao guardião. */
  guard?: StudyGuard;
};

/**
 * O que o guardião cortou. Guardado porque é o sinal mais direto que temos de
 * que o pipeline está resvalando para cima do resumo: `blockedByGuard` alto
 * significa questionador preguiçoso, e `rewrites > 0` significa redator que
 * colapsou de volta na tese do sermão.
 */
export type StudyGuard = {
  /** Perguntas descartadas por já estarem respondidas no resumo. */
  blockedByGuard: string[];
  /** Quantas vezes o redator teve de reescrever por repetir a tese (0, 1). */
  rewrites: number;
};

// ── Passos 4-5: os blocos ────────────────────────────────────────────────────

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
  /** Uma objeção honesta, com a resposta. */
  | { type: "objection"; text: string; response: string }
  /** Dois conceitos que costumam ser colapsados, e a diferença. */
  | { type: "distinction"; a: string; b: string; text: string }
  /** Indicação de leitura. Campos separados para poderem ser validados. */
  | { type: "reading"; author: string; title: string; note: string }
  /** Pergunta em aberto. No máximo duas, e só no fecho — o texto é artigo,
   *  não questionário. */
  | { type: "question"; text: string }
  | { type: "conclusion"; text: string };

export type StudyBlockType = StudyBlock["type"];

export type StudyPayload = {
  title: string;
  /** A tese do artigo, como afirmação. */
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
 * Teto de perguntas aceitas do passo 1. Alto de propósito: o questionador é
 * instruído a perguntar sem pudor, e é o respondedor quem seleciona. Cortar
 * cedo demais aqui seria fazer a seleção pelo critério errado — ordem de
 * geração em vez de qualidade.
 */
const MAX_QUESTIONS = 40;

export function parseStudyQuestionsFromLLM(content: string): StudyRecord | null {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const src = obj as Record<string, unknown>;

  const raw = Array.isArray(src.questions) ? src.questions : [];
  const questions: StudyQuestion[] = [];
  const seen = new Set<string>();

  for (const q of raw) {
    if (!q || typeof q !== "object") continue;
    const rec = q as Record<string, unknown>;
    const text = str(rec, "text");
    if (!text) continue;
    // Duplicata literal acontece quando o modelo reformula a mesma pergunta;
    // ela custaria uma vaga na seleção do respondedor.
    const key = text.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);

    questions.push({
      text,
      topics: strArray(rec, "topics").filter(isStudyTopic),
      depth: rec.depth === "alta" ? "alta" : "media",
      why: str(rec, "why"),
    });
    if (questions.length === MAX_QUESTIONS) break;
  }

  // Sem perguntas não há estudo: o chamador para aqui em vez de escrever no
  // vazio, que é exatamente o comportamento antigo.
  if (questions.length === 0) return null;

  return {
    // "subject" é o assunto geral; "theme" era o título do sermão na versão
    // anterior, e é essa troca que tira a moldura do resto do pipeline.
    theme: str(src, "subject") || str(src, "theme"),
    frame: str(src, "frame"),
    questions,
    answered: [],
    guard: { blockedByGuard: [], rewrites: 0 },
  };
}

export function parseStudyAnswersFromLLM(content: string): StudyAnswer[] {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return [];
  }
  if (!obj || typeof obj !== "object") return [];
  const src = obj as Record<string, unknown>;

  const raw = Array.isArray(src.answers) ? src.answers : [];
  const answers: StudyAnswer[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const rec = a as Record<string, unknown>;
    const question = str(rec, "question");
    const text = str(rec, "text");
    if (!question || !text) continue;
    const rawSources = Array.isArray(rec.sources) ? rec.sources : [];
    const sources: StudySource[] = [];
    for (const src2 of rawSources) {
      if (!src2 || typeof src2 !== "object") continue;
      const sr = src2 as Record<string, unknown>;
      const author = str(sr, "author");
      const work = str(sr, "work");
      // Sem obra a fonte não é conferível, que é o critério do produto inteiro.
      if (author && work) sources.push({ author, work, claim: str(sr, "claim") });
    }

    answers.push({
      question,
      text,
      passages: strArray(rec, "passages"),
      sources,
      tension: str(rec, "tension"),
    });
  }
  return answers;
}

/**
 * Payload do redator. Só descarta o que está estruturalmente quebrado (campo
 * obrigatório vazio, tipo desconhecido) — a verificação de fonte é da selagem.
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
        // Sem referência não há o que ancorar contra a NVI na selagem.
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

// ── O guardião ───────────────────────────────────────────────────────────────

/**
 * Perguntas que o filtro mandou descartar. Casadas por texto normalizado: o
 * modelo às vezes devolve a pergunta com pontuação ou caixa diferente, e uma
 * comparação exata deixaria passar justamente o que ele quis cortar.
 */
export function parseQuestionFilterFromLLM(content: string, asked: StudyQuestion[]): string[] {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return [];
  }
  if (!obj || typeof obj !== "object") return [];

  const raw = strArray(obj as Record<string, unknown>, "drop");
  if (raw.length === 0) return [];

  const norm = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const wanted = new Set(raw.map(norm));
  return asked.filter((q) => wanted.has(norm(q.text))).map((q) => q.text);
}

export type ThesisVerdict = { repeats: boolean; overlap: string };

export function parseThesisCheckFromLLM(content: string): ThesisVerdict {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    // Falha de parse não pode disparar reescrita: o custo do falso positivo é
    // o artigo inteiro refeito à toa.
    return { repeats: false, overlap: "" };
  }
  if (!obj || typeof obj !== "object") return { repeats: false, overlap: "" };
  const src = obj as Record<string, unknown>;
  return { repeats: src.repeats === true, overlap: str(src, "overlap") };
}
