import { NextResponse } from "next/server";
import { z } from "zod";
import { createPartner, listPartners } from "@/features/admin/server/db/partners";
import { normalizeSocials } from "@/features/partners/socials";
import { normalizeSlug } from "@/features/referrals/cookies";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isValidCpf, onlyDigits } from "@/lib/domain/documento";
import { isUf, isValidCep } from "@/lib/domain/endereco";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/partners");

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

/**
 * Endereço obrigatório, com a mesma regra de `isCompleteAddress` e do CHECK
 * `partners_address_shape`. O CEP chega com ou sem máscara e sai só com os
 * dígitos; a UF sai em maiúsculas.
 */
const AddressSchema = z
  .object({
    cep: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .refine(isValidCep, "CEP inválido"),
    street: z.string().trim().min(1).max(200),
    number: z.string().trim().min(1).max(20),
    complement: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((v) => v || undefined),
    district: z.string().trim().min(1).max(120),
    city: z.string().trim().min(1).max(120),
    state: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine(isUf, "UF inválida"),
  })
  .strict();

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
    // CPF OBRIGATÓRIO, e só CPF: o programa é para pessoa física (ver a
    // cláusula 3 dos termos e a migração 0070). Só dígitos no banco, e o
    // dígito verificador tem de fechar: um PIX enviado para documento errado
    // não volta sozinho. Nem `null` nem vazio passam, nem no PATCH, onde o
    // `.partial()` torna o campo omissível mas não anulável.
    doc: z
      .string()
      .trim()
      .max(40)
      .transform((v, ctx) => {
        const digits = onlyDigits(v);
        if (!isValidCpf(digits)) {
          ctx.addIssue({ code: "custom", message: "CPF inválido" });
          return z.NEVER;
        }
        return digits;
      }),
    address: AddressSchema,
    pixKey: z.string().trim().max(140).nullable().optional(),
    // Teto em 100%: o simulador avisa muito antes disso, mas nada aqui deveria
    // aceitar um número que o CHECK do banco recusaria.
    commissionRateBps: z.number().int().min(0).max(10_000).optional(),
    signupBonusCoins: z.number().int().min(0).max(100_000).optional(),
    signupRewardCoins: z.number().int().min(0).max(100_000).optional(),
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
    log.error("list failed", { error: (err as Error).message });
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
    log.info("created", { id: partner.id, slug: partner.slug });
    return NextResponse.json({ partner }, { status: 201 });
  } catch (err) {
    const message = (err as Error).message;
    // Slug ou e-mail já usados: erro do operador, não do sistema. Um 409 com
    // motivo próprio evita que isso vire o "algo deu errado" genérico, que
    // não diz qual dos dois campos precisa mudar.
    if (message.includes("23505") || message.includes("duplicate key")) {
      return NextResponse.json({ error: "slug_or_email_taken" }, { status: 409 });
    }
    log.error("create failed", { error: message });
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
