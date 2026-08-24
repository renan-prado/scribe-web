import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
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
          <>
            <div className="hidden sm:block">
              <NewRecordingDialog />
            </div>
            {profile ? (
              <div className="hidden sm:block">
                <UserMenu
                  displayName={profile.displayName ?? null}
                  email={profile.email ?? null}
                  avatarUrl={profile.avatarUrl ?? null}
                  isAdmin={isAdmin}
                />
              </div>
            ) : null}
          </>
        }
      />
      <div className="pb-36 sm:pb-0">{children}</div>
      <MobileBottomNav />
    </>
  );
}
