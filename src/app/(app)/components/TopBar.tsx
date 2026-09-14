import type { ReactNode } from "react";
import { PrivilegedMenuItems } from "@/features/auth/components/PrivilegedMenuItems";
import { isCurrentUserPartner } from "@/lib/auth/require-partner";
import { INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import { getCurrentAccount } from "@/lib/db/account";
import { AppMenu } from "./AppMenu";

/**
 * A barra do topo do v2: hambúrguer, título, busca.
 *
 * Mora aqui, e não dentro de `home/`, porque a `/recording` usa a mesma:
 * são telas diferentes do mesmo produto, e um cabeçalho que muda de desenho ao
 * entrar na gravação faria a pessoa achar que saiu do app.
 *
 * **Ela é um server component, e por isso é a PÁGINA quem a renderiza**, nunca
 * um componente cliente. É aqui que o perfil e o saldo são lidos (uma consulta,
 * `getCurrentAccount` é `cache()`), e é a única razão de a barra tocar o banco:
 * a gaveta abre com quem é você e quanto você tem.
 *
 * O canto direito é um SLOT (`trailing`), e não um botão fixo: quem manda é a
 * página, porque o que vai ali depende dela. A Biblioteca passa o gatilho da
 * busca (que precisa do estado dela, ver `SearchScope`); a gravação não passa
 * nada, e fica sem — uma lupa que não busca, numa tela onde não há o que
 * buscar, é pior que um canto vazio.
 */
export async function TopBar({ title, trailing }: { title: string; trailing?: ReactNode }) {
  // Duas consultas, em paralelo. `getCurrentAccount` traz perfil, saldo e papel
  // da MESMA linha de `profiles`; `isCurrentUserPartner` lê outra tabela, e é
  // também o ponto onde a mesada mensal do parceiro é conferida e creditada
  // (ver `lib/partners/allowance.ts`). Fica aqui, e não numa rota, porque esta
  // barra é o único caminho por onde todo parceiro passa ao usar o app.
  const [account, isPartner] = await Promise.all([
    getCurrentAccount().catch(() => null),
    isCurrentUserPartner().catch(() => false),
  ]);

  return (
    <header className="flex items-center gap-2 px-1 py-3">
      <AppMenu
        displayName={account?.profile.displayName ?? null}
        email={account?.profile.email ?? null}
        avatarUrl={account?.profile.avatarUrl ?? null}
        coinBalance={account?.coinBalance ?? INITIAL_COIN_BALANCE}
        hasSession={account !== null}
        privilegedItems={
          <PrivilegedMenuItems isAdmin={account?.isAdmin ?? false} isPartner={isPartner} />
        }
      />
      <h1 className="min-w-0 flex-1 truncate text-[22px] font-semibold text-v2-ink">{title}</h1>
      {/* Sem `trailing`, um vão do tamanho do botão: é ele que mantém o título
          na mesma posição nas duas telas, e sem o vão o texto escorregaria
          para a direita ao trocar de página. */}
      {trailing ?? <span aria-hidden className="size-11 shrink-0" />}
    </header>
  );
}
