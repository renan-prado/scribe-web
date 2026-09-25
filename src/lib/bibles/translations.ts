/**
 * QUAIS traduções existem, e o que a licença de cada uma permite.
 *
 * Este módulo é CLIENT-SAFE de propósito: a sigla e o crédito aparecem na
 * TELA, ao lado da referência, e a regra da raiz é clara — número ou texto que
 * a pessoa lê mora num módulo que o cliente pode importar. Quem lê o disco é o
 * `loader.ts`, que importa daqui e não o contrário.
 *
 * ## A licença não é metadado, é o que decide o que vai para a tela
 *
 * As duas do registro podem ser redistribuídas, e é por isso que são as duas
 * do registro. **A NVI saiu daqui**: ela foi a única tradução do produto por
 * muito tempo e é proprietária, então mostrá-la num resumo compartilhado, num
 * export ou numa página pública é redistribuir texto que não temos licença
 * para redistribuir. Não ficou como opção trancada porque uma opção trancada
 * é uma opção que alguém destranca; o `NVI.json` que sobrou no disco não tem
 * como ser lido por caminho nenhum do código.
 *
 * `credit` é obrigação de licença, não cortesia. A BLIVRE é CC BY 3.0 Brasil:
 * uso livre, inclusive comercial, com menção obrigatória onde o texto aparece.
 * Os próprios autores dizem que em espaço curto (slide, cartão, tweet) a SIGLA
 * basta, e é isso que a pastilha ao lado da referência faz. O crédito inteiro
 * aparece no /profile, onde há linha para ele.
 *
 * **É 3.0 e não 4.0**, embora a ficha da eBible diga 4.0: a URL que ela imprime
 * (`creativecommons.org/licenses/by/4.0/br/`) não existe, porque a CC BY 4.0
 * nunca foi portada para jurisdição nenhuma — "br" só existe na 3.0. O texto
 * abaixo é o dos próprios autores, e é ele que vale.
 *
 * A ALM1911 é domínio público por idade (edição de 1900, reimpressão de 1911),
 * então `credit` é nulo: não há a quem creditar, e inventar um crédito para uma
 * obra em domínio público é pior que não ter nenhum.
 */

export const TRANSLATION_IDS = ["BLIVRE", "ALM1911"] as const;

export type TranslationId = (typeof TRANSLATION_IDS)[number];

export type TranslationInfo = {
  id: TranslationId;
  /** O nome inteiro, para o seletor e para a linha de preferência. */
  name: string;
  /** A sigla da pastilha. Curta porque ela divide espaço com a referência. */
  short: string;
  /** O ano da EDIÇÃO que está no disco, não o da tradução original. */
  year: number;
  /** Uma linha sobre o que se ganha e o que se perde escolhendo esta. */
  hint: string;
  license: "public-domain" | "cc-by" | "proprietary";
  /**
   * A menção exigida pela licença, POR EXTENSO, ou `null` quando não há
   * nenhuma. É o que aparece abaixo do texto bíblico onde ele é LIDO (o
   * seletor de passagem, a Bíblia da lateral) e na preferência do /profile.
   *
   * Onde não cabe um parágrafo — a pastilha de uma citação no meio do resumo —
   * quem faz o papel dele é a SIGLA (`short`), que é o que os próprios autores
   * dizem bastar em espaço curto.
   */
  credit: string | null;
  /** Se a pessoa pode ESCOLHER esta tradução. Hoje, as duas do registro. */
  selectable: boolean;
};

export const TRANSLATIONS: Record<TranslationId, TranslationInfo> = {
  BLIVRE: {
    id: "BLIVRE",
    name: "Bíblia Livre",
    short: "BLIVRE",
    year: 2018,
    // O texto é ESTE, escrito pelo usuário, e a descrição já carrega o crédito
    // de propósito: onde a tradução é apresentada, ela é apresentada creditada.
    // A DATA faz parte dele, porque a Bíblia Livre é revisada e creditar sem
    // data credita uma edição que pode não ser a que está no disco. Ao trocar
    // o JSON por uma revisão nova, esta linha muda junto.
    hint: "Tradução com português moderno. Bíblia Livre (BLIVRE/2018), Copyright © Diego Santos, Mario Sérgio, e Marco Teles.",
    license: "cc-by",
    credit:
      "Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio, e Marco Teles, http://sites.google.com/site/biblialivre/ - fevereiro de 2018. Licença Creative Commons Atribuição 3.0 Brasil (http://creativecommons.org/licenses/by/3.0/br/). Reprodução permitida desde que devidamente mencionados fonte e autores.",
    selectable: true,
  },
  ALM1911: {
    id: "ALM1911",
    name: "Almeida 1911",
    short: "ALM 1911",
    year: 1911,
    hint: "Português antigo, escrito em 1911. Citações livres de direitos autorais.",
    license: "public-domain",
    credit: null,
    selectable: true,
  },
};

/**
 * A tradução de quem nunca escolheu nada, e é a BLIVRE por LICENÇA antes de
 * por gosto: ela é a única das três que junta português de hoje com permissão
 * de redistribuir. A ALM1911 tem a permissão e cobra a ortografia de 1911; a
 * NVI tem o português e não tem a permissão.
 */
export const DEFAULT_TRANSLATION: TranslationId = "BLIVRE";

/** As que aparecem no seletor, na ordem em que aparecem. */
export const SELECTABLE_TRANSLATIONS: TranslationInfo[] = TRANSLATION_IDS.map(
  (id) => TRANSLATIONS[id]
).filter((t) => t.selectable);

/**
 * Um `id` vindo de fora (corpo de requisição, coluna do banco, bloco antigo do
 * jsonb) virando `TranslationId`, ou o padrão.
 *
 * Cai no padrão em silêncio, e isso é escolha: o que chega aqui errado é quase
 * sempre uma linha gravada antes desta funcionalidade existir — "NVI" é o caso
 * garantido —, e recusar a leitura do versículo por causa disso trocaria um
 * texto certo por um buraco na tela.
 */
export function parseTranslation(raw: unknown): TranslationId {
  if (typeof raw !== "string") return DEFAULT_TRANSLATION;
  const found = TRANSLATION_IDS.find((id) => id === raw);
  if (!found) return DEFAULT_TRANSLATION;
  return TRANSLATIONS[found].selectable ? found : DEFAULT_TRANSLATION;
}

/** A sigla para a pastilha, sem passar pelo objeto inteiro na chamada. */
export function translationShort(id: TranslationId): string {
  return TRANSLATIONS[id].short;
}
