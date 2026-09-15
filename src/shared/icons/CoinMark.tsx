import { cn } from "@/lib/utils";

/**
 * A MOEDA: anel amarelo, campo de ouro escuro e o hexágono da marca no meio.
 * Usada onde é preciso dizer "isto é moeda" ao lado de um número — o item de
 * créditos do menu da conta, os KPIs do admin, os avisos de bônus.
 *
 * ## Por que ela é um SVG de um nó só
 *
 * Era um sanduíche de TRÊS `<span>` com aritmética em pixel no `style`: um
 * disco externo, um disco interno e o hexágono, cada um com uma fração
 * diferente do `size`. Isso quebrava de três jeitos, e os três apareceram em
 * produção:
 *
 * 1. **O disco interno era `bg-scriba-paper`**, ou seja, a moeda assumia a cor
 *    da superfície embaixo dela. Certo no cartão de papel, errado em qualquer
 *    outro lugar — no cartão de moedas do painel do parceiro (que é da família
 *    do ouro) e no menu da conta o miolo virava uma rodela de outra cor, e a
 *    moeda parecia recortada de outra tela.
 * 2. **O anel era `inset 0 0 0 2px` FIXO.** A 14px ele comia um sétimo do
 *    raio; a 30px virava um fio. A moeda não tinha uma proporção, tinha uma
 *    por tamanho.
 * 3. **O tamanho só entrava por `size`**, em número. Um `className` com
 *    `size-5` não fazia nada, e num flex sem `shrink-0` ela amassava — daí os
 *    `flex-none` espalhados pelas chamadas.
 *
 * Como SVG com `viewBox`, as três somem de uma vez: a proporção é do desenho e
 * não da conta, nada é pintado com a cor da superfície (o vão entre o hexágono
 * e o anel é o próprio campo da moeda), e o tamanho vem de onde quer que venha
 * — do `size`, de um utilitário no `className`, ou do `font-size` de quem a
 * contém, que é o padrão quando nenhum dos dois é passado.
 *
 * Decorativa sempre: o rótulo de acessibilidade vem do texto ao lado
 * ("Moedas", "Créditos e planos", "+50 moedas").
 */
export function CoinMark({ size, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      // Atributo, e não classe: assim um `size-*` no `className` continua
      // ganhando de um `size` numérico esquecido na chamada.
      width={size}
      height={size}
      aria-hidden
      role="presentation"
      className={cn(
        // `shrink-0` aqui dentro, e não em cada chamada: uma moeda amassada
        // num flex apertado era o bug mais repetido deste componente.
        // `align` é para quando ela é irmã de texto fora de um flex.
        "inline-block shrink-0 align-[-0.125em]",
        // Sem `size`, ela acompanha a letra de quem a contém.
        size === undefined && "size-[1em]",
        className
      )}
    >
      {/* O campo. Opaco de propósito: é ele que faz o vão em volta do
          hexágono, no lugar do disco que copiava a cor da superfície. */}
      <circle cx="12" cy="12" r="10.9" fill="var(--scriba-gold-track)" />
      {/* O anel. `r` + metade da espessura = 11,8, ou seja, ele para antes da
          borda do viewBox: encostado nela, o antialiasing corta o topo do
          círculo em alguns navegadores. */}
      <circle
        cx="12"
        cy="12"
        r="10.9"
        fill="none"
        stroke="var(--scriba-yellow)"
        strokeWidth="1.8"
      />
      {/* O hexágono da marca, nas mesmas proporções do `.coin-hex` de
          `globals.css` (razão 0,88 entre largura e altura, vértices a 25% e
          75% da altura). Os dois desenham a mesma coisa em lugares
          diferentes — se um mudar, o outro muda junto. */}
      <path
        d="M12 5.78 17.5 8.89 17.5 15.11 12 18.22 6.5 15.11 6.5 8.89Z"
        fill="var(--scriba-yellow)"
      />
    </svg>
  );
}
