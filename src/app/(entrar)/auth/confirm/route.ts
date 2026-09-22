import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { nextPathOrDefault } from "@/features/auth/lib/next-path";
import { resolveOrigin } from "@/features/auth/server/origin";
import { applyWelcomeBonuses } from "@/features/auth/server/welcome-bonuses";
import { createLogger } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("auth/confirm");

/**
 * A porta do `token_hash`, irmã do `/auth/callback`.
 *
 * As duas trocam um link de e-mail por sessão, e a diferença é de QUEM pode
 * fazer a troca. O `code` do `/auth/callback` exige o verificador do PKCE, que
 * mora num cookie do navegador que INICIOU o fluxo: pedir a recuperação de
 * senha no computador e abrir o e-mail no celular falha por desenho. O
 * `token_hash` não depende de cookie nenhum, então o link funciona em qualquer
 * aparelho, que é como as pessoas de fato leem e-mail.
 *
 * Esta rota só é usada quando os modelos de e-mail do Supabase apontam para
 * cá. Os de fábrica não apontam, e por isso `supabase/email-templates/` traz os
 * quatro modelos prontos para colar no painel (o guia de colagem é `docs/auth.md`
 * §4). Enquanto ninguém os trocar, tudo continua funcionando pelo
 * `/auth/callback`, no mesmo aparelho.
 *
 * `type` é entrada do cliente e é conferida contra a lista fechada abaixo:
 * ela vai direto para o `verifyOtp`, e um valor inventado ali é uma chamada
 * ao servidor de auth com parâmetro que não controlamos.
 */
const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/** Os tipos em que uma conta acaba de NASCER, e portanto há brinde a creditar. */
const BIRTH_TYPES = new Set<EmailOtpType>(["signup", "invite", "email"]);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type") as EmailOtpType | null;
  const next = nextPathOrDefault(searchParams.get("next"));

  if (!tokenHash || !rawType || !OTP_TYPES.has(rawType)) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type: rawType, token_hash: tokenHash });
  if (error) {
    log.error("verifyOtp falhou", { type: rawType, error: error.message });
    return NextResponse.redirect(`${origin}/sign-in?error=exchange_failed`);
  }

  if (BIRTH_TYPES.has(rawType)) {
    // Indicação, pré-parceiro e cupom. Chamar duas vezes é seguro; ver
    // `features/auth/server/welcome-bonuses.ts`.
    await applyWelcomeBonuses(data.user?.id);
  }

  return NextResponse.redirect(`${resolveOrigin(request, origin)}${next}`);
}
