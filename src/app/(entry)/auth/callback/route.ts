import { NextResponse } from "next/server";
import { nextPathOrDefault } from "@/features/auth/lib/next-path";
import { resolveOrigin } from "@/features/auth/server/origin";
import { applyWelcomeBonuses } from "@/features/auth/server/welcome-bonuses";
import { createLogger } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("auth/callback");

/**
 * O callback do fluxo PKCE, a porta do `?code=`.
 *
 * Chega aqui: o Google (e qualquer OAuth futuro) depois do consentimento, e
 * também o link de confirmação de e-mail e o de recuperação de senha ENQUANTO
 * os modelos de e-mail do Supabase forem os de fábrica, porque o
 * `{{ .ConfirmationURL }}` deles passa pelo `/auth/v1/verify` e desemboca aqui
 * com um `code`.
 *
 * **O irmão desta rota é o `/auth/confirm`**, que atende a outra forma do mesmo
 * link, o `token_hash`. A diferença não é estética: o `code` só é trocável por
 * sessão NO MESMO NAVEGADOR que iniciou o fluxo, porque o verificador do PKCE
 * ficou num cookie de lá. Quem pede a recuperação no computador e abre o e-mail
 * no celular cai exatamente nesse buraco, e é por isso que os modelos com
 * `token_hash` (que não dependem de cookie nenhum) são os recomendados em
 * `docs/auth.md`. As duas portas ficam de pé porque a decisão de trocar os
 * modelos é do painel do Supabase, não deste repositório.
 *
 * O `?next=` vem do `proxy.ts` quando ele tira um anônimo de uma rota
 * protegida, então depois do login a pessoa cai onde estava indo.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Só caminho relativo, recusando as formas que o navegador resolve como host
  // externo. Um `next` frouxo aqui é um open redirect assinado pelo nosso
  // domínio, logo depois do login. Ver `features/auth/lib/next-path.ts`.
  const next = nextPathOrDefault(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    log.error("exchangeCodeForSession failed", { error: error.message });
    return NextResponse.redirect(`${origin}/sign-in?error=exchange_failed`);
  }

  // Indicação, pré-parceiro e cupom. Nada aqui pode impedir o login; ver
  // `features/auth/server/welcome-bonuses.ts`.
  await applyWelcomeBonuses(data.user?.id);

  return NextResponse.redirect(`${resolveOrigin(request, origin)}${next}`);
}
