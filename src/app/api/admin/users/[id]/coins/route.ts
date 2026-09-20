import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { grantCoins } from "@/lib/db/billing";
import { parseJsonBody, parseUuidParam } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/users/coins");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Crédito AVULSO na conta de alguém, pelo painel.
 *
 * ## Por que ela existe
 *
 * Porque a alternativa era o Supabase Studio. Dar cortesia a quem perdeu uma
 * gravação por um defeito nosso, ou destravar um suporte, significava abrir a
 * tabela `profiles` e somar um número na mão — sem lançamento no ledger, sem
 * autor, sem motivo, e com o dedo a uma tecla de editar a linha errada. Um
 * crédito feito assim não aparece em `/admin/custos`, não entra no passivo de
 * moedas e não tem como ser auditado depois.
 *
 * ## Ela NÃO é uma segunda porta de crédito
 *
 * `grantCoins` continua sendo a única (ver `lib/db/billing.ts`), e esta rota é
 * mais um chamador dela, como o webhook do Stripe e a mesada do parceiro. Daí
 * ela herdar de graça as três garantias que importam: o lançamento no ledger
 * com motivo próprio (`admin_grant`, que já existia no `GrantReason` esperando
 * por isto), o incremento ATÔMICO no banco (a RPC `grant_coins` faz
 * `saldo = saldo + valor` numa transação, então duas cortesias simultâneas não
 * se atropelam), e a idempotência por `external_ref`.
 *
 * **O `external_ref` carrega QUEM deu, e um id sorteado no servidor.** Quem deu
 * é o que torna o lançamento auditável meses depois; o id sorteado é o que faz
 * duas cortesias iguais, no mesmo minuto, para a mesma pessoa, serem dois
 * créditos em vez de um. Sortear no CLIENTE seria deixar a chave de
 * idempotência na mão de quem chama, e um duplo clique viraria crédito dobrado
 * ou nenhum, conforme o navegador reenviasse o mesmo valor ou um novo.
 *
 * ## O que ela não deixa fazer
 *
 * **Só CREDITA.** Não há valor negativo, e não é esquecimento: tirar moeda de
 * alguém é estorno, tem motivo próprio (`refund`/`chargeback`) e já tem caminho
 * (`clawbackCoins`). Um campo que aceitasse os dois sinais transformaria um
 * erro de digitação na zeragem da conta de um assinante.
 *
 * O teto por operação existe pela mesma razão: `50.000` moedas é vinte vezes a
 * franquia mensal do plano mais caro, ou seja, folga enorme para qualquer
 * cortesia real, e um piso contra o dia em que alguém colar um id no campo do
 * valor.
 */
const MAX_GRANT = 50_000;

const BodySchema = z
  .object({
    amount: z.number().int().positive().max(MAX_GRANT),
    /**
     * Por que esta cortesia foi dada. Vai para o LOG, não para o ledger: a
     * coluna `reason` de `coin_transactions` é o vocabulário fechado de
     * `GrantReason`, e escrever texto livre nela faria toda consulta que agrupa
     * por motivo passar a ter uma cauda de frases únicas.
     */
    note: z.string().trim().max(280).optional(),
  })
  .strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;
  const id = guarded.id;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  const externalRef = `admin:${auth.user.id}:${crypto.randomUUID()}`;
  const balance = await grantCoins({
    userId: id,
    amount: parsed.data.amount,
    reason: "admin_grant",
    externalRef,
  });

  // `null` é a RPC tendo recusado, e o caso mais provável é o id não ser de
  // ninguém: `grant_coins` não tem o que atualizar e volta vazia. Um 500 aqui
  // diria "o Scriba quebrou" sobre o que quase sempre é um id colado errado.
  if (balance === null) {
    log.error("grant failed", { targetId: id, amount: parsed.data.amount, externalRef });
    return NextResponse.json({ error: "grant_failed" }, { status: 422 });
  }

  // `info`, e não `debug`: é dinheiro saindo da casa por decisão de uma pessoa,
  // e é exatamente o tipo de rastro que se vai querer numa auditoria. Ver
  // `src/lib/AGENTS.md`.
  log.info("granted", {
    targetId: id,
    byAdminId: auth.user.id,
    amount: parsed.data.amount,
    note: parsed.data.note ?? null,
    externalRef,
    balance,
  });

  return NextResponse.json({ ok: true, balance });
}
