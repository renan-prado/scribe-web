"use client";

import { WriteGlyph } from "@/components/icons/WriteGlyph";
import { LinkPendingSwap, NavLink } from "@/components/NavLink";

/**
 * O corpo de uma sessão salva que não tem resumo nenhum: um texto escrito à mão
 * em que ninguém escreveu nada, ou uma gravação que não produziu nem resumo nem
 * transcrição.
 *
 * Era a linha "O resumo aparecerá aqui.", e o futuro que ela promete não vem:
 * este ramo só desenha sessão já salva e PARADA (quem espera resumo chegando é
 * o esqueleto, um ramo acima, ver `SummaryView`).
 *
 * **É só o botão.** Sem resumo o cabeçalho não mostra nem o "Editar" nem o
 * "Gerar novamente", então a tela ficava sem uma única porta; o que falta ali é
 * a PORTA, não um aviso de que está vazio, que a tela vazia já diz sozinha.
 * Apagar continua no menu de três pontinhos, onde moram as ações raras.
 *
 * Sem `sessionId` (o `/admin` também monta o `SummaryView`) não há para onde
 * mandar ninguém, e o ramo não desenha nada.
 */
export function SummaryEmptyState({ sessionId }: { sessionId?: string }) {
  if (!sessionId) return null;

  return (
    <div className="flex justify-center py-12">
      {/* `prefetchOnPress` pela mesma razão do "Editar" do cabeçalho: o editor é
          um pedaço grande de JavaScript, e um toque sem resposta nenhuma até a
          tela trocar é como um clique vira três. Ver `NavLink`. */}
      <NavLink
        href={`/summary/${sessionId}/edit`}
        prefetchOnPress
        spinner="none"
        contentClassName="inline-flex items-center gap-1.5"
        className="scriba-cta inline-flex h-9 items-center justify-center rounded-full bg-[image:var(--scriba-cta)] px-5 text-[13px] font-semibold text-scriba-cta-ink shadow-[0_8px_20px_var(--scriba-cta-shadow)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <LinkPendingSwap className="size-3.5">
          <WriteGlyph className="size-3.5" />
        </LinkPendingSwap>
        Escrever alguma coisa
      </NavLink>
    </div>
  );
}
