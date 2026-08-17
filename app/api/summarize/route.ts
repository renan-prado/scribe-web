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
        messages: [
          {
            role: "system",
            content:
              "Você recebe uma transcrição parcial em português de uma palestra, aula ou reunião. " +
              "Sua tarefa: escrever um resumo em texto corrido (parágrafos curtos, sem bullets, sem tópicos) " +
              "explicando a ideia central do que está sendo dito e como ela se desenvolve. " +
              "Seja descritivo e claro, como se estivesse explicando o assunto para alguém que não escutou. " +
              "O texto vai crescer com o tempo — adapte o resumo conforme novo conteúdo chega, " +
              "mantendo coerência com o que já foi dito. Não invente conteúdo que não está na transcrição. " +
              "Se ainda não houver ideia clara, responda apenas: (sem conteúdo suficiente).",
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
  const summary = parsed.choices?.[0]?.message?.content?.trim() ?? "";

  return NextResponse.json({ summary, latencyMs, model });
}
