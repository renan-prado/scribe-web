import { permanentRedirect } from "next/navigation";

/**
 * Rota LEGADA: o v2 é o app, e o perfil mora em `/v2/profile`.
 *
 * Ela continua existindo, e não foi apagada, porque link antigo, bookmark e
 * atalho de PWA instalado apontam para cá. `permanentRedirect` (308) é o que
 * diz ao navegador e ao rastreador que a mudança é definitiva.
 *
 * **Esta é a única dos redirects que ficou DENTRO de `(app)`**, e o motivo é a
 * irmã: `/profile/delete` é pública (é a URL da ficha das lojas, ver
 * `proxy.ts`) e mora em `app/(app)/profile/delete`. Tirar esta folha daqui
 * arrastaria a pasta inteira, e a página de exclusão de conta mudaria de
 * endereço junto — o endereço que está registrado na Play Store.
 */
export default function ProfileRedirect() {
  permanentRedirect("/v2/profile");
}
