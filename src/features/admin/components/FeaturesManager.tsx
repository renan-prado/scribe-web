"use client";

import { Ban, Check, Loader2, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  type SelectOption,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PLANS } from "@/lib/billing/plans";
import type {
  FeatureDefinition,
  FeatureKey,
  FeatureOverrideRow,
  FeatureSwitchRow,
} from "@/lib/entitlements/features";

/**
 * Painel de funcionalidades. Três blocos, e a ordem conta:
 *
 *   1. A MATRIZ — só leitura. É o retrato de `lib/entitlements/features.ts`.
 *      Quem chega aqui querendo saber "o que o Estudioso tem" lê isto.
 *   2. O KILL SWITCH — o botão de incidente. Vence override.
 *   3. AS EXCEÇÕES — por pessoa, por e-mail.
 *
 * A matriz vir primeiro e não ter botão nenhum é intencional: é o que impede
 * alguém de procurar aqui o lugar de "liberar o estudo pro plano Pessoal".
 * Esse lugar não existe nesta tela; é um commit.
 */

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const EFFECT_OPTIONS: SelectOption<"true" | "false">[] = [
  { value: "true", label: "Liberar" },
  { value: "false", label: "Revogar" },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DATE_FMT.format(d);
}

type Props = {
  features: FeatureDefinition[];
  switches: FeatureSwitchRow[];
  overrides: FeatureOverrideRow[];
};

export function FeaturesManager({ features, switches, overrides }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Ausência de linha = ligada. Ver a migração 0032.
  const switchByFeature = new Map(switches.map((s) => [s.feature, s]));
  const isEnabled = (key: FeatureKey) => switchByFeature.get(key)?.enabled !== false;

  const [email, setEmail] = useState("");
  const [overrideFeature, setOverrideFeature] = useState<FeatureKey>(
    features[0]?.key ?? ("study_generation" as FeatureKey)
  );
  const [granted, setGranted] = useState<"true" | "false">("true");
  const featureOptions: SelectOption<FeatureKey>[] = features.map((f) => ({
    value: f.key,
    label: f.name,
  }));

  async function post(body: unknown, okMessage: string, busyKey: string) {
    setBusy(busyKey);
    try {
      const res = await fetch("/api/admin/features", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(
          data.error === "user_not_found"
            ? "Não achei uma conta com esse e-mail."
            : "Não consegui salvar. Tente de novo."
        );
        return false;
      }
      toast.success(okMessage);
      startTransition(() => router.refresh());
      return true;
    } catch {
      toast.error("Falha de conexão.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 1 — matriz, só leitura */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-scriba-ink-strong">Matriz de planos</h2>
          <p className="text-xs font-light text-scriba-ink-mute">
            Definida em <code className="font-mono">lib/entitlements/features.ts</code>. Mudar qual
            plano libera o quê é um deploy, não um clique — pelo mesmo motivo que o catálogo de
            preços não é editável pelo painel.
          </p>
        </div>
        <div className="rounded-xl border border-scriba-hairline bg-scriba-paper">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionalidade</TableHead>
                <TableHead>Plano mínimo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Exceções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map((f) => {
                const enabled = isEnabled(f.key);
                const count = overrides.filter((o) => o.feature === f.key).length;
                return (
                  <TableRow key={f.key}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-scriba-ink-strong">{f.name}</span>
                        <span className="text-xs font-light text-scriba-ink-mute">
                          {f.description}
                        </span>
                        <code className="mt-0.5 font-mono text-[10px] text-scriba-ink-mute">
                          {f.key}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{PLANS[f.minPlan].name}</Badge>
                    </TableCell>
                    <TableCell>
                      {enabled ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-scriba-green">
                          <Check className="size-3.5" /> Ligada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
                          <Ban className="size-3.5" /> Desligada
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-scriba-ink-mute">
                      {count === 0 ? "—" : `${count}`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* 2 — kill switch */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-scriba-ink-strong">Kill switch</h2>
          <p className="text-xs font-light text-scriba-ink-mute">
            Desligar tira a funcionalidade de <strong>todo mundo</strong>, inclusive de quem tem
            exceção liberada e de quem paga por ela. É botão de incidente, não de produto.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {features.map((f) => {
            const enabled = isEnabled(f.key);
            const row = switchByFeature.get(f.key);
            return (
              <div
                key={f.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-scriba-hairline bg-scriba-paper px-4 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium text-scriba-ink-strong">{f.name}</span>
                  {row ? (
                    <span className="text-[11px] font-light text-scriba-ink-mute">
                      Alterada em {formatDate(row.updatedAt)}
                      {row.note ? ` · ${row.note}` : ""}
                    </span>
                  ) : (
                    <span className="text-[11px] font-light text-scriba-ink-mute">
                      Nunca alterada
                    </span>
                  )}
                </div>
                <Button
                  variant={enabled ? "outline" : "default"}
                  size="sm"
                  disabled={busy === `switch:${f.key}`}
                  onClick={() =>
                    void post(
                      { action: "switch", feature: f.key, enabled: !enabled },
                      enabled ? `${f.name} desligada.` : `${f.name} religada.`,
                      `switch:${f.key}`
                    )
                  }
                >
                  {busy === `switch:${f.key}` ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Power className="size-4" />
                  )}
                  {enabled ? "Desligar" : "Religar"}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3 — exceções por pessoa */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-scriba-ink-strong">Exceções por pessoa</h2>
          <p className="text-xs font-light text-scriba-ink-mute">
            Liberar dá acesso a quem está abaixo do plano mínimo; revogar tira de quem paga. Sem
            exceção, quem decide é o plano.
          </p>
        </div>

        <form
          className="flex flex-wrap items-end gap-2 rounded-xl border border-scriba-hairline bg-scriba-paper p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            void post(
              {
                action: "override",
                feature: overrideFeature,
                email: email.trim(),
                granted: granted === "true",
              },
              "Exceção salva.",
              "override"
            ).then((ok) => {
              if (ok) setEmail("");
            });
          }}
        >
          <div className="flex min-w-[220px] flex-1 flex-col gap-1">
            <span className="text-[11px] font-medium text-scriba-ink-mute">E-mail da conta</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@exemplo.com"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-scriba-ink-mute">Funcionalidade</span>
            <Select
              items={featureOptions}
              value={overrideFeature}
              onValueChange={(v) => setOverrideFeature(v as FeatureKey)}
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {featureOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-scriba-ink-mute">Efeito</span>
            <Select
              items={EFFECT_OPTIONS}
              value={granted}
              onValueChange={(v) => setGranted(v as "true" | "false")}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EFFECT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy === "override"}>
            {busy === "override" ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar exceção
          </Button>
        </form>

        <div className="rounded-xl border border-scriba-hairline bg-scriba-paper">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Funcionalidade</TableHead>
                <TableHead>Efeito</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-scriba-ink-mute">
                    Nenhuma exceção. Todo mundo é decidido pelo plano.
                  </TableCell>
                </TableRow>
              ) : (
                overrides.map((o) => {
                  const key = `clear:${o.userId}:${o.feature}`;
                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-scriba-ink-strong">
                            {o.displayName || o.email || o.userId.slice(0, 8)}
                          </span>
                          {o.email && o.displayName ? (
                            <span className="text-xs font-light text-scriba-ink-mute">
                              {o.email}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{o.feature}</TableCell>
                      <TableCell>
                        <Badge variant={o.granted ? "default" : "destructive"}>
                          {o.granted ? "Liberada" : "Revogada"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-scriba-ink-mute">
                        {formatDate(o.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === key}
                          onClick={() =>
                            void post(
                              {
                                action: "clear-override",
                                feature: o.feature,
                                userId: o.userId,
                              },
                              "Exceção removida.",
                              key
                            )
                          }
                        >
                          {busy === key ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                          Remover
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
