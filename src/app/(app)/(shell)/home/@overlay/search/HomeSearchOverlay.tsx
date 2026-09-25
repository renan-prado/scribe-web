"use client";

import { GlobalSearchDialog } from "../../../components/GlobalSearchDialog";
import { HOME_HREF } from "../../../lib/overlay-routes";
import { useOverlayClose } from "../../../lib/use-overlay-close";

/**
 * A metade cliente de `/home/search`: a rota está aberta, logo o diálogo está
 * aberto. `open` é `true` e nunca muda — quem fecha é o roteador.
 *
 * **Montado pela rota, ele nasce limpo.** A `GlobalSearchDialog` tem um efeito
 * que zera filtro e foco ao ABRIR (ver o cabeçalho dela), escrito para uma
 * instância que ficava montada o tempo todo; aqui ele roda na montagem, que dá
 * no mesmo. Quando a última tela sair da `GlobalSearchStore`, esse efeito pode
 * sair junto.
 */
export function HomeSearchOverlay() {
  const close = useOverlayClose(HOME_HREF);
  return <GlobalSearchDialog open onOpenChange={(next) => !next && close()} />;
}
