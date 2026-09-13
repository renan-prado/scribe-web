/**
 * O esqueleto da Biblioteca enquanto as três consultas do servidor voltam.
 *
 * Ele existe porque esta é a PRIMEIRA tela de toda sessão de uso, e é dinâmica:
 * sem ele, quem abre o app encara o fundo preto vazio até a lista chegar, e o
 * tempo de espera passa a parecer defeito. O desenho copia a anatomia do
 * cartão do v2 (linha do autor, título, local, resumo), não um retângulo
 * genérico: um esqueleto que não tem a forma do que vai chegar produz um pulo
 * de layout quando o conteúdo entra.
 *
 * A barra do topo NÃO é desenhada aqui. Ela também é dinâmica (lê perfil e
 * saldo), mas desenhá-la duas vezes, uma em osso e outra de verdade, faria o
 * cabeçalho piscar; deixá-la fora simplesmente adia o cabeçalho inteiro.
 */
export default function LibraryLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-4 pt-2 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2 px-1 py-3">
        <SB className="size-11 shrink-0 rounded-full" />
        <SB className="h-6 w-40" />
      </div>

      <section className="flex flex-col gap-3">
        <SB className="ml-1 h-4 w-24" />
        {[0, 1, 2].map((i) => (
          <div
            key={`card-${i}`}
            className="flex flex-col gap-3 rounded-3xl border border-scriba-hairline-soft p-5 sm:p-6"
          >
            <div className="flex items-center gap-2">
              <SB className="size-6 shrink-0 rounded-full" />
              <SB className="h-3.5 w-32" />
            </div>
            <SB className="h-5 w-4/5" />
            <SB className="h-3 w-40" />
            <SB className="mt-1 h-3.5 w-full" />
            <SB className="h-3.5 w-2/3" />
            <div className="mt-3 border-t border-scriba-hairline pt-3">
              <SB className="ml-auto h-7 w-32 rounded-full" />
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function SB({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`animate-skeleton-shimmer rounded-md bg-scriba-hairline-soft ${className}`}
    />
  );
}
