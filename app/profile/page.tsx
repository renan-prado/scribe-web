import { permanentRedirect } from "next/navigation";

/**
 * Rota LEGADA: o v2 é o app, e o perfil mora em `/v2/profile`.
 *
 * Ela continua existindo, e não foi apagada, porque link antigo, bookmark e
 * atalho de PWA instalado apontam para cá. `permanentRedirect` (308) é o que
 * diz ao navegador e ao rastreador que a mudança é definitiva.
 *
 * Ela tem uma IRMÃ que não redireciona: `/profile/delete` é uma página de
 * verdade, e é pública (é a URL da ficha das lojas, ver `proxy.ts`). As duas
 * moram lado a lado aqui fora justamente para que o endereço registrado na
 * Play Store não dependa de onde o resto do app está.
 */
export default function ProfileRedirect() {
  permanentRedirect("/v2/profile");
}
