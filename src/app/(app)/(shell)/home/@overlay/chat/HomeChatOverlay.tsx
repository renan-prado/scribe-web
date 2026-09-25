"use client";

import { BibloHomeDrawer } from "@/features/session/components/BibloHomeDrawer";
import { HOME_HREF } from "../../../lib/overlay-routes";
import { useOverlayClose } from "../../../lib/use-overlay-close";

/** A metade cliente de `/home/chat`: a rota está aberta, logo a gaveta está. */
export function HomeChatOverlay() {
  const close = useOverlayClose(HOME_HREF);
  return <BibloHomeDrawer onClose={close} />;
}
