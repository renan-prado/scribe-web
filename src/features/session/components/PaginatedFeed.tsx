"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FeedEntry, FeedOrder } from "@/lib/db/feed-entries-types";
import { cn } from "@/lib/utils";
import { buildFooter, PracticeCard, ReminderCard, RereadCard } from "./FeedEntryCards";

/**
 * Feed paginado (praticar/releia/lembra) do /feed. Consome GET /api/feed:
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
}: PaginatedFeedProps) {
  const [items, setItems] = useState<FeedEntry[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [order, setOrder] = useState<FeedOrder>(initialOrder);
  const [state, setState] = useState<FetchState>("idle");
  // now is captured on mount so relative labels stay stable across "Ver mais"
  const [now] = useState(() => new Date());

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
    <div className="flex flex-col gap-4">
      <SortSelector order={order} onChange={setOrder} disabled={state === "loading"} />

      {items.length === 0 ? (
        <EmptyFeedNotice />
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((entry) => {
            const footer = buildFooter(entry.session, now);
            return (
              <li key={entry.key}>
                {entry.kind === "practice" ? (
                  <PracticeCard item={entry.item as never} footer={footer} />
                ) : entry.kind === "reread" ? (
                  <RereadCard item={entry.item as never} footer={footer} />
                ) : (
                  <ReminderCard item={entry.item as never} footer={footer} />
                )}
              </li>
            );
          })}
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
      <span className="font-medium">Ordenar por</span>
      <Select value={order} onValueChange={(v) => onChange(v as FeedOrder)} disabled={disabled}>
        <SelectTrigger
          size="sm"
          className={cn(
            "gap-1.5 rounded-full border-scriba-hairline-soft bg-white pl-3 pr-2 text-[11px] font-semibold text-scriba-ink shadow-[0_1px_3px_rgba(79,168,240,0.05)] hover:border-scriba-blue-soft",
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
          className="rounded-full bg-scriba-blue-soft/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-scriba-blue transition-colors hover:bg-scriba-blue-soft"
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
            "inline-flex items-center gap-2 rounded-full border border-scriba-hairline-soft bg-white px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-soft transition-colors hover:border-scriba-blue-soft hover:text-scriba-blue",
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

function EndOfFeedSticker() {
  return (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
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
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-scriba-hairline-soft bg-white/60 px-5 py-8 text-center">
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
