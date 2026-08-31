import { cn } from "@/lib/utils";

/**
 * Marca visual da "moeda" — reaproveita a mesma silhueta hexagonal do
 * CoinBalance (via classe `coin-hex` em globals.css). Sem estado, sem
 * animação — usada onde quisermos mostrar "isso é uma moeda" ao lado de um
 * valor (ex.: KPI de custo por moeda no admin). Sempre decorativa: rótulo de
 * acessibilidade vem do texto adjacente ("Moedas", "Por moeda", etc.).
 */
export function CoinMark({ size = 20, className }: { size?: number; className?: string }) {
  const outer = size;
  const hexW = size * 0.53;
  const hexH = size * 0.6;
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: outer, height: outer }}
    >
      <span
        className="absolute inset-0 rounded-full bg-scriba-gold-track"
        style={{ boxShadow: "inset 0 0 0 2px var(--scriba-yellow)" }}
      />
      <span
        className="relative flex items-center justify-center rounded-full bg-scriba-paper"
        style={{ width: outer * 0.78, height: outer * 0.78 }}
      >
        <span className="coin-hex bg-scriba-yellow" style={{ width: hexW, height: hexH }} />
      </span>
    </span>
  );
}
