import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Opcional como as do Stripe: sem ela o app sobe normalmente e o
  // `Analytics` não renderiza nada. Ela vive SÓ no escopo Production da
  // Vercel — ver src/shared/components/Analytics.tsx.
  NEXT_PUBLIC_GA_ID: z
    .string()
    .startsWith("G-", "O id de medição do GA4 começa com 'G-'")
    .optional(),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
});

if (!parsed.success) {
  const details = JSON.stringify(parsed.error.flatten().fieldErrors, null, 2);
  throw new Error(`Invalid client environment variables:\n${details}`);
}

export const clientEnv = parsed.data;
