import { LLMS_MARKDOWN } from "@/shared/content/llms";

/**
 * `/index.md` — a landing page em Markdown.
 *
 * Dois consumidores: um agente que busca a URL direto, e o `proxy.ts`, que
 * reescreve `GET /` para cá quando o `Accept` do request prefere
 * `text/markdown` (negociação de conteúdo — acceptmarkdown.com). O `Vary:
 * Accept` acompanha a resposta para caches e validadores que inspecionam o
 * header. O conteúdo é o mesmo de `/llms.txt`.
 *
 * Fica fora do gate do proxy pela exceção `.*\.md$` no `matcher`.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(LLMS_MARKDOWN, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      vary: "Accept",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
