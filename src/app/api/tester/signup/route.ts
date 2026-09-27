import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { upsertTesterSignup } from "@/lib/db/testers";
import { normalizeWhatsapp } from "@/lib/domain/whatsapp";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("tester/signup");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O pré-cadastro do teste fechado da Play Store.
 *
 * PÚBLICA, e por definição: quem preenche o formulário de `/tester` ainda não
 * tem conta no Scriba — o app que ele quer baixar é justamente o que ainda
 * não dá para baixar. Está na allowlist do `proxy.ts` pelo mesmo motivo de
 * `/r` e `/i`.
 *
 * **Ela não cria conta, não credita moeda e não manda mensagem nenhuma.** O
 * que ela faz é pôr uma linha numa fila que uma pessoa esvazia à mão, colando
 * os endereços no console do Google Play. É por isso que a resposta de
 * sucesso não promete prazo: quem promete é a tela, e o que ela promete é
 * "algumas horas", que é o tempo do Google propagar a lista, não o nosso.
 *
 * **Nenhuma recusa distingue "já existe".** Um formulário que responde
 * "este e-mail já está cadastrado" é um oráculo de presença numa lista de
 * contatos: dá para varrer endereços e descobrir quem se inscreveu. O
 * reenvio do mesmo e-mail atualiza a linha e responde o mesmo `ok` do
 * primeiro envio — ver `upsertTesterSignup`.
 */
const BodySchema = z
  .object({
    // Zod valida a FORMA; quem valida a existência é o Google, no dia em que
    // o endereço entra na lista e o convite chega (ou não).
    email: z.string().trim().min(5).max(254).email(),
    whatsapp: z.string().trim().min(8).max(24),
    name: z.string().trim().max(80).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, RATE_LIMITS["tester-signup"]);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  const whatsapp = normalizeWhatsapp(parsed.data.whatsapp);
  if (!whatsapp) {
    return NextResponse.json({ error: "invalid_whatsapp" }, { status: 400 });
  }

  const name = parsed.data.name?.trim();
  const ok = await upsertTesterSignup({
    playEmail: parsed.data.email.toLowerCase(),
    whatsapp,
    displayName: name ? name : null,
  });
  if (!ok) {
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  // Sem o e-mail no log: ele é o dado pessoal que esta rota existe para
  // guardar, e o que interessa medir é o VOLUME da fila, não quem entrou.
  log.info("pré-cadastro de testador recebido");
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
