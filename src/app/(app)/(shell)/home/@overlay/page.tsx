import { BibloHomeTrigger } from "@/features/session/components/BibloHomeTrigger";
import { HOME_CHAT_HREF } from "../../lib/overlay-routes";

/**
 * O estado do slot `@overlay` em `/home`: nenhuma gaveta aberta, e o disco do
 * Biblo no canto (desktop; no celular quem o abre é a `MobileActionBar`).
 *
 * **Ele é um `page.tsx` e não o `default.tsx`, e a diferença importa.** Um slot
 * sem página própria para `/home` não seria RESETADO ao voltar de
 * `/home/chat`: numa navegação de cliente o Next mantém o último estado dos
 * slots que a URL nova não casa, e a gaveta continuaria na tela depois de
 * fechada. Com esta página o slot casa `/home` explicitamente, e voltar para a
 * Biblioteca troca a gaveta pelo disco como qualquer outra navegação.
 */
export default function HomeOverlayIdle() {
  return <BibloHomeTrigger href={HOME_CHAT_HREF} />;
}
