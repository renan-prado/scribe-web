import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

/**
 * A versão do `package.json`, lida no BUILD e embutida no bundle.
 *
 * É o carimbo de `llm_usage_events.app_version` e o filtro do `/admin/usage`.
 * Ela sai daqui, e não de uma variável de ambiente, porque variável de
 * ambiente é digitada: um número no painel da Vercel discordaria do
 * `package.json` no primeiro deploy em que alguém esquecesse de mexer nos
 * dois. Derivada, ela não tem como discordar.
 *
 * Se o arquivo não puder ser lido, o build QUEBRA, e é o certo: um build que
 * sobe sem saber a própria versão contamina a série inteira de medição com um
 * rótulo falso, e isso só apareceria semanas depois, ao comparar duas versões
 * que nunca existiram.
 */
const appVersion = (
  JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // microphone + autoplay needed for recording + silent-audio keepalive;
    // camera/geolocation blocked.
    value: "camera=(), microphone=(self), geolocation=(), autoplay=(self)",
  },
  {
    // HSTS. Vale para toda resposta (`/(.*)`), e não só as HTML: um navegador
    // que já viu este header em QUALQUER caminho passa a recusar http para o
    // domínio inteiro, o que fecha o downgrade http→https e o roubo de cookie
    // por man-in-the-middle na primeira requisição de uma sessão futura.
    //
    // Sobre http (o `next dev` em localhost) o header é IGNORADO pelo
    // navegador, HSTS só é honrado sobre https, então emiti-lo sempre não
    // tem efeito colateral em desenvolvimento.
    //
    // `includeSubDomains` é seguro AQUI e merece uma linha, porque
    // `dev.scriba.cc` é subdomínio de `scriba.cc` na mesma conta Vercel: os
    // dois são servidos SÓ sobre https pela plataforma, então forçar https no
    // subdomínio não quebra nada, quebraria se algum subdomínio precisasse
    // responder em http, e nenhum precisa.
    //
    // `preload` foi deixado DE FORA de propósito. Ele embute o domínio na lista
    // hardcoded dos navegadores, é uma porta de mão única (remover leva meses)
    // e exige inscrição em hstspreload.org, é uma decisão do dono do domínio,
    // não um default que esta auditoria deva tomar. Ligar depois é só
    // acrescentar `; preload` e submeter o domínio.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Remove o `X-Powered-By: Next.js` que o framework adiciona por padrão. Não é
  // vulnerabilidade, é impressão digital: anuncia o framework para quem
  // procura alvos por versão conhecida, sem nenhum ganho para quem usa o app.
  poweredByHeader: false,
  // Ver `lib/app-version.ts`: o único consumidor, e o lugar onde está escrito
  // por que este número não passa pelo schema Zod de env.
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
  images: {
    /**
     * A foto de perfil do Google, e só ela.
     *
     * `app/AGENTS.md` proíbe `<img>` apontando para host externo, e a proibição
     * continua valendo: sete avatares de 1024px vindos de fora custavam 724 KB
     * e ainda eram promovidos a `<link rel="preload">` pelo React 19,
     * disputando a banda inicial com o CSS. O que entra aqui NÃO é uma exceção
     * a essa regra, é o caminho que a respeita: com o `remotePattern`, o
     * `next/image` serve a imagem otimizada, redimensionada e a partir do NOSSO
     * domínio, com width/height conhecidos e sem CLS.
     *
     * Um host só, e fechado: `remotePatterns` frouxo (`**`) transforma
     * `/_next/image` num proxy de imagem aberto, que qualquer um usa para
     * lavar tráfego pela nossa conta.
     *
     * Quem consome: o selo "indicado por Fulano" no hero da landing page e na
     * tela de entrada. Sem foto, a tela desenha as iniciais, ver
     * `ReferrerAvatar`.
     */
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" }],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
