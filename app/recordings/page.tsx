import { permanentRedirect } from "next/navigation";

/**
 * Rota LEGADA: o v2 é o app, e esta tela mora em `/v2/home`.
 *
 * Ela continua existindo, e não foi apagada, porque link antigo, bookmark e
 * atalho de PWA instalado apontam para cá. `permanentRedirect` (308) é o que
 * diz ao navegador e ao rastreador que a mudança é definitiva; um 307 faria
 * cada visita futura bater aqui de novo para descobrir a mesma coisa.
 *
 * Mora FORA do layout do app de propósito: um redirect não precisa da consulta
 * ao banco que aquele layout faz (o mapa dos tours), e layout e página
 * renderizam em paralelo, então pô-la lá dentro pagaria essa consulta em toda
 * visita a um link antigo. Mesma decisão de `app/list` e `app/session/[id]`.
 */
export default function RecordingsRedirect() {
  permanentRedirect("/v2/home");
}
