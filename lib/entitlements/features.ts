/**
 * Catálogo de funcionalidades por plano — parte CLIENT-SAFE.
 *
 * Este é o ÚNICO lugar onde existe a frase "esta funcionalidade exige tal
 * plano". Nenhuma rota, componente ou consulta deve comparar `plan ===
 * "estudioso"` por conta própria: pergunte a `canUseFeature`.
 *
 * ⚠️ O catálogo mora em CÓDIGO, não no banco. É a mesma decisão de
 * `lib/billing/catalog.ts`, pelo mesmo motivo: uma linha errada numa tabela
 * não pode virar acesso grátis a uma funcionalidade paga. O `/admin` MOSTRA
 * esta matriz; não a edita. O que ele edita — kill switch e exceção por
 * pessoa — está em `feature_switches` / `feature_overrides` e entra aqui
 * como CONTEXTO, nunca como regra.
 *
 * Ser client-safe é requisito, não conveniência: a UI precisa do mesmo mapa
 * para não oferecer um botão que o servidor vai recusar. Ela usa para
 * DESENHAR; o servidor usa para DECIDIR (`lib/entitlements/server.ts`).
 */

import { PLAN_ORDER, PLANS, type PlanKey } from "@/lib/billing/plans";

export const FEATURE_KEYS = ["study_generation"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && (FEATURE_KEYS as readonly string[]).includes(value);
}

export type FeatureDefinition = {
  key: FeatureKey;
  /** Nome como o usuário conhece a funcionalidade. */
  name: string;
  /** O que ela faz, em uma linha. Usado no /admin. */
  description: string;
  /** Plano mínimo. `"free"` = disponível para todo mundo. */
  minPlan: PlanKey;
  /** Frase mostrada a quem não alcança o plano. Curta, sem culpa. */
  upsell: string;
};

export const FEATURES: Record<FeatureKey, FeatureDefinition> = {
  study_generation: {
    key: "study_generation",
    name: "Gerar estudo",
    description: "Produz o estudo aprofundado de uma sessão já resumida, e o reprocessamento dele.",
    minPlan: "estudioso",
    upsell: "O estudo aprofundado faz parte do plano Estudioso.",
  },
};

export const FEATURE_LIST: FeatureDefinition[] = FEATURE_KEYS.map((k) => FEATURES[k]);

/** True quando `plan` alcança o degrau exigido pela feature. */
export function planMeetsFeature(plan: PlanKey, key: FeatureKey): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(FEATURES[key].minPlan);
}

/** Nome de tela do plano mínimo — para a frase de upsell. */
export function minPlanNameFor(key: FeatureKey): string {
  return PLANS[FEATURES[key].minPlan].name;
}

export type FeatureDenial =
  /** O plano do usuário é inferior ao mínimo. Reversível comprando. */
  | "plan"
  /** Kill switch: a feature está fora para todo mundo. */
  | "disabled"
  /** Um override do admin revogou para esta pessoa. */
  | "revoked";

export type FeatureAccess = { allowed: true } | { allowed: false; reason: FeatureDenial };

export type FeatureContext = {
  /** Plano EFETIVO — já resolvido contra o status da assinatura. */
  plan: PlanKey;
  /** `false` quando existe linha em `feature_switches` com enabled=false. */
  enabled?: boolean;
  /** Exceção por pessoa. `null`/ausente = sem exceção, decide o plano. */
  override?: boolean | null;
};

/**
 * A decisão. Precedência: kill switch → override → plano.
 *
 * O kill switch vencer o override é deliberado: ele existe para incidente, e
 * um incidente não abre exceção para ninguém — nem para o beta tester que
 * tinha `granted = true`.
 */
export function evaluateFeature(key: FeatureKey, ctx: FeatureContext): FeatureAccess {
  if (ctx.enabled === false) return { allowed: false, reason: "disabled" };
  if (ctx.override === true) return { allowed: true };
  if (ctx.override === false) return { allowed: false, reason: "revoked" };
  if (planMeetsFeature(ctx.plan, key)) return { allowed: true };
  return { allowed: false, reason: "plan" };
}

export function canUseFeature(key: FeatureKey, ctx: FeatureContext): boolean {
  return evaluateFeature(key, ctx).allowed;
}

/**
 * O que o servidor entrega ao cliente: já decidido, sem as razões internas
 * além da que a UI precisa para escolher a mensagem.
 *
 * Note que `reason` não é segredo — o usuário descobre a mesma coisa clicando
 * e recebendo 403. Mandá-la junto é o que permite dizer "faz parte do plano
 * Estudioso" em vez de "indisponível".
 */
export type EntitlementSnapshot = {
  plan: PlanKey;
  features: Record<FeatureKey, FeatureAccess>;
};

export function snapshotAllows(snapshot: EntitlementSnapshot, key: FeatureKey): boolean {
  return snapshot.features[key]?.allowed ?? false;
}

/** Snapshot de quem não está logado / falhou a leitura: nada liberado. */
export function emptySnapshot(): EntitlementSnapshot {
  const features = {} as Record<FeatureKey, FeatureAccess>;
  for (const key of FEATURE_KEYS) features[key] = { allowed: false, reason: "plan" };
  return { plan: "free", features };
}

/**
 * Formas das duas tabelas de runtime, aqui e não em `lib/db/feature-flags.ts`
 * porque a tela do `/admin` é um componente cliente e não pode importar de um
 * módulo `server-only` — nem para tipo. Ver a regra de fronteira no AGENTS.md
 * da raiz.
 */
export type FeatureSwitchRow = {
  feature: string;
  enabled: boolean;
  note: string | null;
  updatedAt: string;
};

export type FeatureOverrideRow = {
  userId: string;
  email: string | null;
  displayName: string | null;
  feature: string;
  granted: boolean;
  note: string | null;
  createdAt: string;
};
