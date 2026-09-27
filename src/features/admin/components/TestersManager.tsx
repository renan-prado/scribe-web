"use client";

import { Check, ClipboardCopy, MailCheck, MessageCircle, Undo2 } from "lucide-react";
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
import type { AdminTesterSignups, TesterSignupRow } from "@/features/admin/server/db/testers";
import {
  markAllTestersInvited,
  markTesterInvited,
  undoTesterInvited,
} from "@/features/admin/server/tester-actions";
import { formatWhatsapp } from "@/lib/domain/whatsapp";

/**
 * A fila do teste fechado, e o mutirão de convidar em lote.
 *
 * **Ela é uma FILA DE TRABALHO, não um cadastro**, e o desenho todo sai disso:
 * o bloco de cima é a única coisa que se faz aqui de verdade (copiar os
 * endereços, colar no console do Google Play, marcar), e a tabela embaixo é
 * conferência. Enquanto esta tela não existia, esse mutirão era um
 * `string_agg` digitado à mão no SQL Editor do Supabase de produção, seguido
 * de um `update` com o `where` escrito na hora.
 *
 * **O que se copia é uma LINHA SÓ, separada por vírgula**, porque o destino
 * dela é um campo de texto: a lista de testadores do console do Google Play é
 * um `textarea` de endereços separados por vírgula. Copiar uma coluna obrigaria
 * a pessoa a juntar as linhas à mão do outro lado, que é metade do trabalho que
 * este botão existe para tirar.
 *
 * **Marcar não convida ninguém**, e é importante que quem usa a tela saiba: o
 * convite acontece no CONSOLE, fora daqui. `invited_at` é a nossa anotação de
 * que o endereço já foi colado lá, e é só isso que o botão escreve. Por isso o
 * desfazer existe e é inofensivo, ele apaga a anotação, não o convite.
 *
 * **A confirmação do lote é o próprio botão em dois toques**, sem diálogo:
 * marcar a fila inteira é a ação que mais custa desfazer (são N linhas, e o
 * desfazer é por linha), e um `window.confirm` num painel que já tem diálogo de
 * verdade seria a única janela do sistema operacional no produto inteiro.
 */

const DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type Props = {
  data: AdminTesterSignups;
  /** Ver `ADMIN_TESTERS_PAGE_SIZE`: o teto é dito quando é atingido. */
  pageSize: number;
};

export function TestersManager({ data, pageSize }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);

  const queue = data.rows.filter((r) => r.invitedAt === null);
  // Uma linha, vírgula e espaço: é o formato que o campo do console consome.
  const emailList = queue.map((r) => r.playEmail).join(", ");

  function copyQueue() {
    navigator.clipboard.writeText(emailList).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-baseline gap-x-8 gap-y-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper px-5 py-4">
        <Metric label="Na fila" value={data.pending} />
        <Metric label="Convidados, esperando" value={data.waiting} />
        <Metric label="Entraram no app" value={data.joined} />
        <Metric label="Total" value={data.total} />
      </section>

      {/* O MUTIRÃO. Ele só existe quando há fila: um bloco "nenhum pendente"
          permanente seria moldura vazia no lugar do que a pessoa veio fazer,
          a mesma regra da fila de alertas do léxico. */}
      {queue.length > 0 ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-scriba-hairline bg-scriba-paper p-5">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-scriba-ink-strong">
              Convidar os que estão na fila
              <Badge>{queue.length}</Badge>
            </h2>
            <p className="text-[12.5px] font-light leading-relaxed text-scriba-ink-soft">
              Copie os endereços, cole na lista de testadores do teste fechado no Google Play
              Console e só então marque como convidados. O Google leva algumas horas para propagar a
              liberação.
            </p>
          </div>

          {/* Os endereços ficam VISÍVEIS, e não só dentro do botão de copiar.
              Uma área de transferência é invisível: sem o texto na tela, a
              pessoa não tem como saber se copiou dois endereços ou duzentos,
              nem conferir um que pareça digitado errado antes de colar. */}
          <p className="max-h-32 overflow-y-auto break-all rounded-xl bg-background px-3 py-2.5 font-mono text-[12px] leading-relaxed text-scriba-ink">
            {emailList}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={copyQueue}>
              {copied ? <Check className="size-3.5" aria-hidden /> : null}
              {copied ? "Copiado" : `Copiar ${queue.length} e-mails`}
            </Button>
            <Button
              size="sm"
              variant={confirmingAll ? "default" : "outline"}
              disabled={pending}
              onClick={() => {
                if (!confirmingAll) {
                  setConfirmingAll(true);
                  return;
                }
                setConfirmingAll(false);
                run(markAllTestersInvited);
              }}
            >
              <MailCheck className="size-3.5" aria-hidden />
              {confirmingAll
                ? `Confirmar: marcar os ${queue.length}`
                : "Marcar todos como convidados"}
            </Button>
            {confirmingAll ? (
              <Button size="sm" variant="ghost" onClick={() => setConfirmingAll(false)}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-[14px] font-semibold text-scriba-ink-strong">Todos os pré-cadastros</h2>
        {data.rows.length === 0 ? (
          <p className="rounded-xl bg-scriba-btn-muted px-3 py-3 text-[12.5px] font-light text-scriba-ink-soft">
            Ninguém se pré-cadastrou ainda. O formulário fica em /tester.
          </p>
        ) : (
          <div className="admin-table overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Pediu</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TesterRow key={row.id} row={row} pending={pending} onRun={run} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-[11.5px] font-light leading-relaxed text-scriba-ink-mute">
          {data.capped
            ? `Mostrando os ${pageSize} mais antigos de ${data.total}. Passou do teto da tela: a fila agora precisa de paginação.`
            : `${data.total} ${data.total === 1 ? "pré-cadastro" : "pré-cadastros"}, do mais antigo para o mais novo, que é a ordem em que eles devem ser atendidos.`}
        </p>
      </section>
    </div>
  );
}

function TesterRow({
  row,
  pending,
  onRun,
}: {
  row: TesterSignupRow;
  pending: boolean;
  onRun: (action: () => Promise<void>) => void;
}) {
  const invited = row.invitedAt !== null;
  const joined = row.giftedAt !== null;

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-scriba-ink-strong">
            {row.displayName?.trim() || "sem nome"}
          </span>
          <span className="break-all text-[11.5px] font-light text-scriba-ink-mute">
            {row.playEmail}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {/* O link do `wa.me` é o ponto de existir a coluna: o número está aqui
            para mandar o link do download, e copiá-lo à mão para o WhatsApp é
            o passo manual que sobra depois de o convite sair. */}
        <a
          href={`https://wa.me/${row.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-scriba-ink hover:underline"
        >
          <MessageCircle className="size-3.5 shrink-0" aria-hidden />
          {formatWhatsapp(row.whatsapp)}
        </a>
      </TableCell>
      <TableCell className="whitespace-nowrap text-[12.5px] font-light text-scriba-ink-soft">
        {DATE.format(new Date(row.createdAt))}
      </TableCell>
      <TableCell>
        {/* TRÊS estados, e o terceiro é o que diz se o programa funcionou:
            "entrou no app" só é verdade quando o presente foi emitido, o que
            acontece no primeiro login (ver a migração 0079). É a taxa de
            conversão da tela, linha por linha. */}
        {joined ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-scriba-mint-ink">
            <Check className="size-3.5" aria-hidden />
            Entrou no app
          </span>
        ) : invited ? (
          <span
            className="whitespace-nowrap text-[12px] text-scriba-ink-soft"
            title={`Convidado em ${DATE.format(new Date(row.invitedAt as string))}`}
          >
            Convidado
          </span>
        ) : (
          <span className="whitespace-nowrap text-[12px] font-medium text-scriba-ink-strong">
            Na fila
          </span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {joined ? null : invited ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            title="Desfaz a anotação, não o convite no console"
            onClick={() =>
              onRun(async () => {
                const fd = new FormData();
                fd.set("id", row.id);
                await undoTesterInvited(fd);
              })
            }
          >
            <Undo2 className="size-3.5" aria-hidden />
            Devolver à fila
          </Button>
        ) : (
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              title="Copiar o e-mail"
              onClick={() => {
                void navigator.clipboard.writeText(row.playEmail);
              }}
            >
              <ClipboardCopy className="size-3.5" aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                onRun(async () => {
                  const fd = new FormData();
                  fd.set("id", row.id);
                  await markTesterInvited(fd);
                })
              }
            >
              <MailCheck className="size-3.5" aria-hidden />
              Convidado
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-scriba-ink-mute">
        {label}
      </span>
      <span className="text-[20px] font-semibold tabular-nums tracking-tight text-scriba-ink-strong">
        {value}
      </span>
    </div>
  );
}
