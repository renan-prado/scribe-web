import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  clearLexiconImage,
  createLexiconEntry,
  deleteLexiconEntry,
  setLexiconPublished,
  updateLexiconEntry,
} from "@/lib/db/lexicon";
import { LexiconEntryInputSchema } from "@/lib/domain/lexicon";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/lexicon");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O cadastro do léxico: criar, editar, publicar e apagar as entradas que o
 * resumo marca.
 *
 * **Publicar é a ação de verdade desta rota**, e é por isso que ela é um verbo
 * separado de "salvar" em vez de um campo do formulário. Publicar uma entrada
 * faz o nome dela passar a ser marcado na prosa de todo mundo, ficar clicável e
 * entrar como fonte na conversa do Biblo: três efeitos que ninguém quer
 * disparar sem querer ao corrigir uma vírgula na descrição. `LexiconEntryInput`
 * nem sequer aceita o campo.
 *
 * A conferência de "tem o que publicar" mora em `canPublishLexiconEntry`
 * (client-safe) e é chamada nos DOIS lados: o painel para acender o botão, esta
 * rota para recusar o pedido. O botão é UX; a rota é a regra.
 *
 * **E os dois conferem a MESMA coisa**, que é o conserto de um defeito real: o
 * botão olhava o formulário e a rota olhava a linha gravada, então quem
 * preenchia os campos e ia direto ao Publicar via *"Escreva o título e a
 * descrição antes de publicar"* com os dois escritos na tela. Publicar agora
 * carrega o formulário e o grava na mesma escrita.
 */

const IdSchema = z.string().uuid();

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), ...LexiconEntryInputSchema.shape }),
  z.object({ action: z.literal("update"), id: IdSchema, ...LexiconEntryInputSchema.shape }),
  // `entry` é o formulário como ele está AGORA, e publicar o grava junto. Ele é
  // opcional porque publicar também acontece de fora do formulário; ver o
  // cabeçalho de `setLexiconPublished`.
  z.object({
    action: z.literal("publish"),
    id: IdSchema,
    published: z.boolean(),
    entry: LexiconEntryInputSchema.optional(),
  }),
  z.object({ action: z.literal("clear-image"), id: IdSchema }),
  z.object({ action: z.literal("delete"), id: IdSchema }),
]);

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    if (body.action === "delete") {
      const ok = await deleteLexiconEntry(body.id);
      return ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "write_failed" }, { status: 500 });
    }

    const result =
      body.action === "create"
        ? await createLexiconEntry(body, auth.user.id)
        : body.action === "update"
          ? await updateLexiconEntry(body.id, body)
          : body.action === "publish"
            ? await setLexiconPublished(body.id, body.published, body.entry)
            : await clearLexiconImage(body.id);

    if (result.ok) return NextResponse.json({ ok: true, entry: result.entry });

    const status =
      result.reason === "duplicate"
        ? 409
        : result.reason === "not_found"
          ? 404
          : result.reason === "incomplete"
            ? 422
            : 500;
    return NextResponse.json({ error: result.reason }, { status });
  } catch (err) {
    log.error("ação falhou", { action: body.action, error: (err as Error).message });
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
}
