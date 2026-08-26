"use client";

import { Popover } from "@base-ui/react/popover";
import { useState } from "react";
import { PassageVerses } from "@/features/session/components/PassageVerses";
import { useReadFlag } from "@/hooks/use-read-flag";
import { parseVerseReference } from "@/lib/domain/feed";
import type { SummaryBlock } from "@/lib/domain/summary";
import { cn } from "@/lib/utils";

export type CommentBlock = Extract<SummaryBlock, { type: "contextCard" | "relatedVerse" }>;

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ContextBody({ block }: { block: Extract<CommentBlock, { type: "contextCard" }> }) {
  return (
    <>
      <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink">{block.text}</p>
      {block.source ? (
        <p className="text-[11px] font-light italic text-scriba-ink-soft">— {block.source}</p>
      ) : null}
    </>
  );
}

function RelatedVerseBody({ block }: { block: Extract<CommentBlock, { type: "relatedVerse" }> }) {
  const parsed = parseVerseReference(block.reference);
  const hasRange = parsed && parsed.startVerse != null && parsed.endVerse != null;
  return (
    <>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-soft">
        Leia também · {block.reference}
      </span>
      {hasRange ? (
        <div className="text-[15px] font-light leading-relaxed text-session-verse-text">
          <PassageVerses
            bookDisplay={parsed.bookDisplay}
            chapter={parsed.chapter}
            startVerse={parsed.startVerse as number}
            endVerse={parsed.endVerse as number}
          />
        </div>
      ) : block.text ? (
        <blockquote className="border-l-[3px] border-session-verse-border pl-3.5 text-[15px] font-light italic leading-relaxed text-session-verse-text">
          {block.text}
        </blockquote>
      ) : null}
      {block.reason ? (
        <p className="text-xs font-normal leading-relaxed text-scriba-ink-soft">{block.reason}</p>
      ) : null}
    </>
  );
}

function commentKey(block: CommentBlock): string {
  if (block.type === "contextCard") return `${block.label}-${block.text.slice(0, 24)}`;
  return `${block.reference}-${block.reason.slice(0, 24)}`;
}

function ScribaCommentsStack({ comments }: { comments: CommentBlock[] }) {
  return (
    <div className="flex flex-col gap-5 divide-y divide-scriba-hairline">
      {comments.map((c, i) => (
        <div key={commentKey(c)} className={cn("flex flex-col gap-3", i > 0 && "pt-5")}>
          {c.type === "contextCard" ? <ContextBody block={c} /> : <RelatedVerseBody block={c} />}
        </div>
      ))}
    </div>
  );
}

/**
 * Wraps a primary summary block that has one or more attached Scriba comments.
 * Renders the primary content on the left with a marker button on the right;
 * clicking the marker opens a popover anchored to the button. First open marks
 * the marker as "read" and hides the purple unread dot.
 */
export function ScribaCommentGroup({
  children,
  comments,
}: {
  children: React.ReactNode;
  comments: CommentBlock[];
}) {
  const [open, setOpen] = useState(false);
  const [read, markSeen] = useReadFlag(comments.map(commentKey).join("|"));
  const showUnread = read === false && !open;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) markSeen();
  };

  const triggerLabel = open
    ? "Fechar comentário do Scriba"
    : `Abrir comentário do Scriba${comments.length > 1 ? ` (${comments.length})` : ""}`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <div className="min-w-0 flex-1">{children}</div>
      <Popover.Root open={open} onOpenChange={handleOpenChange} modal>
        <Popover.Trigger
          aria-label={triggerLabel}
          className={cn(
            "relative flex size-9 shrink-0 items-center justify-center rounded-full border border-scriba-hairline bg-scriba-bubble text-scriba-ink-soft transition-colors",
            "self-end sm:self-auto",
            "hover:bg-scriba-blue-soft hover:text-scriba-ink",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            "data-[popup-open]:z-50 data-[popup-open]:bg-scriba-blue-soft data-[popup-open]:text-scriba-ink"
          )}
        >
          {open ? <CloseIcon className="size-4" /> : <ChatIcon className="size-4" />}
          {showUnread ? (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-[#7C5CE0] ring-2 ring-white"
            />
          ) : null}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Backdrop
            className={cn(
              "fixed inset-0 z-40 bg-black/20 supports-[backdrop-filter]:backdrop-blur-[2px]",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
              "transition-opacity duration-150"
            )}
          />
          <Popover.Positioner side="left" align="start" sideOffset={12} className="z-50">
            <Popover.Popup
              className={cn(
                "w-[min(24rem,calc(100vw-2rem))] rounded-3xl bg-scriba-bubble p-6 shadow-[0_12px_36px_rgba(30,45,70,0.12)] outline-none",
                "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
                "origin-[var(--transform-origin)] transition-[opacity,transform] duration-150"
              )}
            >
              <ScribaCommentsStack comments={comments} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
