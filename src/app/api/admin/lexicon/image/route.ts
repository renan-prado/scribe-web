import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { setLexiconImage } from "@/lib/db/lexicon";
import { LEXICON_IMAGE_EXTENSION, LEXICON_IMAGE_TYPES, LEXICON_LIMITS } from "@/lib/domain/lexicon";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/lexicon-image");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A imagem de um cartão do léxico.
 *
 * **Rota própria, e não mais uma ação da irmã ao lado**, porque o corpo é
 * `multipart/form-data` e a outra é JSON validado por Zod. Enfiar o arquivo na
 * outra rota custaria um caminho de parse alternativo dentro dela e um schema
 * que descreve dois formatos diferentes — a fronteira natural aqui é o tipo do
 * corpo.
 *
 * ## As três conferências, e por que elas existem sendo o banco a última palavra
 *
 * O bucket já recusa tipo e tamanho fora da lista (migrações 0063 e 0064). O
 * que se ganha conferindo aqui é MENSAGEM: recusado pelo Storage, o erro chega
 * como uma string de infraestrutura que a tela repassa sem saber o que dizer.
 * É a mesma régua do Zod × CHECK do resto do repositório: o primeiro produz
 * frase, o segundo produz garantia.
 *
 * O SVG é aceito (ver o cabeçalho da 0064). O que o mantém inerte não é uma
 * conferência aqui dentro — não há como "limpar" um SVG com confiança —, é ele
 * ser servido de outra origem e ser desenhado sempre por `<img>`.
 */

/** O teto do corpo. Um pouco acima do limite do arquivo, para o envelope do
 *  multipart caber sem transformar um arquivo válido em 413. */
const MAX_BODY_BYTES = LEXICON_LIMITS.imageBytes + 64 * 1024;

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const id = form.get("id");
  const file = form.get("file");
  if (typeof id !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const contentType = file.type as (typeof LEXICON_IMAGE_TYPES)[number];
  if (!LEXICON_IMAGE_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "bad_type" }, { status: 415 });
  }
  if (file.size > LEXICON_LIMITS.imageBytes) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const result = await setLexiconImage(id, {
    bytes: await file.arrayBuffer(),
    contentType,
    extension: LEXICON_IMAGE_EXTENSION[contentType],
  });

  if (!result.ok) {
    log.error("imagem não subiu", { id, reason: result.reason });
    return NextResponse.json(
      { error: result.reason },
      { status: result.reason === "not_found" ? 404 : 500 }
    );
  }

  return NextResponse.json({ ok: true, entry: result.entry });
}
