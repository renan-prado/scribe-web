/**
 * A IDENTIDADE do Biblo: a semente e as duas coordenadas de cor.
 *
 * Mora fora do `BibloAvatar` porque ele é `"use client"` (a animação é da
 * `@blobatar/react`), e um server component que importe uma constante de um
 * módulo cliente não recebe o valor: recebe uma referência de cliente. A
 * landing page precisa do MESMO rosto sem pagar bundle nenhum, e o
 * `BibloFace` o desenha no servidor a partir daqui.
 *
 * São três números num arquivo só porque são a cara de um personagem, não
 * configuração: dois valores divergentes seriam duas pessoas diferentes
 * atendendo, uma no app e outra na página que vende o app.
 */

/**
 * A semente. Constante: o Biblo é um só, em todo aparelho.
 *
 * **O valor é escolhido pelo ROSTO que ele produz, não pelo que ele diz.** A
 * lib deriva a forma de um hash da string, então mudar um caractere aqui é
 * trocar o personagem — `"biblo03"` foi o que se olhou na tela e se aprovou.
 * Não "arrume" para `"biblo"`.
 */
export const BIBLO_NAME = "biblo03";

/**
 * O azul do Biblo. `hue` em graus, `tone` na posição da amostra — juntos dão
 * `#b4d8ff` na cabeça, um azul claro esbranquiçado.
 *
 * **O grau é OKLCh, e não o matiz de HSL que o DevTools mostra.** Esta
 * constante já foi `44`, "o amarelo da marca (`--scriba-yellow`, #F8C64B)" —
 * mas 44 é o matiz HSL daquele amarelo, e em OKLCh 44° é laranja queimado: o
 * Biblo nasceu vermelho. Para conferir um valor sem abrir a tela:
 * `palette(hue, true, tone)`, exportado pelo próprio pacote, devolve os três
 * hexadecimais. A régua, em OKLCh: ~29 vermelho, ~88 amarelo, ~145 verde,
 * ~250 azul.
 *
 * **E ele NÃO é mais a cor da marca, de propósito.** O amarelo do Scriba é a
 * MOEDA (`src/shared/AGENTS.md`: saldo, preço, marca-texto), e um rosto amarelo
 * flutuando sobre o mesmo canto em que o app fala de crédito diria "isto custa"
 * antes de dizer "isto conversa". O azul não pertence a nenhuma das três
 * famílias semânticas, que é exatamente o que um personagem precisa.
 *
 * O número é literal porque a lib recebe um NÚMERO, não uma cor — a regra de
 * "nada de cor literal" do AGENTS.md fala de `className`.
 */
export const BIBLO_HUE = 250;

/**
 * A posição na rampa daquele matiz. **Não é contínua**: a lib escolhe entre
 * meia dúzia de amostras, e o intervalo 0,80–0,90 inteiro dá o mesmo
 * `#b4d8ff`. 0,85 é o meio da faixa de propósito — um ajuste fino de dois
 * centésimos não deve pular para a amostra vizinha (`#1c89e4`, o azul médio
 * que este valor substituiu, ou `#2a394a`, que é quase o grafite do fundo).
 *
 * O fundo do avatar é TRANSPARENTE (a lib desenha só cabeça e olhos), então a
 * cabeça pousa direto no vidro do `BibloDock`, sobre o grafite. É o que deixa
 * o tom claro passar: ele não está sobre o disco quase branco que a `palette()`
 * devolve como `bg`, e que não vai para a tela.
 */
export const BIBLO_TONE = 0.85;
