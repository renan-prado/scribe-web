"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { MANUAL_FX_COOKIE } from "./usd-brl";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * Persist a manually entered USD→BRL rate as a server-readable cookie.
 * Read back by `getUsdToBrl()` when the AwesomeAPI fetch fails.
 * Accepts pt-BR ("5,42") or en-US ("5.42") decimal notation.
 */
export async function setManualUsdBrlRate(formData: FormData): Promise<void> {
  const raw = formData.get("rate");
  if (typeof raw !== "string") return;
  const normalized = raw.trim().replace(",", ".");
  const rate = Number.parseFloat(normalized);
  if (!Number.isFinite(rate) || rate <= 0) return;
  const payload = { rate, setAt: new Date().toISOString() };
  const jar = await cookies();
  jar.set(MANUAL_FX_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  revalidatePath("/admin");
  revalidatePath("/admin/usage");
}

export async function clearManualUsdBrlRate(): Promise<void> {
  const jar = await cookies();
  jar.delete(MANUAL_FX_COOKIE);
  revalidatePath("/admin");
  revalidatePath("/admin/usage");
}
