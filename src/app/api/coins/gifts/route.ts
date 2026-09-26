import { NextResponse } from "next/server";
import { listOwnPendingGifts } from "@/features/coins/server/gifts";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Presentes de moedas pendentes do usuário autenticado. Não chama modelo e
 * não cobra, mesma razão de `/api/verse`.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const gifts = await listOwnPendingGifts();
  return NextResponse.json({ gifts });
}
