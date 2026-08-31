"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/shared/hooks/use-theme";

type ThemeToggleProps = {
  className?: string;
};

/**
 * Light/dark switch — a pill track with both glyphs printed on it and a raised
 * thumb that slides over the active one.
 *
 * Everything downstream reacts to the `.dark` class this writes onto <html>;
 * see `useTheme` and `ThemeScript`.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { isDark, toggleTheme, mounted } = useTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      onClick={toggleTheme}
      className={cn(
        "group relative inline-flex h-9 w-[68px] flex-none items-center rounded-full p-1",
        "border border-scriba-hairline bg-scriba-surface",
        "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-scriba-blue/40",
        "hover:border-scriba-blue-soft",
        className
      )}
    >
      {/* Static glyphs printed on the track */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 flex w-1/2 items-center justify-center text-scriba-ink-mute"
      >
        <Sun className="size-3.5" strokeWidth={2} />
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 flex w-1/2 items-center justify-center text-scriba-ink-mute"
      >
        <Moon className="size-3.5" strokeWidth={2} />
      </span>

      {/* Sliding thumb, carrying the active glyph */}
      <span
        aria-hidden
        className={cn(
          "relative flex size-7 items-center justify-center rounded-full",
          "bg-scriba-paper shadow-[0_2px_8px_rgba(51,65,79,0.18)] ring-1 ring-scriba-hairline",
          mounted && "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isDark
            ? "translate-x-[32px] text-scriba-yellow shadow-[0_2px_10px_rgba(95,176,245,0.28)]"
            : "translate-x-0 text-scriba-blue"
        )}
      >
        {isDark ? (
          <Moon className="size-3.5" strokeWidth={2.2} />
        ) : (
          <Sun className="size-3.5" strokeWidth={2.2} />
        )}
      </span>
    </button>
  );
}

/**
 * Labelled variant for settings-style surfaces (e.g. /profile), where the
 * switch needs a name and a hint next to it.
 */
export function ThemeToggleRow({ className }: ThemeToggleProps) {
  const { isDark } = useTheme();
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="flex size-9 flex-none items-center justify-center rounded-full bg-scriba-blue-soft text-scriba-blue">
        {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-medium uppercase tracking-wider text-scriba-ink-mute">
          Aparência
        </span>
        <span className="truncate text-sm font-medium text-scriba-ink-strong">
          {isDark ? "Tema escuro" : "Tema claro"}
        </span>
      </div>
      <ThemeToggle />
    </div>
  );
}
