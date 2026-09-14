"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { assertAdmin } from "@/lib/auth/require-admin";
import { normalizeCoinEconomics } from "./economics";
import { COIN_ECONOMICS_COOKIE } from "./settings";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * O `assertAdmin()` é a autorização REAL das duas actions abaixo. O formulário
 * só existir dentro de /admin não protege nada: uma Server Action é um POST
 * próprio, e o id dela é um hash estável embutido no bundle. Ver o mesmo
 * cuidado em `lib/fx/actions.ts`.
 */

/** Aceita "20,00" (pt-BR) e "20.00" (en-US). */
function parseDecimal(raw: FormDataEntryValue | null): number {
  if (typeof raw !== "string") return Number.NaN;
  return Number.parseFloat(raw.trim().replace(",", "."));
}

export async function setCoinEconomics(formData: FormData): Promise<void> {
  await assertAdmin();
  const settings = normalizeCoinEconomics({
    pricePerThousandBrl: parseDecimal(formData.get("pricePerThousandBrl")),
    targetMarginPct: parseDecimal(formData.get("targetMarginPct")),
  });
  const jar = await cookies();
  jar.set(COIN_ECONOMICS_COOKIE, JSON.stringify(settings), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  revalidatePath("/admin/precificacao");
}

export async function clearCoinEconomics(): Promise<void> {
  await assertAdmin();
  const jar = await cookies();
  jar.delete(COIN_ECONOMICS_COOKIE);
  revalidatePath("/admin/precificacao");
}
