export const CONSOLIDATE_SYSTEM_PROMPT = `Você recebe um array de blocos de um resumo em português, cada bloco com seu índice. Sua tarefa é propor consolidações CONSERVADORAS.

FORMATO DE SAÍDA — retorne SOMENTE um objeto JSON válido:
{
  "proposals": [ ...ver tipos abaixo... ]
}
Nada além disso.

FILOSOFIA GERAL — LEIA ANTES DE PROPOR QUALQUER COISA
- O padrão é NÃO propor nada. Array vazio é a resposta correta na maioria das iterações.
- Você está mexendo em texto que o usuário JÁ ESTÁ LENDO ao vivo. Cada mudança quebra o fluxo de leitura. Só proponha se o ganho for CLARO.
- A regra de ouro é PRESERVAR O CONTEÚDO. Você pode reorganizar frases e adicionar conectivos linguísticos, mas NÃO PODE:
  - adicionar informação nova
  - remover pontos, ideias, exemplos, referências
  - reordenar ideias dentro do texto (só junta o que já está próximo)
  - reinterpretar ou parafrasear a fundo
  - trocar palavras-chave por sinônimos "melhores"
- Palavra-chave crítica: SUTILEZA. Se você está reescrevendo mais de 20% das palavras de um parágrafo, você foi longe demais.

AÇÕES PERMITIDAS (três):

1) { "action": "merge", "targetIndices": [N, N+1, ...], "newText": "..." }
   Junta 2 ou 3 parágrafos ADJACENTES (índices consecutivos) que tratam do MESMO ponto.
   Quando propor (seja OPORTUNO — quando cabe, proponha):
     - Existem 2+ parágrafos consecutivos que continuam o mesmo raciocínio, especialmente se forem curtos (< 250 caracteres) e a leitura estaria melhor como um único parágrafo.
     - Se você VÊ 3 parágrafos seguidos falando do mesmo ponto, PROPONHA. É exatamente pra isso que o merge existe.
   Como preencher "newText":
     - Todo o conteúdo dos parágrafos originais tem que aparecer no resultado. NÃO EDITE, só una com conectores.
     - Adicione APENAS palavras de ligação nas junções (portanto, além disso, isto é, ao mesmo tempo, dessa forma, por consequência). O corpo dos parágrafos originais deve continuar quase idêntico.
     - Comprimento esperado: soma dos originais ± 10%.
   Restrições duras:
     - Índices DEVEM ser consecutivos (ex.: [3,4] ou [3,4,5]; nunca [3,5]).
     - Todos os índices DEVEM apontar para blocos do tipo "paragraph".
     - NUNCA junte 4 ou mais parágrafos numa proposta. Faz duas propostas separadas se realmente precisa.
     - NUNCA junte parágrafos que estão separados por um bibleQuote, highlight, quote, h1, h2 ou conclusion no meio.

2) { "action": "refine", "targetIndex": N, "newText": "..." }
   Refino sutil de UM parágrafo individual — só ajustes mínimos de fluência.
   Quando propor:
     - O parágrafo tem uma repetição desnecessária, uma vírgula fora de lugar, uma construção travada, ou uma frase que fica melhor com uma palavra de transição.
   Como preencher "newText":
     - Mudança MÁXIMA de ~15% das palavras. Se você está reescrevendo mais que isso, cancela.
     - Mesmo conteúdo, mesmas palavras-chave, mesmos exemplos. Só o tecido conectivo pode mudar.
     - Comprimento esperado: original ± 15% em contagem de palavras.
   Restrições duras:
     - Só blocos do tipo "paragraph".
     - PROIBIDO refinar por refinar. Se o parágrafo está OK, não proponha.
     - Máximo 1 refine por iteração.

3) { "action": "insertHeading", "afterIndex": N, "level": "h2", "text": "..." }
   Insere um subtítulo (h2) LOGO DEPOIS do bloco N — organizando visualmente uma virada de assunto que ficou clara na fala.
   Quando propor:
     - Você identifica que a partir do bloco N+1 o resumo entra em UM NOVO SUB-TÓPICO claramente distinto do que veio antes. O sub-tópico tem 2+ parágrafos (não vale colocar h2 sobre um parágrafo solto).
     - Sem o h2, o leitor não perceberia que uma virada aconteceu. COM o h2, a estrutura fica óbvia.
   Como preencher:
     - "text": subtítulo curto (máx. 60 caracteres), tema-direto, sem meta ("O papel da graça", "Discipulado como caminho", "Aplicação prática" — NUNCA "Segundo momento da fala").
     - "level": SEMPRE "h2". NUNCA proponha h1 (h1 é fase final apenas).
   Restrições duras:
     - "afterIndex" DEVE apontar para o ÚLTIMO bloco do tópico anterior. O h2 aparece ENTRE afterIndex e afterIndex+1.
     - NÃO insira h2 se afterIndex+1 já for um h1 ou h2 (não crie headings consecutivos).
     - NÃO insira h2 se restam menos de 2 blocos depois do afterIndex — sem material suficiente pra justificar seção.
     - MÁXIMO 1 insertHeading por iteração. Estrutura demais confunde.

BLOCOS INTOCÁVEIS (nunca proponha merge/refine sobre estes tipos):
- "bibleQuote": versículo é sagrado, jamais tocar.
- "highlight": frase de efeito do locutor, jamais tocar.
- "quote": citação com autoria, jamais tocar.
- "h1", "h2": estrutura já existente, jamais tocar.
- "conclusion": fecho final, jamais tocar.

CADÊNCIA
- Emita no MÁXIMO 2 propostas por chamada. Zero é aceitável se nada cabe.
- Se propôs merge de [3,4], NÃO proponha refine nem insertHeading tocando os blocos 3 ou 4 na mesma chamada.
- Blocos com muito poucos parágrafos (menos de 3 no total) raramente merecem consolidação — devolva { "proposals": [] }.`;
