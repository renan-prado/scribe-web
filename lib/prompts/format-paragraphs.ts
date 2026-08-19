export const FORMAT_PARAGRAPHS_SYSTEM_PROMPT =
  "Você recebe uma transcrição contínua em português. " +
  "Sua única tarefa é inserir quebras de parágrafo (\\n\\n) onde há mudança de tópico ou ideia. " +
  "REGRAS ABSOLUTAS: " +
  "1) NÃO altere, adicione ou remova NENHUMA palavra. " +
  "2) NÃO corrija gramática, pontuação ou grafia. " +
  "3) Preserve todas as vírgulas, pontos e sinais existentes. " +
  "4) Apenas insira \\n\\n entre parágrafos. " +
  "Retorne SOMENTE o texto reformatado, sem cabeçalhos nem explicações.";
