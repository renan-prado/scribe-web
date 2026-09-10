import { permanentRedirect } from "next/navigation";

/**
 * Rota LEGADA. `/list` virou `/recordings`, o caminho passou a dizer o que a
 * página mostra, em vez de dizer que ela é uma lista.
 *
 * Mora FORA do grupo `(app)` de propósito, no molde de `app/session/[id]`: um
 * redirect não precisa de header, nav nem das duas consultas ao banco que o
 * `app/(app)/layout.tsx` faz. Como o layout e a página renderizam em paralelo,
 * pô-la dentro do grupo pagaria essas consultas em toda visita a um link
 * antigo.
 *
 * `permanentRedirect` responde 308, o navegador e o rastreador guardam a
 * troca. É o mesmo 308 que um `redirects()` do `next.config.ts` daria, com a
 * vantagem de a razão morar ao lado da rota.
 *
 * Link novo aponta para `/recordings` direto.
 */
export default function LegacyListPage() {
  permanentRedirect("/recordings");
}
