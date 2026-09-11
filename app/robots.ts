import type { MetadataRoute } from "next";
import { IS_INDEXABLE, SITE_URL } from "@/lib/seo";

/**
 * `app/robots.ts` no lugar de `public/robots.txt` (removido) por dois motivos.
 *
 * 1. O arquivo estático era o MESMO nos dois ambientes, então `dev.scriba.cc`
 *    anunciava `Allow: /` e apontava para o sitemap de produção. Aqui o
 *    ambiente decide: fora de produção sai `Disallow: /` e nenhum sitemap.
 * 2. O domínio deixa de ser texto solto: vem de `lib/seo.ts`, o mesmo que
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
      // "/profile/delete" é a única folha liberada dentro de uma área
      // bloqueada, e a regra mais específica é a que vale (o Google resolve
      // conflito pelo caminho mais longo). Ela é pública de verdade, ver a
      // nota em `proxy.ts`, e é a URL que as lojas de aplicativo pedem na
      // ficha: uma URL que o robots manda ignorar é uma URL que ninguém
      // encontra quando precisa dela.
      allow: ["/", "/profile/delete"],
      disallow: [
        "/api/",
        "/admin",
        "/auth/",
        "/sign-in",
        "/sign-up",
        // Não é página: é o desvio que marca o cookie de pré-parceiro e
        // redireciona para o login. Rastreá-la só gasta orçamento para chegar
        // numa tela que já é `noindex`, e a página que queremos indexada,
        // `/parceiros`, continua liberada.
        "/parceiros/entrar",
        "/feed",
        "/profile",
        "/recordings",
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
