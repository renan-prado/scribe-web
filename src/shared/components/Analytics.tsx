import { GoogleAnalytics } from "@next/third-parties/google";
import { IS_PRODUCTION_DEPLOY } from "@/lib/deploy";
import { clientEnv } from "@/lib/env/client";

/**
 * Google Analytics 4 — só no deploy de produção.
 *
 * O snippet que o Google entrega (`<script async src=".../gtag/js">` mais um
 * inline com o `gtag('config', ...)`) funciona, mas entra no `<head>`
 * disputando banda e main thread com o CSS e o JS do próprio app. O
 * `GoogleAnalytics` do `@next/third-parties` emite os MESMOS dois scripts
 * através do `next/script` com a estratégia padrão `afterInteractive`: o gtag
 * só é buscado depois da hidratação, e o Next garante que ele entre UMA vez
 * mesmo com o layout re-renderizando entre navegações. Mesma medição, por um
 * caminho que não compete com o primeiro paint da landing page.
 *
 * **Duas condições, e as duas precisam valer.** `IS_PRODUCTION_DEPLOY` cuida
 * do ambiente e `NEXT_PUBLIC_GA_ID` cuida da configuração; qualquer uma que
 * falte devolve `null` e a página sai sem nenhum script do Google. Então:
 * `npm run dev`, `npm run prod` (dados reais, mas rodando de localhost) e
 * `dev.scriba.cc` (Preview da Vercel) NÃO medem nada, nem que alguém copie a
 * variável para o escopo errado do painel. Tráfego de teste misturado com o
 * número que se olha para decidir alguma coisa é pior do que não ter número.
 *
 * O outro lado da moeda: não dá para conferir a medição fora de produção. Para
 * validar uma tag nova, use o DebugView do GA4 contra `scriba.cc` depois do
 * deploy — ou troque esta condição temporariamente, sem commitar.
 *
 * **Não há código nosso de pageview.** O App Router navega por
 * `history.pushState`, e a medição aprimorada do GA4 ("alterações de página
 * com base em eventos do histórico do navegador", ligada por padrão) traduz
 * isso em `page_view`. Se um dia a contagem de páginas parar, confira essa
 * opção na propriedade antes de escrever um listener aqui.
 *
 * Para eventos personalizados, use `sendGAEvent` de `@next/third-parties/google`
 * dentro de um componente client — não chame `window.gtag` na mão.
 */
export function Analytics() {
  const gaId = clientEnv.NEXT_PUBLIC_GA_ID;

  if (!IS_PRODUCTION_DEPLOY || !gaId) return null;

  return <GoogleAnalytics gaId={gaId} />;
}
