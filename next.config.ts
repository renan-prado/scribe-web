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

/**
 * O host do projeto Supabase deste ambiente, para o `remotePatterns` das
 * imagens do léxico.
 *
 * Derivado, e não escrito: são dois projetos, um por arquivo de ambiente (ver
 * `docs/ambientes.md`), e um host fixo aqui deixaria as imagens quebradas em
 * metade dos ambientes sem dizer por quê. Se a variável faltar, o build QUEBRA,
 * pela mesma régua do `appVersion` acima: melhor parar aqui que descobrir numa
 * tela com o cartão sem foto.
 */
const supabaseHost = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
    (() => {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL ausente: o next.config precisa dela para as imagens do léxico"
      );
    })()
).hostname;

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
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      /**
       * A MINIATURA do vídeo que está sendo importado, na tela de espera do
       * `/importar/:id`.
       *
       * Mesmo argumento do avatar acima: a alternativa não era "nenhuma
       * imagem", era um `<img>` cru para host externo, que a regra proíbe. Por
       * aqui ela sai do nosso domínio, redimensionada, com width/height
       * conhecidos e sem CLS numa tela que fica minutos aberta.
       *
       * O caminho é FECHADO em `/vi/**`, que é onde ficam as miniaturas e mais
       * nada. A URL é derivada do id do vídeo (`youtubeThumbnailUrl`), não
       * vem de resposta de API nenhuma.
       */
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
      /**
       * A imagem do cartão do LÉXICO, no bucket público `lexicon`
       * (migração 0063).
       *
       * O host é DERIVADO de `NEXT_PUBLIC_SUPABASE_URL` em vez de escrito, pela
       * mesma razão da versão lá em cima: são dois projetos Supabase, um por
       * ambiente, e um host fixo aqui apontaria o dev para as imagens de
       * produção (ou o contrário) sem erro nenhum na tela — a imagem
       * simplesmente não carregaria naquele ambiente.
       *
       * O caminho é fechado no bucket: `/storage/v1/object/public/lexicon/**`.
       * Os outros buckets do projeto, se um dia houver, não passam por aqui.
       */
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/lexicon/**",
      },
    ],
    /**
     * O SVG do léxico (migração 0064): mapa, planta do templo, linha do tempo.
     *
     * O otimizador recusa SVG por padrão, e a recusa tem motivo: um `.svg` pode
     * conter `<script>`, e servido pelo NOSSO domínio (é isso que `/_next/image`
     * faz) ele rodaria na nossa origem, com acesso a cookie e sessão. A tranca
     * que torna a permissão aceitável é a CSP abaixo, aplicada pelo Next a toda
     * imagem que ele serve: sem script, e em sandbox.
     *
     * A outra metade da proteção não mora aqui: SVG só é inerte enquanto for
     * desenhado por `<img>`. Ver `LEXICON_IMAGE_TYPES` em `domain/lexicon.ts`.
     */
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  /**
   * Os endereços que o produto já teve.
   *
   * Todos são 308 (`permanent: true`): a mudança é definitiva, e o navegador e
   * o rastreador guardam a troca em vez de bater aqui de novo a cada visita.
   *
   * **Moram AQUI e não como `page.tsx` com `permanentRedirect`**, que era o
   * desenho anterior, por duas razões:
   *
   * 1. **Eles rodam ANTES do proxy.** Um anônimo que abre `/recordings` é
   *    redirecionado para `/home` e SÓ ENTÃO o gate do login age, então ele
   *    chega ao `/sign-in?next=/home` — o destino vivo. Como página, o gate via
   *    `/recordings` primeiro e guardava no `?next=` um caminho que só existe
   *    para ser abandonado (era a exceção documentada do `/list` no `proxy.ts`,
   *    e ela deixou de ser necessária).
   * 2. **Não renderizam nada.** Cada um era um arquivo com um comentário e uma
   *    linha de código; nove arquivos numa árvore de rotas que a gente estava
   *    justamente tentando enxugar.
   *
   * A query atravessa sozinha (o Next a preserva quando o destino não traz a
   * sua), e isso IMPORTA em dois deles: `?plan=` carrega a escolha feita na
   * landing page, e `?cs=` é o que permite reconciliar um pagamento cujo
   * webhook não chegou — uma sessão de Checkout aberta durante o deploy ainda
   * traz `/billing/retorno` gravado do lado do Stripe.
   */
  async redirects() {
    return [
      // A Biblioteca teve três nomes antes de virar `/home`.
      { source: "/feed", destination: "/home", permanent: true },
      { source: "/recordings", destination: "/home", permanent: true },
      { source: "/list", destination: "/home", permanent: true },
      // A cobrança saiu de `/billing/*`.
      { source: "/billing/assinar", destination: "/assinar", permanent: true },
      { source: "/billing/retorno", destination: "/retorno", permanent: true },
      // Tudo que pertencia a uma sessão morava sob `/recording/:id/`, mesmo o
      // que não era gravação. `/recording` hoje é o gravador, e mais nada.
      { source: "/recording/:id/summary", destination: "/summary/:id", permanent: true },
      { source: "/recording/:id/deepening", destination: "/studies/:id", permanent: true },
      { source: "/recording/:id/youtube", destination: "/importar/:id", permanent: true },
      // O nome mais antigo de todos.
      { source: "/session/:id", destination: "/summary/:id", permanent: true },
      // O painel passou de dezessete itens de menu para oito, e os recortes
      // viraram ABAS. Estes seis endereços eram telas; hoje são abas, e cada
      // redirect aponta para a aba que absorveu a tela. Eles existem porque o
      // painel é usado por marcador e por link colado: sem eles, um favorito
      // de `/admin/usage` responde 404, que se lê como "a funcionalidade
      // sumiu" e não como "mudou de endereço". A query sobrevive sozinha, o
      // que importa em `?sessionId=`, o parâmetro do inspetor de execuções.
      { source: "/admin/usage", destination: "/admin/custos?aba=rotas", permanent: true },
      { source: "/admin/precificacao", destination: "/admin/custos", permanent: true },
      { source: "/admin/insights", destination: "/admin", permanent: true },
      { source: "/admin/features", destination: "/admin/configuracoes", permanent: true },
      {
        source: "/admin/financeiro/compromissos",
        destination: "/admin/financeiro/lancamentos?visao=aberto",
        permanent: true,
      },
      {
        source: "/admin/financeiro/configuracoes",
        destination: "/admin/configuracoes?aba=financeiro",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
