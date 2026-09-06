import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { PageTransition } from "@/components/PageTransition";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccountDisabled } from "@/features/auth/components/AccountDisabled";
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
  // Conta desativada não renderiza o app: nem header, nem nav, nem children.
  // O 403 de `requireAuth()` já barra as rotas de API — sem esta metade, a
  // pessoa navegaria por telas que falham uma a uma sem explicar o motivo.
  if (account && !account.isActive) return <AccountDisabled />;

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
      {/* Só o CONTEÚDO troca com a rota. O header acima e a `MobileBottomNav`
          abaixo ficam montados: eram eles que sumiam e voltavam a cada toque
          quando o fade morava no root layout.

          A folga de 144px no celular é o espaço que a barra inferior ocupa —
          sem ela o fim da rolagem fica embaixo da barra. Ela vai no FILHO
          (`[&>*]`), não neste wrapper, e a diferença é visível: as páginas que
          pintam o próprio chão o pintam no elemento raiz delas
          (`bg-scriba-surface` no /feed, /list e /studies), então uma folga
          aqui fora ficava DEPOIS da tinta e a faixa reservada aparecia num tom
          diferente do conteúdo — o do `body`. Por dentro, o chão da página se
          estende por ela.

          Isso pressupõe UM elemento raiz por página, que é como todas as
          páginas de `(app)` são hoje. Uma página que devolva irmãos no topo
          ganharia a folga em cada um.

          O `EndOfFeedSticker` (`PaginatedFeed.tsx`) tem um `mt-24 sm:mt-0` que
          acompanha o `sm:` daqui, mas NÃO o valor: 144px em cima ficou longe
          demais. Se o `sm:` desta linha mudar, o de lá muda junto. */}
      <PageTransition className="flex flex-1 flex-col [&>*]:pb-36 sm:[&>*]:pb-0">
        {children}
      </PageTransition>
      <MobileBottomNav />
    </>
  );
}
