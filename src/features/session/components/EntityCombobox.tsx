"use client";

import { useEffect, useRef, useState } from "react";
import type { EntitySuggestion } from "@/features/session/lib/api";
import { cn } from "@/lib/utils";

/**
 * Autocomplete input backed by a per-user search endpoint. Fetches suggestions
 * on mount and on every keystroke (debounced), sorted by how often the user
 * has recorded with each entity. Free-text is always allowed — hitting Enter
 * or blurring commits whatever is in the input.
 *
 * The dropdown is a plain absolute-positioned list (not a Portal) so it lives
 * inside the parent Dialog and inherits its overlay stacking without extra
 * portal wiring.
 */
type EntityComboboxProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  fetchSuggestions: (q: string) => Promise<EntitySuggestion[]>;
  onEnter?: () => void;
};

export function EntityCombobox({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  autoFocus = false,
  fetchSuggestions,
  onEnter,
}: EntityComboboxProps) {
  const [suggestions, setSuggestions] = useState<EntitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const suppressFetchOnceRef = useRef(false);

  useEffect(() => {
    if (suppressFetchOnceRef.current) {
      suppressFetchOnceRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      void fetchSuggestions(value.trim()).then((items) => {
        setSuggestions(items);
        setActiveIndex(-1);
      });
    }, 120);
    return () => clearTimeout(t);
  }, [value, fetchSuggestions]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (name: string) => {
    suppressFetchOnceRef.current = true;
    onChange(name);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        className={cn(
          "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground",
          "focus:border-ring focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
        )}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        // biome-ignore lint/a11y/noAutofocus: matches original dialog behavior
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(suggestions.length - 1, i + 1));
            setOpen(true);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(-1, i - 1));
          } else if (e.key === "Enter") {
            if (open && activeIndex >= 0 && suggestions[activeIndex]) {
              e.preventDefault();
              pick(suggestions[activeIndex].name);
            } else if (onEnter) {
              e.preventDefault();
              onEnter();
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        autoComplete="off"
      />
      {open && suggestions.length > 0 ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-scriba-hairline bg-white py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.map((s, idx) => {
            const active = idx === activeIndex;
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s.name);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm",
                  active
                    ? "bg-scriba-blue-soft/60 text-scriba-ink-strong"
                    : "text-scriba-ink hover:bg-scriba-blue-soft/30"
                )}
              >
                <span className="truncate">{s.name}</span>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-scriba-ink-mute">
                  {s.count}×
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
