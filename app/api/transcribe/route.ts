import { NextResponse } from "next/server";
import { VOCABULARIO_GUIA } from "@/lib/vocabulario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const model = process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-transcribe";

  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid multipart body: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  const chunkIndex = form.get("chunkIndex");
  const prevText = (form.get("prevText") as string | null) ?? "";
  const extension = ((form.get("extension") as string | null) ?? "webm").toLowerCase();

  const upstream = new FormData();
  const filename = `chunk-${chunkIndex ?? "x"}.${extension}`;
  upstream.append("file", file, filename);
  upstream.append("model", model);
  upstream.append("language", "pt");
  upstream.append("response_format", "json");
  const vocab = VOCABULARIO_GUIA.join(", ");
  const prompt = prevText ? `${vocab}. ${prevText}` : vocab;
  upstream.append("prompt", prompt);

  const startedAt = performance.now();
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `upstream fetch failed: ${(err as Error).message}` },
      { status: 502 }
    );
  }
  const latencyMs = Math.round(performance.now() - startedAt);

  const rawBody = await upstreamRes.text();
  if (!upstreamRes.ok) {
    return NextResponse.json(
      { error: `upstream ${upstreamRes.status}: ${rawBody.slice(0, 500)}`, latencyMs, model },
      { status: 502 }
    );
  }

  let parsed: { text?: string } = {};
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = { text: rawBody };
  }

  return NextResponse.json({
    text: parsed.text ?? "",
    latencyMs,
    model,
  });
}
