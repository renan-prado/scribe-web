import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import { PrivilegedMenuItems } from "@/features/auth/components/PrivilegedMenuItems";
import { INITIAL_COIN_BALANCE } from "@/features/coins/pricing";
import { isCurrentUserPartner } from "@/lib/auth/require-partner";
import { getCurrentAccount } from "@/lib/db/account";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./AccountMenu";
import { AppMenu } from "./AppMenu";
import { TOPBAR_CHIP_CLASS } from "./chip";

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
 * O canto direito tem DUAS coisas, e só uma delas é da página. O `trailing` é
 * um SLOT: a Biblioteca passa o gatilho da busca (que precisa do estado dela,
 * ver `SearchScope`), a gravação passa o relógio. **O avatar vem depois dele e
 * é da BARRA**, em toda tela que a monte: a conta não é assunto de uma página,
 * e um avatar que aparece e some conforme a tela obrigaria a decorar em qual
 * delas ele estava. Ver `AccountMenu`.
 *
 * **Com `backHref`, o canto esquerdo troca a gaveta por um VOLTAR** e o título
 * pode sumir — é a barra do `/summary`. Uma tela de leitura aberta a partir de
 * um cartão precisa do caminho de volta no lugar onde o polegar já procura,
 * que é o canto de onde a gaveta sai; e repetir ali o título do sermão, que a
 * página inteira grita duas linhas abaixo, seria dizê-lo duas vezes. O resto da
 * barra NÃO muda: a lupa e o avatar continuam onde estavam em toda tela.
 */
export async function TopBar({
  title,
  backHref,
  trailing,
}: {
  /** Some no `/summary`: a própria página já é o título. */
  title?: string;
  /** Quando passado, o hambúrguer vira um voltar para cá. */
  backHref?: string;
  trailing?: ReactNode;
}) {
  // Duas consultas, em paralelo. `getCurrentAccount` traz perfil, saldo e papel
  // da MESMA linha de `profiles`; `isCurrentUserPartner` lê outra tabela, e é
  // também o ponto onde a mesada mensal do parceiro é conferida e creditada
  // (ver `lib/partners/allowance.ts`). Fica aqui, e não numa rota, porque esta
  // barra é o único caminho por onde todo parceiro passa ao usar o app.
  const [account, isPartner] = await Promise.all([
    getCurrentAccount().catch(() => null),
    isCurrentUserPartner().catch(() => false),
  ]);

  // O MESMO nó, renderizado no menu do avatar e no da gaveta. Montá-lo duas
  // vezes daria dois RSC payloads iguais; montá-lo aqui, uma vez, é o que
  // garante que os dois menus não possam divergir num deploy distraído.
  const privilegedItems = (
    <PrivilegedMenuItems isAdmin={account?.isAdmin ?? false} isPartner={isPartner} />
  );
  const identity = {
    displayName: account?.profile.displayName ?? null,
    email: account?.profile.email ?? null,
    avatarUrl: account?.profile.avatarUrl ?? null,
    coinBalance: account?.coinBalance ?? INITIAL_COIN_BALANCE,
  };

  return (
    // `gap-3`: o título encostado no botão da esquerda lia como legenda dele,
    // e não como o nome da tela.
    <header className="flex items-center gap-3 px-1 py-3">
      {backHref ? (
        <NavLink
          href={backHref}
          aria-label="Voltar"
          spinner="none"
          contentClassName="inline-flex items-center"
          className={cn("-ml-1", TOPBAR_CHIP_CLASS)}
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} />
        </NavLink>
      ) : (
        <AppMenu {...identity} hasSession={account !== null} privilegedItems={privilegedItems} />
      )}
      {/* Sem peso: o título é a placa da tela, e em negrito ele competia com o
          conteúdo que a página veio mostrar. */}
      {title ? (
        <h1 className="min-w-0 flex-1 truncate text-[22px] text-v2-ink">{title}</h1>
      ) : (
        <span className="flex-1" />
      )}
      {/* Sem `trailing`, um vão do tamanho do botão: é ele que mantém o título
          na mesma posição nas duas telas, e sem o vão o texto escorregaria
          para a direita ao trocar de página. */}
      {trailing ?? <span aria-hidden className="size-10 shrink-0" />}
      {/* Sem sessão não há conta a abrir, e o canto fica com a lupa sozinha. */}
      {account ? <AccountMenu {...identity} privilegedItems={privilegedItems} /> : null}
    </header>
  );
}
