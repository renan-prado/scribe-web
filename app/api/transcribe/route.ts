import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { callTranscribe } from "@/lib/llm/openai";
import { requireAuth } from "@/lib/supabase/require-auth";
import { VOCABULARIO_GUIA } from "@/lib/vocabulario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB — OpenAI's limit
const ALLOWED_EXTENSIONS = new Set(["webm", "mp4", "mp3", "wav", "ogg", "m4a", "flac"]);

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const model = serverEnv.OPENAI_TRANSCRIBE_MODEL;

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
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }
  const chunkIndex = form.get("chunkIndex");
  const prevText = (form.get("prevText") as string | null) ?? "";
  const extension = ((form.get("extension") as string | null) ?? "webm").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "unsupported file type" }, { status: 415 });
  }

  const filename = `chunk-${chunkIndex ?? "x"}.${extension}`;
  const vocab = VOCABULARIO_GUIA.join(", ");
  const prompt = prevText ? `${vocab}. ${prevText}` : vocab;

  const result = await callTranscribe({
    model,
    file,
    filename,
    prompt,
    language: "pt",
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: result.error.message, latencyMs: result.error.latencyMs, model },
      { status: 502 }
    );
  }

  return NextResponse.json({
    text: result.data.text,
    latencyMs: result.data.latencyMs,
    model,
  });
}
