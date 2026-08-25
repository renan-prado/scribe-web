import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { CoinBalance } from "@/components/CoinBalance";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { UserMenu } from "@/features/auth/components/UserMenu";
import { NewRecordingDialog } from "@/features/session/components/NewRecordingDialog";
import { isCurrentUserAdmin } from "@/lib/auth/require-admin";
import { INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import { getCurrentBalance } from "@/lib/db/coins";
import { getCurrentProfile } from "@/lib/db/profiles";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [profile, isAdmin, coinBalance] = await Promise.all([
    getCurrentProfile().catch(() => null),
    isCurrentUserAdmin().catch(() => false),
    getCurrentBalance().catch(() => null),
  ]);
  const initialBalance = coinBalance ?? INITIAL_COIN_BALANCE;

  return (
    <>
      <AppHeader
        actions={
          <>
            <div className="flex items-center sm:hidden">
              <CoinBalance initialBalance={initialBalance} />
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <NewRecordingDialog />
              <CoinBalance initialBalance={initialBalance} />
              {profile ? (
                <UserMenu
                  displayName={profile.displayName ?? null}
                  email={profile.email ?? null}
                  avatarUrl={profile.avatarUrl ?? null}
                  isAdmin={isAdmin}
                />
              ) : null}
            </div>
          </>
        }
      />
      <div className="flex flex-1 flex-col pb-36 sm:pb-0">{children}</div>
      <MobileBottomNav />
    </>
  );
}
