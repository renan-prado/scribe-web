import { cn } from "@/lib/utils";

type BookGlyphProps = { className?: string };

export function BookGlyph({ className }: BookGlyphProps) {
  return (
    <span
      className={cn("block rounded-[3px_5px_5px_3px] border-[1.5px] border-current", className)}
    />
  );
}
