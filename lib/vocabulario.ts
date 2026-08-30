export const LIVROS_BIBLICOS = [
  "Gênesis",
  "Êxodo",
  "Levítico",
  "Números",
  "Deuteronômio",
  "Josué",
  "Juízes",
  "Rute",
  "1 Samuel",
  "2 Samuel",
  "1 Reis",
  "2 Reis",
  "1 Crônicas",
  "2 Crônicas",
  "Esdras",
  "Neemias",
  "Ester",
  "Jó",
  "Salmos",
  "Provérbios",
  "Eclesiastes",
  "Cantares",
  "Isaías",
  "Jeremias",
  "Lamentações",
  "Ezequiel",
  "Daniel",
  "Oseias",
  "Joel",
  "Amós",
  "Obadias",
  "Jonas",
  "Miqueias",
  "Naum",
  "Habacuque",
  "Sofonias",
  "Ageu",
  "Zacarias",
  "Malaquias",
  "Mateus",
  "Marcos",
  "Lucas",
  "João",
  "Atos",
  "Romanos",
  "1 Coríntios",
  "2 Coríntios",
  "Gálatas",
  "Efésios",
  "Filipenses",
  "Colossenses",
  "1 Tessalonicenses",
  "2 Tessalonicenses",
  "1 Timóteo",
  "2 Timóteo",
  "Tito",
  "Filemom",
  "Hebreus",
  "Tiago",
  "1 Pedro",
  "2 Pedro",
  "1 João",
  "2 João",
  "3 João",
  "Judas",
  "Apocalipse",
];

export const TERMOS_TEOLOGICOS = [
  "propiciação",
  "justificação",
  "santificação",
  "expiação",
  "escatologia",
  "exegese",
];

export const VOCABULARIO_GUIA = [...LIVROS_BIBLICOS, ...TERMOS_TEOLOGICOS];

/**
 * Prompt-guia para o Whisper. Formato importa: o Whisper trata o `prompt` como
 * transcrição prévia e tenta "continuar" a partir dele. Se passamos uma lista
 * plana ("Gênesis, Êxodo, Levítico, ..."), o modelo acredita que alguém acabou
 * de recitar isso e, em áudio curto/silencioso/incerto, ecoa a lista inteira
 * como se fosse fala. Prosa natural elimina o padrão de eco sem perder a dica
 * de vocabulário — o Whisper ainda enxerga os termos e prefere "Filemom" a
 * "Filemão", "Habacuque" a "Abacuque", etc.
 */
export const VOCABULARIO_PROMPT =
  `Transcrição em português brasileiro de uma aula bíblica ou pregação cristã. ` +
  `Podem aparecer nomes de livros como ${LIVROS_BIBLICOS.join(", ")}, ` +
  `e termos teológicos como ${TERMOS_TEOLOGICOS.join(", ")}.`;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const VOCAB_ECHO_MIN_RUN = 5;
const VOCAB_ALTERNATION = VOCABULARIO_GUIA.map(escapeRegex).join("|");
const VOCAB_ECHO_PATTERN = new RegExp(
  `(?:\\b(?:${VOCAB_ALTERNATION})\\b)(?:\\s*,\\s*(?:${VOCAB_ALTERNATION})\\b){${VOCAB_ECHO_MIN_RUN - 1},}`,
  "gi"
);

/**
 * Rede de segurança contra o eco de vocabulário do Whisper. Detecta runs de
 * 5+ tokens consecutivos separados por vírgula, todos pertencentes ao
 * VOCABULARIO_GUIA, e os remove. Em fala real é implausível recitar 5+ livros
 * bíblicos ou termos teológicos em sequência limpa por vírgula — o padrão é
 * assinatura de alucinação, não de conteúdo. Preserva texto real ao redor e
 * limpa vírgulas/espaços órfãos resultantes.
 */
export function stripVocabHallucination(text: string): string {
  if (!text) return text;
  const stripped = text.replace(VOCAB_ECHO_PATTERN, "");
  if (stripped === text) return text;
  return stripped
    .replace(/,\s*,+/g, ",")
    .replace(/([.!?])\s*,\s*/g, "$1 ")
    .replace(/^\s*,\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
