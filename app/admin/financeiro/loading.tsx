/**
 * Esqueleto do segmento `/admin/financeiro` inteiro — ele cobre as seis telas,
 * porque um `loading.tsx` de segmento envolve as filhas também.
 *
 * As outras telas do painel não têm um, e esta tem por um motivo medido: a
 * visão geral faz seis leituras, e uma delas varre até 50 mil linhas de
 * `llm_usage_events` para montar o custo de IA mês a mês. Sem esqueleto, o
 * `PageTransition` segura a tela ANTERIOR durante esse tempo — e a leitura é
 * "o clique não funcionou", não "está carregando".
 *
 * O desenho copia a moldura real (cabeçalho, quatro KPIs, dois cartões) em vez
 * de uma barra genérica: um esqueleto com a forma do conteúdo não muda o
 * layout quando os dados chegam, e é a diferença entre a página assentar e a
 * página pular.
 */
export default function FinanceLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 rounded-lg bg-scriba-hairline" />
        <div className="h-4 w-80 max-w-full rounded-md bg-scriba-hairline-soft" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5"
          >
            <div className="h-4 w-24 rounded-full bg-scriba-hairline-soft" />
            <div className="h-7 w-32 rounded-lg bg-scriba-hairline" />
            <div className="h-3 w-40 max-w-full rounded-md bg-scriba-hairline-soft" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5"
          >
            <div className="h-4 w-32 rounded-md bg-scriba-hairline" />
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4">
                <div className="h-3 w-40 max-w-[60%] rounded-md bg-scriba-hairline-soft" />
                <div className="h-3 w-20 rounded-md bg-scriba-hairline-soft" />
              </div>
            ))}
          </div>
        ))}
      </div>

      <span className="sr-only">Carregando os dados financeiros…</span>
    </div>
  );
}
