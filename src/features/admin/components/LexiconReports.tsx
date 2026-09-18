"use client";

import { Check, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AdminLexiconReport } from "@/lib/domain/lexicon";

/**
 * Os alertas de "Algo está errado" que chegaram dos cartões.
 *
 * ## Ela fica ACIMA da lista, e some quando está vazia
 *
 * A tela do léxico é uma fila de trabalho de 258 entradas, e quase todo dia o
 * trabalho é escrever o próximo cartão. Um alerta é a exceção que fura essa
 * fila: alguém LEU o que escrevemos e disse que está errado, e isso vale mais
 * que a próxima entrada em branco.
 *
 * Por isso ela abre a tela quando existe e desaparece quando não existe — um
 * bloco "nenhum alerta" permanente seria uma moldura vazia ocupando o lugar do
 * que a pessoa veio fazer.
 *
 * ## O alerta mostra o SLUG, e ele é um link
 *
 * Quem lê "a data está errada" precisa chegar à entrada para corrigir, e o
 * caminho mais curto é a busca da própria tela já filtrada. Sem isso, o alerta
 * obriga a copiar o nome e procurá-lo à mão.
 *
 * ## "Resolvido" não apaga
 *
 * Ele marca a linha, que sai da fila e continua no banco. Apagar perderia o
 * registro do que foi apontado, que é o que responde "esse texto já foi
 * questionado antes?" — e um cartão que recebe três alertas sobre a mesma coisa
 * está dizendo algo que um alerta só não diz.
 */
export function LexiconReports({ reports }: { reports: AdminLexiconReport[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (reports.length === 0) return null;

  async function resolve(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/lexicon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resolve-report", id, resolved: true }),
      });
      if (!res.ok) {
        toast.error("Não consegui marcar como resolvido.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      toast.error("Falha de conexão.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-card-surface flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-[13px] font-medium text-scriba-ink-strong">
        <TriangleAlert className="size-4 text-amber-600" />
        {reports.length === 1
          ? "1 alerta de leitor em aberto"
          : `${reports.length} alertas de leitores em aberto`}
      </h2>

      <ul className="flex flex-col gap-2">
        {reports.map((report) => (
          <li
            key={report.id}
            className="flex items-start gap-3 rounded-lg border border-scriba-hairline-soft p-3"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <a
                href={`/admin/lexico?q=${encodeURIComponent(report.slug)}`}
                className="w-fit font-mono text-[11px] text-scriba-ink-mute hover:text-scriba-ink hover:underline"
              >
                {report.slug}
              </a>
              <p className="text-[13px] leading-relaxed text-scriba-ink">{report.note}</p>
              {report.userEmail ? (
                <span className="text-[11px] text-scriba-ink-mute">{report.userEmail}</span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy === report.id}
              onClick={() => void resolve(report.id)}
            >
              <Check className="size-3.5" />
              Resolvido
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
