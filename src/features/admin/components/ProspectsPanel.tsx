"use client";

import { UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCoins } from "@/lib/billing/plans";
import type { AdminProspect } from "@/lib/db/prospects";
import { declineProspectAction } from "@/lib/partners/prospect-actions";

/**
 * Os candidatos a parceiro: quem criou conta por `/parceiros` e ainda não foi
 * promovido nem descartado.
 *
 * **Isto é uma FILA, não um cadastro.** A pergunta que ela responde é "quem se
 * interessou desde a última vez que eu olhei?", e por isso os pendentes vêm
 * primeiro e os resolvidos só aparecem sob demanda: uma lista que cresce para
 * sempre deixa de ser lida em duas semanas.
 *
 * "Cadastrar como parceiro" não faz nada de especial, ele abre o MESMO diálogo
 * de sempre, já com o e-mail preenchido. Salvar cria a linha de `partners` e é
 * `createPartner` quem carimba o candidato como promovido, pelo e-mail. Não há
 * um segundo caminho de promoção que possa divergir do cadastro normal.
 */

type Props = {
  prospects: AdminProspect[];
  /** Abre o diálogo de cadastro de parceiro com este e-mail já preenchido. */
  onPromote: (email: string, displayName: string) => void;
};

const DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function ProspectsPanel({ prospects, onPromote }: Props) {
  const [showResolved, setShowResolved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const waiting = prospects.filter((p) => p.status === "new");
  const resolved = prospects.filter((p) => p.status !== "new");
  const rows = showResolved ? prospects : waiting;

  function decline(userId: string) {
    startTransition(async () => {
      await declineProspectAction(userId);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-scriba-ink-strong">
            Candidatos a parceiro
            {waiting.length > 0 ? <Badge>{waiting.length}</Badge> : null}
          </h2>
          <p className="text-[12.5px] font-light text-scriba-ink-soft">
            Criaram conta por /parceiros, receberam as moedas de cortesia e ainda não foram
            avaliados. Nada foi prometido a eles.
          </p>
        </div>
        {resolved.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? "Só pendentes" : `Ver resolvidos (${resolved.length})`}
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl bg-scriba-btn-muted px-3 py-3 text-[12.5px] font-light text-scriba-ink-soft">
          Nenhum candidato pendente.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Entrou</TableHead>
                <TableHead>Moedas</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.userId}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-scriba-ink-strong">
                        {p.displayName ?? "-"}
                      </span>
                      <span className="text-[11.5px] font-light text-scriba-ink-mute">
                        {p.email ?? "sem e-mail no perfil"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[12.5px] font-light text-scriba-ink-soft">
                    {DATE.format(new Date(p.createdAt))}
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-scriba-ink">
                    {p.coinsGranted > 0 ? (
                      formatCoins(p.coinsGranted)
                    ) : (
                      // O zero não é detalhe: significa que o TETO GLOBAL estava
                      // cheio quando a pessoa entrou. Ela se cadastrou esperando
                      // moedas e não recebeu, quem olha esta tela precisa ver
                      // isso, não um "0" que se lê como "ainda não processou".
                      <span className="text-scriba-rose-accent">0 · teto cheio</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.status === "new" ? (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!p.email}
                          onClick={() => onPromote(p.email ?? "", p.displayName ?? "")}
                        >
                          <UserPlus className="size-3.5" aria-hidden />
                          Cadastrar como parceiro
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => decline(p.userId)}
                          aria-label="Descartar candidato"
                        >
                          <X className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="secondary">
                        {p.status === "promoted" ? "Promovido" : "Descartado"}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
