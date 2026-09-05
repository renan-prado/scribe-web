import type { NextConfig } from "next";

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
    // navegador — HSTS só é honrado sobre https —, então emiti-lo sempre não
    // tem efeito colateral em desenvolvimento.
    //
    // `includeSubDomains` é seguro AQUI e merece uma linha, porque
    // `dev.scriba.cc` é subdomínio de `scriba.cc` na mesma conta Vercel: os
    // dois são servidos SÓ sobre https pela plataforma, então forçar https no
    // subdomínio não quebra nada — quebraria se algum subdomínio precisasse
    // responder em http, e nenhum precisa.
    //
    // `preload` foi deixado DE FORA de propósito. Ele embute o domínio na lista
    // hardcoded dos navegadores, é uma porta de mão única (remover leva meses)
    // e exige inscrição em hstspreload.org — é uma decisão do dono do domínio,
    // não um default que esta auditoria deva tomar. Ligar depois é só
    // acrescentar `; preload` e submeter o domínio.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Remove o `X-Powered-By: Next.js` que o framework adiciona por padrão. Não é
  // vulnerabilidade — é impressão digital: anuncia o framework para quem
  // procura alvos por versão conhecida, sem nenhum ganho para quem usa o app.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
