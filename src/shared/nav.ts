/**
 * Qual item da navegação fica aceso para um dado caminho.
 *
 * Existe porque as DUAS barras precisam da mesma resposta — `AppNav` no
 * desktop e `MobileBottomNav` no celular —, e enquanto cada uma tinha a sua
 * comparação elas discordavam: as duas acendiam apenas na correspondência
 * exata do próprio href, então toda página de detalhe apagava a barra inteira.
 * Abrir uma gravação deixava "Gravações" apagado, e abrir um estudo deixava
 * "Estudos" apagado.
 *
 * A regra que resolve isso é uma só: **o item aceso é a LISTA de onde o
 * conteúdo veio**, não o prefixo da URL. Daí o caso que parece exceção e é o
 * ponto principal do arquivo — `/recording/:id/deepening` acende "Estudos",
 * embora a URL diga `/recording`. A URL segue a SESSÃO porque o estudo é dela;
 * para quem navega, o que está na tela é um estudo, e é em `/studies` que ele
 * vai procurar de volta.
 */
export type NavKey = "feed" | "list" | "studies" | "profile";

/** O estudo de uma sessão. Precisa ser testado ANTES do `/recording/` geral. */
const DEEPENING_ROUTE = /^\/recording\/[^/]+\/deepening$/;

export function activeNavKey(pathname: string): NavKey | null {
  if (pathname === "/feed") return "feed";
  if (pathname.startsWith("/studies")) return "studies";
  if (pathname.startsWith("/profile")) return "profile";
  if (DEEPENING_ROUTE.test(pathname)) return "studies";
  // Todo o resto de `/recording/:id/*` — resumo, transcrição e as três telas
  // de captura — pertence à lista de gravações.
  if (pathname.startsWith("/list") || pathname.startsWith("/recording/")) return "list";
  return null;
}
