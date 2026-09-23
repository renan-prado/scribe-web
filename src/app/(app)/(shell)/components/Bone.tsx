/**
 * Um osso de esqueleto: um retângulo que cintila no lugar de um pedaço de
 * conteúdo que ainda não chegou.
 *
 * Existe para que os `loading.tsx` das telas de `(shell)` não repitam a mesma
 * linha de classes seis vezes — e, mais do que economia, para que o cintilar
 * seja o MESMO em todas elas: dois esqueletos com animações levemente
 * diferentes se leem como duas telas de produtos diferentes.
 *
 * **Ele nunca desenha a barra do topo.** A barra mora no layout de `(shell)` e
 * sobrevive à navegação: ela já está na tela, de verdade, enquanto o resto
 * carrega. Um osso por cima dela seria fingir que falta o que está ali — era
 * exatamente esse o piscar do cabeçalho que se via ao trocar de tela.
 */
export function Bone({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`animate-skeleton-shimmer rounded-md bg-scriba-hairline-soft ${className}`}
    />
  );
}
