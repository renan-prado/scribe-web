import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PrivilegedMenuItems } from "@/features/auth/components/PrivilegedMenuItems";
import { UserMenu } from "@/features/auth/components/UserMenu";
import { CoinBalance } from "@/features/coins/components/CoinBalance";
import { NewRecordingDialog } from "@/features/session/components/NewRecordingDialog";
import { isCurrentUserPartner } from "@/lib/auth/require-partner";
import { INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import { getCurrentAccount } from "@/lib/db/account";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Duas idas ao banco, não quatro: `getCurrentAccount` traz perfil, saldo e
  // papel da MESMA linha de `profiles` (antes eram três consultas nela, cada
  // uma precedida do seu próprio `getUser()` na rede).
  //
  // `isCurrentUserPartner` continua separado porque lê outra tabela — e é
  // também o ponto onde a mesada mensal de moedas do parceiro é conferida e
  // creditada (ver lib/partners/allowance.ts). Fica aqui, e não numa rota,
  // porque é o único caminho por onde todo parceiro passa ao usar o app.
  const [account, isPartner] = await Promise.all([
    getCurrentAccount().catch(() => null),
    isCurrentUserPartner().catch(() => false),
  ]);
  const profile = account?.profile ?? null;
  const isAdmin = account?.isAdmin ?? false;
  const initialBalance = account?.coinBalance ?? INITIAL_COIN_BALANCE;

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
                  privilegedItems={<PrivilegedMenuItems isAdmin={isAdmin} isPartner={isPartner} />}
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
