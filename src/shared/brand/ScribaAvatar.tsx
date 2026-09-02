import { cn } from "@/lib/utils";
import { ScribaMark } from "@/shared/brand/ScribaMark";

/**
 * A pena dentro do disco com gradiente — o "rosto" do Scriba quando ele fala
 * como autor: avatar dos cartões escritos pela IA no feed e nos blocos de
 * estudo.
 *
 * `text-white` é literal de propósito e está dentro da regra: o gradiente do
 * disco é o MESMO nos dois temas, então não há o que inverter.
 */
export function ScribaAvatar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-[image:var(--scriba-avatar-gradient)]",
        className
      )}
    >
      <ScribaMark size={16} className="text-white" />
    </div>
  );
}
