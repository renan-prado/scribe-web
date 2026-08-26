"use client";

import { useState } from "react";
import { PassageVerses } from "@/features/session/components/PassageVerses";
import { PenaAvatar } from "@/features/session/components/PenaAvatar";
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

function ScribaMarker({
  onClick,
  open,
  unread,
  count,
}: {
  onClick: () => void;
  open: boolean;
  unread: boolean;
  count: number;
}) {
  const label = open
    ? "Fechar comentário do Scriba"
    : `Abrir comentário do Scriba${count > 1 ? ` (${count})` : ""}`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-full border border-scriba-hairline bg-white text-scriba-ink-soft transition-colors",
        "hover:bg-scriba-bubble hover:text-scriba-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        open && "bg-scriba-bubble text-scriba-ink"
      )}
    >
      <ChatIcon className="size-4" />
      {unread ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-[#7C5CE0] ring-2 ring-white"
        />
      ) : null}
    </button>
  );
}

function InvertedScribaBubble({ block }: { block: CommentBlock }) {
  return (
    <div className="animate-content-fade flex flex-col items-end">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-xs font-semibold text-scriba-ink-soft">Scriba</span>
        <PenaAvatar />
      </div>
      <div className="-mt-2 mr-[42px] flex max-w-[92%] flex-col gap-3.5 rounded-3xl rounded-tr-none bg-scriba-bubble px-5 py-4 text-scriba-bubble-ink">
        {block.type === "contextCard" ? (
          <ContextBody block={block} />
        ) : (
          <RelatedVerseBody block={block} />
        )}
      </div>
    </div>
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

/**
 * Wraps a primary summary block that has one or more attached Scriba comments.
 * Renders the primary content on the left with a marker button on the right;
 * clicking the marker toggles inverted (avatar-right) bubbles below the block.
 * First open marks the marker as "read" and hides the purple unread dot.
 */
export function ScribaCommentGroup({
  children,
  comments,
}: {
  children: React.ReactNode;
  comments: CommentBlock[];
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);

  const handleToggle = () => {
    setOpen((v) => !v);
    if (!seen) setSeen(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">{children}</div>
        <ScribaMarker onClick={handleToggle} open={open} unread={!seen} count={comments.length} />
      </div>
      {open ? (
        <div className="flex flex-col gap-4">
          {comments.map((c) => (
            <InvertedScribaBubble key={`${c.type}-${commentKey(c)}`} block={c} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
