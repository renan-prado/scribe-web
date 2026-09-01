/**
 * Constantes de SEO — fonte única para metadata, sitemap, robots e JSON-LD.
 *
 * Existe para que domínio, nome e descrição não sejam redigitados em cinco
 * arquivos: um `metadataBase` divergindo do `Sitemap:` do robots.txt é o tipo
 * de erro que só aparece semanas depois, num relatório do Search Console.
 */

export const SITE_URL = "https://scriba.cc";
export const SITE_NAME = "Scriba";

export const SITE_DESCRIPTION =
  "Scriba transcreve e resume sermões em tempo real com IA — citações bíblicas detectadas automaticamente, destaques do pregador e resumo estruturado ao final.";

/**
 * Só o deploy de produção pode ser indexado.
 *
 * `dev.scriba.cc` é um Preview da Vercel com domínio fixo (ver docs/ambientes.md):
 * é HTML público, servido de um domínio próprio, e a Vercel NÃO manda
 * `X-Robots-Tag: noindex` nesse caso — verificado. Sem esta checagem, o
 * ambiente de desenvolvimento entra no índice competindo com scriba.cc por
 * conteúdo idêntico.
 */
export const IS_INDEXABLE = process.env.VERCEL_ENV === "production";
