import { permanentRedirect } from "next/navigation";

/**
 * Rota LEGADA. `/list` virou `/recordings`, e `/recordings` virou a Biblioteca
 * em `/v2/home`. Dois nomes atrás, e o link ainda abre.
 *
 * Mora FORA do layout do app de propósito, no molde de `app/session/[id]`: um
 * redirect não precisa da consulta ao banco que aquele layout faz, e os dois
 * renderizam em paralelo.
 *
 * `permanentRedirect` responde 308, o navegador e o rastreador guardam a
 * troca. É o mesmo 308 que um `redirects()` do `next.config.ts` daria, com a
 * vantagem de a razão morar ao lado da rota.
 *
 * Link novo aponta para `/v2/home` direto.
 */
export default function LegacyListPage() {
  permanentRedirect("/v2/home");
}
