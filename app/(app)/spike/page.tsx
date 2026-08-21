"use client";

import { Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Greeting } from "@/features/session/components/Greeting";
import { requestCreateSession } from "@/features/session/lib/api";
import { cn } from "@/lib/utils";

/**
 * Recording launcher. One button → create the DB row via /api/sessions →
 * push to /recording/{id}/live where the recorder mounts and (via autoStart)
 * kicks off immediately. Kept intentionally light so the pre-recording
 * moment stays a single deliberate action.
 */
export default function SpikePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    if (loading) return;
    setLoading(true);
    const result = await requestCreateSession({});
    if ("error" in result) {
      setLoading(false);
      toast.error("Não consegui iniciar a sessão", { description: result.error });
      return;
    }
    router.push(`/recording/${result.id}/live?autostart=1`);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-4 sm:gap-10 sm:px-6">
      <Greeting />

      <button
        type="button"
        onClick={handleStart}
        disabled={loading}
        className={cn(
          "group relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg sm:size-20",
          "transition-transform hover:scale-[1.03] active:scale-95",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
          "disabled:cursor-not-allowed disabled:opacity-80"
        )}
        aria-label="Iniciar gravação"
      >
        <Mic className="size-6 sm:size-7" />
      </button>
      <p className="text-sm text-muted-foreground">
        {loading ? "Preparando sessão..." : "Toque no microfone para começar"}
      </p>
    </main>
  );
}
