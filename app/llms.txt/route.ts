import { LLMS_MARKDOWN } from "@/shared/content/llms";

/**
 * `/llms.txt` — o resumo do produto para agentes e buscadores de IA.
 *
 * Route handler, e não `public/llms.txt`, para o texto sair de um lugar só
 * (`src/shared/content/llms.ts`, compartilhado com `/index.md` e com a
 * negociação de conteúdo do `proxy.ts`). Fica FORA do gate do proxy pela
 * exceção `llms\.txt` no `matcher`.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(LLMS_MARKDOWN, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
