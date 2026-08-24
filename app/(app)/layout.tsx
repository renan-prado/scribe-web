import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { CoinBalance } from "@/components/CoinBalance";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { UserMenu } from "@/features/auth/components/UserMenu";
import { NewRecordingDialog } from "@/features/session/components/NewRecordingDialog";
import { isCurrentUserAdmin } from "@/lib/auth/require-admin";
import { getCurrentProfile } from "@/lib/db/profiles";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [profile, isAdmin] = await Promise.all([
    getCurrentProfile().catch(() => null),
    isCurrentUserAdmin().catch(() => false),
  ]);

  return (
    <>
      <AppHeader
        actions={
          <div className="hidden items-center gap-3 sm:flex">
            <NewRecordingDialog />
            <CoinBalance />
            {profile ? (
              <UserMenu
                displayName={profile.displayName ?? null}
                email={profile.email ?? null}
                avatarUrl={profile.avatarUrl ?? null}
                isAdmin={isAdmin}
              />
            ) : null}
          </div>
        }
      />
      <div className="pb-36 sm:pb-0">{children}</div>
      <MobileBottomNav />
    </>
  );
}
