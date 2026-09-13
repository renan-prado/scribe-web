import { permanentRedirect } from "next/navigation";

/**
 * Rota LEGADA: o v2 é o app, e esta tela mora em `/v2/importar`.
 *
 * Ela continua existindo, e não foi apagada, porque link antigo, bookmark e
 * atalho de PWA instalado apontam para cá. `permanentRedirect` (308) é o que
 * diz ao navegador e ao rastreador que a mudança é definitiva; um 307 faria
 * cada visita futura bater aqui de novo para descobrir a mesma coisa.
 *
 * Mora FORA do grupo `(app)` de propósito: um redirect não precisa de header,
 * de nav, nem das duas consultas ao banco do `app/(app)/layout.tsx`, que
 * renderiza em paralelo com a página. Mesma decisão de `app/list` e
 * `app/session/[id]`.
 */
export default function ImportarRedirect() {
  permanentRedirect("/v2/importar");
}
