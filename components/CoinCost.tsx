/**
 * Small chip that visualizes the coin cost of an action — a filled yellow
 * hexagon + the number, sized to sit on the primary blue button.
 *
 * `suffix` is appended after the number (e.g. "/min") for per-minute costs
 * so the same chip can show both flat and rate-based prices.
 */
export function CoinCost({ count, suffix }: { count: number; suffix?: string }) {
  const label = suffix ? `Custa ${count} moedas ${suffix}` : `Custa ${count} moedas`;
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full bg-white/18 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white"
    >
      <span aria-hidden className="coin-hex block h-[10.25px] w-[9px] bg-white" />
      {count}
      {suffix ? <span className="font-medium opacity-80">{suffix}</span> : null}
    </span>
  );
}
