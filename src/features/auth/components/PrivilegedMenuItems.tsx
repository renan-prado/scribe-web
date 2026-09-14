import { Handshake, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

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
 *
 * **Eles são `DropdownMenuItem`, e não âncoras soltas.** Desde que a conta
 * virou um menu (ver `AccountMenu`), estes dois passaram a morar dentro do
 * popup, e o popup do base-ui navega por setas entre os ITENS que conhece: um
 * `<a>` cru lá dentro seria um destino que o teclado pula. Um server component
 * pode renderizar um componente cliente — o que ele não pode é importar uma
 * constante de dentro de um, e é por isso que a classe abaixo é uma cópia da
 * `ACCOUNT_ITEM_CLASS` e não um import dela.
 */
const ITEM_CLASS =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-v2-ink-soft focus:bg-v2-card-hover focus:text-v2-ink";

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
        <DropdownMenuItem render={<Link href="/partners" />} className={ITEM_CLASS}>
          <Handshake className="size-4 text-v2-ink-mute" />
          Área do parceiro
        </DropdownMenuItem>
      ) : null}
      {isAdmin ? (
        <DropdownMenuItem render={<Link href="/admin" />} className={ITEM_CLASS}>
          <LayoutDashboard className="size-4 text-v2-ink-mute" />
          Admin
        </DropdownMenuItem>
      ) : null}
    </>
  );
}
