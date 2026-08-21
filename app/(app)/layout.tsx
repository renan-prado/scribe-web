import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { UserMenu } from "@/features/auth/components/UserMenu";
import { isCurrentUserAdmin } from "@/lib/auth/require-admin";
import { getCurrentProfile } from "@/lib/db/profiles";
import { cn } from "@/lib/utils";

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
            <Link
              href="/spike"
              aria-label="Nova gravação"
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-none bg-primary text-primary-foreground shadow-sm",
                "transition-colors hover:bg-primary/80",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
              )}
            >
              <Plus className="size-4" />
            </Link>
            {profile ? (
              <UserMenu
                displayName={profile.displayName ?? null}
                email={profile.email ?? null}
                avatarUrl={profile.avatarUrl ?? null}
                isAdmin={isAdmin}
              />
            ) : null}
          </>
        }
      />
      {children}
    </>
  );
}
