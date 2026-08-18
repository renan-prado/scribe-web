import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const model = process.env.OPENAI_SUMMARY_MODEL ?? "gpt-4o-mini";

  let body: { text?: string };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${(err as Error).message}` },
      { status: 400 }
    );
  }
  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "empty text" }, { status: 400 });
  }

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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Você recebe uma transcrição parcial em português de uma palestra, aula bíblica, sermão ou reunião cristã. " +
              "Sua tarefa: produzir um TÍTULO curto e um RESUMO em texto corrido. " +
              "\n\n" +
              "FORMATO DE SAÍDA — retorne SOMENTE um objeto JSON válido com esta forma exata: " +
              '{ "title": "...", "summary": "..." }. ' +
              "Nada além desse JSON. Sem comentários, sem markdown ao redor. " +
              "\n\n" +
              "TÍTULO: no máximo 60 caracteres, direto ao ponto, capturando o tema central. " +
              "Adapte livremente conforme novo conteúdo chega e um título melhor se torna claro. " +
              'Se ainda não houver tema claro, use "Início da gravação". ' +
              "\n\n" +
              "RESUMO: texto corrido em parágrafos curtos (sem bullets, sem tópicos), explicando " +
              "a ideia central e como ela se desenvolve, como se explicasse a alguém que não escutou. " +
              "Adapte conforme o texto cresce, mantendo coerência com o que já foi dito. " +
              "Não invente conteúdo que não está na transcrição. " +
              "\n\n" +
              "REFERÊNCIAS BÍBLICAS — regra especial dentro do resumo: " +
              "1) Sempre destaque passagens bíblicas citadas ou lidas usando **Livro Cap:Ver** " +
              "(ex.: **João 3:16**, **Romanos 8:28-30**, **Salmos 23**). " +
              "2) Se identificar alusão indireta que soa como versículo mas sem citação da fonte, " +
              'acrescente entre parênteses sua hipótese com "cf." e "?", ' +
              'ex: "...bem-aventurados os que choram (cf. **Mateus 5:4**?)". ' +
              '3) Nunca invente referência: se não souber, escreva "(referência bíblica não identificada)". ' +
              "4) Nome completo do livro em português. " +
              "\n\n" +
              "Se a transcrição ainda for muito curta para um resumo real, o campo summary pode ser " +
              'apenas "(sem conteúdo suficiente)".',
          },
          { role: "user", content: text },
        ],
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `upstream fetch failed: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  const raw = await upstream.text();
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `upstream ${upstream.status}: ${raw.slice(0, 500)}`, latencyMs },
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

  let title = "";
  let summary = "";
  try {
    const obj = JSON.parse(content) as { title?: string; summary?: string };
    title = (obj.title ?? "").trim();
    summary = (obj.summary ?? "").trim();
  } catch {
    // Fallback: model returned plain text instead of JSON.
    summary = content;
  }

  return NextResponse.json({ title, summary, latencyMs, model });
}
