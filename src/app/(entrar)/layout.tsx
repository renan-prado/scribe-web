import type { ReactNode } from "react";
import { ZoomLock } from "@/components/ZoomLock";
import { APP_VIEWPORT } from "@/shared/viewport";

/**
 * Este layout não desenha nada, e existe por uma linha só: o `viewport`.
 *
 * `/sign-in` é a `start_url` do manifest, ou seja, é a PRIMEIRA tela do app
 * instalado — e a última que faria sentido ampliar na pinça. Sem esta camada,
 * ela herdaria o `maximumScale: 5` do site e o app abriria ampliável para
 * fechar-se logo depois, ao entrar. Ver `src/shared/viewport.ts`.
 */
export const viewport = APP_VIEWPORT;

export default function EntrarLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ZoomLock />
      {children}
    </>
  );
}
