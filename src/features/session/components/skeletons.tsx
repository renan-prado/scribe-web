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

export function ListeningDots() {
  return (
    <div
      role="status"
      aria-label="Escutando"
      className="flex items-center justify-center gap-1.5 pt-2"
    >
      <span className="size-1.5 animate-listening-dot rounded-full bg-[#9BB6CC]" />
      <span className="size-1.5 animate-listening-dot rounded-full bg-[#9BB6CC] [animation-delay:200ms]" />
      <span className="size-1.5 animate-listening-dot rounded-full bg-[#9BB6CC] [animation-delay:400ms]" />
    </div>
  );
}
