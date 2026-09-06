"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide, Loader2 } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FeedEntry, FeedOrder } from "@/lib/db/feed-entries-types";
import { cn } from "@/lib/utils";
import { buildFooter, HighlightCard, ReminderCard, RereadCard } from "./FeedEntryCards";
import { StudyCtaCard, type StudyCtaSession } from "./StudyCtaCard";

const STUDY_CTA_EVERY = 10;

/**
 * Decide onde encaixar os cards de CTA "Gerar estudo" no meio da lista.
 * Retorna um mapa `indexDoCard → slotDoCta`, onde o CTA é inserido logo
 * depois do card daquele index.
 *
 * Regras:
 * - Uma janela a cada `STUDY_CTA_EVERY` cards; se o total for menor, ainda
 *   entra 1 CTA (desde que exista sessão sem estudo).
 * - Dentro da janela, prefere o meio (evita ser o primeiro/último da lista
 *   inteira quando possível).
 * - Nunca mais CTAs do que sessões sem estudo disponíveis (sem repetir).
 */
function computeStudyCtaSlots(itemCount: number, ctaSessionCount: number): Map<number, number> {
  const slots = new Map<number, number>();
  if (itemCount === 0 || ctaSessionCount === 0) return slots;
  const windowCount = Math.max(1, Math.ceil(itemCount / STUDY_CTA_EVERY));
  const totalCtas = Math.min(ctaSessionCount, windowCount);
  for (let w = 0; w < totalCtas; w++) {
    const start = w * STUDY_CTA_EVERY;
    if (start >= itemCount) break;
    const end = Math.min(start + STUDY_CTA_EVERY, itemCount);
    const size = end - start;
    let idx = start + Math.floor((size - 1) / 2);
    // Evita cair como último card geral quando existe alternativa.
    if (idx === itemCount - 1 && itemCount > 1) idx = itemCount - 2;
    slots.set(idx, w);
  }
  return slots;
}

/**
 * Feed paginado (releia / lembra / frase marcante) do /feed. Consome GET /api/feed:
 * SSR entrega a primeira página, o "Ver mais" pede as próximas 10, e o
 * seletor "Ordenar por" refaz do zero em outra ordem.
 *
 * Quando `hasMore=false`, exibimos um sticker + copy sutil convidando o
 * usuário a gravar de novo — não empurra CTA, só sinaliza fim de fila.
 */

const PAGE_SIZE = 10;

type PaginatedFeedProps = {
  initialItems: FeedEntry[];
  initialHasMore: boolean;
  initialOrder: FeedOrder;
  excludeSessionId?: string | null;
  /**
   * Sessões sem estudo (aprofundamento) do usuário. Uma delas é intercalada
   * a cada `STUDY_CTA_EVERY` cards carregados; se acabar a lista, não repete.
   */
  studyCtaSessions?: StudyCtaSession[];
  /** Ver `lib/entitlements/server.ts`. Repassado ao CTA de estudo. */
  canGenerateStudy?: boolean;
};

type FetchState = "idle" | "loading" | "error";

const SORT_LABELS: Record<FeedOrder, string> = {
  recent: "Mais recente",
  oldest: "Mais antigo",
};

export function PaginatedFeed({
  initialItems,
  initialHasMore,
  initialOrder,
  excludeSessionId = null,
  studyCtaSessions = [],
  canGenerateStudy = false,
}: PaginatedFeedProps) {
  const [items, setItems] = useState<FeedEntry[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [order, setOrder] = useState<FeedOrder>(initialOrder);
  const [state, setState] = useState<FetchState>("idle");

  const fetchPage = useCallback(
    async (nextOrder: FeedOrder, offset: number, replace: boolean) => {
      setState("loading");
      try {
        const params = new URLSearchParams({
          order: nextOrder,
          offset: String(offset),
          limit: String(PAGE_SIZE),
        });
        if (excludeSessionId) params.set("excludeSessionId", excludeSessionId);
        const res = await fetch(`/api/feed?${params.toString()}`, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as {
          items: FeedEntry[];
          hasMore: boolean;
          total: number;
        };
        setItems((prev) => (replace ? body.items : [...prev, ...body.items]));
        setHasMore(body.hasMore);
        setState("idle");
      } catch {
        setState("error");
      }
    },
    [excludeSessionId]
  );

  useEffect(() => {
    if (order === initialOrder) return;
    void fetchPage(order, 0, true);
  }, [order, initialOrder, fetchPage]);

  const onLoadMore = () => {
    void fetchPage(order, items.length, false);
  };

  return (
    <div className="flex flex-col gap-5">
      <SortSelector order={order} onChange={setOrder} disabled={state === "loading"} />

      {items.length === 0 ? (
        <EmptyFeedNotice />
      ) : (
        <ol className="flex flex-col gap-5">
          {(() => {
            const ctaSlots = computeStudyCtaSlots(items.length, studyCtaSessions.length);
            return items.map((entry, index) => {
              const footer = buildFooter(entry.session);
              const ctaSlot = ctaSlots.get(index);
              const ctaSession = ctaSlot !== undefined ? studyCtaSessions[ctaSlot] : null;
              return (
                <Fragment key={entry.key}>
                  <li>
                    {entry.kind === "reread" ? (
                      <RereadCard item={entry.item as never} footer={footer} />
                    ) : entry.kind === "reminder" ? (
                      <ReminderCard item={entry.item as never} footer={footer} />
                    ) : (
                      <HighlightCard item={entry.item as never} footer={footer} />
                    )}
                  </li>
                  {ctaSession ? (
                    <li>
                      <StudyCtaCard session={ctaSession} canGenerate={canGenerateStudy} />
                    </li>
                  ) : null}
                </Fragment>
              );
            });
          })()}
        </ol>
      )}

      <FeedTail
        state={state}
        hasMore={hasMore}
        hasAnyItems={items.length > 0}
        onLoadMore={onLoadMore}
        onRetry={() => void fetchPage(order, items.length, false)}
      />
    </div>
  );
}

function SortSelector({
  order,
  onChange,
  disabled,
}: {
  order: FeedOrder;
  onChange: (o: FeedOrder) => void;
  disabled: boolean;
}) {
  const Icon = order === "recent" ? ArrowDownWideNarrow : ArrowUpNarrowWide;
  return (
    <div className="flex items-center justify-end gap-2 text-[11px] text-scriba-ink-mute">
      {/* O rótulo visível É o nome acessível do seletor: `role="combobox"` não
          tira nome do conteúdo, então sem o `aria-labelledby` o leitor de tela
          anuncia um combobox anônimo (axe: `button-name`). Apontar para o
          <span> em vez de repetir a string num aria-label mantém as duas em
          sincronia. */}
      <span id="feed-order-label" className="font-medium">
        Ordenar por
      </span>
      <Select value={order} onValueChange={(v) => onChange(v as FeedOrder)} disabled={disabled}>
        <SelectTrigger
          aria-labelledby="feed-order-label"
          size="sm"
          className={cn(
            "gap-1.5 rounded-full border-scriba-hairline-soft bg-scriba-paper pl-3 pr-2 text-[11px] font-semibold text-scriba-ink shadow-[0_1px_3px_rgba(79,168,240,0.05)] hover:border-scriba-blue-soft",
            disabled && "opacity-60"
          )}
        >
          <Icon className="size-3.5 text-scriba-ink-mute" strokeWidth={2} aria-hidden />
          <SelectValue>{(v) => SORT_LABELS[(v as FeedOrder) ?? "recent"]}</SelectValue>
        </SelectTrigger>
        <SelectContent className="min-w-[160px]">
          <SelectItem value="recent">{SORT_LABELS.recent}</SelectItem>
          <SelectItem value="oldest">{SORT_LABELS.oldest}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function FeedTail({
  state,
  hasMore,
  hasAnyItems,
  onLoadMore,
  onRetry,
}: {
  state: FetchState;
  hasMore: boolean;
  hasAnyItems: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
}) {
  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <p className="text-[12px] font-light text-scriba-ink-mute">
          Não consegui carregar mais itens.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-scriba-blue-soft/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-scriba-blue-ink transition-colors hover:bg-scriba-blue-soft"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (hasMore) {
    return (
      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={onLoadMore}
          disabled={state === "loading"}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-scriba-hairline-soft bg-scriba-paper px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-soft transition-colors hover:border-scriba-blue-soft hover:text-scriba-blue-ink",
            state === "loading" && "opacity-60"
          )}
        >
          {state === "loading" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Carregando
            </>
          ) : (
            "Ver mais"
          )}
        </button>
      </div>
    );
  }

  if (hasAnyItems) {
    return <EndOfFeedSticker />;
  }

  return null;
}

const END_MESSAGES = [
  "Você chegou até aqui. Que tal ouvir algo novo?",
  "Sem mais releituras por enquanto, grave um próximo sermão.",
  "Fim da fila. Volte quando o próximo culto terminar.",
];

function endMessage(): string {
  const idx = new Date().getDate() % END_MESSAGES.length;
  return END_MESSAGES[idx];
}

/**
 * O `mt-24` afasta o sticker do último card, para ele não ficar colado no
 * conteúdo. Ele NÃO iguala a folga que reserva o espaço da barra inferior
 * (`[&>*]:pb-36 sm:[&>*]:pb-0` em `app/(app)/layout.tsx`): espelhar os 144px
 * foi testado e ficou longe demais. Simetria exata aqui não é o objetivo — a
 * folga de baixo existe para a barra não cobrir o conteúdo, e essa serve só
 * para separar.
 *
 * O `sm:mt-0` acompanha o `sm:pb-0` do guard: no desktop a barra não existe, a
 * folga de baixo some, e sem o reset sobraria um buraco no fim da lista.
 */
function EndOfFeedSticker() {
  return (
    <div className="mt-24 flex flex-col items-center gap-2 py-2 text-center sm:mt-0">
      {/** biome-ignore lint/performance/noImgElement: local sticker asset */}
      <img
        src="/stickers/woman/013-woman.svg"
        alt=""
        aria-hidden
        width={80}
        height={80}
        className="h-auto w-[68px] opacity-90"
      />
      <p className="max-w-[260px] text-pretty text-[12px] font-light leading-relaxed text-scriba-ink-mute">
        {endMessage()}
      </p>
    </div>
  );
}

function EmptyFeedNotice() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-scriba-hairline-soft bg-scriba-paper/60 px-5 py-8 text-center">
      {/** biome-ignore lint/performance/noImgElement: local sticker asset */}
      <img
        src="/stickers/men/007-man.svg"
        alt=""
        aria-hidden
        width={96}
        height={96}
        className="h-auto w-[84px] opacity-90"
      />
      <p className="max-w-[280px] text-pretty text-[12.5px] font-light leading-relaxed text-scriba-ink-mute">
        Nada agendado para hoje. Assim que houver uma nova gravação (ou um card antigo amadurecer),
        ele aparece aqui.
      </p>
    </div>
  );
}
