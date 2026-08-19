import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(request: Request) {
  const apiKey = serverEnv.OPENAI_API_KEY;
  const model = serverEnv.OPENAI_FORMAT_MODEL;

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
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Você recebe uma transcrição contínua em português. " +
              "Sua única tarefa é inserir quebras de parágrafo (\\n\\n) onde há mudança de tópico ou ideia. " +
              "REGRAS ABSOLUTAS: " +
              "1) NÃO altere, adicione ou remova NENHUMA palavra. " +
              "2) NÃO corrija gramática, pontuação ou grafia. " +
              "3) Preserve todas as vírgulas, pontos e sinais existentes. " +
              "4) Apenas insira \\n\\n entre parágrafos. " +
              "Retorne SOMENTE o texto reformatado, sem cabeçalhos nem explicações.",
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
  const formatted = parsed.choices?.[0]?.message?.content?.trim() ?? "";

  return NextResponse.json({ formatted, latencyMs, model });
}
