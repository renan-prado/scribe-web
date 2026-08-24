/**
 * Small chip that visualizes the coin cost of an action — a filled yellow
 * hexagon + the number, sized to sit on the primary blue button.
 */
export function CoinCost({ count }: { count: number }) {
  return (
    <span
      role="img"
      aria-label={`Custa ${count} moedas`}
      className="inline-flex items-center gap-1 rounded-full bg-white/18 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white"
    >
      <span
        aria-hidden
        className="block bg-white"
        style={{
          width: "9px",
          height: "10.25px",
          clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
        }}
      />
      {count}
    </span>
  );
}
