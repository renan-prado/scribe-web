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

export function StatusPhrases({ hasSummary }: { hasSummary: boolean }) {
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

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full items-center gap-2.5 text-left text-xs"
    >
      <span className="mt-0 shrink-0 text-[color:var(--scriba-blue)]">
        <SpinnerGlyph />
      </span>
      <span
        key={`pool-${index}`}
        className={cn(
          "flex-1 text-pretty leading-relaxed font-normal animate-status-fade animate-text-shimmer bg-clip-text text-transparent",
          "bg-[linear-gradient(90deg,#B7C3D0_20%,#4A5A6A_50%,#B7C3D0_80%)]",
          "bg-[length:220%_100%]"
        )}
      >
        {pool[index]}
      </span>
    </div>
  );
}
