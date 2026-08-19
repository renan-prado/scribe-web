"use client";

import { useEffect, useState } from "react";
import { SpinnerGlyph } from "@/features/session/components/SpinnerGlyph";
import { cn } from "@/lib/utils";

const EARLY_STATUS_PHRASES = [
  "ouvindo o áudio",
  "escutando com atenção",
  "aguardando as primeiras ideias",
  "captando a fala inicial",
  "acompanhando o começo",
  "atento ao que vem por aí",
  "esperando o discurso engrenar",
];

const LATER_STATUS_PHRASES = [
  "acompanhando o raciocínio",
  "juntando as ideias que surgiram até aqui",
  "conectando os argumentos",
  "identificando os temas centrais",
  "consultando as Escrituras",
  "estruturando o resumo",
  "escutando com atenção o próximo trecho",
  "amadurecendo as ideias",
  "deixando o pensamento se desenvolver",
];

export function StatusPhrases({
  hasSummary,
  thinking,
}: {
  hasSummary: boolean;
  thinking?: string;
}) {
  const pool = hasSummary ? LATER_STATUS_PHRASES : EARLY_STATUS_PHRASES;
  const [index, setIndex] = useState(() => Math.floor(Math.random() * pool.length));

  useEffect(() => {
    setIndex(Math.floor(Math.random() * pool.length));
    const id = setInterval(
      () => setIndex((i) => (i + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length),
      15000
    );
    return () => clearInterval(id);
  }, [pool]);

  const message = thinking && thinking.trim().length > 0 ? thinking : pool[index];
  const keyForFade = thinking && thinking.trim().length > 0 ? thinking : `pool-${index}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full items-start gap-2 text-left text-xs"
    >
      <span className="mt-[1px] shrink-0">
        <SpinnerGlyph />
      </span>
      <span
        key={keyForFade}
        className={cn(
          "flex-1 text-pretty leading-relaxed animate-status-fade animate-text-shimmer bg-clip-text text-transparent",
          "bg-[linear-gradient(90deg,var(--muted-foreground)_0%,var(--muted-foreground)_35%,var(--foreground)_50%,var(--muted-foreground)_65%,var(--muted-foreground)_100%)]",
          "bg-[length:200%_100%]"
        )}
      >
        {message}
      </span>
    </div>
  );
}
