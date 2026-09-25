"use client";

import { createContext, type ReactNode, useContext } from "react";
import { DEFAULT_TRANSLATION, type TranslationId } from "@/lib/bibles/translations";

/**
 * A tradução PADRÃO de quem está lendo, disponível a toda tela logada.
 *
 * Ela desce do layout de `(shell)`, que já lê a conta inteira numa consulta só
 * — a preferência viaja na mesma linha de `profiles` que traz nome, saldo e
 * papel, então este contexto não custa consulta nenhuma.
 *
 * ## Por que contexto, e não prop
 *
 * Quem precisa da resposta está fundo na árvore e em lugares que não se
 * conhecem: o bloco de citação de um resumo, a leitura de capítulo do Biblo, o
 * diálogo de capítulo, a prévia do `PassagePicker`. Passar a preferência de
 * mão em mão obrigaria toda tela intermediária a carregar uma prop que não é
 * dela, e a primeira que esquecesse leria numa tradução diferente do resto da
 * página, sem erro nenhum.
 *
 * O padrão do contexto é o padrão do produto, então um componente montado fora
 * do provider (um mockup da landing, um teste) continua funcionando.
 */
const TranslationContext = createContext<TranslationId>(DEFAULT_TRANSLATION);

export function TranslationScope({
  translation,
  children,
}: {
  translation: TranslationId;
  children: ReactNode;
}) {
  return <TranslationContext value={translation}>{children}</TranslationContext>;
}

/** A tradução padrão de quem lê. Nunca nula: sem preferência, é a do produto. */
export function useDefaultTranslation(): TranslationId {
  return useContext(TranslationContext);
}

/**
 * A tradução que VALE para uma citação, na ordem em que o produto decide:
 * a escolha da própria citação primeiro, a preferência de quem lê depois.
 *
 * A ordem é essa porque a citação é do AUTOR do resumo e a preferência é de
 * quem está lendo: um texto escrito citando Almeida continua citando Almeida
 * na tela de quem prefere a Bíblia Livre, que é o que "esta passagem, nesta
 * tradução" quer dizer.
 */
export function useResolvedTranslation(blockTranslation?: TranslationId): TranslationId {
  const fallback = useDefaultTranslation();
  return blockTranslation ?? fallback;
}
