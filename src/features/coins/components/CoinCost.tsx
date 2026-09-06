/**
 * Pastilha com o custo em moedas de uma ação — o hexágono cheio mais o número,
 * dimensionada para sentar DENTRO de um botão.
 *
 * `suffix` entra depois do número (ex.: "/min") para preços por minuto, de modo
 * que a mesma pastilha mostre custo fixo e custo por tempo.
 *
 * **Tudo aqui pinta com `currentColor`, e isso não é preguiça.** Era branco
 * cravado — `bg-white/18`, `text-white` e o hexágono `bg-white` —, escrito
 * quando o botão primário era sempre azul. Ele deixou de ser: `--scriba-cta`
 * INVERTE, e no tema escuro vira uma pastilha quase branca. O resultado era
 * branco sobre branco, com a moeda sumindo do botão "Gravar" e do "Gerar
 * estudo" — visível só no escuro, que é justamente onde ninguém repara ao
 * escrever o componente.
 *
 * Herdando a tinta, ela acompanha `--scriba-cta-ink` sozinha (branca sobre o
 * azul do claro, navy sobre a pastilha do escuro) e também acerta o estado
 * desabilitado, onde o botão troca a tinta para `--scriba-ink-mute` e o branco
 * ficava ilegível do mesmo jeito.
 *
 * Consequência para quem for usá-la em outro lugar: ela só funciona dentro de
 * um contêiner cuja `color` já contrasta com o fundo. Num botão é o caso; solta
 * numa superfície de papel ela sairia na cor do texto corrido.
 */
export function CoinCost({ count, suffix }: { count: number; suffix?: string }) {
  const label = suffix ? `Custa ${count} moedas ${suffix}` : `Custa ${count} moedas`;
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full bg-current/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums"
    >
      <span aria-hidden className="coin-hex block h-[10.25px] w-[9px] bg-current" />
      {count}
      {suffix ? <span className="font-medium opacity-80">{suffix}</span> : null}
    </span>
  );
}
