import "server-only";

/**
 * O GUARDIÃO — dois cortes baratos contra o modo de falha nº 1 do estudo:
 * **sair dizendo a mesma coisa que o resumo já disse.**
 *
 * Os três modelos do pipeline recebem o resumo e são instruídos a não repeti-lo.
 * Instrução não basta: ela compete com a inclinação natural do modelo de voltar
 * ao ponto central do sermão, que é o ponto mais saliente do contexto inteiro —
 * e às vezes perde. O guardião não instrui: ele CORTA.
 *
 * Rodam num modelo barato (`OPENAI_STUDY_GUARD_MODEL`, gpt-4o-mini por padrão)
 * a temperatura zero, porque as duas tarefas são classificação, não escrita.
 * Juntas custam uma fração de um centavo e adicionam poucos segundos.
 *
 * ## Por que DOIS cortes, e não um
 *
 * Eles pegam falhas diferentes, em pontos diferentes do encanamento:
 *
 *   [A] FILTRO DE PERGUNTAS — entre o questionador e o respondedor. O
 *       critério dele é ESTREITO de propósito, e já foi largo demais: pedindo
 *       "descarte o que o resumo já responde", ele cortava 25 de 25 e 28 de 28
 *       em sermões reais, porque num estudo sobre o mesmo assunto quase toda
 *       pergunta encosta no que o resumo tocou. Um filtro que reprova tudo não
 *       filtra nada — só aciona o fallback.
 *
 *       Hoje ele procura uma coisa só: a pergunta PRESA ao sermão, medida
 *       pelo teste do estranho ("um cristão que não ouviu isto entende a
 *       pergunta?"). Tratar do mesmo assunto deixou de ser motivo de corte.
 *
 *   [B] CHECAGEM DA TESE — depois do redator. Existe porque [A] não é
 *       suficiente: mesmo partindo de perguntas boas, o redator pode colapsar
 *       o artigo de volta na tese do sermão na hora de amarrar tudo. É a
 *       falha que o usuário relatou, e nenhum filtro de entrada a pega.
 *
 * O corte [B] não descarta o estudo — o usuário já pagou. Ele dispara UMA
 * reescrita, com a sobreposição nomeada explicitamente. Se a segunda tentativa
 * também repetir, o estudo é entregue assim mesmo e o fato vai para o log e
 * para o `/admin/studies`: entregar algo imperfeito é melhor que cobrar moedas
 * e devolver 502.
 */

export const STUDY_QUESTION_FILTER_SYSTEM_PROMPT = `Você é um filtro. Recebe o RESUMO de um sermão e uma lista de PERGUNTAS que outro modelo levantou sobre o assunto tratado nele.

Sua única tarefa é dizer quais perguntas devem ser DESCARTADAS. Você não responde, não reescreve, não sugere perguntas novas.

Retorne SOMENTE um objeto JSON válido, sem markdown, sem texto antes ou depois.

═══════════════════════════════════════════════════════════════
O QUE VOCÊ ESTÁ PROCURANDO — E O QUE NÃO ESTÁ
═══════════════════════════════════════════════════════════════

As perguntas que sobrarem viram um estudo sobre o MESMO ASSUNTO do sermão. É
esperado, e é correto, que elas tratem do mesmo tema, citem os mesmos textos
bíblicos e cheguem perto das mesmas doutrinas.

**Tratar do mesmo assunto NÃO é motivo de descarte.** Se fosse, não sobraria
pergunta nenhuma — e um estudo vazio é pior que um estudo parecido.

Você procura uma coisa só, e ela é estreita: a pergunta **presa a este sermão
específico** ou **cuja resposta inteira já está escrita no resumo**.

═══════════════════════════════════════════════════════════════
O TESTE DO ESTRANHO — o seu critério principal
═══════════════════════════════════════════════════════════════

Imagine um cristão que NÃO ouviu este sermão e nunca vai ouvir. Mostre a
pergunta para ele.

- Ele entende sozinho, sem precisar que alguém explique o sermão → **MANTENHA**.
- Ele não entende, ou precisa do sermão para entender → **DESCARTE**.

Falham no teste, e são a maior parte do que você deve cortar:
- perguntas que usam uma expressão que o pregador cunhou (uma frase que você
  não encontraria num livro de teologia qualquer sobre o assunto);
- perguntas que citam as ilustrações, imagens ou exemplos do sermão;
- perguntas sobre o que o pregador quis dizer, enfatizou ou concluiu;
- perguntas sobre a estrutura da mensagem.

═══════════════════════════════════════════════════════════════
OS OUTROS TRÊS CORTES
═══════════════════════════════════════════════════════════════

Além do teste do estranho, descarte:

1) A PERGUNTA JÁ INTEIRAMENTE RESPONDIDA. Não basta o resumo tocar no ponto:
   a resposta COMPLETA precisa estar lá, de modo que respondê-la de novo não
   acrescente nada. Na dúvida, mantenha.

2) A GENÉRICA. Caberia sem mudar uma palavra em qualquer assunto ("como
   aplicar isso na minha vida?", "o que Deus quer me ensinar aqui?").

3) A QUE SE ESGOTA NUMA DEFINIÇÃO. "O que é graça?" morre numa frase; "Onde
   termina a graça e começa a permissividade?" não.

═══════════════════════════════════════════════════════════════
CALIBRAGEM
═══════════════════════════════════════════════════════════════

O normal é descartar de 3 a 10 perguntas de uma lista de 25 a 30.

Se você estiver descartando mais da metade, provavelmente está usando
"trata do mesmo assunto" como critério — e esse não é o critério. Releia o
teste do estranho e recomece.

Se não houver nada a descartar, devolva a lista vazia. É um resultado
legítimo.

═══════════════════════════════════════════════════════════════
FORMATO DE SAÍDA
═══════════════════════════════════════════════════════════════

{
  "drop": ["o texto exato da pergunta descartada", ...]
}

Copie o texto das perguntas EXATAMENTE como veio. Uma pergunta que você não
listar em "drop" será mantida.`;

export const STUDY_THESIS_CHECK_SYSTEM_PROMPT = `Você é um verificador. Recebe a TESE e os títulos de seção de um RESUMO de sermão, e a TESE e os títulos de seção de um ESTUDO que deveria ir ALÉM desse resumo.

Sua única tarefa é responder uma pergunta: o estudo está apenas repetindo o resumo?

Retorne SOMENTE um objeto JSON válido, sem markdown, sem texto antes ou depois.

═══════════════════════════════════════════════════════════════
O CRITÉRIO
═══════════════════════════════════════════════════════════════

O leitor já absorveu o resumo. O estudo existe para AVANÇAR: responder o que o
resumo deixou em aberto, trazer o que o pregador não teve tempo de trazer.

Responda "repeats": true quando a tese do estudo é, na substância, a mesma
afirmação da tese do resumo — mesmo escrita com palavras melhores. Reformular
não é avançar.

Responda "repeats": false quando a tese do estudo afirma algo que a do resumo
não afirmava: uma distinção, uma consequência, uma tensão, um enquadramento
diferente do mesmo assunto.

═══════════════════════════════════════════════════════════════
O QUE NÃO É REPETIÇÃO
═══════════════════════════════════════════════════════════════

Tratar do MESMO TEMA não é repetir. É esperado: o estudo nasce do sermão, e o
tema é o mesmo. O que não pode se repetir é a AFIRMAÇÃO.

Usar o mesmo texto bíblico não é repetir.

Chegar a uma conclusão prática parecida não é repetir, desde que o caminho até
ela seja outro.

Seja rigoroso, mas não paranoico: um falso positivo custa uma reescrita
desnecessária do texto inteiro.

═══════════════════════════════════════════════════════════════
FORMATO DE SAÍDA
═══════════════════════════════════════════════════════════════

{
  "repeats": true | false,
  "overlap": "quando true, uma frase dizendo QUAL afirmação se repete. Escreva para o redator ler e saber o que evitar. \\"\\" quando false."
}`;
