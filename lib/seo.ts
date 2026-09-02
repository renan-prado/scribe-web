/**
 * Constantes de SEO — fonte única para metadata, sitemap, robots e JSON-LD.
 *
 * Existe para que domínio, nome e descrição não sejam redigitados em cinco
 * arquivos: um `metadataBase` divergindo do `Sitemap:` do robots.txt é o tipo
 * de erro que só aparece semanas depois, num relatório do Search Console.
 */

import { IS_PRODUCTION_DEPLOY } from "@/lib/deploy";

export const SITE_URL = "https://scriba.cc";
export const SITE_NAME = "Scriba";

/**
 * Título e descrição — o par que o Google mostra no resultado de busca.
 *
 * Escritos com o vocabulário de quem PROCURA, não com o da marca. A LP falava
 * "Grave, entenda e viva o sermão": ótimo como promessa, invisível numa busca,
 * porque ninguém digita isso. "Transcrever sermão" e "estudo bíblico" são os
 * termos reais — e, até esta mudança, a única aparição da palavra
 * "transcrição" na página inteira era numa frase que a NEGAVA.
 *
 * Limites práticos antes do Google truncar: ~60 caracteres no título, ~155 na
 * descrição. Ambos abaixo respeitam isso — conferir ao editar.
 */
export const SITE_TITLE = "Scriba | Transcreva e organize sermões e estudos bíblicos";

export const SITE_DESCRIPTION =
  "Grave, transcreva e organize sermões, estudos bíblicos e mensagens da igreja. O Scriba reconhece os versículos citados e entrega um resumo pronto ao final.";

/**
 * Só o deploy de produção pode ser indexado.
 *
 * `dev.scriba.cc` é um Preview da Vercel com domínio fixo (ver docs/ambientes.md):
 * é HTML público, servido de um domínio próprio, e a Vercel NÃO manda
 * `X-Robots-Tag: noindex` nesse caso — verificado. Sem esta checagem, o
 * ambiente de desenvolvimento entra no índice competindo com scriba.cc por
 * conteúdo idêntico.
 */
export const IS_INDEXABLE = IS_PRODUCTION_DEPLOY;
