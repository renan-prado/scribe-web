import { NextResponse } from "next/server";
import { getCurrentBalance, getCycleUsage } from "@/lib/db/coins";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saldo e CICLO da conta, para o cliente ressincronizar depois de uma ação que
 * gasta (o tique da gravação, uma mensagem ao Biblo, um aprofundar).
 *
 * O ciclo vem junto porque quem assina não vê o número: o chip desenha o
 * crédito do MÊS restante, e ele envelhece pelo mesmo débito que envelhece o
 * saldo. Buscá-lo numa segunda rota faria o anel e o número discordarem por um
 * instante a cada gasto. `null` = conta sem franquia, e aí o chip volta ao
 * saldo absoluto. Ver `docs/creditos-na-tela.md`.
 *
 * `unlimited` é a conta de Backoffice (migração 0073). Ela vai no MESMO
 * payload, e não numa rota própria, pela mesma razão do ciclo: é o cliente
 * decidindo entre desenhar um número e desenhar ∞, e duas respostas
 * separadas deixariam o chip mostrar o saldo congelado por um instante antes
 * de se corrigir.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["coins-read"], auth.user.id);
  if (limited) return limited;

  const [balance, cycle] = await Promise.all([
    getCurrentBalance(),
    getCycleUsage().catch(() => null),
  ]);
  return NextResponse.json({ balance: balance ?? 0, cycle, unlimited: auth.user.isInternal });
}
