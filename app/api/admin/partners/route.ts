import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isValidDoc, normalizeDoc } from "@/lib/br/documento";
import { createPartner, listPartners } from "@/lib/db/admin/partners";
import { parseJsonBody } from "@/lib/http/validate";
import { devLog } from "@/lib/log";
import { normalizeSlug } from "@/lib/partners/cookies";
import { normalizeSocials } from "@/lib/partners/socials";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O slug é validado com a MESMA função que a rota /r e o campo de código usam,
 * e o banco reaplica o formato num CHECK. Três camadas para a mesma regra
 * parece exagero até alguém cadastrar um código com espaço e acento: o link do
 * parceiro nasceria quebrado sem erro visível, porque a rota trata slug
 * inválido como "não existe" e redireciona em silêncio.
 */
const SlugSchema = z.string().transform((v, ctx) => {
  const slug = normalizeSlug(v);
  if (!slug) {
    ctx.addIssue({
      code: "custom",
      message: "slug inválido: use 3 a 32 caracteres entre a-z, 0-9 e hífen",
    });
    return z.NEVER;
  }
  return slug;
});

export const PartnerBodySchema = z
  .object({
    invitedEmail: z.string().email().max(320),
    slug: SlugSchema,
    displayName: z.string().trim().min(1).max(120),
    // O handle chega já normalizado pela tela, mas normalizamos DE NOVO aqui:
    // a rota é a fronteira, e um `curl` com a URL inteira do Instagram gravaria
    // um valor que o painel não consegue transformar em link.
    socials: z
      .record(z.string(), z.string().trim().max(200))
      .optional()
      .transform((v) => (v ? normalizeSocials(v) : v)),
    // Só dígitos no banco, e o dígito verificador tem de fechar: um PIX
    // enviado para documento errado não volta sozinho.
    doc: z
      .string()
      .trim()
      .max(40)
      .nullable()
      .optional()
      .transform((v, ctx) => {
        const digits = normalizeDoc(v);
        if (digits === null) return null;
        if (!isValidDoc(digits)) {
          ctx.addIssue({ code: "custom", message: "CPF ou CNPJ inválido" });
          return z.NEVER;
        }
        return digits;
      }),
    pixKey: z.string().trim().max(140).nullable().optional(),
    // Teto em 100%: o simulador avisa muito antes disso, mas nada aqui deveria
    // aceitar um número que o CHECK do banco recusaria.
    commissionRateBps: z.number().int().min(0).max(10_000).optional(),
    signupBonusCoins: z.number().int().min(0).max(100_000).optional(),
    monthlyCoins: z.number().int().min(0).max(100_000).optional(),
    bonusBudgetCoins: z.number().int().min(0).nullable().optional(),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .strict();

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  try {
    const partners = await listPartners();
    return NextResponse.json({ partners });
  } catch (err) {
    console.error("[admin/partners] list failed", { error: (err as Error).message });
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, PartnerBodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const partner = await createPartner(parsed.data);
    devLog("[admin/partners] created", { id: partner.id, slug: partner.slug });
    return NextResponse.json({ partner }, { status: 201 });
  } catch (err) {
    const message = (err as Error).message;
    // Slug ou e-mail já usados: erro do operador, não do sistema. Um 409 com
    // motivo próprio evita que isso vire o "algo deu errado" genérico, que
    // não diz qual dos dois campos precisa mudar.
    if (message.includes("23505") || message.includes("duplicate key")) {
      return NextResponse.json({ error: "slug_or_email_taken" }, { status: 409 });
    }
    console.error("[admin/partners] create failed", { error: message });
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
