"use client";

import { WriteGlyph } from "@/components/icons/WriteGlyph";
import { LinkPendingSwap, NavLink } from "@/components/NavLink";

/**
 * O corpo de uma sessão salva que não tem resumo nenhum. São DOIS casos, e a
 * diferença entre eles é a TRANSCRIÇÃO:
 *
 * 1. **Sem transcrição** (um texto escrito à mão em que ninguém escreveu nada,
 *    ou uma gravação que não produziu nem resumo nem transcrição): não há de
 *    onde tirar resumo, e a única porta é escrever.
 * 2. **COM transcrição**: a pregação está inteira no slide ao lado e só o
 *    resumo falhou. A porta é tentar o resumo de novo a partir dela, que é a
 *    mesma chamada do "Gerar novamente" do menu.
 *
 * O segundo caso não tinha tela: ele caía no ESQUELETO do `SummaryView`
 * (`running || hasTranscript`), e como a tela de uma sessão salva nunca está
 * `running`, aquele esqueleto nunca resolvia. Quem importou um vídeo e viu o
 * resumo falhar ficava olhando linhas cinzas pulsando para sempre, com as
 * moedas já gastas, sem uma frase dizendo o que houve. Ver o cabeçalho de
 * `server/final-summary.ts` para o caso que revelou isso.
 *
 * Era a linha "O resumo aparecerá aqui.", e o futuro que ela promete não vem:
 * este ramo só desenha sessão já salva e PARADA (quem espera resumo chegando é
 * o esqueleto, um ramo acima, ver `SummaryView`).
 *
 * **No caso 1 é só o botão.** Sem resumo o cabeçalho não mostra o "Editar",
 * então a tela ficava sem uma única porta; o que falta ali é a PORTA, não um
 * aviso de que está vazio, que a tela vazia já diz sozinha. Apagar continua no
 * menu de três pontinhos, onde moram as ações raras.
 *
 * Sem `sessionId` (o `/admin` também monta o `SummaryView`) não há para onde
 * mandar ninguém, e o ramo não desenha nada.
 */
export function SummaryEmptyState({
  sessionId,
  hasTranscript = false,
  onGenerate,
  generating = false,
}: {
  sessionId?: string;
  /** Há pregação salva de onde tirar um resumo? Ver o caso 2 acima. */
  hasTranscript?: boolean;
  /**
   * Refazer o resumo a partir da transcrição. É o `handleReprocess` do
   * `SavedSessionView`, o MESMO do "Gerar novamente": duas chamadas da mesma
   * rota divergiriam no primeiro ajuste do diálogo de espera ou do toast de
   * saldo. Ausente no `/admin`, que só lê.
   */
  onGenerate?: () => void;
  generating?: boolean;
}) {
  if (!sessionId) return null;

  if (hasTranscript) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-[15px] font-medium text-scriba-ink">O resumo não saiu desta vez</p>
        <p className="max-w-sm text-[13px] leading-relaxed text-scriba-ink-mute">
          A pregação foi transcrita e está salva, no slide ao lado. Dá para tentar o resumo de novo
          a partir dela.
        </p>
        {onGenerate ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="scriba-cta mt-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[image:var(--scriba-cta)] px-5 text-[13px] font-semibold text-scriba-cta-ink shadow-[0_8px_20px_var(--scriba-cta-shadow)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
          >
            {generating ? "Gerando…" : "Gerar o resumo"}
          </button>
        ) : null}
      </div>
    );
  }

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
