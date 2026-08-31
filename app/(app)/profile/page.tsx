import { AtSign, CalendarClock, LogOut, User as UserIcon } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggleRow } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlanCard } from "@/features/billing/components/PlanCard";
import { COIN_RING_REFERENCE } from "@/lib/coins/pricing";
import { getCurrentBalance } from "@/lib/db/coins";
import { getCurrentProfile } from "@/lib/db/profiles";

export const metadata = {
  title: "Perfil",
};

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function initialsFrom(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || source.slice(0, 1).toUpperCase();
}

/**
 * /profile lives inside `(app)` so the shared AppHeader (with the CoinBalance
 * chip) sits on top for free. Layout uses the scriba tokens for a soft,
 * grouped look — an identity hero on top, the coin balance card below it as
 * the biggest visual anchor, then an "Informações da conta" list grouped in
 * a hairline card.
 */
export default async function ProfilePage() {
  const [profile, balance] = await Promise.all([
    getCurrentProfile(),
    getCurrentBalance().catch(() => null),
  ]);
  if (!profile) redirect("/sign-in");

  const shownName = profile.displayName?.trim() || profile.email?.split("@")[0] || "Sua conta";
  const memberSince = DATE_FMT.format(new Date(profile.createdAt));
  const initials = initialsFrom(profile.displayName, profile.email);
  const coinBalance = balance ?? 0;
  const percent = Math.max(0, Math.min(100, (coinBalance / COIN_RING_REFERENCE) * 100));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12">
      {/* Identity hero */}
      <section className="relative overflow-hidden rounded-[28px] bg-scriba-paper p-6 shadow-[0_18px_40px_rgba(51,65,79,0.06)] ring-1 ring-scriba-hairline sm:p-8">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-scriba-blue-soft to-transparent"
        />
        <div className="relative flex flex-col items-center gap-4 text-center">
          <Avatar
            size="lg"
            className="size-24 ring-4 ring-scriba-paper shadow-[0_12px_28px_rgba(51,65,79,0.14)]"
          >
            {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt={shownName} /> : null}
            <AvatarFallback className="bg-scriba-blue-soft text-2xl font-semibold text-scriba-blue">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-center gap-1">
            <h1 className="font-heading text-[26px] font-semibold tracking-tight text-scriba-ink-strong">
              {shownName}
            </h1>
            {profile.email ? <p className="text-sm text-scriba-ink-soft">{profile.email}</p> : null}
            <p className="text-[11px] font-medium uppercase tracking-wider text-scriba-ink-mute">
              Membro desde {memberSince}
            </p>
            <span
              role="img"
              aria-label={`${coinBalance} moedas`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-scriba-gold-soft py-1 pr-3 pl-2"
            >
              <span className="relative flex size-4.5 flex-none items-center justify-center">
                {/* biome-ignore lint/a11y/noSvgWithoutTitle: aria-hidden decorative coin ring */}
                <svg
                  className="absolute inset-0 -rotate-90"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  aria-hidden
                >
                  <circle cx="9" cy="9" r="9" fill="var(--scriba-gold-track)" />
                  <circle
                    cx="9"
                    cy="9"
                    r="9"
                    fill="none"
                    stroke="var(--scriba-yellow)"
                    strokeWidth="18"
                    strokeDasharray={`${(percent / 100) * 56.549} ${56.549 - (percent / 100) * 56.549}`}
                  />
                </svg>
                <span className="relative flex size-[13px] items-center justify-center rounded-full bg-scriba-paper">
                  <span className="coin-hex block h-[7.5px] w-[6.5px] bg-scriba-yellow" />
                </span>
              </span>
              <span className="text-[12px] font-semibold tabular-nums text-scriba-gold-ink">
                {coinBalance} moedas
              </span>
            </span>
          </div>
        </div>
      </section>

      <PlanCard />

      {/* Account info */}
      <section className="rounded-[28px] bg-scriba-paper p-6 ring-1 ring-scriba-hairline sm:p-7">
        <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-mute">
          Informações da conta
        </h2>
        <dl className="grid gap-4">
          <InfoRow icon={<UserIcon className="size-4" />} label="Nome" value={shownName} />
          <InfoRow
            icon={<AtSign className="size-4" />}
            label="Email"
            value={profile.email ?? "—"}
          />
          <InfoRow
            icon={<CalendarClock className="size-4" />}
            label="Membro desde"
            value={memberSince}
          />
        </dl>
      </section>

      {/* Preferências */}
      <section className="rounded-[28px] bg-scriba-paper p-6 ring-1 ring-scriba-hairline sm:p-7">
        <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-mute">
          Preferências
        </h2>
        <ThemeToggleRow />
      </section>

      <form action="/auth/sign-out" method="post">
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-scriba-rose px-5 py-3 text-sm font-semibold text-scriba-rose-ink transition-colors hover:bg-scriba-rose-accent/20"
        >
          <LogOut className="size-4" />
          Sair da conta
        </button>
      </form>
    </main>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 flex-none items-center justify-center rounded-full bg-scriba-blue-soft text-scriba-blue">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <dt className="text-[11px] font-medium uppercase tracking-wider text-scriba-ink-mute">
          {label}
        </dt>
        <dd className="truncate text-sm font-medium text-scriba-ink-strong">{value}</dd>
      </div>
    </div>
  );
}
