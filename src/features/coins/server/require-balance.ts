import "server-only";
import { NextResponse } from "next/server";

/**
 * Piso de saldo para as rotas que gastam dinheiro nosso na OpenAI.
 *
 * POR QUE EXISTE. A cobrança por minuto de gravação é emitida pelo NAVEGADOR
 * (`src/features/coins/store.ts` → POST /api/coins/charge). Isso é uma decisão
 * de produto razoável, só o cliente sabe quanto tempo o microfone ficou
 * aberto, mas fazia da medição inteira uma gentileza: `transcribe` e
 * `final-summary` tinham `requireAuth` e rate limit, e mais nada. Um cliente
 * que simplesmente NUNCA
 * chamasse /api/coins/charge transcrevia de graça, com saldo zero, limitado só
 * pelo balde em memória, que é por instância, e portanto vale
 * `limite × instâncias`.
 *
 * O que este gate faz e o que ele NÃO faz: ele recusa quem está sem crédito.
 * Ele não mede consumo, não substitui o tique do cliente e não impede alguém
 * de gravar 50 minutos pagando 10. Fechar essa segunda folga exigiria mover a
 * medição para o servidor (contar segundos de áudio recebidos por sessão), que
 * é uma mudança de produto, não de segurança. O piso corta o caso que importa:
 * a conta grátis, de saldo zero, rodando um script.
 *
 * `null` é "não sei" e passa. Vem de linha de `profiles` ausente ou de erro de
 * leitura, e é o mesmo princípio de `getCurrentBalance`, uma inconsistência
 * nossa não tranca a gravação de quem não tem culpa dela. Só o zero LIDO
 * recusa.
 *
 * 402 e não 403: é exatamente o código que os clientes de gravação já tratam
 * como "pare de capturar e ofereça a compra" (ver o 402 de /api/coins/charge),
 * então a UI existente reage certo sem mudança nenhuma.
 *
 * **A conta de Backoffice passa sempre** (migração 0073). O saldo dela não é
 * debitado por `charge_coins`, então o número em `profiles` está congelado no
 * que era quando a conta foi marcada — pode ser 8.959, pode ser 0, e nenhum
 * dos dois diz nada. Recusar por esse zero trancaria exatamente a conta que
 * existe para exercitar as rotas caras.
 */
export function requireBalance(user: {
  coinBalance: number | null;
  isInternal?: boolean;
}): NextResponse | null {
  if (user.isInternal === true) return null;
  if (user.coinBalance === null) return null;
  if (user.coinBalance > 0) return null;
  return NextResponse.json({ error: "insufficient_balance" }, { status: 402 });
}
