import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { readActiveReferral } from "@/lib/referrals/active";

const log = createLogger("referrals/active");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Quem me indicou?", para o selo do hero da landing page.
 *
 * ESTA ROTA EXISTE PORQUE A LP É ESTÁTICA. `app/page.tsx` não pode ler cookie,
 * uma leitura ali marca a rota como dinâmica e a resposta passa a sair com
 * `no-store` e `X-Vercel-Cache: MISS`, HTML remontado na origem a cada visita
 * anônima, numa página cujo conteúdo é idêntico para todo mundo (ver "Landing
 * page" em `app/AGENTS.md`). O efeito colateral fica aqui, e a LP continua
 * saindo da CDN.
 *
 * PÚBLICA, e por definição: quem chega por um link de indicação ainda não tem
 * conta. Está na allowlist do `proxy.ts` pelo mesmo motivo de `/r` e `/i`.
 *
 * O que ela devolve é o que o visitante já sabe, o nome e a foto de quem
 * mandou o link. Nunca id, nunca e-mail, nunca nada que permita ir de um
 * código a uma pessoa: quem monta a resposta é `readActiveReferral`, sobre os
 * tipos `Public` de `lib/db/*`.
 *
 * `no-store` é obrigatório: a resposta depende de um cookie e é diferente para
 * cada visitante. Um cache compartilhado aqui mostraria o padrinho de um
 * visitante para outro.
 */
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, RATE_LIMITS["referral-active"]);
  if (limited) return limited;

  try {
    const referral = await readActiveReferral();
    return NextResponse.json({ referral }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    // O selo é enfeite: um erro aqui vira "não há indicação" e a LP desenha a
    // pílula normal. Derrubar a landing page por causa de um adorno seria
    // trocar a única página que converte por um detalhe.
    log.error("falha ao resolver indicação ativa", { error: (err as Error).message });
    return NextResponse.json(
      { referral: null },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
