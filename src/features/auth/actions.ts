"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nextPathOrDefault } from "@/features/auth/lib/next-path";
import {
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/features/auth/lib/password";
import { requestOrigin } from "@/features/auth/server/origin";
import { applyWelcomeBonuses } from "@/features/auth/server/welcome-bonuses";
import { createLogger } from "@/lib/log";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createClient, getAuthUser } from "@/lib/supabase/server";

const log = createLogger("auth/password");

/**
 * Entrar, criar conta, recuperar e trocar a senha. O caminho de e-mail e senha,
 * ao lado do Google, que continua sendo o botão de cima da tela.
 *
 * **São server actions, e não rotas de API, por três razões que andam juntas:**
 *
 * 1. **O cookie de sessão nasce no servidor.** `signInWithPassword` a partir do
 *    client do navegador funciona, mas deixa a criação da sessão do lado de lá
 *    e obriga um `router.refresh()` para o servidor enxergá-la. Aqui o
 *    `@supabase/ssr` escreve o cookie no mesmo request que já vai re-renderizar
 *    a página (ver o guia de Server Actions do Next: mutar cookie dispara o
 *    re-render), e o `redirect()` sai com a sessão pronta.
 * 2. **O verificador do PKCE também.** O `signUp` guarda um cookie de
 *    verificação que o `/auth/callback` precisa ler para trocar o `?code=` do
 *    e-mail por sessão. Nascendo no servidor, ele é `httpOnly` e está no mesmo
 *    pote que a rota vai abrir.
 * 3. **O brinde de boas-vindas.** Indicação, pré-parceiro e cupom são
 *    creditados por `applyWelcomeBonuses`, que lê cookies httpOnly. Com a
 *    confirmação de e-mail DESLIGADA no Supabase, o `signUp` devolve sessão na
 *    hora e ninguém passa pelo `/auth/callback`: sem esta chamada aqui, o
 *    cupom de convite sumiria em silêncio.
 *
 * **Toda action é um endpoint público**, o Next só esconde a URL. Por isso cada
 * uma valida a entrada com Zod e passa por um balde de cadência ANTES de falar
 * com o Supabase. O servidor de auth tem limites próprios, mas eles são por
 * projeto, e quem os estoura primeiro é quem está sendo atacado, não quem
 * ataca.
 *
 * **As mensagens não são escritas aqui.** Cada action devolve um `status`, e a
 * tela decide a frase, o mesmo contrato de `features/referrals/actions.ts`.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;

const EmailSchema = z.string().trim().toLowerCase().email().max(MAX_EMAIL_LENGTH);
const PasswordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);
const NameSchema = z.string().trim().min(1).max(80);

export type SignInState = {
  status:
    | "idle"
    | "invalid_input"
    | "invalid_credentials"
    | "email_not_confirmed"
    | "account_disabled"
    | "rate_limited"
    | "error";
  /** Guardado para a tela poder oferecer "reenviar confirmação" sem redigitar. */
  email?: string;
};

export type SignUpState = {
  status:
    | "idle"
    | "invalid_input"
    | "weak_password"
    | "email_taken"
    | "check_email"
    | "rate_limited"
    | "error";
  email?: string;
};

export type RecoverState = {
  status: "idle" | "invalid_input" | "sent" | "rate_limited";
};

export type NewPasswordState = {
  status:
    | "idle"
    | "invalid_input"
    | "weak_password"
    | "same_password"
    | "unauthenticated"
    | "error";
};

export type ResendState = {
  status: "idle" | "sent" | "rate_limited" | "error";
};

/**
 * Entrar com e-mail e senha.
 *
 * **Dois baldes, e os dois importam.** O de IP corta a varredura que testa mil
 * contas a partir de uma máquina; o de E-MAIL corta a que testa mil senhas
 * contra uma conta a partir de mil máquinas, que é o formato do credential
 * stuffing moderno e passa reto por qualquer limite por IP.
 *
 * O e-mail entra no balde já normalizado (minúsculo, sem espaço), senão
 * `Fulano@Gmail.com` e `fulano@gmail.com` seriam duas contas para o limitador
 * e uma só para o Supabase.
 */
export async function signInWithPassword(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const parsed = z
    .object({ email: EmailSchema, password: z.string().min(1).max(MAX_PASSWORD_LENGTH) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { status: "invalid_input" };
  const { email, password } = parsed.data;

  const ip = getClientIp(await headers());
  const byIp = checkRateLimit(`auth-sign-in:ip:${ip}`, 20, 10 * MIN);
  const byEmail = checkRateLimit(`auth-sign-in:email:${email}`, 8, 15 * MIN);
  if (!byIp.ok || !byEmail.ok) {
    log.warn("login por senha limitado", { ip, limitedBy: byIp.ok ? "email" : "ip" });
    return { status: "rate_limited", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    log.warn("login por senha recusado", { code: error.code, status: error.status });
    return { ...signInStatusFor(error), email };
  }

  // Fora do try/catch e no fim: `redirect()` funciona lançando, é o contrato
  // dele no Next (ver a API reference de `redirect`).
  redirect(nextPathOrDefault(formData.get("next") as string | null));
}

function signInStatusFor(error: AuthError): SignInState {
  switch (error.code) {
    case "invalid_credentials":
      return { status: "invalid_credentials" };
    case "email_not_confirmed":
      return { status: "email_not_confirmed" };
    case "user_banned":
      return { status: "account_disabled" };
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return { status: "rate_limited" };
    case "validation_failed":
      return { status: "invalid_input" };
    default:
      return { status: "error" };
  }
}

/**
 * Criar conta com e-mail e senha.
 *
 * **O `full_name` vai no `options.data` de propósito.** É de lá que o trigger
 * `handle_new_auth_user` (migração 0005) tira o `display_name` do perfil; sem
 * ele o app passaria a chamar a pessoa pelo pedaço do e-mail antes do arroba,
 * que é o `coalesce` de último recurso daquela função.
 *
 * **O desfecho depende de uma chave do painel do Supabase, e os dois caminhos
 * estão cobertos:** com "Confirm email" LIGADO, `data.session` volta vazia e a
 * tela manda conferir a caixa de entrada; com ela desligada, a sessão vem na
 * hora, e é aqui que o brinde de boas-vindas precisa ser creditado, porque
 * ninguém vai passar pelo `/auth/callback`.
 *
 * **E-mail já cadastrado não é dito em voz alta.** Com a confirmação ligada, o
 * Supabase responde com um usuário de `identities` VAZIO em vez de um erro,
 * justamente para que o formulário não vire um oráculo de "esta pessoa tem
 * conta aqui". Respeitamos isso devolvendo o mesmo `check_email` do caminho
 * feliz: quem já tem conta recebe um e-mail avisando da tentativa, e quem está
 * sondando não aprende nada.
 */
export async function signUpWithPassword(
  _prev: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const parsed = z
    .object({ name: NameSchema, email: EmailSchema, password: PasswordSchema })
    .safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return { status: fields.password ? "weak_password" : "invalid_input" };
  }
  const { name, email, password } = parsed.data;

  const ip = getClientIp(await headers());
  const byIp = checkRateLimit(`auth-sign-up:ip:${ip}`, 10, HOUR);
  if (!byIp.ok) {
    log.warn("cadastro por senha limitado", { ip });
    return { status: "rate_limited", email };
  }

  const next = nextPathOrDefault(formData.get("next") as string | null);
  const origin = await requestOrigin();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    log.warn("cadastro por senha recusado", { code: error.code, status: error.status });
    return { ...signUpStatusFor(error), email };
  }

  // Sem sessão: a confirmação de e-mail está ligada e o link é que vai criar a
  // conta de verdade. O brinde de boas-vindas espera lá no `/auth/callback`.
  if (!data.session) return { status: "check_email", email };

  await applyWelcomeBonuses(data.user?.id);
  log.info("conta criada por e-mail e senha", { userId: data.user?.id });

  redirect(next);
}

function signUpStatusFor(error: AuthError): SignUpState {
  switch (error.code) {
    case "weak_password":
      return { status: "weak_password" };
    case "user_already_exists":
    case "email_exists":
      return { status: "email_taken" };
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return { status: "rate_limited" };
    case "email_address_invalid":
    case "validation_failed":
      return { status: "invalid_input" };
    default:
      return { status: "error" };
  }
}

/**
 * Pedir o e-mail de recuperação de senha.
 *
 * **Responde "enviado" SEMPRE**, inclusive para um endereço que não existe e
 * para um que estourou o balde do Supabase. Um formulário que diferencia os
 * dois casos é uma lista de quem tem conta no produto, de graça, para quem
 * quiser montá-la. O preço é quem digitou o e-mail errado ficar esperando uma
 * mensagem que não vem, e por isso a tela diz "se houver uma conta com esse
 * e-mail".
 *
 * **Serve também para quem entrou pelo Google e quer uma senha.** A conta já
 * existe, o endereço é o mesmo, e definir a senha pela recuperação é o caminho
 * suportado: depois disso os dois botões levam à MESMA conta, porque o
 * Supabase liga as identidades pelo e-mail confirmado.
 */
export async function requestPasswordReset(
  _prev: RecoverState,
  formData: FormData
): Promise<RecoverState> {
  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "invalid_input" };
  const email = parsed.data;

  const ip = getClientIp(await headers());
  const byIp = checkRateLimit(`auth-recover:ip:${ip}`, 10, HOUR);
  const byEmail = checkRateLimit(`auth-recover:email:${email}`, 3, HOUR);
  if (!byIp.ok || !byEmail.ok) {
    log.warn("recuperação limitada", { ip, limitedBy: byIp.ok ? "email" : "ip" });
    return { status: "rate_limited" };
  }

  const origin = await requestOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/new-password")}`,
  });
  if (error) {
    // Vira log e nada mais: a resposta é a mesma do caminho feliz, ver o
    // cabeçalho.
    log.warn("envio de recuperação falhou", { code: error.code, status: error.status });
  }

  return { status: "sent" };
}

/**
 * Definir a nova senha, já dentro da sessão que o link de recuperação criou.
 *
 * O gate é a própria sessão: sem ela o Supabase recusaria de qualquer forma, e
 * conferir aqui devolve uma tela explicando em vez de um erro genérico. Não há
 * conferência de senha ANTIGA porque quem chega aqui chegou por um link enviado
 * ao e-mail da conta, que é a prova de posse; exigir a antiga tornaria a
 * recuperação impossível justamente para quem a esqueceu.
 */
export async function updatePassword(
  _prev: NewPasswordState,
  formData: FormData
): Promise<NewPasswordState> {
  const user = await getAuthUser();
  if (!user) return { status: "unauthenticated" };

  const parsed = PasswordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { status: "weak_password" };

  const ip = getClientIp(await headers());
  if (!checkRateLimit(`auth-new-password:user:${user.id}`, 10, HOUR).ok) {
    log.warn("troca de senha limitada", { ip, userId: user.id });
    return { status: "error" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    log.warn("troca de senha recusada", { code: error.code, userId: user.id });
    if (error.code === "same_password") return { status: "same_password" };
    if (error.code === "weak_password") return { status: "weak_password" };
    return { status: "error" };
  }

  log.info("senha definida", { userId: user.id });
  redirect("/home");
}

/**
 * Reenviar a confirmação de cadastro.
 *
 * Existe para não deixar beco sem saída: quem tenta entrar e ouve "confirme seu
 * e-mail" muitas vezes já apagou a mensagem, e sem isto o único caminho seria
 * criar outra conta. Como a recuperação, responde igual para todo mundo, pelo
 * mesmo motivo de não virar oráculo de quem tem conta.
 */
export async function resendConfirmation(
  _prev: ResendState,
  formData: FormData
): Promise<ResendState> {
  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error" };
  const email = parsed.data;

  const ip = getClientIp(await headers());
  const byIp = checkRateLimit(`auth-resend:ip:${ip}`, 10, HOUR);
  const byEmail = checkRateLimit(`auth-resend:email:${email}`, 3, HOUR);
  if (!byIp.ok || !byEmail.ok) return { status: "rate_limited" };

  const origin = await requestOrigin();
  const next = nextPathOrDefault(formData.get("next") as string | null);
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) log.warn("reenvio de confirmação falhou", { code: error.code });

  return { status: "sent" };
}
