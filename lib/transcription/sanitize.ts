import { stripVocabHallucination } from "@/lib/vocabulario";

/**
 * Assinaturas conhecidas de alucinação do modelo de transcrição em áudio
 * ruim/silêncio, observadas em sessões reais:
 *
 *  1. Eco do prompt-guia — o modelo devolve o texto do VOCABULARIO_PROMPT
 *     como se fosse fala ("Transcrição em português brasileiro de uma aula
 *     bíblica..."). Como o texto é nosso, a remoção é determinística.
 *  2. Eco da lista de vocabulário — runs de livros bíblicos separados por
 *     vírgula (tratado por stripVocabHallucination).
 *  3. Loop de repetição — a mesma sentença repetida N vezes seguidas
 *     ("A Bíblia diz que a pressão é muito grande." ×7). Agravado pelo
 *     prevText, que realimenta o loop no chunk seguinte.
 *
 * Qualquer assinatura marca o chunk como `suspect`: o texto limpo ainda vale
 * para o transcript, mas o chunk não deve ser reutilizado como contexto
 * (prevText) nem alimentar os pipelines ao vivo.
 */

/**
 * Frases do VOCABULARIO_PROMPT que o modelo ecoa em áudio ruim. Matching
 * estrutural (não literal) porque o eco costuma vir truncado ou com a lista
 * de livros parcialmente corrompida ("como , Josué, Jó, e termos teológicos
 * como ."). Nenhuma das âncoras é fala plausível de um pregador. `[^.!?]*`
 * limita o dano de um eco sem ponto final a uma única sentença.
 */
const PROMPT_ECHO_PATTERNS = [
  /transcrição em português brasileiro de uma aula bíblica ou pregação cristã[\s.,;]*/gi,
  /podem aparecer nomes de livros como[^.!?]*(?:termos teológicos como[^.!?]*)?[.!?]?\s*/gi,
];

/** Sentenças idênticas consecutivas a partir deste run são colapsadas em uma. */
const REPEAT_MIN_RUN = 3;

function tidyWhitespace(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[,;]\s*/, "")
    .trim();
}

/** Remove ecos do prompt-guia. Retorna o texto limpo e se algo foi removido. */
export function stripPromptEcho(text: string): { text: string; found: boolean } {
  if (!text) return { text, found: false };
  let out = text;
  for (const pattern of PROMPT_ECHO_PATTERNS) {
    out = out.replace(pattern, " ");
  }
  if (out === text) return { text, found: false };
  return { text: tidyWhitespace(out), found: true };
}

/**
 * Colapsa runs de sentenças idênticas consecutivas (comparação normalizada:
 * caixa e espaços ignorados) com REPEAT_MIN_RUN+ ocorrências para uma única.
 * Runs de 2 são preservados — repetição retórica dupla é comum em pregação;
 * 3+ idênticas e contíguas é assinatura de loop de decodificação, não de fala.
 */
export function collapseRepeatedSentences(text: string): { text: string; found: boolean } {
  if (!text) return { text, found: false };
  const sentences = text.match(/[^.!?]+(?:[.!?]+|$)/g);
  if (!sentences || sentences.length < REPEAT_MIN_RUN) return { text, found: false };

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const kept: string[] = [];
  let found = false;
  let i = 0;
  while (i < sentences.length) {
    const key = normalize(sentences[i]);
    let run = 1;
    while (i + run < sentences.length && normalize(sentences[i + run]) === key && key !== "") {
      run++;
    }
    kept.push(sentences[i]);
    if (run >= REPEAT_MIN_RUN) found = true;
    else for (let k = 1; k < run; k++) kept.push(sentences[i + k]);
    i += run;
  }
  if (!found) return { text, found: false };
  return { text: tidyWhitespace(kept.join(" ")), found: true };
}

export type SanitizedTranscription = {
  text: string;
  /** O texto ecoou frases do prompt-guia. */
  promptEcho: boolean;
  /** O texto ecoou a lista de vocabulário (run de livros por vírgula). */
  vocabEcho: boolean;
  /** O texto continha um loop de sentença repetida (3+ idênticas seguidas). */
  repetitionLoop: boolean;
  /** Qualquer assinatura acima: não reutilizar este chunk como contexto. */
  suspect: boolean;
};

/**
 * Limpeza determinística do texto transcrito de um chunk, na ordem: eco de
 * prompt → eco de vocabulário → loop de repetição. Aplicada no servidor antes
 * de devolver ao cliente, para que transcript, prevText e pipelines nunca
 * vejam as assinaturas conhecidas.
 */
export function sanitizeTranscription(raw: string): SanitizedTranscription {
  const echo = stripPromptEcho(raw);
  const afterVocab = stripVocabHallucination(echo.text);
  const vocabEcho = afterVocab !== echo.text;
  const repeats = collapseRepeatedSentences(afterVocab);
  return {
    text: repeats.text,
    promptEcho: echo.found,
    vocabEcho,
    repetitionLoop: repeats.found,
    suspect: echo.found || vocabEcho || repeats.found,
  };
}
