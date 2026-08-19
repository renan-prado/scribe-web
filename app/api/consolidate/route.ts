import { NextResponse } from "next/server";
import { parseProposalsFromLLM } from "@/lib/domain/consolidate";
import type { SummaryBlock } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";

// Re-export domain types so client-side imports that used to reach into this
// route file keep resolving during the refactor.
export type {
  ConsolidatePayload,
  InsertHeadingProposal,
  MergeProposal,
  Proposal,
  RefineProposal,
} from "@/lib/domain/consolidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `Você recebe um array de blocos de um resumo em português, cada bloco com seu índice. Sua tarefa é propor consolidações CONSERVADORAS.

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

export async function POST(request: Request) {
  const apiKey = serverEnv.OPENAI_API_KEY;
  const model = serverEnv.OPENAI_CONSOLIDATE_MODEL;

  let body: { blocks?: SummaryBlock[]; isFinal?: boolean };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${(err as Error).message}` },
      { status: 400 }
    );
  }
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  if (blocks.length < 3) {
    return NextResponse.json({ proposals: [] });
  }

  const indexedBlocks = blocks.map((b, i) => ({ index: i, ...b }));
  const userMessage = `blocks:\n${JSON.stringify(indexedBlocks)}`;

  const startedAt = performance.now();
  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch (err) {
    console.error("[consolidate] upstream fetch failed", { error: (err as Error).message });
    return NextResponse.json(
      { error: `upstream fetch failed: ${(err as Error).message}`, proposals: [] },
      { status: 502 }
    );
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  const raw = await upstream.text();
  if (!upstream.ok) {
    console.error("[consolidate] upstream error", {
      status: upstream.status,
      latencyMs,
      snippet: raw.slice(0, 300),
    });
    return NextResponse.json(
      { error: `upstream ${upstream.status}: ${raw.slice(0, 500)}`, proposals: [] },
      { status: 502 }
    );
  }

  let parsed: {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // fall through
  }
  const content = parsed.choices?.[0]?.message?.content?.trim() ?? "";
  const finishReason = parsed.choices?.[0]?.finish_reason ?? "";
  const proposals = parseProposalsFromLLM(content, blocks);
  console.log("[consolidate] ok", {
    latencyMs,
    finishReason,
    promptTokens: parsed.usage?.prompt_tokens,
    completionTokens: parsed.usage?.completion_tokens,
    proposals: proposals.length,
  });
  return NextResponse.json({ proposals, latencyMs, model });
}
