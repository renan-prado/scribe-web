"use client";

import { Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { requestCreateSession } from "@/features/session/lib/api";
import { cn } from "@/lib/utils";

export function NewRecordingDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="Nova gravação"
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-none bg-primary text-primary-foreground shadow-sm",
          "transition-colors hover:bg-primary/80",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
        )}
      >
        <Mic className="size-4" />
      </DialogTrigger>
      <DialogContent className="flex flex-col items-center gap-8 px-6 py-10 sm:gap-10">
        <DialogTitle className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Tudo pronto?
        </DialogTitle>

        <div className="flex w-full flex-col items-stretch gap-2">
          <Button
            type="button"
            size="lg"
            onClick={handleStart}
            disabled={loading}
            className="w-full"
          >
            <Mic data-icon="inline-start" />
            {loading ? "Preparando sessão..." : "Iniciar gravação"}
          </Button>
          <DialogClose
            render={<Button type="button" variant="ghost" size="lg" />}
            disabled={loading}
            className="w-full"
          >
            Cancelar
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
