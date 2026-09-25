import { HomeChatOverlay } from "./HomeChatOverlay";

/**
 * `/home/chat`: a conversa com o Biblo, com a Biblioteca atrás.
 *
 * Mesmo desenho do `search` ao lado, e pelo mesmo motivo — ver
 * `lib/overlay-routes.ts`. A diferença é o que sobrevive ao fechar: a conversa
 * está no cache do TanStack e o documento em edição no `localStorage`, os dois
 * fora desta rota (ver `BibloHomeDrawer`), então desmontar a gaveta não perde
 * nada além da gaveta.
 */
export default function HomeChatPage() {
  return <HomeChatOverlay />;
}
