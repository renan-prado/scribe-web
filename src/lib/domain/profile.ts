import { z } from "zod";

const ProfileSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  email: z.string().nullable(),
  createdAt: z.string(),
});

export type Profile = z.infer<typeof ProfileSchema>;

/**
 * O primeiro nome, para quando a tela fala COM a pessoa.
 *
 * A conta vem do Google, então `display_name` quase sempre existe; quando não
 * existe, o pedaço do e-mail antes do `@` é o que ela reconheceria como si
 * mesma. O e-mail inteiro nunca sai daqui — endereço de alguém não é nome.
 *
 * Devolve `null` quando não há nada usável, e quem chama decide o fallback: um
 * selo público diz "um amigo" (`lib/db/referrals.ts`), e um cumprimento
 * simplesmente omite o nome, porque "Olá, um amigo!" é pior que "Olá!".
 */
export function firstNameFrom(displayName: string | null, email?: string | null): string | null {
  const name = displayName?.trim();
  if (name) return name.split(/\s+/)[0];
  const handle = email?.split("@")[0]?.trim();
  return handle || null;
}
