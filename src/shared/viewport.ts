import type { Viewport } from "next";

/**
 * O viewport das telas que são O APP: a área logada e a porta de entrada dela.
 *
 * **Aqui o zoom é TRAVADO, e na landing não.** O `app/layout.tsx` continua
 * declarando `maximumScale: 5` para o site público, porque ali o conteúdo é
 * texto corrido lido em aba de navegador, e travar a pinça numa página de
 * leitura é violação de acessibilidade (o Lighthouse reprova, com razão).
 *
 * O app é outra coisa: ele é instalado na tela inicial e vai virar um
 * WebView dentro de um app nativo, onde o zoom do navegador não é um recurso
 * de leitura, é um acidente — a pessoa apoia dois dedos para rolar durante a
 * pregação e a tela inteira desalinha, com o `RecordDock` fora de vista e o
 * gesto de voltar do sistema desencontrado. Num app nativo esse gesto não
 * existe, e o app tem que parecer nativo.
 *
 * **A meta sozinha não resolve, e por isso existe o `ZoomLock`.** O Safari do
 * iOS IGNORA `user-scalable=no` numa aba comum desde o iOS 10; ele só obedece
 * no modo standalone (instalado) e no WKWebView. O restinho — a aba do iPhone
 * — é coberto por JS, ver `src/shared/components/ZoomLock.tsx`.
 *
 * `viewportFit: "cover"` é repetido aqui de propósito: o Next mescla campo a
 * campo com o layout de cima, mas esta é a única declaração que o app enxerga
 * e ela precisa se ler inteira — é dela que dependem os `env(safe-area-inset-*)`
 * do topo do `(app)/layout.tsx` e do `RecordDock`.
 */
export const APP_VIEWPORT: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};
