/**
 * As partículas que sobem atrás do hero da landing.
 *
 * ## Por que é CSS e server component
 *
 * Zero JavaScript: são `<span>` com `animation` declarada, renderizados no
 * servidor. A LP é a única página que todo visitante anônimo carrega, e um
 * campo de partículas em canvas ou em `requestAnimationFrame` seria bundle e
 * trabalho de CPU na primeira dobra, pelo efeito mais dispensável dela.
 *
 * ## Por que as posições são uma LISTA e não um `Math.random()`
 *
 * Um sorteio no corpo do componente dá valores diferentes no HTML do servidor
 * e no primeiro render do cliente. Numa página estática isso é pior do que
 * parece: o HTML é gerado uma vez no build e servido da CDN, então o "sorteio"
 * ficaria congelado para sempre naquele resultado — com o custo de um
 * hydration mismatch se algum dia esta página virar cliente. A lista é o mesmo
 * resultado, explícito e revisável.
 *
 * **Elas evitam o miolo de propósito.** No desktop o texto do hero mora numa
 * coluna de 780px centrada, e o que sobra dos lados é onde o efeito tem espaço
 * para existir: partícula atravessando a frase é ruído atrás de texto, que é o
 * lugar em que ruído mais atrapalha. Daí as duas faixas laterais
 * (`hidden lg:block`) serem as mais povoadas, e o miolo levar só quatro pontos
 * pequenos, que passam longe da largura do título.
 *
 * ## As três camadas
 *
 * `size` decide também a velocidade: ponto grande sobe mais rápido e brilha
 * mais (está "perto"), ponto pequeno sobe devagar e apagado (está "longe").
 * São os três `--animate-lp-particle-*` do `globals.css`, e é o que dá
 * profundidade sem uma animação por partícula.
 *
 * `prefers-reduced-motion` já é respeitado pelo bloco que existe no
 * `globals.css` — ele zera `animation` no documento inteiro. Uma partícula
 * PARADA no meio do gradiente é um pontinho inerte, invisível na prática, e
 * foi por isso que não ganhou um `hidden` próprio: o `aria-hidden` do
 * invólucro já a tira da árvore de acessibilidade.
 */

type Particle = {
  /** % da largura do invólucro. */
  left: number;
  /** Diâmetro em px. Decide a camada: 1–2 é longe, 3–4 é perto. */
  size: number;
  /** Segundos de atraso. É o que espalha as partículas na vertical: com 0 em
   *  todas, o campo inteiro começa junto e sobe em formação. */
  delay: number;
  /** Deriva lateral no percurso, em px. Negativo vai para a esquerda. */
  drift: number;
  /** Onde ela vive: `side` é fora da coluna de texto (só no desktop). */
  band: "left" | "right" | "center";
};

/**
 * Vinte e quatro partículas, e o número é o teto de custo aceito aqui: cada
 * uma é uma camada de composição animando sem parar na primeira dobra. Vinte
 * nas duas faixas laterais, que só existem do `lg` para cima, e quatro no
 * miolo, que é o que o celular vê.
 *
 * **A distribuição não é uniforme, e a lista é longa por isso.** Dez pontos
 * espaçados regularmente numa faixa de 250px leem como uma régua; o que
 * convence é aglomerado com vão — daí três pontos entre 10% e 22% e nada entre
 * 44% e 58%. Ao acrescentar uma partícula, olhe onde as vizinhas estão antes
 * de escolher o `left`.
 *
 * Os `delay` são negativos para que o campo já esteja EM MOVIMENTO no primeiro
 * quadro: com atraso positivo, quem abre a página vê uma faixa vazia enchendo
 * de baixo para cima nos primeiros vinte segundos. Eles também são o que
 * espalha as partículas na VERTICAL, então dois valores próximos numa mesma
 * faixa põem dois pontos na mesma altura.
 */
const PARTICLES: Particle[] = [
  // Faixa esquerda
  { left: 12, size: 3, delay: -2, drift: 14, band: "left" },
  { left: 19, size: 2, delay: -23, drift: -8, band: "left" },
  { left: 34, size: 2, delay: -9, drift: -10, band: "left" },
  { left: 58, size: 4, delay: -15, drift: 8, band: "left" },
  { left: 66, size: 2, delay: -25, drift: 12, band: "left" },
  { left: 72, size: 3, delay: -5, drift: -16, band: "left" },
  { left: 22, size: 2, delay: -18, drift: 6, band: "left" },
  { left: 88, size: 3, delay: -12, drift: -6, band: "left" },
  { left: 45, size: 1, delay: -7, drift: 10, band: "left" },
  { left: 81, size: 2, delay: -21, drift: -12, band: "left" },
  // Faixa direita
  { left: 18, size: 3, delay: -7, drift: -12, band: "right" },
  { left: 24, size: 2, delay: -20, drift: 8, band: "right" },
  { left: 41, size: 4, delay: -18, drift: 10, band: "right" },
  { left: 63, size: 2, delay: -3, drift: -8, band: "right" },
  { left: 79, size: 3, delay: -24, drift: 16, band: "right" },
  { left: 28, size: 3, delay: -11, drift: 4, band: "right" },
  { left: 92, size: 2, delay: -16, drift: -14, band: "right" },
  { left: 55, size: 1, delay: -13, drift: 6, band: "right" },
  { left: 71, size: 2, delay: -6, drift: -10, band: "right" },
  { left: 35, size: 2, delay: -26, drift: 14, band: "right" },
  // O miolo: poucas e pequenas, longe da largura do título
  { left: 6, size: 2, delay: -8, drift: 10, band: "center" },
  { left: 94, size: 2, delay: -19, drift: -10, band: "center" },
  { left: 16, size: 1, delay: -13, drift: 6, band: "center" },
  { left: 84, size: 2, delay: -4, drift: -6, band: "center" },
];

/**
 * O diâmetro escolhe a camada, e com ela a velocidade e o brilho.
 *
 * Os picos foram de 0,28–0,5 para estes: na primeira calibragem o campo era
 * quase subliminar — as partículas existiam na tela e ninguém as via, o que é o
 * pior lugar para um efeito parar, porque custa o mesmo e não entrega nada.
 *
 * **O teto é o texto.** Acima de ~0,7 o ponto começa a competir com a frase
 * que está na frente dele, e é isso que decide o valor, não a estética do
 * fundo sozinho. O degradê do hero clareia para o topo (`--lp-hero`), então
 * confira no ALTO da dobra, que é onde o contraste é menor.
 */
const LAYER = {
  1: { animation: "var(--animate-lp-particle-slow)", peak: 0.34 },
  2: { animation: "var(--animate-lp-particle-slow)", peak: 0.48 },
  3: { animation: "var(--animate-lp-particle-mid)", peak: 0.58 },
  4: { animation: "var(--animate-lp-particle-fast)", peak: 0.66 },
} as const;

function Dots({ band }: { band: Particle["band"] }) {
  return (
    <>
      {PARTICLES.filter((p) => p.band === band).map((p) => {
        const layer = LAYER[p.size as keyof typeof LAYER];
        return (
          // **São DOIS elementos por partícula, e o de fora é o que viaja.**
          // `translateY(-100%)` mede a altura do PRÓPRIO elemento, então um
          // ponto de 3px animado assim sobe 3px — o campo inteiro tremia no
          // rodapé e nada subia. A coluna de fora tem `h-full`, ou seja, a
          // altura do invólucro (a seção do hero), e é isso que faz `-100%`
          // valer a travessia inteira. O ponto vai no pé dela.
          //
          // A animação fica na COLUNA: a keyframe mexe em `transform` e
          // `opacity`, e as duas são herdadas pela composição do filho.
          <span
            key={`${band}-${p.left}-${p.delay}`}
            className="absolute bottom-0 h-full"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              animation: layer.animation,
              animationDelay: `${p.delay}s`,
              // Consumidas pela keyframe `lp-particle`.
              ["--lp-drift" as string]: `${p.drift}px`,
              ["--lp-particle-peak" as string]: layer.peak,
            }}
          >
            <span
              className="absolute bottom-0 left-0 rounded-full bg-scriba-ink-strong"
              style={{ width: `${p.size}px`, height: `${p.size}px` }}
            />
          </span>
        );
      })}
    </>
  );
}

export function LandingParticles() {
  return (
    // `inset-0` com `overflow-hidden`: a partícula que passa do topo é cortada
    // pelo invólucro, não pela seção — se ela escapasse, criaria barra de
    // rolagem horizontal no celular, que é o jeito clássico de um efeito de
    // fundo estragar a página.
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* As duas faixas laterais medem o vão que sobra fora da coluna de
          780px do texto, e existem só onde esse vão existe (`lg`). Abaixo
          disso o texto ocupa a largura toda e não há "lado vazio". */}
      <div className="absolute inset-y-0 left-0 hidden w-[calc((100%-780px)/2)] lg:block">
        <Dots band="left" />
      </div>
      <div className="absolute inset-y-0 right-0 hidden w-[calc((100%-780px)/2)] lg:block">
        <Dots band="right" />
      </div>
      <div className="absolute inset-0">
        <Dots band="center" />
      </div>
    </div>
  );
}
