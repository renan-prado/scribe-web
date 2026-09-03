import "server-only";
import type { StudyTopic } from "@/lib/domain/study";

/**
 * Índice de teólogos — substitui a whitelist plana que o prompt antigo
 * carregava.
 *
 * A whitelist antiga tinha 48 nomes e mais nada. Ela restringia o CAMPO
 * `author`, que quase nunca está errado, e não dizia nada sobre o `text`, que
 * é onde a atribuição inventada mora. O efeito prático era o pior possível:
 * garantia que a citação fabricada viesse assinada por alguém real.
 *
 * Este índice serve a dois propósitos distintos, e é por isso que cada entrada
 * tem obra e tema:
 *
 *   1. FILTRAR NA ENTRADA. O redator não recebe 48 nomes soltos; recebe os
 *      seis a doze autores pertinentes ao eixo que está escrevendo, cada um
 *      com século, tradição e as obras pelas quais ele é lembrado. Um autor
 *      sugerido junto do seu assunto e do seu livro tem chance muito maior de
 *      ser citado por pertinência do que de ser jogado no texto.
 *   2. FILTRAR NA SAÍDA. A selagem (`lib/study/seal.ts`) descarta todo bloco
 *      `quote` cujo autor não está aqui — e, mais importante, todo `quote` sem
 *      `work` declarada.
 *
 * `works` NÃO é bibliografia completa: são as obras pelas quais o autor é
 * lembrado, as que um leitor consegue localizar. Se a citação não está numa
 * delas, o redator é instruído a declarar a obra mesmo assim — e é isso que
 * um humano confere em um minuto.
 */

export type Theologian = {
  name: string;
  /** Século(s) de atuação, para o redator situar a voz. */
  era: string;
  tradition: string;
  /** Obras pelas quais é lembrado — as localizáveis, não a bibliografia. */
  works: string[];
  topics: StudyTopic[];
};

export const THEOLOGIANS: Theologian[] = [
  // ── Igreja antiga ─────────────────────────────────────────────────────────
  {
    name: "Agostinho de Hipona",
    era: "séc. IV-V",
    tradition: "patrística latina",
    works: [
      "Confissões",
      "A Cidade de Deus",
      "Sobre a Trindade",
      "Sobre a Graça e o Livre-Arbítrio",
    ],
    topics: ["graca", "pecado", "trindade", "providencia", "amor", "duvida", "criacao"],
  },
  {
    name: "Atanásio",
    era: "séc. IV",
    tradition: "patrística grega",
    works: ["Sobre a Encarnação do Verbo", "Discursos contra os Arianos"],
    topics: ["cristologia", "trindade", "criacao"],
  },
  {
    name: "João Crisóstomo",
    era: "séc. IV-V",
    tradition: "patrística grega",
    works: ["Homilias sobre Mateus", "Homilias sobre Romanos", "Sobre o Sacerdócio"],
    topics: ["etica", "justica-social", "oracao", "lideranca-pastoral", "escritura"],
  },
  {
    name: "Irineu de Lyon",
    era: "séc. II",
    tradition: "patrística",
    works: ["Contra as Heresias", "Demonstração da Pregação Apostólica"],
    topics: ["cristologia", "criacao", "escatologia", "alianca"],
  },
  {
    name: "Gregório de Nazianzo",
    era: "séc. IV",
    tradition: "patrística grega",
    works: ["Discursos Teológicos"],
    topics: ["trindade", "cristologia"],
  },

  // ── Reforma e pós-Reforma ────────────────────────────────────────────────
  {
    name: "Martinho Lutero",
    era: "séc. XVI",
    tradition: "reforma luterana",
    works: [
      "Da Liberdade Cristã",
      "Comentário sobre Gálatas",
      "Da Vontade Cativa",
      "Catecismo Maior",
    ],
    topics: ["graca", "fe", "justificacao", "lei-e-evangelho", "pecado", "duvida"],
  },
  {
    name: "João Calvino",
    era: "séc. XVI",
    tradition: "reforma reformada",
    works: ["Institutas da Religião Cristã", "Comentários bíblicos"],
    topics: ["soberania", "providencia", "escritura", "igreja", "sacramentos", "oracao", "alianca"],
  },
  {
    name: "John Owen",
    era: "séc. XVII",
    tradition: "puritano inglês",
    works: [
      "A Mortificação do Pecado",
      "Comunhão com Deus",
      "A Glória de Cristo",
      "A Morte da Morte na Morte de Cristo",
    ],
    topics: ["pecado", "santificacao", "cristologia", "espirito-santo", "trindade"],
  },
  {
    name: "Richard Baxter",
    era: "séc. XVII",
    tradition: "puritano inglês",
    works: ["O Pastor Aprovado", "O Eterno Descanso dos Santos"],
    topics: ["lideranca-pastoral", "escatologia", "santificacao", "morte"],
  },
  {
    name: "Thomas Watson",
    era: "séc. XVII",
    tradition: "puritano inglês",
    works: ["O Corpo da Divindade", "A Arte do Contentamento Divino", "O Doce Consolo do Cristão"],
    topics: ["alegria", "santificacao", "providencia", "sofrimento", "oracao"],
  },
  {
    name: "Jonathan Edwards",
    era: "séc. XVIII",
    tradition: "puritano norte-americano",
    works: ["Afeições Religiosas", "A Liberdade da Vontade", "Pecadores nas Mãos de um Deus Irado"],
    topics: ["santificacao", "alegria", "pecado", "soberania", "escatologia"],
  },

  // ── Pregação e espiritualidade ───────────────────────────────────────────
  {
    name: "Charles Spurgeon",
    era: "séc. XIX",
    tradition: "batista reformado",
    works: ["Sermões do Tabernáculo Metropolitano", "Tesouro de Davi", "Lições aos Meus Alunos"],
    topics: ["graca", "sofrimento", "oracao", "fe", "duvida", "lideranca-pastoral"],
  },
  {
    name: "Martyn Lloyd-Jones",
    era: "séc. XX",
    tradition: "reformado britânico",
    works: [
      "Estudos no Sermão do Monte",
      "Depressão Espiritual",
      "Pregação e Pregadores",
      "Exposição de Romanos",
    ],
    topics: ["duvida", "santificacao", "espirito-santo", "etica", "lideranca-pastoral"],
  },
  {
    name: "J. C. Ryle",
    era: "séc. XIX",
    tradition: "anglicano evangélico",
    works: ["Santidade", "Pensamentos Expositivos sobre os Evangelhos"],
    topics: ["santificacao", "pecado", "fe"],
  },
  {
    name: "A. W. Tozer",
    era: "séc. XX",
    tradition: "evangélico norte-americano",
    works: ["A Busca de Deus", "O Conhecimento do Santo"],
    topics: ["oracao", "santificacao", "trindade"],
  },
  {
    name: "C. S. Lewis",
    era: "séc. XX",
    tradition: "anglicano leigo",
    works: [
      "Cristianismo Puro e Simples",
      "O Problema do Sofrimento",
      "Cartas de um Diabo a seu Aprendiz",
      "Os Quatro Amores",
      "Um Luto Observado",
    ],
    topics: ["sofrimento", "duvida", "amor", "apologetica", "morte", "etica", "alegria"],
  },
  {
    name: "Elisabeth Elliot",
    era: "séc. XX",
    tradition: "evangélica missionária",
    works: ["Portais de Esplendor", "A Sombra do Todo-Poderoso", "Deixe-me Ser Mulher"],
    topics: ["sofrimento", "missao", "providencia", "morte"],
  },
  {
    name: "Dietrich Bonhoeffer",
    era: "séc. XX",
    tradition: "luterano alemão",
    works: ["Discipulado", "Vida em Comunhão", "Ética", "Resistência e Submissão"],
    topics: ["graca", "igreja", "etica", "justica-social", "sofrimento", "morte"],
  },

  // ── Contemporâneos ───────────────────────────────────────────────────────
  {
    name: "Timothy Keller",
    era: "séc. XX-XXI",
    tradition: "presbiteriano norte-americano",
    works: [
      "A Fé na Era do Ceticismo",
      "O Deus Pródigo",
      "Caminhando com Deus em meio à Dor e ao Sofrimento",
      "Oração",
      "Deuses Falsos",
    ],
    topics: ["graca", "duvida", "sofrimento", "oracao", "apologetica", "justica-social", "amor"],
  },
  {
    name: "D. A. Carson",
    era: "séc. XX-XXI",
    tradition: "batista reformado",
    works: [
      "Comentário de João",
      "O Deus Que Está Presente",
      "A Difícil Doutrina do Amor de Deus",
      "Chamado à Renovação Espiritual",
    ],
    topics: ["amor", "sofrimento", "escritura", "oracao", "cristologia"],
  },
  {
    name: "John Stott",
    era: "séc. XX",
    tradition: "anglicano evangélico",
    works: [
      "A Cruz de Cristo",
      "O Sermão do Monte",
      "A Mensagem de Romanos",
      "Cristianismo Básico",
    ],
    topics: ["cristologia", "etica", "justica-social", "missao", "escritura"],
  },
  {
    name: "J. I. Packer",
    era: "séc. XX-XXI",
    tradition: "anglicano reformado",
    works: ["O Conhecimento de Deus", "Evangelização e Soberania de Deus"],
    topics: ["soberania", "missao", "santificacao", "escritura"],
  },
  {
    name: "R. C. Sproul",
    era: "séc. XX-XXI",
    tradition: "presbiteriano reformado",
    works: ["A Santidade de Deus", "Escolhidos por Deus", "Somos Todos Teólogos"],
    topics: ["soberania", "graca", "pecado", "trindade"],
  },
  {
    name: "Sinclair Ferguson",
    era: "séc. XX-XXI",
    tradition: "presbiteriano escocês",
    works: ["A Controvérsia Marrow (O Cristo Integral)", "O Espírito Santo", "Vida Cristã"],
    topics: ["lei-e-evangelho", "graca", "espirito-santo", "santificacao"],
  },
  {
    name: "N. T. Wright",
    era: "séc. XX-XXI",
    tradition: "anglicano, nova perspectiva",
    works: [
      "A Ressurreição do Filho de Deus",
      "Simplesmente Cristão",
      "Surpreendido pela Esperança",
      "Paulo e a Fidelidade de Deus",
    ],
    topics: ["escatologia", "justificacao", "alianca", "cristologia", "justica-social"],
  },
  {
    name: "Craig Keener",
    era: "séc. XX-XXI",
    tradition: "acadêmico evangélico",
    works: ["Comentário Histórico-Cultural do Novo Testamento", "Comentário de Atos", "Milagres"],
    topics: ["escritura", "espirito-santo", "missao"],
  },
  {
    name: "Gordon Fee",
    era: "séc. XX-XXI",
    tradition: "pentecostal acadêmico",
    works: ["Comentário de 1 Coríntios", "Entendes o Que Lês?", "A Presença Poderosa de Deus"],
    topics: ["espirito-santo", "escritura", "igreja"],
  },
  {
    name: "Christopher J. H. Wright",
    era: "séc. XX-XXI",
    tradition: "anglicano evangélico",
    works: ["A Missão de Deus", "Ética do Antigo Testamento para o Povo de Deus"],
    topics: ["missao", "etica", "justica-social", "alianca", "criacao"],
  },
  {
    name: "Alister McGrath",
    era: "séc. XX-XXI",
    tradition: "anglicano, teologia histórica",
    works: [
      "Teologia Sistemática, Histórica e Filosófica",
      "Doutrina da Justificação (Iustitia Dei)",
    ],
    topics: ["justificacao", "apologetica", "duvida", "criacao"],
  },
  {
    name: "Miroslav Volf",
    era: "séc. XX-XXI",
    tradition: "teologia pública",
    works: ["Exclusão e Abraço", "Memória do Bem, Perdão do Mal"],
    topics: ["justica-social", "amor", "sofrimento", "etica"],
  },
  {
    name: "John Piper",
    era: "séc. XX-XXI",
    tradition: "batista reformado",
    works: [
      "Alegria em Deus (Desiring God)",
      "Não Desperdice Sua Vida",
      "A Paixão de Deus por Sua Glória",
    ],
    topics: ["alegria", "soberania", "sofrimento", "missao"],
  },

  // ── Brasileiros e lusófonos ──────────────────────────────────────────────
  {
    name: "Augustus Nicodemus Lopes",
    era: "séc. XX-XXI",
    tradition: "presbiteriano brasileiro",
    works: [
      "O Que Estão Fazendo com a Igreja",
      "A Bíblia e Seus Intérpretes",
      "O Escândalo da Cruz",
    ],
    topics: ["escritura", "igreja", "cristologia"],
  },
  {
    name: "Hernandes Dias Lopes",
    era: "séc. XX-XXI",
    tradition: "presbiteriano brasileiro",
    works: ["Comentários expositivos (série)", "Vencendo a Ansiedade"],
    topics: ["sofrimento", "oracao", "lideranca-pastoral"],
  },
  {
    name: "Jonas Madureira",
    era: "séc. XXI",
    tradition: "batista, filosofia e teologia",
    works: ["Inteligência Humilhada", "Acorda, Igreja!"],
    topics: ["apologetica", "duvida", "escritura", "etica"],
  },
  {
    name: "Franklin Ferreira",
    era: "séc. XX-XXI",
    tradition: "batista reformado brasileiro",
    works: ["Teologia Sistemática (com Alan Myatt)", "Contigo Caminharei"],
    topics: ["trindade", "graca", "igreja", "escatologia"],
  },
  {
    name: "Heber Carlos de Campos",
    era: "séc. XX-XXI",
    tradition: "presbiteriano brasileiro",
    works: ["O Ser de Deus e os Seus Atributos", "As Obras de Deus"],
    topics: ["soberania", "providencia", "trindade", "criacao"],
  },
  {
    name: "Luiz Sayão",
    era: "séc. XX-XXI",
    tradition: "batista, hebraísta",
    works: ["Introdução à Bíblia", "Rendição Total"],
    topics: ["escritura", "alianca"],
  },
  {
    name: "Russell Shedd",
    era: "séc. XX",
    tradition: "batista, Brasil",
    works: ["Bíblia Shedd (notas)", "Salvação Plena"],
    topics: ["escritura", "santificacao", "igreja"],
  },
  {
    name: "Ricardo Barbosa de Sousa",
    era: "séc. XX-XXI",
    tradition: "espiritualidade cristã, Brasil",
    works: ["O Caminho do Coração", "A Fé como Descanso"],
    topics: ["oracao", "sofrimento", "santificacao", "duvida"],
  },
  {
    name: "Antônio Carlos Costa",
    era: "séc. XX-XXI",
    tradition: "presbiteriano, ação social",
    works: ["Comunidade dos Vagabundos", "Missão Redenção"],
    topics: ["justica-social", "missao", "igreja", "amor"],
  },
  {
    name: "Guilherme de Carvalho",
    era: "séc. XXI",
    tradition: "teologia pública, Brasil",
    works: ["Ensaios sobre cosmovisão e cultura (L'Abri Brasil)"],
    topics: ["apologetica", "etica", "justica-social", "criacao"],
  },
];

const BY_NAME = new Map(THEOLOGIANS.map((t) => [normalize(t.name), t]));

function normalize(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** `null` quando o nome não está no índice — a selagem descarta o bloco. */
export function findTheologian(name: string | null | undefined): Theologian | null {
  if (!name) return null;
  return BY_NAME.get(normalize(name)) ?? null;
}

/**
 * Os autores pertinentes a um tema. Interseção por assunto, com um degrau de
 * folga: lista vazia faria o redator inventar um nome, que é exatamente o que
 * queremos evitar.
 */
export function theologiansFor(topics: StudyTopic[], limit = 12): Theologian[] {
  if (topics.length === 0) return THEOLOGIANS.slice(0, limit);
  const matched = THEOLOGIANS.filter((t) => t.topics.some((x) => topics.includes(x)));
  if (matched.length >= 4) return matched.slice(0, limit);
  return dedupe([...matched, ...THEOLOGIANS]).slice(0, limit);
}

function dedupe(list: Theologian[]): Theologian[] {
  const seen = new Set<string>();
  const out: Theologian[] = [];
  for (const t of list) {
    if (seen.has(t.name)) continue;
    seen.add(t.name);
    out.push(t);
  }
  return out;
}

/** Bloco de texto que entra nos prompts. Uma linha por autor. */
export function renderTheologianBriefing(list: Theologian[]): string {
  return list
    .map((t) => `- ${t.name} (${t.era}, ${t.tradition}) — obras: ${t.works.join("; ")}`)
    .join("\n");
}
