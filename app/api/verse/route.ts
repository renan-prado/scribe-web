import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `Você recebe uma referência bíblica em português (ex.: "Ef 2:8", "Romanos 8:28-29", "Salmos 23", "1 Coríntios 13:4-7").

Sua tarefa: devolver o TEXTO BÍBLICO REAL dessa referência.

FORMATO DE SAÍDA — retorne SOMENTE um objeto JSON válido:
{
  "reference": "string (referência normalizada, ex.: 'Efésios 2:8-9')",
  "text": "string (texto do versículo, ou vazio se não souber)",
  "translation": "string (sigla da tradução usada, ex.: 'ARC', 'ARA', 'NVI', 'NAA', 'NTLH', 'NVT')"
}

REGRAS ABSOLUTAS:
- Use uma tradução comum em português (ARC, ARA, NVI, NAA, NTLH, NVT) — qualquer uma que você conheça bem.
- Se a referência inclui uma FAIXA (ex.: "Rm 8:28-29"), "text" DEVE conter TODOS os versículos da faixa, em ordem, unidos numa continuação natural. NÃO pare no primeiro.
- Se a referência é um capítulo inteiro (ex.: "Salmos 23") e o capítulo tem mais de 10 versículos, DEVOLVA "text" vazio ("") — não gere capítulos longos.
- Se você não tem certeza ABSOLUTA do texto real, devolva "text" vazio (""). NUNCA invente, NUNCA parafraseie, NUNCA aproxime.
- INTEGRIDADE: "text" DEVE conter o versículo (ou range) COMPLETO. Se precisar omitir um trecho longo, sinalize com "[...]" no ponto do corte. NUNCA apresente um recorte como se fosse o versículo inteiro.
- "reference" normalizada: use o nome completo do livro em português (ex.: "Efésios 2:8", não "Ef 2:8").`;

export async function POST(request: Request) {
  const apiKey = serverEnv.OPENAI_API_KEY;
  const model = serverEnv.OPENAI_VERSE_MODEL;

  let body: { reference?: string };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${(err as Error).message}` },
      { status: 400 }
    );
  }
  const reference = (body.reference ?? "").trim();
  if (!reference) {
    return NextResponse.json({ error: "empty reference" }, { status: 400 });
  }

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
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `referência: ${reference}` },
        ],
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `upstream fetch failed: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  const raw = await upstream.text();
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `upstream ${upstream.status}: ${raw.slice(0, 500)}` },
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

  let obj: unknown = null;
  try {
    obj = JSON.parse(content);
  } catch {
    return NextResponse.json({ reference, text: "", translation: "" });
  }
  const rec = (obj && typeof obj === "object" ? obj : {}) as Record<string, unknown>;
  return NextResponse.json({
    reference: typeof rec.reference === "string" ? rec.reference.trim() : reference,
    text: typeof rec.text === "string" ? rec.text.trim() : "",
    translation: typeof rec.translation === "string" ? rec.translation.trim() : "",
  });
}
