"use client";

import { useEffect, useState } from "react";

const SPINNER_FRAMES = ["·", "*", "✳", "✶", "✳", "*"];

export function SpinnerGlyph() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 140);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      aria-hidden
      className="inline-flex w-3 items-center justify-center font-mono text-sm leading-none text-foreground/70 tabular-nums"
    >
      {SPINNER_FRAMES[frame]}
    </span>
  );
}
