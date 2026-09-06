import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Só entra aqui URL que responde 200 e é indexável.
 *
 * `/sign-up` saiu porque é um `redirect("/sign-in")` — sitemap apontando para
 * redirect vira "Página com redirecionamento" no Search Console, e nenhuma das
 * duas indexa. `/sign-in` saiu porque é tela de login: não tem conteúdo para
 * ranquear e o `?next=` multiplica variantes da mesma página. Ambas seguem
 * rastreáveis (só não são candidatas a índice) — ver `app/robots.ts`.
 *
 * O resto do app (/feed, /list, /studies, /recording/*, /billing/*) está atrás
 * do `proxy.ts`: para um rastreador aquilo é `307 → /sign-in`, então listar
 * qualquer uma delas seria pedir um erro de cobertura.
 */

/** Data das páginas legais — bate com o "Última atualização" renderizado nelas.
 * Fixa de propósito: `new Date()` marcaria cada deploy como alteração de
 * conteúdo em documento que não mudou, e o Google aprende a ignorar o campo. */
const LEGAL_LAST_MODIFIED = new Date("2026-08-28");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: LEGAL_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: LEGAL_LAST_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: LEGAL_LAST_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: LEGAL_LAST_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
