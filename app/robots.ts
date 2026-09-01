import type { MetadataRoute } from "next";
import { IS_INDEXABLE, SITE_URL } from "@/lib/seo";

/**
 * `app/robots.ts` no lugar de `public/robots.txt` (removido) por dois motivos.
 *
 * 1. O arquivo estático era o MESMO nos dois ambientes, então `dev.scriba.cc`
 *    anunciava `Allow: /` e apontava para o sitemap de produção. Aqui o
 *    ambiente decide: fora de produção sai `Disallow: /` e nenhum sitemap.
 * 2. O domínio deixa de ser texto solto — vem de `lib/seo.ts`, o mesmo que
 *    alimenta o `metadataBase` e o sitemap.
 *
 * O bloqueio é de RASTREIO, não de segurança: quem protege as rotas privadas é
 * o `proxy.ts`. Estas linhas só evitam gastar orçamento de rastreio em páginas
 * que respondem `307 → /sign-in`, e mantêm fora do índice as URLs de login com
 * `?next=`, que geram infinitas variantes do mesmo conteúdo.
 */
export default function robots(): MetadataRoute.Robots {
  if (!IS_INDEXABLE) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/auth/",
        "/sign-in",
        "/sign-up",
        "/feed",
        "/profile",
        "/list",
        "/studies",
        "/recording/",
        "/session/",
        "/billing/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
