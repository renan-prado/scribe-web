import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/features/auth/components/UserMenu";
import { CoinBalance } from "@/features/coins/components/CoinBalance";
import { NewRecordingDialog } from "@/features/session/components/NewRecordingDialog";
import { isCurrentUserAdmin } from "@/lib/auth/require-admin";
import { isCurrentUserPartner } from "@/lib/auth/require-partner";
import { INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import { getCurrentBalance } from "@/lib/db/coins";
import { getCurrentProfile } from "@/lib/db/profiles";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // `isCurrentUserPartner` também é o ponto onde a mesada mensal de moedas do
  // parceiro é conferida e creditada — ver lib/partners/allowance.ts. Fica
  // aqui, e não numa rota, porque é o único caminho por onde todo parceiro
  // passa ao usar o app.
  const [profile, isAdmin, isPartner, coinBalance] = await Promise.all([
    getCurrentProfile().catch(() => null),
    isCurrentUserAdmin().catch(() => false),
    isCurrentUserPartner().catch(() => false),
    getCurrentBalance().catch(() => null),
  ]);
  const initialBalance = coinBalance ?? INITIAL_COIN_BALANCE;

  return (
    <>
      <AppHeader
        actions={
          <>
            <div className="flex items-center gap-2 sm:hidden">
              <ThemeToggle compact />
              <CoinBalance initialBalance={initialBalance} />
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <NewRecordingDialog />
              <CoinBalance initialBalance={initialBalance} />
              <ThemeToggle compact />
              {profile ? (
                <UserMenu
                  displayName={profile.displayName ?? null}
                  email={profile.email ?? null}
                  avatarUrl={profile.avatarUrl ?? null}
                  isAdmin={isAdmin}
                  isPartner={isPartner}
                />
              ) : null}
            </div>
          </>
        }
      />
      <div className="flex flex-1 flex-col pb-36 sm:pb-0">{children}</div>
      <MobileBottomNav
        avatarUrl={profile?.avatarUrl ?? null}
        displayName={profile?.displayName ?? null}
        email={profile?.email ?? null}
      />
    </>
  );
}
