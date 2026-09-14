import { Handshake, LayoutDashboard } from "lucide-react";
import Link from "next/link";

/**
 * Os atalhos do menu que só existem para quem tem o papel.
 *
 * É um SERVER component de propósito, e é essa a única razão de ele existir
 * separado do menu. Enquanto estes dois itens moravam lá dentro, atrás de um
 * `isAdmin &&`, as strings "Admin", "Área do parceiro", "/admin" e "/partners"
 * viajavam no chunk de JavaScript que TODO usuário logado baixa: o `false`
 * escondia o item na tela, não o código que o desenha. Conferido no build, o
 * chunk continha as quatro.
 *
 * Renderizado aqui, o markup entra no RSC payload, que é montado por request:
 * quem não é admin nem parceiro recebe `null` e nunca vê os nomes. Os ícones do
 * lucide saem do bundle compartilhado pela mesma razão.
 *
 * Isso NÃO é o controle de acesso, esse mora nos gates de `/admin` e
 * `/partners`, que respondem 404 para quem digitar a URL. Aqui é só não
 * anunciar a existência da porta.
 *
 * `<Link>` cru, e não o `NavLink` que a gaveta usa nos outros itens: os dois
 * destinos ficam FORA do layout do app, então a navegação troca a moldura
 * inteira e a gaveta se desmonta junto — não há estado de gaveta a fechar.
 */
const ITEM_CLASS =
  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-v2-ink-soft transition-colors hover:bg-v2-card hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute";

export function PrivilegedMenuItems({
  isAdmin,
  isPartner,
}: {
  isAdmin: boolean;
  isPartner: boolean;
}) {
  if (!isAdmin && !isPartner) return null;

  return (
    <>
      {/* Sem este item o parceiro só chega ao painel digitando a URL: o admin
          manda o link uma vez e depois a área some do mundo dele. */}
      {isPartner ? (
        <Link href="/partners" className={ITEM_CLASS}>
          <Handshake className="size-4" />
          Área do parceiro
        </Link>
      ) : null}
      {isAdmin ? (
        <Link href="/admin" className={ITEM_CLASS}>
          <LayoutDashboard className="size-4" />
          Admin
        </Link>
      ) : null}
    </>
  );
}
