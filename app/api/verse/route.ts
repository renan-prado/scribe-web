import { NextResponse } from "next/server";
import { parseVerseFromLLM } from "@/lib/domain/verse";
import { serverEnv } from "@/lib/env/server";
import { callChat } from "@/lib/llm/openai";
import { VERSE_SYSTEM_PROMPT } from "@/lib/prompts/verse";

export type { VersePayload } from "@/lib/domain/verse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  const result = await callChat({
    model,
    temperature: 0,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: VERSE_SYSTEM_PROMPT },
      { role: "user", content: `referência: ${reference}` },
    ],
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: result.error.message }, { status: 502 });
  }

  return NextResponse.json(parseVerseFromLLM(result.data.content, reference));
}
