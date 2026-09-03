import { Handshake, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MENU_ITEM_CLASS } from "@/features/auth/lib/menu";

/**
 * Os atalhos do menu do avatar que só existem para quem tem o papel.
 *
 * É um SERVER component de propósito, e é essa a única razão de ele existir
 * separado do `UserMenu`. Enquanto estes dois itens moravam lá dentro, atrás
 * de um `isAdmin &&`, as strings "Admin", "Área do parceiro", "/admin" e
 * "/partners" viajavam no chunk de JavaScript que TODO usuário logado baixa —
 * o `false` escondia o item na tela, não o código que o desenha. Conferido no
 * build: o chunk do UserMenu continha as quatro.
 *
 * Renderizado aqui, o markup entra no RSC payload, que é montado por request:
 * quem não é admin nem parceiro recebe `null` e nunca vê os nomes. Os ícones
 * do lucide saem do bundle compartilhado pela mesma razão.
 *
 * Isso NÃO é o controle de acesso — esse mora nos gates de `/admin` e
 * `/partners`, que respondem 404 para quem digitar a URL. Aqui é só não
 * anunciar a existência da porta.
 */
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
      {/* Sem este item o parceiro só chega ao painel digitando a URL —
          o admin manda o link uma vez e depois a área some do mundo dele. */}
      {isPartner ? (
        <DropdownMenuItem render={<Link href="/partners" />} className={MENU_ITEM_CLASS}>
          <Handshake className="size-4 text-scriba-ink-soft" />
          Área do parceiro
        </DropdownMenuItem>
      ) : null}
      {isAdmin ? (
        <DropdownMenuItem render={<Link href="/admin" />} className={MENU_ITEM_CLASS}>
          <LayoutDashboard className="size-4 text-scriba-ink-soft" />
          Admin
        </DropdownMenuItem>
      ) : null}
    </>
  );
}
