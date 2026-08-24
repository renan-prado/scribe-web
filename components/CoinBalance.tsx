"use client";

// Placeholder — real balance will come from the credits system
const PLACEHOLDER_REMAINING = 180;
const PLACEHOLDER_PERCENT = 64;

export function CoinBalance() {
  const remaining = PLACEHOLDER_REMAINING;
  const percent = PLACEHOLDER_PERCENT;

  return (
    <button
      type="button"
      className="flex items-center gap-[7px] rounded-[20px] bg-[#FFF9E8] py-1 pr-3 pl-2.5 outline-none transition-colors hover:bg-[#FCEFC2]"
    >
      <div
        className="flex size-[26px] flex-none items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(#F8C64B 0 ${percent}%, #F0E4C6 ${percent}% 100%)`,
        }}
      >
        <div className="flex size-5 items-center justify-center rounded-full bg-white">
          <div
            className="bg-[#F8C64B]"
            style={{
              width: "9.35px",
              height: "10.625px",
              clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
            }}
          />
        </div>
      </div>
      <span className="text-[13px] font-semibold tabular-nums text-[#B07F13]">{remaining}</span>
    </button>
  );
}
