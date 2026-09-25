import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { ContentTabs } from "@/features/admin/components/SectionTabs";
import { SessionModeBadge } from "@/features/admin/components/SessionModeBadge";
import { SessionReaderFilters } from "@/features/admin/components/SessionReaderFilters";
import {
  ADMIN_SESSIONS_PAGE_SIZE,
  listSessionsForAdmin,
} from "@/features/admin/server/db/sessions";
import { getUserFilterOption } from "@/features/admin/server/db/user-search";
import { SESSION_MODES, type SessionMode } from "@/lib/domain/session";

export const metadata: Metadata = { title: "Sessões" };
export const dynamic = "force-dynamic";

/**
 * A lista de tudo o que os usuários gravaram, para abrir e LER.
 *
 * As outras telas do painel contam sessões, somam custo e mostram a nota que
 * as pessoas deram. Nenhuma delas mostra o texto, e sem o texto não dá para
 * responder por que a nota foi aquela. Esta é a porta de entrada da leitura;
 * quem faz a leitura é `/admin/sessions/[id]`.
 *
 * A coluna de conteúdo é deliberadamente sim/não e não uma prévia: um trecho
 * de resumo numa célula de tabela convida a julgar qualidade por uma frase
 * cortada, que é exatamente o julgamento que a tela de leitura existe para
 * substituir. Eram DUAS colunas enquanto o estudo existia.
 */

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "-";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function parseModeFilter(value: string | undefined): SessionMode | undefined {
  return (SESSION_MODES as readonly string[]).includes(value ?? "")
    ? (value as SessionMode)
    : undefined;
}

type PageProps = {
  searchParams: Promise<{ userId?: string; mode?: string; q?: string }>;
};

export default async function AdminSessionsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const mode = parseModeFilter(sp.mode);

  const [sessions, selectedUser] = await Promise.all([
    listSessionsForAdmin({
      userId: sp.userId?.trim() || undefined,
      mode,
      search: sp.q?.trim() || undefined,
    }),
    // Uma linha, e só quando há filtro: a barra procura no banco a cada tecla
    // em vez de receber a base inteira para um `<select>`.
    sp.userId ? getUserFilterOption(sp.userId).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Sessões"
        subtitle="O que os usuários receberam de fato: resumo e transcrição, para ler e julgar."
      />

      <ContentTabs active="sessoes" />

      <SessionReaderFilters
        selectedUser={selectedUser}
        current={{ mode: sp.mode ?? "", q: sp.q ?? "" }}
      />

      <div className="admin-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sessão</TableHead>
              <TableHead>Dono</TableHead>
              <TableHead>Modo</TableHead>
              <TableHead className="text-right">Duração</TableHead>
              <TableHead>Conteúdo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Nenhuma sessão com esse recorte.
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/admin/sessions/${s.id}`}
                      className="flex min-w-0 flex-col text-scriba-ink transition-colors hover:text-scriba-blue-ink"
                    >
                      <span className="truncate font-medium">
                        {s.title?.trim() || "Sessão sem título"}
                      </span>
                      <span className="text-[0.7rem] font-light text-scriba-ink-mute">
                        {DATE_FMT.format(new Date(s.createdAt))}
                        {s.speakerName?.trim() ? ` · ${s.speakerName}` : ""}
                        {/* Uma sessão sem `ended_at` está em andamento, ou
                            morreu no meio. Nos dois casos o que houver dentro
                            é parcial, e a tela precisa avisar antes de alguém
                            concluir que o resumo saiu curto. */}
                        {s.endedAt ? "" : " · em andamento"}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <span className="block max-w-[16rem] truncate" title={s.ownerEmail ?? ""}>
                      {s.ownerName?.trim() ||
                        s.ownerEmail ||
                        (s.userId ? s.userId.slice(0, 8) : "-")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <SessionModeBadge mode={s.mode} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatDuration(s.durationMs)}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-scriba-ink-mute">
                      {s.hasSummary ? (
                        <span className="inline-flex items-center gap-1 text-scriba-ink-soft">
                          <FileText aria-hidden className="size-3" />
                          resumo
                        </span>
                      ) : null}
                      {s.hasSummary ? null : "só transcrição"}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* O teto é dito em voz alta. Sem isto, o dia em que a base passar de
          cem sessões é o dia em que a lista para de crescer sem nada na tela
          explicando por quê. */}
      <p className="text-[11px] font-light text-scriba-ink-mute">
        {sessions.length >= ADMIN_SESSIONS_PAGE_SIZE
          ? `Mostrando as ${ADMIN_SESSIONS_PAGE_SIZE} mais recentes deste recorte. Filtre por pessoa ou título para ver o resto.`
          : `${sessions.length} sessão(ões) neste recorte.`}
      </p>
    </div>
  );
}
