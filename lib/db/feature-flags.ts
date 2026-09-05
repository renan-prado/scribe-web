import "server-only";
import { escapeLikeValue } from "@/lib/db/like";
import type { FeatureOverrideRow, FeatureSwitchRow } from "@/lib/entitlements/features";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistência das DUAS coisas de entitlement que mudam em runtime: o kill
 * switch por feature e a exceção por pessoa. O mapa `feature → plano mínimo`
 * NÃO está aqui — mora em `lib/entitlements/features.ts`, em código.
 *
 * Divisão de clientes igual à de `lib/db/billing.ts`: leitura do próprio
 * usuário pelo cliente com cookie (a RLS escopa), toda escrita pelo
 * service-role, que só é alcançado depois de `requireAdmin()`.
 *
 * Ausência de linha em `feature_switches` significa LIGADA. Uma feature nova
 * nasce funcionando; a tabela só cresce quando alguém desliga algo.
 */

const log = createLogger("feature-flags");

/** `{ [feature]: enabled }`. Só traz as features que alguém tocou. */
export async function getFeatureSwitches(): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("feature_switches").select("feature, enabled");
  if (error) {
    // Falha de leitura não pode DERRUBAR feature paga: sem linha = ligada, e
    // é isso que devolvemos. O plano continua sendo o gate real.
    log.warn("switches read failed — assuming all enabled", { error: error.message });
    return {};
  }
  const out: Record<string, boolean> = {};
  for (const row of (data ?? []) as { feature: string; enabled: boolean }[]) {
    out[row.feature] = row.enabled;
  }
  return out;
}

/** `{ [feature]: granted }` do usuário autenticado. RLS garante o escopo. */
export async function getOwnFeatureOverrides(): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("feature_overrides").select("feature, granted");
  if (error) {
    // Aqui a falha é conservadora ao contrário: sem override, decide o plano.
    // Perder um `granted = true` tira acesso de um beta tester; perder um
    // `granted = false` devolve acesso a quem paga. Nenhum dos dois cria
    // acesso grátis, que é o que não pode acontecer.
    log.warn("overrides read failed — falling back to plan", { error: error.message });
    return {};
  }
  const out: Record<string, boolean> = {};
  for (const row of (data ?? []) as { feature: string; granted: boolean }[]) {
    out[row.feature] = row.granted;
  }
  return out;
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function listFeatureSwitches(): Promise<FeatureSwitchRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feature_switches")
    .select("feature, enabled, note, updated_at")
    .order("feature");
  if (error) throw new Error(`listFeatureSwitches failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    feature: r.feature as string,
    enabled: r.enabled as boolean,
    note: (r.note as string | null) ?? null,
    updatedAt: r.updated_at as string,
  }));
}

/**
 * Liga ou desliga uma feature para todo mundo. Escreve sempre — inclusive ao
 * religar — porque a linha guarda quem mexeu e quando, e essa é a única
 * trilha que temos de um incidente.
 */
export async function setFeatureSwitch(args: {
  feature: string;
  enabled: boolean;
  note: string | null;
  adminId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("feature_switches").upsert(
    {
      feature: args.feature,
      enabled: args.enabled,
      note: args.note,
      updated_at: new Date().toISOString(),
      updated_by: args.adminId,
    },
    { onConflict: "feature" }
  );
  if (error) throw new Error(`setFeatureSwitch failed: ${error.message}`);
  log.info("switch set", { feature: args.feature, enabled: args.enabled });
}

export async function listFeatureOverrides(): Promise<FeatureOverrideRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feature_overrides")
    .select("user_id, feature, granted, note, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listFeatureOverrides failed: ${error.message}`);

  const rows = (data ?? []) as {
    user_id: string;
    feature: string;
    granted: boolean;
    note: string | null;
    created_at: string;
  }[];
  if (rows.length === 0) return [];

  // Um SELECT só para todos os donos — a lista de exceções é curta por
  // natureza, mas N+1 numa tela de admin envelhece mal.
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, display_name")
    .in("id", ids);
  const byId = new Map(
    ((profiles ?? []) as { id: string; email: string | null; display_name: string | null }[]).map(
      (p) => [p.id, p]
    )
  );

  return rows.map((r) => ({
    userId: r.user_id,
    email: byId.get(r.user_id)?.email ?? null,
    displayName: byId.get(r.user_id)?.display_name ?? null,
    feature: r.feature,
    granted: r.granted,
    note: r.note,
    createdAt: r.created_at,
  }));
}

/** Resolve um e-mail para o id da conta. `null` quando não existe. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", escapeLikeValue(email.trim()))
    .maybeSingle();
  if (error) throw new Error(`findUserIdByEmail failed: ${error.message}`);
  return (data?.id as string | undefined) ?? null;
}

export async function setFeatureOverride(args: {
  userId: string;
  feature: string;
  granted: boolean;
  note: string | null;
  adminId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("feature_overrides").upsert(
    {
      user_id: args.userId,
      feature: args.feature,
      granted: args.granted,
      note: args.note,
      created_at: new Date().toISOString(),
      created_by: args.adminId,
    },
    { onConflict: "user_id,feature" }
  );
  if (error) throw new Error(`setFeatureOverride failed: ${error.message}`);
  log.info("override set", { feature: args.feature, granted: args.granted });
}

/** Remove a exceção — a pessoa volta a ser decidida pelo plano. */
export async function clearFeatureOverride(userId: string, feature: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("feature_overrides")
    .delete()
    .eq("user_id", userId)
    .eq("feature", feature);
  if (error) throw new Error(`clearFeatureOverride failed: ${error.message}`);
  log.info("override cleared", { feature });
}
