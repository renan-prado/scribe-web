import { z } from "zod";

/**
 * O vocabulário do LÉXICO: os nomes que o resumo marca e o cartão de cada um.
 *
 * **Este arquivo já foi o léxico inteiro.** Ele era um array de ~330 strings
 * (`BIBLE_PEOPLE`, `BIBLE_PLACES`, `CITED_FIGURES`) compilado no bundle e
 * varrido pelo anotador a cada parágrafo. Hoje as strings moram em
 * `lexicon_entries` (migração 0063), cadastradas pelo admin, e o que ficou aqui
 * é o contrato: os tipos que o cliente e o servidor precisam falar igual.
 *
 * Client-safe, e precisa ser: o anotador roda no render, e `RichText` é
 * `"use client"`.
 *
 * ## As três formas de uma entrada, e por que não é uma só
 *
 * | tipo | quem recebe | o que carrega |
 * |---|---|---|
 * | `LexiconIndexEntry` | TODA tela que desenha prosa | o mínimo para RECONHECER: termo, apelidos, slug |
 * | `LexiconCard` | quem TOCOU num nome | título, descrição, imagem |
 * | `AdminLexiconEntry` | o painel | tudo, inclusive o rascunho |
 *
 * A separação entre as duas primeiras é a decisão de desempenho da feature. O
 * índice desce junto com a página, então ele paga o peso dele em toda leitura
 * de resumo; o cartão é buscado no toque, como o `ChapterDialog` busca o texto
 * da NVI. Juntá-los faria cada abertura de resumo baixar 300 descrições e 300
 * URLs de imagem para mostrar zero delas.
 */

/**
 * De quanto em quanto tempo o índice de nomes é reconferido.
 *
 * **Um número só para os dois lados**, e é ele que torna verdadeira a promessa
 * "no máximo um minuto entre publicar uma entrada e ela acender na tela": o
 * servidor guarda o índice em memória por este prazo (`getLexiconIndex`), e o
 * cliente o reconfere por ele a cada navegação (`LexiconProvider`). Com dois
 * números, o maior manda e o outro vira decoração.
 */
export const LEXICON_INDEX_STALE_MS = 60_000;

export const LEXICON_CATEGORIES = ["person", "place", "figure"] as const;

export type LexiconCategory = (typeof LEXICON_CATEGORIES)[number];

/**
 * O que a categoria diz na tela. Ela aparece no cartão e no filtro do painel, e
 * **não aparece na tinta da marcação**: três cores de faixa num parágrafo
 * produzem uma página de arco-íris, que é o oposto do que o realce existe para
 * fazer. Ver o cabeçalho de `RichText`.
 */
export const LEXICON_CATEGORY_LABEL: Record<LexiconCategory, string> = {
  person: "Personagem bíblico",
  place: "Lugar bíblico",
  figure: "Autor citado",
};

/** O plural, para os títulos de seção e os filtros do painel. */
export const LEXICON_CATEGORY_PLURAL: Record<LexiconCategory, string> = {
  person: "Personagens",
  place: "Lugares",
  figure: "Autores citados",
};

/**
 * O que o anotador precisa para achar um nome num parágrafo, e nada além.
 *
 * `term` e `aliases` viram alternativas da mesma regex; as duas levam ao mesmo
 * `slug`, porque são o mesmo nome escrito de dois jeitos ("Martinho Lutero" e
 * "Lutero").
 */
export type LexiconIndexEntry = {
  slug: string;
  term: string;
  aliases: string[];
  category: LexiconCategory;
};

/** O cartão que abre no toque. */
export type LexiconCard = {
  slug: string;
  term: string;
  category: LexiconCategory;
  title: string;
  description: string;
  /** URL pública do bucket, já montada pelo servidor. `null` = cartão sem foto. */
  imageUrl: string | null;
};

/** A linha como o painel a vê: o cartão mais o que só o admin enxerga. */
export type AdminLexiconEntry = {
  id: string;
  slug: string;
  term: string;
  aliases: string[];
  category: LexiconCategory;
  title: string;
  description: string;
  imagePath: string | null;
  imageUrl: string | null;
  published: boolean;
  updatedAt: string;
};

/**
 * Os tetos, espelhando os CHECK da migração 0063.
 *
 * Eles existem nos dois lugares pela mesma razão de sempre neste repositório: o
 * Zod produz MENSAGEM, o banco produz GARANTIA. Mexer num sem mexer no outro
 * troca um aviso no formulário por um 500 na rota.
 */
export const LEXICON_LIMITS = {
  term: 80,
  title: 120,
  description: 2000,
  aliases: 12,
  /** 2 MB, o `file_size_limit` do bucket. */
  imageBytes: 2 * 1024 * 1024,
} as const;

/**
 * Os formatos aceitos, espelhando `allowed_mime_types` do bucket (0063 + 0064).
 *
 * **O SVG está aqui por causa dos LUGARES.** Mapa, rota do êxodo, planta do
 * templo e linha do tempo são desenho, não fotografia: em PNG borram no zoom e
 * pesam dez vezes mais. O que torna seguro aceitá-lo está escrito no cabeçalho
 * da migração 0064, e a perna do banquinho que mora no CÓDIGO é esta: a imagem
 * do cartão se desenha com `<img>` (ou o `next/image` por cima dele), nunca com
 * `<object>`, `<iframe>` ou `<embed>`, que são os que executam script de SVG.
 */
/**
 * Teto do recado de "Algo está errado", espelhando o CHECK da migração 0066.
 *
 * Pequeno de propósito: é um recado ("a data está errada", "esse não é o
 * Timóteo certo"), e o que não couber aqui é uma conversa, não um campo maior.
 */
export const LEXICON_REPORT_MAX_CHARS = 600;

export const LexiconReportInputSchema = z.object({
  slug: z.string().min(1).max(64),
  note: z.string().trim().min(3).max(LEXICON_REPORT_MAX_CHARS),
});

export type LexiconReportInput = z.infer<typeof LexiconReportInputSchema>;

/** Um alerta, como o painel o lê. */
export type AdminLexiconReport = {
  id: string;
  slug: string;
  note: string;
  resolved: boolean;
  createdAt: string;
  /** Quem alertou, para o painel poder responder. `null` = conta apagada. */
  userEmail: string | null;
};

export const LEXICON_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
] as const;

/** A extensão que cada tipo ganha no bucket. */
export const LEXICON_IMAGE_EXTENSION: Record<(typeof LEXICON_IMAGE_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/**
 * O termo vira slug: sem acento, minúsculo, hífen no lugar do resto.
 *
 * `ø` e `Ø` entram à mão porque a decomposição NFD não os separa em letra mais
 * acento — eles são uma letra própria do alfabeto nórdico, e sem esta linha
 * "Søren Kierkegaard" viraria `s-ren-kierkegaard`. É o único caractere do
 * léxico atual com esse comportamento, e a linha custa menos que a surpresa.
 */
export function slugifyTerm(term: string): string {
  return term
    .replace(/ø/g, "o")
    .replace(/Ø/g, "O")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // os acentos, agora soltos pelo NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

const TermSchema = z.string().trim().min(2).max(LEXICON_LIMITS.term);

/**
 * O que o painel manda ao salvar uma entrada.
 *
 * **`published` não é aceito aqui**, e essa ausência é a regra da feature
 * escrita no schema: publicar é o que faz um nome ser marcado no texto de todo
 * mundo, e isso não pode ser efeito colateral de salvar um rascunho. A rota
 * tem uma ação `publish` própria, que confere se há o que publicar.
 */
export const LexiconEntryInputSchema = z.object({
  term: TermSchema,
  /**
   * Apelidos: as outras formas do mesmo nome. Vazios são descartados e
   * duplicatas somem, porque uma alternativa repetida na regex é trabalho pago
   * duas vezes pelo mesmo casamento.
   */
  aliases: z
    .array(z.string())
    .max(LEXICON_LIMITS.aliases)
    .default([])
    .transform((list) => [...new Set(list.map((a) => a.trim()).filter((a) => a.length >= 2))]),
  category: z.enum(LEXICON_CATEGORIES),
  title: z.string().trim().max(LEXICON_LIMITS.title).default(""),
  description: z.string().trim().max(LEXICON_LIMITS.description).default(""),
});

export type LexiconEntryInput = z.infer<typeof LexiconEntryInputSchema>;

/**
 * Uma entrada está pronta para acender?
 *
 * Título e descrição, os dois. A imagem é opcional de propósito: um cartão com
 * texto e sem foto responde a pergunta que o toque fez; um cartão com foto e
 * sem texto é uma imagem sem legenda no meio de um sermão.
 *
 * Mora aqui, e não na rota, porque as duas pontas precisam da MESMA resposta: o
 * painel para acender o botão, a rota para recusar o pedido. Duas
 * implementações discordariam no dia em que uma das duas ganhasse um campo.
 */
export function canPublishLexiconEntry(entry: { title: string; description: string }): boolean {
  return entry.title.trim().length > 0 && entry.description.trim().length > 0;
}
