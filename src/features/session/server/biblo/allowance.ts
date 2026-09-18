import "server-only";
import { BIBLO_GIFT_MESSAGES } from "@/features/coins/pricing";
import { countGiftMessages } from "@/lib/db/biblo";
import { getFeatureSwitches, getOwnFeatureOverrides } from "@/lib/db/feature-flags";
import type { BibloAllowance, BibloVoiceAllowance } from "@/lib/domain/biblo";
import { evaluateFeature } from "@/lib/entitlements/features";
import { getCurrentPlan } from "@/lib/entitlements/server";
import { createLogger } from "@/lib/log";

const log = createLogger("biblo");

/**
 * Quem pode mandar a próxima mensagem ao Biblo.
 *
 * **Esta é a única decisão de acesso do produto que não é um sim ou não**, e
 * por isso ela mora aqui e não em `lib/entitlements/`. O catálogo de features
 * continua respondendo o que sempre respondeu; o que este módulo faz é tratar
 * o "não, por plano" de uma conta gratuita como "talvez, se ainda houver
 * presente". Ensinar esse talvez ao `evaluateFeature` criaria uma terceira
 * resposta que as outras features teriam de entender sem precisar.
 *
 * A ordem importa:
 *
 *   1. **Kill switch primeiro**, e ele recusa TODO mundo — inclusive o
 *      presente e inclusive quem tem override. É a precedência que já está
 *      escrita em `evaluateFeature`, e um incidente não abre exceção.
 *   2. **Plano pago** → `coins`. Saldo insuficiente NÃO é decidido aqui: é o
 *      402 que `chargeCoins` devolve na rota, como em toda outra que cobra.
 *      Conferir o saldo aqui duplicaria a checagem e abriria a janela entre
 *      "eu conferi" e "eu debitei".
 *   3. **Recusado por plano** (conta gratuita) → presente, enquanto houver.
 *   4. **Revogado por override** → nada. Quem foi revogado não ganha presente.
 */
export async function resolveBibloAllowance(userId: string): Promise<BibloAllowance> {
  let plan: Awaited<ReturnType<typeof getCurrentPlan>>;
  try {
    plan = await getCurrentPlan();
  } catch (error) {
    // "Não sei qual é o plano" não pode liberar o que é pago, e também não
    // pode dar o presente: o presente é decidido por SABER que a conta é
    // gratuita. `revoked` é a recusa sem convite, que é a resposta honesta
    // para uma falha nossa — não adianta oferecer um plano a quem talvez já
    // tenha um.
    log.error("não consegui ler o plano", { error: String(error) });
    return { kind: "denied", reason: "revoked" };
  }

  const [switches, overrides] = await Promise.all([
    getFeatureSwitches().catch(() => ({}) as Record<string, boolean>),
    getOwnFeatureOverrides().catch(() => ({}) as Record<string, boolean>),
  ]);

  const access = evaluateFeature("biblo_chat", {
    plan,
    enabled: switches.biblo_chat,
    override: overrides.biblo_chat ?? null,
  });

  if (access.allowed) return { kind: "coins" };
  if (access.reason === "disabled") return { kind: "denied", reason: "disabled" };
  if (access.reason === "revoked") return { kind: "denied", reason: "revoked" };

  // Sobrou `reason: "plan"`, a conta gratuita. É aqui que o presente existe.
  // Falha na contagem assume o presente GASTO: errar para o lado de não dar
  // custa uma conversa; errar para o outro dá mensagens infinitas de graça a
  // quem topar com uma falha de leitura.
  const used = await countGiftMessages(userId).catch((error: unknown) => {
    log.error("não consegui contar o presente", { error: String(error) });
    return BIBLO_GIFT_MESSAGES;
  });
  const remaining = Math.max(0, BIBLO_GIFT_MESSAGES - used);
  if (remaining <= 0) return { kind: "denied", reason: "gift_exhausted" };
  return { kind: "gift", remaining };
}

/**
 * Quem pode mandar o PRÓXIMO recado falado. Ver `BibloVoiceDenial`
 * (`lib/domain/biblo.ts`) para o porquê de não haver presente aqui.
 *
 * **Não é `resolveBibloAllowance` com um `if` a menos, é a mesma decisão sem
 * o passo 3.** O catálogo (`evaluateFeature`) continua respondendo sim ou
 * não; o que a voz NUNCA faz é traduzir o "não, por plano" de uma conta
 * gratuita num talvez. `"plan"` sai direto como recusa.
 *
 * **Sem parâmetro `userId`.** Ao contrário de `resolveBibloAllowance`, esta
 * função nunca consulta `countGiftMessages` (não há presente para a voz), e
 * `getCurrentPlan()` já resolve sozinho a conta do request atual. Recebê-lo
 * sem usá-lo sugeriria uma checagem por PESSOA que este código não faz.
 */
export async function resolveBibloVoiceAllowance(): Promise<BibloVoiceAllowance> {
  let plan: Awaited<ReturnType<typeof getCurrentPlan>>;
  try {
    plan = await getCurrentPlan();
  } catch (error) {
    log.error("não consegui ler o plano", { error: String(error) });
    return { kind: "denied", reason: "revoked" };
  }

  const [switches, overrides] = await Promise.all([
    getFeatureSwitches().catch(() => ({}) as Record<string, boolean>),
    getOwnFeatureOverrides().catch(() => ({}) as Record<string, boolean>),
  ]);

  const access = evaluateFeature("biblo_chat", {
    plan,
    enabled: switches.biblo_chat,
    override: overrides.biblo_chat ?? null,
  });

  if (access.allowed) return { kind: "coins" };
  return { kind: "denied", reason: access.reason };
}
