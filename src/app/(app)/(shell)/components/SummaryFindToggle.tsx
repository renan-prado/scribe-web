"use client";

import { Search, X } from "lucide-react";
import { useSummaryFind } from "@/features/session/components/SummaryFind";
import { TOPBAR_CHIP_CLASS } from "./chip";

/**
 * A lupa do `/summary`, que procura DENTRO do resumo aberto.
 *
 * Ela mora aqui, e não junto do motor da busca (`features/session/components/
 * SummaryFind.tsx`), por uma razão de direção: `features/` nunca importa de
 * `app/`, e o desenho do chip é de `app/(app)/components/chip.ts`. O estado vem
 * do contexto lá de baixo, o vestido vem daqui, e cada camada continua
 * importando só para onde ela já importava.
 *
 * É o MESMO chip da `SearchToggle` da Biblioteca e do voltar (ver `chip.ts`), e
 * troca de glifo quando aberta, pela mesma razão: a lupa aberta e a fechada
 * seriam o mesmo botão dizendo a mesma coisa em dois estados, e quem abriu sem
 * querer não teria por onde desfazer.
 *
 * **O que ela faz mudou, o que ela parece não.** Nas outras telas a lupa é a
 * `LibrarySearchLink`, um link para o acervo; aqui é um botão que abre a barra
 * de busca do próprio texto. O glifo é o mesmo porque a pergunta é a mesma —
 * "onde está isso?" —, e o que muda é só o alcance dela, que é o texto em que
 * a pessoa já está.
 */
export function SummaryFindToggle() {
  const { open, toggle } = useSummaryFind();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? "Fechar a busca" : "Procurar neste resumo"}
      aria-expanded={open}
      className={TOPBAR_CHIP_CLASS}
    >
      {open ? (
        <X className="size-5" strokeWidth={1.75} />
      ) : (
        <Search className="size-5" strokeWidth={1.75} />
      )}
    </button>
  );
}
