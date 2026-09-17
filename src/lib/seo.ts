/**
 * Constantes de SEO, fonte única para metadata, sitemap, robots e JSON-LD.
 *
 * Existe para que domínio, nome e descrição não sejam redigitados em cinco
 * arquivos: um `metadataBase` divergindo do `Sitemap:` do robots.txt é o tipo
 * de erro que só aparece semanas depois, num relatório do Search Console.
 */

import { IS_PRODUCTION_DEPLOY } from "@/lib/deploy";

export const SITE_URL = "https://scriba.cc";
export const SITE_NAME = "Scriba";

/**
 * Título e descrição, o par que o Google mostra no resultado de busca.
 *
 * Escritos com o vocabulário de quem PROCURA, não com o da marca. A LP falava
 * "Grave, entenda e viva o sermão": ótimo como promessa, invisível numa busca,
 * porque ninguém digita isso. "Transcrever sermão" e "estudo bíblico" são os
 * termos reais, e, até esta mudança, a única aparição da palavra
 * "transcrição" na página inteira era numa frase que a NEGAVA.
 *
 * **O substantivo da frente é "bloco de notas", e isso é produto, não SEO.**
 * O Scriba deixou de ser um gravador que resume: a anotação pode ser gravada,
 * importada ou escrita à mão, e o Biblo conversa sobre ela. "Transcreva e
 * resuma sermões" descrevia o produto inteiro e hoje descreve uma das três
 * coisas que ele faz. Os termos de busca ("Bíblia", "pregação", "anotação")
 * continuam na frase, atrás da categoria nova — é ela que responde "que tipo
 * de coisa é isso?", que é a pergunta que um título tem de responder.
 *
 * Limites práticos antes do Google truncar: ~60 caracteres no título, ~155 na
 * descrição. Ambos abaixo respeitam isso, conferir ao editar.
 */
export const SITE_TITLE = "Scriba | Bloco de notas com IA para estudar a Bíblia";

export const SITE_DESCRIPTION =
  "Grave a pregação e receba a anotação pronta, escreva a sua ou importe de um vídeo, e converse sobre qualquer passagem da Bíblia com o Biblo.";

/**
 * Só o deploy de produção pode ser indexado.
 *
 * `dev.scriba.cc` é um Preview da Vercel com domínio fixo (ver docs/ambientes.md):
 * é HTML público, servido de um domínio próprio, e a Vercel NÃO manda
 * `X-Robots-Tag: noindex` nesse caso, verificado. Sem esta checagem, o
 * ambiente de desenvolvimento entra no índice competindo com scriba.cc por
 * conteúdo idêntico.
 */
export const IS_INDEXABLE = IS_PRODUCTION_DEPLOY;
