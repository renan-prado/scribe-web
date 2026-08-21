"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

export function RefreshSessionsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label="Atualizar lista"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground sm:size-9",
        "transition-colors hover:border-foreground/25 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        "disabled:cursor-not-allowed"
      )}
    >
      <RefreshCw className={cn("size-4", isPending && "animate-spin")} />
    </button>
  );
}
