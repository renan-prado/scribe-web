"use client";

import { ImageIcon, Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
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
  type AdminLexiconEntry,
  LEXICON_CATEGORIES,
  LEXICON_CATEGORY_LABEL,
} from "@/lib/domain/lexicon";
import { LexiconEntryDialog } from "./LexiconEntryDialog";

/**
 * O cadastro do léxico: a lista, os filtros e a porta para o formulário.
 *
 * ## A coluna que importa é o ESTADO, e o padrão da tela é o rascunho
 *
 * Esta tela nasceu com 258 rascunhos dentro (a migração 0063 trouxe para cá o
 * léxico que era um array no código) e nenhuma entrada publicada. O trabalho
 * que ela existe para servir não é "administrar o cadastro", é **escrever
 * cartões**, um de cada vez, até o produto voltar a marcar nomes — e por isso a
 * ordenação padrão do servidor põe rascunho primeiro, e o filtro de estado é o
 * primeiro que se alcança.
 *
 * A pastilha diz "publicada" ou "rascunho" e mais nada. Ela não distingue
 * "rascunho sem nada escrito" de "rascunho quase pronto": quem quer saber abre,
 * e uma terceira pastilha para um estado intermediário seria uma régua a mais
 * na tela que já tem a régua certa, o botão de publicar aceso ou apagado dentro
 * do formulário.
 *
 * ## Os filtros moram na URL
 *
 * Como no resto do painel: um recorte ("os lugares que faltam") é colável, e o
 * botão voltar do navegador desfaz. A busca cobre termo, título e APELIDO, que
 * é o que faz procurar "Lutero" achar a entrada chamada "Martinho Lutero".
 */

const ANY = "__any__";

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: ANY, label: "Todas" },
  ...LEXICON_CATEGORIES.map((c) => ({ value: c, label: LEXICON_CATEGORY_LABEL[c] })),
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: ANY, label: "Tudo" },
  { value: "rascunho", label: "Rascunhos" },
  { value: "publicadas", label: "Publicadas" },
];

type Props = {
  entries: AdminLexiconEntry[];
  current: { q: string; categoria: string; estado: string };
  /** Quantas existem no total, antes dos filtros. */
  total: { all: number; published: number };
};

export function LexiconManager({ entries, current, total }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(current.q);
  const [categoria, setCategoria] = useState(current.categoria || ANY);
  const [estado, setEstado] = useState(current.estado || ANY);

  /** `null` = fechado; `"new"` = cadastro novo; senão, a entrada em edição. */
  const [editing, setEditing] = useState<AdminLexiconEntry | "new" | null>(null);

  function push(next: { q: string; categoria: string; estado: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.q.trim()) params.set("q", next.q.trim());
    else params.delete("q");
    if (next.categoria !== ANY) params.set("categoria", next.categoria);
    else params.delete("categoria");
    if (next.estado !== ANY) params.set("estado", next.estado);
    else params.delete("estado");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/admin/lexicon?${qs}` : "/admin/lexicon"));
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="admin-card-surface flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          push({ q, categoria, estado });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
          <div className="flex flex-col gap-1.5">
            <Label>Estado</Label>
            <Select
              items={STATUS_OPTIONS}
              value={estado}
              onValueChange={(v) => {
                const next = v ?? ANY;
                setEstado(next);
                push({ q, categoria, estado: next });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Categoria</Label>
            <Select
              items={CATEGORY_OPTIONS}
              value={categoria}
              onValueChange={(v) => {
                const next = v ?? ANY;
                setCategoria(next);
                push({ q, categoria: next, estado });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-1">
            <Label htmlFor="lex-q">Buscar</Label>
            <Input
              id="lex-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="termo, título ou apelido"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" variant="outline" size="sm">
              <Search className="size-3.5" />
              Filtrar
            </Button>
            <Button type="button" size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-3.5" />
              Nova entrada
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-scriba-ink-mute">
          {total.published} de {total.all} publicadas. Só entrada publicada é marcada no texto, abre
          cartão e entra como fonte na conversa do Biblo.
        </p>
      </form>

      <div className="admin-card-surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Termo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Cartão</TableHead>
              <TableHead className="text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-[13px] font-light text-scriba-ink-mute">
                  Nada com esses filtros.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow
                  key={entry.id}
                  className="cursor-pointer"
                  onClick={() => setEditing(entry)}
                >
                  <TableCell>
                    <span className="font-medium text-scriba-ink-strong">{entry.term}</span>
                    {entry.aliases.length > 0 ? (
                      <span className="ml-2 text-[11px] text-scriba-ink-mute">
                        {entry.aliases.join(", ")}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-[12px] text-scriba-ink-mute">
                    {LEXICON_CATEGORY_LABEL[entry.category]}
                  </TableCell>
                  <TableCell className="max-w-[28rem]">
                    <span className="flex items-center gap-2">
                      {entry.imageUrl ? (
                        <ImageIcon
                          aria-label="tem imagem"
                          className="size-3.5 shrink-0 text-scriba-ink-mute"
                        />
                      ) : null}
                      <span className="truncate text-[12px] text-scriba-ink-mute">
                        {entry.title || entry.description || "sem cartão"}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={entry.published ? "default" : "outline"}>
                      {entry.published ? "publicada" : "rascunho"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* A `key` remonta o formulário a cada entrada, e isso é o que mantém os
          campos em dia: os `useState` dele são inicializados a partir da prop, e
          sem remontar, abrir a segunda entrada mostraria o texto da primeira. */}
      {editing !== null ? (
        <LexiconEntryDialog
          key={editing === "new" ? "new" : editing.id}
          entry={editing === "new" ? null : editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}
