"use client";

import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  CATEGORY_KIND_LABELS,
  type CategoryKind,
  type CostNature,
  type FinanceCategory,
  NATURE_LABELS,
} from "@/lib/domain/finance";

/**
 * O vocabulário financeiro.
 *
 * A coluna que importa é NATUREZA, e ela não é decoração: é a categoria que
 * decide se um custo entra em "fixo" ou em "variável" na visão mensal e na
 * base das projeções (ver `lib/finance/aggregate.ts`). Trocar a natureza de
 * "Infraestrutura" reescreve a leitura de TODO o histórico, por isso a
 * mudança tem log próprio na rota, e por isso ela mora aqui, numa tela de
 * configuração, e não dentro do formulário de lançamento.
 *
 * NÃO EXISTE EXCLUIR. Apagar uma categoria deixaria os lançamentos dela com
 * `category_id` nulo, e sem categoria um custo vira variável, o custo fixo do
 * histórico inteiro despencaria sem nada indicando por quê. Arquivar tira do
 * formulário e mantém o passado legível.
 */

const KIND_OPTIONS: SelectOption[] = [
  { value: "expense", label: "Despesa" },
  { value: "revenue", label: "Receita" },
  { value: "both", label: "Ambos" },
];

const NATURE_OPTIONS: SelectOption[] = [
  { value: "fixed", label: "Fixo" },
  { value: "variable", label: "Variável" },
];

export function CategoriesManager({ categories }: { categories: FinanceCategory[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [nature, setNature] = useState<CostNature>("variable");
  const [busy, setBusy] = useState(false);

  const active = categories.filter((c) => !c.archivedAt);
  const archived = categories.filter((c) => c.archivedAt);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Dê um nome à categoria.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/finance/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), kind, nature }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(
          payload.error === "category_exists"
            ? "já existe uma categoria com esse nome"
            : payload.error
        );
      }
      toast.success("Categoria criada.");
      setName("");
      router.refresh();
    } catch (err) {
      toast.error(`Falha ao criar: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function patch(category: FinanceCategory, body: Record<string, unknown>, message: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/finance/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(message);
      router.refresh();
    } catch (err) {
      toast.error(`Falha ao salvar: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function renderRows(items: FinanceCategory[], isArchived: boolean) {
    return items.map((category) => (
      <TableRow key={category.id} className={isArchived ? "opacity-55" : undefined}>
        <TableCell className="text-[13px] font-medium text-scriba-ink-strong">
          {category.name}
        </TableCell>
        <TableCell>
          <Badge variant="outline">{CATEGORY_KIND_LABELS[category.kind]}</Badge>
        </TableCell>
        <TableCell>
          {isArchived ? (
            <span className="text-[12.5px] text-scriba-ink-mute">
              {NATURE_LABELS[category.nature]}
            </span>
          ) : (
            <Select
              items={NATURE_OPTIONS}
              value={category.nature}
              disabled={busy}
              onValueChange={(v) => {
                if (v === category.nature) return;
                void patch(category, { nature: v }, "Natureza atualizada.");
              }}
            >
              <SelectTrigger size="sm" className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NATURE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </TableCell>
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              patch(
                category,
                { archived: !isArchived },
                isArchived ? "Categoria restaurada." : "Categoria arquivada."
              )
            }
          >
            {isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {isArchived ? "Restaurar" : "Arquivar"}
          </Button>
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5">
        <div>
          <h2 className="text-[14px] font-semibold text-scriba-ink-strong">Categorias</h2>
          <p className="text-[12px] font-light leading-[1.5] text-scriba-ink-mute">
            A natureza da categoria é o que decide se um custo entra em fixo ou variável, mudá-la
            reescreve a leitura de todo o histórico.
          </p>
        </div>

        <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-name">Nova categoria</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Contabilidade"
            />
          </div>
          <Select
            items={KIND_OPTIONS}
            value={kind}
            onValueChange={(v) => setKind(v as CategoryKind)}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={NATURE_OPTIONS}
            value={nature}
            onValueChange={(v) => setNature(v as CostNature)}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NATURE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreate} disabled={busy}>
            <Plus className="size-4" />
            Criar
          </Button>
        </div>
      </div>

      <div className="admin-table admin-card-surface overflow-hidden rounded-2xl border border-scriba-hairline-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead>Usada em</TableHead>
              <TableHead>Natureza</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderRows(active, false)}
            {archived.length > 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="bg-scriba-surface text-[11px] font-semibold uppercase tracking-[0.1em] text-scriba-ink-mute"
                >
                  Arquivadas, fora dos formulários, ainda explicando o histórico
                </TableCell>
              </TableRow>
            ) : null}
            {renderRows(archived, true)}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
