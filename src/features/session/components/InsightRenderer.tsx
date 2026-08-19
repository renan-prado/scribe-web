"use client";

import { BookOpen, Sparkles } from "lucide-react";
import { useState } from "react";
import { VerseDialog } from "@/features/session/components/VerseDialog";
import type { Insight } from "@/lib/domain/insights";
import { cn } from "@/lib/utils";

export function InsightRenderer({ insight }: { insight: Insight }) {
  const [openRef, setOpenRef] = useState<string | null>(null);

  if (insight.type === "bibleReference") {
    return (
      <>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 pr-0.5 italic">
            <BookOpen className="size-3" />
            Leia também:
          </span>
          {insight.references.map((ref) => (
            <button
              key={ref}
              type="button"
              onClick={() => setOpenRef(ref)}
              className={cn(
                "inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 font-medium text-foreground/80 transition-colors outline-none",
                "hover:border-foreground/60 hover:bg-muted hover:text-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring/40"
              )}
            >
              {ref}
            </button>
          ))}
        </div>
        <VerseDialog reference={openRef} onOpenChange={(open) => !open && setOpenRef(null)} />
      </>
    );
  }
  return (
    <aside
      className="relative flex flex-col gap-5 rounded-3xl rounded-tl-none border-2 border-dashed border-border/80 p-7 animate-insight-gradient"
      style={{
        backgroundImage: "linear-gradient(135deg, #FBFCFE 0%, #F4F6FC 97%)",
        backgroundSize: "200% 200%",
      }}
    >
      <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
        <Sparkles className="size-3" />
        <span>{insight.label}</span>
      </div>
      <p className="text-pretty text-xs leading-relaxed text-foreground/85">{insight.text}</p>
      {insight.source ? (
        <p className="text-[0.7rem] italic text-muted-foreground">— {insight.source}</p>
      ) : null}
    </aside>
  );
}
