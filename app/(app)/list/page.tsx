import { CircleDot, Mic, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { NavLink } from "@/components/NavLink";
import { RefreshSessionsButton } from "@/features/session/components/RefreshSessionsButton";
import { SessionsEmptyState } from "@/features/session/components/SessionsEmptyState";
import { shortDate } from "@/features/session/lib/formatting";
import { listDeepenedSessionIds } from "@/lib/db/deepenings";
import {
  deleteSession,
  listSessionIdsWithSummary,
  listSessions,
  listUnfinishedSessions,
} from "@/lib/db/sessions";
import { recordingRouteFor } from "@/lib/domain/session";
import { cn } from "@/lib/utils";
import { SessionsBrowser } from "./SessionsBrowser";

export const metadata: Metadata = { title: "Suas gravações" };

/**
 * Server Action é um endpoint POST próprio: esta função é chamável por quem
 * souber o id dela, sem passar por esta página. A autorização aqui é o RLS —
 * `deleteSession` usa o client do USUÁRIO, e a policy de `sessions` escopa o
 * delete ao dono, então um id forjado só apaga o que já era de quem chamou.
 *
 * Ou seja: trocar `deleteSession` por qualquer coisa que use
 * `createAdminClient()` transforma isto num IDOR — service-role ignora RLS, e
 * a proteção some sem nenhum sinal no diff. Se isso for preciso um dia, o
 * gate de dono tem de vir junto, explícito.
 */
async function deleteSessionAction(formData: FormData): Promise<void> {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  await deleteSession(id);
  revalidatePath("/list");
}

export default async function LibraryPage() {
  const sessionsResult = await listSessions()
    .then((s) => ({ ok: true as const, sessions: s }))
    .catch((err: Error) => ({ ok: false as const, message: err.message }));

  const sessions = sessionsResult.ok ? sessionsResult.sessions : [];
  const loadError = sessionsResult.ok ? null : sessionsResult.message;
  // Gravações que nunca foram encerradas — fechou o navegador, acabou a
  // bateria, ou o crédito congelou a captura e a pessoa saiu da página. Ficam
  // numa faixa própria no topo para não sumirem de vista.
  const unfinished = await listUnfinishedSessions().catch(() => []);

  // Duas consultas de CHAVE sobre os mesmos ids, no molde de
  // `listDeepenedSessionIds`: quais sessões já têm estudo e quais já têm
  // resumo. A segunda existe porque uma sessão do modo transcrição pode ter
  // ganhado um resumo depois (ver /api/final-summary/from-transcript), e o
  // cartão precisa apontar para a página certa sem trazer `final_summary` — uma
  // das três colunas pesadas — para dentro da lista.
  //
  // O agrupamento por período saiu daqui: quem filtra é o `SessionsBrowser`, e
  // agrupar antes do filtro deixaria seções vazias na tela.
  const sessionIds = sessions.map((s) => s.id);
  const [deepenedIds, summarizedIds] = await Promise.all([
    listDeepenedSessionIds(sessionIds).catch(() => new Set<string>()),
    listSessionIdsWithSummary(sessionIds).catch(() => new Set<string>()),
  ]);
  const now = new Date();

  const isEmpty = sessions.length === 0 && unfinished.length === 0 && !loadError;

  return (
    <div className="flex flex-1 flex-col bg-scriba-surface">
      <main
        className={cn(
          "mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8",
          isEmpty && "justify-center py-0 sm:py-0"
        )}
      >
        {isEmpty ? null : (
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-3xl">
                Suas gravações
              </h1>
              <p className="text-sm font-light text-scriba-ink-soft">
                Tudo o que você ouviu e registrou com o Scriba.
              </p>
            </div>
            {sessions.length > 0 ? <RefreshSessionsButton /> : null}
          </div>
        )}

        {unfinished.length > 0 ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3 px-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-scriba-cream-accent">
                <CircleDot className="size-3.5" />
                Gravações em aberto
              </span>
              <span className="h-px flex-1 bg-scriba-hairline" />
              <span className="text-[11px] font-light text-scriba-ink-mute">
                {unfinished.length}
              </span>
            </div>
            <p className="px-1 text-[12px] font-light leading-relaxed text-scriba-ink-soft">
              Estas gravações nunca foram encerradas. Você pode voltar para elas e continuar, ou
              apagá-las. Trechos de áudio que ficaram pendentes no aparelho são reenviados ao abrir
              a sessão (até 24h depois).
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {unfinished.map((s) => {
                const includeYear = new Date(s.createdAt).getFullYear() !== now.getFullYear();
                return (
                  <li
                    key={s.id}
                    className="flex flex-col gap-3 rounded-3xl border border-scriba-cream-accent/35 bg-scriba-cream p-5 sm:p-6"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-scriba-cream-accent/25 text-scriba-cream-ink">
                        <Mic className="size-4" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-semibold leading-tight text-scriba-cream-ink">
                          {s.title?.trim() || "Gravação sem título"}
                        </span>
                        <span className="text-[11px] font-light text-scriba-cream-body">
                          Iniciada em {shortDate(s.createdAt, includeYear)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center gap-2">
                      <NavLink
                        href={`/recording/${s.id}/${recordingRouteFor(s.mode)}`}
                        spinner="overlay"
                        className="inline-flex flex-1 items-center justify-center rounded-full scriba-cta bg-[image:var(--scriba-cta)] px-4 py-2 text-[11px] font-semibold text-scriba-cta-ink transition-colors"
                      >
                        Continuar gravação →
                      </NavLink>
                      <form action={deleteSessionAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <button
                          type="submit"
                          aria-label="Apagar gravação em aberto"
                          className="inline-flex size-8 items-center justify-center rounded-full text-scriba-cream-body outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/30"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {loadError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Não consegui carregar as gravações: {loadError}
          </div>
        ) : sessions.length === 0 && unfinished.length === 0 ? (
          <SessionsEmptyState
            sticker="/stickers/woman/018-woman.svg"
            heading="Sem gravações, ainda..."
          />
        ) : sessions.length === 0 ? null : (
          <SessionsBrowser
            sessions={sessions}
            deepenedIds={[...deepenedIds]}
            summarizedIds={[...summarizedIds]}
            nowIso={now.toISOString()}
            deleteAction={deleteSessionAction}
          />
        )}
      </main>
    </div>
  );
}
