import { cn } from "@/lib/utils";

export function SummarySkeleton() {
  return (
    <div role="status" aria-label="Gerando resumo" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 border-l-[2.5px] border-scriba-hairline pl-4">
        <div className="h-2.5 w-24 animate-skeleton-shimmer rounded-full bg-scriba-blue-soft" />
        <div className="h-4 w-full animate-skeleton-shimmer rounded-md bg-scriba-blue-soft [animation-delay:80ms]" />
        <div className="h-4 w-4/5 animate-skeleton-shimmer rounded-md bg-scriba-blue-soft [animation-delay:160ms]" />
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="h-5 w-2/5 animate-skeleton-shimmer rounded-md bg-scriba-blue-soft [animation-delay:240ms]" />
        <div className="h-3 w-full animate-skeleton-shimmer rounded-md bg-scriba-hairline-soft [animation-delay:320ms]" />
        <div className="h-3 w-11/12 animate-skeleton-shimmer rounded-md bg-scriba-hairline-soft [animation-delay:400ms]" />
        <div className="h-3 w-3/5 animate-skeleton-shimmer rounded-md bg-scriba-hairline-soft [animation-delay:480ms]" />
      </div>
    </div>
  );
}

export function TranscriptSkeleton() {
  return (
    <div role="status" aria-label="Transcrevendo" className="flex w-full flex-col gap-2 pt-1">
      <div className="h-3.5 w-full animate-skeleton-shimmer rounded-md bg-scriba-hairline-soft" />
      <div className="h-3.5 w-4/5 animate-skeleton-shimmer rounded-md bg-scriba-hairline-soft [animation-delay:150ms]" />
      <div className="h-3.5 w-2/5 animate-skeleton-shimmer rounded-md bg-scriba-hairline-soft [animation-delay:300ms]" />
    </div>
  );
}

/**
 * Os três pontos cinzas, o gesto universal de "algo está vindo".
 *
 * Nasceu no feed ao vivo ("escutando") e serve também à gaveta do Biblo
 * ("abrindo a conversa"), que é por que o rótulo e o espaçamento são
 * parâmetros: o DESENHO é o componente, a frase é de quem chama. Um segundo
 * trio de pontos em outro arquivo divergiria no primeiro ajuste de tamanho.
 *
 * O rótulo continua obrigatório em espírito: quem usa leitor de tela não vê
 * ponto nenhum, e "carregando" sem dizer o quê não informa nada.
 */
export function ListeningDots({
  label = "Escutando",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("flex items-center justify-center gap-1.5 pt-2", className)}
    >
      <span className="size-1.5 animate-listening-dot rounded-full bg-session-typing-dot" />
      <span className="size-1.5 animate-listening-dot rounded-full bg-session-typing-dot [animation-delay:200ms]" />
      <span className="size-1.5 animate-listening-dot rounded-full bg-session-typing-dot [animation-delay:400ms]" />
    </div>
  );
}
