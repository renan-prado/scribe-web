import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // O project ref do Supabase (o subdomínio de `<ref>.supabase.co`).
  //
  // Ele é REDUNDANTE enquanto a URL acima for a do supabase.co, e deixa de ser
  // no momento em que ela vira um domínio customizado (`https://auth.scriba.cc`):
  // aí o ref não está mais em lugar nenhum da URL, e duas coisas dependiam dele
  // sem dizer, o nome do cookie de sessão (lib/supabase/cookie.ts) e o
  // `supabase link` do `npm run db:push`. Ver docs/ambientes.md §7.
  //
  // Público de propósito: o ref não é segredo (ele aparece em toda URL de
  // projeto do Supabase) e o nome do cookie precisa ser o MESMO no navegador e
  // no servidor.
  NEXT_PUBLIC_SUPABASE_PROJECT_REF: z
    .string()
    .regex(/^[a-z0-9]{20}$/, "O project ref do Supabase tem 20 caracteres [a-z0-9]")
    .optional(),
  // Opcional como as do Stripe: sem ela o app sobe normalmente e o
  // `Analytics` não renderiza nada. Ela vive SÓ no escopo Production da
  // Vercel, ver src/shared/components/Analytics.tsx.
  NEXT_PUBLIC_GA_ID: z
    .string()
    .startsWith("G-", "O id de medição do GA4 começa com 'G-'")
    .optional(),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PROJECT_REF: process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF,
  NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
});

if (!parsed.success) {
  const details = JSON.stringify(parsed.error.flatten().fieldErrors, null, 2);
  throw new Error(`Invalid client environment variables:\n${details}`);
}

export const clientEnv = parsed.data;
