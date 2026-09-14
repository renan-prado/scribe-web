import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PageTransition } from "@/components/PageTransition";
import { AccountDisabled } from "@/features/auth/components/AccountDisabled";
import { PrivilegedMenuItems } from "@/features/auth/components/PrivilegedMenuItems";
import { UserMenu } from "@/features/auth/components/UserMenu";
import { CoinBalance } from "@/features/coins/components/CoinBalance";
import { TourProvider } from "@/features/tour/components/TourProvider";
import { isCurrentUserPartner } from "@/lib/auth/require-partner";
import { INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import { getCurrentAccount } from "@/lib/db/account";
import { listSeenTours } from "@/lib/db/tours";
import type { TourSeenMap } from "@/lib/domain/tour";
import { getAuthUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Duas idas ao banco, não quatro: `getCurrentAccount` traz perfil, saldo e
  // papel da MESMA linha de `profiles` (antes eram três consultas nela, cada
  // uma precedida do seu próprio `getUser()` na rede).
  //
  // `isCurrentUserPartner` continua separado porque lê outra tabela, e é
  // também o ponto onde a mesada mensal de moedas do parceiro é conferida e
  // creditada (ver lib/partners/allowance.ts). Fica aqui, e não numa rota,
  // porque é o único caminho por onde todo parceiro passa ao usar o app.
  // `getAuthUser` é `cache()`, então pedir o id aqui não custa uma ida a mais
  // à rede: é a MESMA chamada que `getCurrentAccount` faz por dentro. É o que
  // permite ao mapa de tours entrar no mesmo `Promise.all` em vez de esperar
  // o perfil chegar para só então começar.
  const user = await getAuthUser();
  const [account, isPartner, seenTours] = await Promise.all([
    getCurrentAccount().catch(() => null),
    isCurrentUserPartner().catch(() => false),
    user ? listSeenTours(user.id).catch((): TourSeenMap => ({})) : Promise.resolve({}),
  ]);
  // Conta desativada não renderiza o app: nem header, nem nav, nem children.
  // O 403 de `requireAuth()` já barra as rotas de API, sem esta metade, a
  // pessoa navegaria por telas que falham uma a uma sem explicar o motivo.
  if (account && !account.isActive) return <AccountDisabled />;

  const profile = account?.profile ?? null;
  const isAdmin = account?.isAdmin ?? false;
  const initialBalance = account?.coinBalance ?? INITIAL_COIN_BALANCE;
  // O saldo só existe para quem tem CONTA, e o teste é a sessão, não o perfil:
  // `getCurrentAccount` devolve null também quando a leitura falha, e nesse
  // caso o certo é o chip aparecer com o fallback, não sumir no meio de uma
  // gravação. Sem sessão nenhuma, porém, o fallback vira uma mentira educada,
  // um "50 moedas" exibido a quem não tem conta alguma. Isso não era visível
  // até `/profile/delete` passar a renderizar para anônimos (ver a página e o
  // `proxy.ts`); é a única rota de `(app)` que chega aqui sem usuário.
  const hasSession = user !== null;

  return (
    /* O provider dos tours envolve a moldura INTEIRA, e não só o conteúdo:
       parte dos alvos que o holofote recorta mora no header, e o overlay
       precisa estar vivo enquanto eles estão na tela. Ver
       `src/features/tour/AGENTS.md`. */
    <TourProvider seen={seenTours}>
      <AppHeader
        actions={
          <>
            <div className="flex items-center gap-2 sm:hidden">
              {hasSession ? <CoinBalance initialBalance={initialBalance} /> : null}
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              {hasSession ? <CoinBalance initialBalance={initialBalance} /> : null}
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
      {/* Só o CONTEÚDO troca com a rota: o header acima fica montado, e era
          ele que sumia e voltava a cada toque quando o fade morava no root
          layout. */}
      <PageTransition className="flex flex-1 flex-col">{children}</PageTransition>
    </TourProvider>
  );
}
