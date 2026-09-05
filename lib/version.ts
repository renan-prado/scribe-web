import pkg from "../package.json";

/**
 * A versão do app, lida do `package.json` no BUILD.
 *
 * Não é `server-only` de propósito — o rodapé da landing a exibe. Mas o import
 * do JSON traz o arquivo inteiro para quem o empacota, então mantenha o consumo
 * em SERVER component (`LandingFooter` é um): puxá-la de dentro de um
 * `"use client"` colocaria a lista de dependências no bundle do navegador para
 * mostrar cinco caracteres.
 *
 * Não existe variável de ambiente para isto: a versão é propriedade do código
 * que está rodando, não do ambiente em que ele roda — um `NEXT_PUBLIC_VERSION`
 * no painel da Vercel seria mais um lugar para divergir do `package.json`.
 */
export const APP_VERSION: string = pkg.version;
