import { NextResponse } from "next/server";
import type { SummaryBlock } from "@/app/api/summarize/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export type InsightBibleReference = {
  type: "bibleReference";
  targetBlockIndex: number;
  references: string[];
};

export type InsightSupportingContent = {
  type: "supportingContent";
  targetBlockIndex: number;
  label: string;
  text: string;
  source?: string;
};

export type Insight = InsightBibleReference | InsightSupportingContent;

export type InsightsPayload = { insights: Insight[] };

const SYSTEM_PROMPT = `Você recebe (a) uma transcrição parcial em português de uma palestra, aula bíblica, sermão ou reunião cristã, (b) o resumo estruturado já produzido dessa fala, como um array de blocos com índices, e (c) uma lista "existingInsightIndices" com os índices dos blocos que JÁ têm insight atribuído em iterações anteriores.

Sua tarefa: sugerir INSIGHTS EXTRAS que enriqueçam a leitura — conteúdo que NÃO estava explicitamente na fala mas que se conecta genuinamente com o que está sendo dito. Cada insight é ancorado a UM bloco específico do resumo (pelo índice).

FORMATO DE SAÍDA — retorne SOMENTE um objeto JSON válido com esta forma exata:
{
  "insights": [ ...ver tipos abaixo... ]
}
Nada além disso. Sem markdown ao redor, sem comentários.

REGRA FUNDAMENTAL — RELEVÂNCIA COM BOA COBERTURA
- Sua meta é dar BOA COBERTURA ao longo do resumo, sem repetir ou encher linguiça.
- FOQUE nos blocos QUE AINDA NÃO ESTÃO em "existingInsightIndices". Esses são os candidatos naturais. Blocos que já têm insight NÃO precisam de outro — você não pode nem propor pra eles (será rejeitado).
- Cadência típica por chamada: 0 a 2 insights, ocasionalmente 3 se o material realmente pede. Array vazio é aceitável quando nada dos blocos novos merece.
- Só emita um insight se ele passa neste teste: "Um leitor atento diria 'isso agregou' ou 'isso me faria parar pra olhar'?".
- PROIBIDO encheção de linguiça: sugestões óbvias, genéricas, tautológicas ou que só repetem o que o bloco já diz. Se você está em dúvida, NÃO emita.
- Um insight ruim é MUITO pior que a ausência de insight. O usuário perde confiança se a IA começa a sugerir bobagem.
- Ideal ao final da fala: um resumo de 8 blocos com ~3-4 insights bem distribuídos. NUNCA um insight por bloco.

TIPOS DE INSIGHT:

1) { "type": "bibleReference", "targetBlockIndex": N, "references": ["Ef 2:8", "Rm 5:1"] }
   Versículos que APOIAM ou APROFUNDAM o ponto do bloco alvo, mas que NÃO foram citados na fala.
   - Use abreviações padrão em português (Gn, Êx, Sl, Pv, Is, Jr, Mt, Mc, Lc, Jo, At, Rm, 1Co, 2Co, Gl, Ef, Fp, Cl, 1Ts, 2Ts, 1Tm, 2Tm, Tt, Fm, Hb, Tg, 1Pe, 2Pe, 1Jo, 2Jo, 3Jo, Jd, Ap).
   - MÁXIMO 3 referências por insight. Prefira 1 ou 2. Cada referência precisa ser INDIVIDUALMENTE forte.
   - PROIBIDO sugerir versículo que já apareceu como bibleQuote em qualquer bloco do resumo. Duplicar é encheção.
   - PROIBIDO sugerir versículos genéricos "batidos" (Jo 3:16, Sl 23:1) só porque cabem em qualquer contexto — o insight tem que ser específico ao ponto.
   - A conexão tem que ser real e verificável, não superficial por palavra-chave. Se o bloco fala de "graça" não jogue qualquer versículo com "graça" — jogue o versículo que ILUMINA o ponto específico.

2) { "type": "supportingContent", "targetBlockIndex": N, "label": "...", "text": "...", "source": "..." }
   Conteúdo de apoio EXTRA — algo que a IA está trazendo de fora da fala. Pode ser:
     - contexto histórico ("A carta aos Efésios foi escrita durante a prisão de Paulo em Roma, ~62 d.C., a uma igreja cosmopolita marcada pelo culto a Ártemis.")
     - curiosidade linguística/exegética ("O termo grego traduzido como 'graça' aqui — cháris — carrega também a ideia de favor imerecido concedido gratuitamente.")
     - livro/autor para se aprofundar ("O tema é desenvolvido em 'O Cristão Total', de John Stott, especialmente no capítulo 3.")
     - conexão com outro texto/tradição ("Agostinho tratou dessa mesma tensão entre lei e graça em 'De Spiritu et Littera'.")
   - "label" curto (máx. 24 caracteres): "Contexto histórico", "Para se aprofundar", "Curiosidade", "Nas palavras dos Pais", "Conexão", etc.
   - "text" curto: 1 a 2 frases (máx. ~280 caracteres). Denso, específico, factual.
   - "source" opcional: nome do livro/autor/tradição/enciclopédia se aplicável.
   - PROIBIDO inventar fatos, datas, autores ou livros. Se não tem certeza, NÃO emita. Melhor devolver nada.
   - PROIBIDO conteúdo que apenas parafraseia o bloco em outras palavras. Tem que agregar informação NOVA.

REGRAS GERAIS
- "targetBlockIndex" DEVE ser um índice válido dentro do array "blocks" recebido (0-based).
- Não ancore insights a blocos do tipo "conclusion" — o leitor não precisa de anotação lateral no fecho.
- Nunca ancore mais de UM insight por bloco. Se dois seriam relevantes, escolha o mais forte.
- Retorne { "insights": [] } se nada passar no teste de relevância. Isso é a resposta certa muitas vezes.`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const model = process.env.OPENAI_INSIGHTS_MODEL ?? "gpt-4o-mini";

  let body: { text?: string; blocks?: SummaryBlock[]; existingInsightIndices?: number[] };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${(err as Error).message}` },
      { status: 400 }
    );
  }
  const text = (body.text ?? "").trim();
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  const existingIndices = Array.isArray(body.existingInsightIndices)
    ? body.existingInsightIndices.filter(
        (n): n is number => typeof n === "number" && Number.isInteger(n)
      )
    : [];
  if (!text || blocks.length === 0) {
    return NextResponse.json({ insights: [] });
  }

  const indexedBlocks = blocks.map((b, i) => ({ index: i, ...b }));
  const userMessage = `existingInsightIndices: ${JSON.stringify(existingIndices)}\n\nblocks:\n${JSON.stringify(indexedBlocks)}\n\n---\ntranscript:\n${text}`;

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
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `upstream fetch failed: ${(err as Error).message}`, insights: [] },
      { status: 502 }
    );
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  const raw = await upstream.text();
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `upstream ${upstream.status}: ${raw.slice(0, 500)}`, latencyMs, insights: [] },
      { status: 502 }
    );
  }

  let parsed: { choices?: { message?: { content?: string } }[] } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // fall through
  }
  const content = parsed.choices?.[0]?.message?.content?.trim() ?? "";

  const insights = normalizeInsights(content, blocks, existingIndices);
  return NextResponse.json({ insights, latencyMs, model });
}

function normalizeInsights(
  content: string,
  blocks: SummaryBlock[],
  existingIndices: number[]
): Insight[] {
  let obj: unknown = null;
  try {
    obj = JSON.parse(content);
  } catch {
    return [];
  }
  if (!obj || typeof obj !== "object") return [];
  const rawList = (obj as { insights?: unknown }).insights;
  if (!Array.isArray(rawList)) return [];

  const takenBlocks = new Set<number>(existingIndices);
  const out: Insight[] = [];
  for (const raw of rawList) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const type = typeof rec.type === "string" ? rec.type : "";
    const idx = typeof rec.targetBlockIndex === "number" ? rec.targetBlockIndex : -1;
    if (idx < 0 || idx >= blocks.length) continue;
    if (blocks[idx].type === "conclusion") continue;
    if (takenBlocks.has(idx)) continue;

    if (type === "bibleReference") {
      const rawRefs = Array.isArray(rec.references) ? rec.references : [];
      const references = rawRefs
        .filter((r): r is string => typeof r === "string")
        .map((r) => r.trim())
        .filter(Boolean)
        .slice(0, 3);
      if (references.length === 0) continue;
      const alreadyCited = collectCitedReferences(blocks);
      const fresh = references.filter((r) => !alreadyCited.has(normalizeRef(r)));
      if (fresh.length === 0) continue;
      out.push({ type: "bibleReference", targetBlockIndex: idx, references: fresh });
      takenBlocks.add(idx);
      continue;
    }
    if (type === "supportingContent") {
      const label = typeof rec.label === "string" ? rec.label.trim() : "";
      const text = typeof rec.text === "string" ? rec.text.trim() : "";
      if (!label || !text) continue;
      const source = typeof rec.source === "string" ? rec.source.trim() : "";
      out.push({
        type: "supportingContent",
        targetBlockIndex: idx,
        label,
        text,
        ...(source ? { source } : {}),
      });
      takenBlocks.add(idx);
    }
  }
  return out;
}

function collectCitedReferences(blocks: SummaryBlock[]): Set<string> {
  const set = new Set<string>();
  for (const b of blocks) {
    if (b.type === "bibleQuote" && b.reference) set.add(normalizeRef(b.reference));
  }
  return set;
}

function normalizeRef(ref: string): string {
  return ref.toLowerCase().replace(/\s+/g, "").replace(/[.,]/g, "");
}
