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
 * Prompt-guia do transcritor. Uma frase, e não a lista dos 66 livros.
 *
 * A lista estava lá para o modelo preferir "Filemom" a "Filemão". O que ela
 * fazia, medido: PIORAVA a transcrição. Sobre um sermão real com transcrição
 * de referência, o mesmo áudio nos mesmos chunks fecha 12% de WER com esta
 * frase curta e 17% com a lista inteira, o modelo gasta atenção com 66 nomes
 * que ninguém falou, e em áudio incerto ainda os ecoa como se fossem fala.
 *
 * O `prompt` do endpoint de transcrição é tratado como TRANSCRIÇÃO PRÉVIA:
 * quanto mais ele se parece com o que acabou de ser dito, mais ajuda. É por
 * isso que quem carrega o peso aqui é o `prevText` que a rota concatena
 * depois desta frase, ele é contexto de verdade, e sozinho já entrega os 12%.
 * Esta frase só ancora o domínio e o registro (fala espontânea de púlpito).
 *
 * Se um dia voltar a ideia de guiar vocabulário, o caminho medido NÃO é
 * listar termos: é deixar o prevText mais longo.
 */
export const VOCABULARIO_PROMPT =
  "Transcrição literal de uma pregação cristã em português do Brasil, " +
  "gravada ao vivo. Fala espontânea, com repetições e interjeições.";

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
 * bíblicos ou termos teológicos em sequência limpa por vírgula, o padrão é
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
