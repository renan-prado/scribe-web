"use client";

import { Blobatar } from "@blobatar/react";
import { happy, idle, thinking } from "blobatar/expression";
import "blobatar/motion.css";
import { cn } from "@/lib/utils";

/**
 * O rosto do Biblo.
 *
 * É o que faz "conversar com o Scriba" virar "perguntar ao Biblo", e essa
 * diferença é grande na cabeça de quem usa este app — que não é o público que
 * já tem três chatbots abertos. Ele é o ÚNICO botão flutuante do produto com
 * cara em vez de símbolo (o `CreateDock` tem um `+`, o `AdminMenu` um
 * hambúrguer).
 *
 * ## Ele é UM personagem, não um avatar por usuário
 *
 * O `blobatar` gera a forma a partir de uma string, e aqui a string é
 * constante. `hue` e `tone` também são fixados: sem eles a cor seria o que o
 * hash sorteou, e o Biblo ficaria de uma cor que não é de ninguém.
 *
 * **O que realmente prende a cara dele é o MAJOR do pacote.** No blobatar a
 * geração é o major (`blobatar@2` é a gen2), então `^2.7.0` mantém o desenho e
 * um dia um `blobatar@3` mudaria o rosto do personagem num `npm update`. Num
 * avatar por usuário isso seria cosmético; aqui é outra pessoa atendendo.
 * Subir o major é decisão de produto, e se olha na tela antes.
 *
 * ## Três expressões, e a regra que exclui as outras doze
 *
 * A biblioteca traz quinze (`idle`, `happy`, `sad`, `mad`, `love`, `shy`,
 * `sick`, `thinking`, `surprised`, `wink`, `sleepy`, `smug`, `unsure`,
 * `scared`, `heat`). Usamos três:
 *
 * | momento | expressão |
 * |---|---|
 * | parado | `idle` |
 * | resposta a caminho | `thinking` |
 * | sugestão aceita | `happy`, por um instante |
 *
 * **A expressão diz o estado da MÁQUINA, nunca uma opinião sobre o
 * CONTEÚDO.** Um Biblo entristecido ou irritado com uma pergunta sobre
 * doutrina é o avatar tomando o partido que o prompt proíbe o texto de tomar
 * (`docs/biblo.md` §8) — e uma cara é mais difícil de desmentir que um
 * parágrafo. É a mesma razão de `love`, `shy` e `sick` ficarem de fora: são
 * reações a QUEM está falando.
 *
 * A animação é da biblioteca e já respeita `prefers-reduced-motion`; não há
 * CSS nosso aqui.
 */

/**
 * A semente. Constante: o Biblo é um só, em todo aparelho.
 *
 * **O valor é escolhido pelo ROSTO que ele produz, não pelo que ele diz.** A
 * lib deriva a forma de um hash da string, então mudar um caractere aqui é
 * trocar o personagem — `"biblo03"` foi o que se olhou na tela e se aprovou.
 * Não "arrume" para `"biblo"`.
 */
const BIBLO_NAME = "biblo03";

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
const BIBLO_HUE = 250;

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
const BIBLO_TONE = 0.85;

export type BibloMood = "idle" | "thinking" | "happy";

const EXPRESSION = { idle, thinking, happy } as const;

export function BibloAvatar({
  mood = "idle",
  size = 32,
  className,
  title,
}: {
  mood?: BibloMood;
  size?: number;
  className?: string;
  /** Vira o `<title>` do SVG. `undefined` deixa o avatar decorativo. */
  title?: string;
}) {
  return (
    <Blobatar
      name={BIBLO_NAME}
      size={size}
      hue={BIBLO_HUE}
      tone={BIBLO_TONE}
      expression={EXPRESSION[mood]}
      // `always` e não `hover`: o alvo principal é um telefone, onde não existe
      // hover — e é justamente lá que o `thinking` precisa se mexer para dizer
      // que a resposta está vindo.
      animate="always"
      title={title}
      className={cn("shrink-0", className)}
    />
  );
}
