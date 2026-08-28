import type { LucideIcon } from "lucide-react";
import { BookOpenText, Quote, Sparkles } from "lucide-react";
import type { HighlightsPayload } from "@/lib/domain/highlights";
import type { RemindersPayload } from "@/lib/domain/reminders";
import type { RereadsPayload } from "@/lib/domain/rereads";

/**
 * Card único que anuncia tudo o que foi separado para aparecer no feed do
 * usuário nos próximos dias/meses depois do sermão. Substitui os teasers
 * antes espalhados em `ReleiaEsteTexto variant="summary"` +
 * `LembraDisso variant="summary"` e adiciona a linha de "frases em destaque"
 * — nenhum destes itens é para hoje, então não faz sentido cada um ter seu
 * card separado.
 *
 * Cada linha só renderiza se o payload correspondente existir e tiver itens;
 * o componente inteiro esconde se não houver nada agendado.
 */
type FeedAgendadoPreviewProps = {
  rereads: RereadsPayload | null;
  reminders: RemindersPayload | null;
  highlights: HighlightsPayload | null;
};

type Row = {
  Icon: LucideIcon;
  title: string;
  description: string;
};

export function FeedAgendadoPreview({ rereads, reminders, highlights }: FeedAgendadoPreviewProps) {
  const rows: Row[] = [];

  const rereadsCount = rereads?.items.length ?? 0;
  if (rereadsCount > 0) {
    rows.push({
      Icon: BookOpenText,
      title: `${rereadsCount} ${rereadsCount === 1 ? "versículo foi separado" : "versículos foram separados"}.`,
      description:
        "Nos próximos dias, versículos deste sermão aparecerão no seu feed para serem revisitados.",
    });
  }

  const remindersCount = reminders?.items.length ?? 0;
  if (remindersCount > 0) {
    rows.push({
      Icon: Sparkles,
      title: `${remindersCount} ${remindersCount === 1 ? "referência foi separada" : "referências foram separadas"}.`,
      description:
        "Ao longo dos próximos meses, pequenas referências vão aparecer no seu feed para você lembrar.",
    });
  }

  const highlightsCount = highlights?.items.length ?? 0;
  if (highlightsCount > 0) {
    rows.push({
      Icon: Quote,
      title: `${highlightsCount} ${highlightsCount === 1 ? "frase em destaque foi separada" : "frases em destaque foram separadas"}.`,
      description:
        "Frases marcantes ditas na pregação vão reaparecer no seu feed espaçadas ao longo do ano.",
    });
  }

  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed border-scriba-hairline-soft bg-scriba-blue-soft/15 px-3 py-2.5">
      {rows.map((row, i) => (
        <div
          key={row.title}
          className={
            i > 0
              ? "flex items-start gap-2 border-t border-scriba-hairline-soft/50 pt-2"
              : "flex items-start gap-2"
          }
        >
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-scriba-blue-soft/70 text-scriba-blue">
            <row.Icon className="size-2.5" strokeWidth={2} />
          </span>
          <div className="flex flex-col gap-0 leading-snug">
            <p className="text-[11px] font-medium text-scriba-ink-soft">{row.title}</p>
            <p className="text-[10.5px] font-light text-scriba-ink-mute/90">{row.description}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
