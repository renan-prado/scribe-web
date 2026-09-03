import "server-only";
import { NextResponse } from "next/server";
import { cache } from "react";
import { isActiveStatus, type PlanKey } from "@/lib/billing/plans";
import { getOwnSubscription } from "@/lib/db/billing";
import { getFeatureSwitches, getOwnFeatureOverrides } from "@/lib/db/feature-flags";
import {
  type EntitlementSnapshot,
  emptySnapshot,
  evaluateFeature,
  FEATURE_KEYS,
  type FeatureAccess,
  type FeatureKey,
} from "@/lib/entitlements/features";

/**
 * O lado que DECIDE. `lib/entitlements/features.ts` é o catálogo e a
 * aritmética; aqui é onde o estado real do usuário entra.
 *
 * Regra que este módulo existe para impor: **esconder o botão não é
 * proteção**. Toda rota que executa uma funcionalidade paga chama
 * `requireFeature` antes de fazer qualquer coisa cara ou irreversível — e
 * antes de cobrar moedas, sempre. A UI usa o snapshot só para não oferecer o
 * que vai dar 403.
 */

/**
 * O plano que vale AGORA. Não é `subscription.plan`: uma assinatura cancelada
 * mantém o plano gravado na linha para efeito de histórico, e ler esse campo
 * direto daria acesso vitalício a quem cancelou. `isActiveStatus` inclui
 * `past_due` de propósito — o Stripe ainda está tentando cobrar, e ninguém
 * perde acesso no primeiro retry falho.
 */
export const getCurrentPlan = cache(async (): Promise<PlanKey> => {
  const subscription = await getOwnSubscription().catch(() => null);
  if (!subscription) return "free";
  return isActiveStatus(subscription.status) ? subscription.plan : "free";
});

/**
 * Snapshot completo do usuário autenticado. Memoizado por request (`cache()`),
 * então o layout, a página e o componente podem pedir sem multiplicar
 * consultas — mesmo motivo de `lib/db/account.ts`.
 *
 * ⚠️ `cache()` só vale em Server Component / Server Action. Em Route Handler
 * cada chamada refaz as consultas; é o que `requireFeature` faz, e é
 * deliberado — o caminho que protege dinheiro não divide estado com nada.
 */
export const getCurrentEntitlements = cache(async (): Promise<EntitlementSnapshot> => {
  return resolveEntitlements();
});

async function resolveEntitlements(): Promise<EntitlementSnapshot> {
  const [plan, switches, overrides] = await Promise.all([
    getCurrentPlan(),
    getFeatureSwitches().catch(() => ({}) as Record<string, boolean>),
    getOwnFeatureOverrides().catch(() => ({}) as Record<string, boolean>),
  ]);

  const features = {} as Record<FeatureKey, FeatureAccess>;
  for (const key of FEATURE_KEYS) {
    features[key] = evaluateFeature(key, {
      plan,
      enabled: switches[key],
      override: overrides[key] ?? null,
    });
  }
  return { plan, features };
}

/** Atalho para Server Component: "esta pessoa pode?". */
export async function canCurrentUserUse(key: FeatureKey): Promise<boolean> {
  const snapshot = await getCurrentEntitlements().catch(() => emptySnapshot());
  return snapshot.features[key]?.allowed ?? false;
}

/**
 * Gate para Route Handler. Devolve `null` quando pode seguir, ou a resposta
 * pronta quando não.
 *
 * 403 e não 404: diferente do `/admin`, a existência do "Gerar estudo" não é
 * segredo nenhum — ele está anunciado na página de planos. Esconder o motivo
 * aqui só produziria um erro que ninguém sabe resolver, e o caminho de
 * resolução é justamente o que queremos oferecer (assinar).
 */
export async function requireFeature(key: FeatureKey): Promise<NextResponse | null> {
  const snapshot = await resolveEntitlements().catch(() => emptySnapshot());
  const access = snapshot.features[key];
  if (access?.allowed) return null;
  return NextResponse.json(
    {
      error: "feature_not_available",
      feature: key,
      reason: access?.allowed === false ? access.reason : "plan",
      plan: snapshot.plan,
    },
    { status: 403 }
  );
}
