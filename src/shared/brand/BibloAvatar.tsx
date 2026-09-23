"use client";

import { Blobatar } from "@blobatar/react";
import { happy, idle, thinking } from "blobatar/expression";
import "blobatar/motion.css";
import { cn } from "@/lib/utils";
import { BIBLO_HUE, BIBLO_NAME, BIBLO_TONE } from "@/shared/brand/biblo-seed";
import { useTheme } from "@/shared/hooks/use-theme";

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
 * A semente e as duas coordenadas de cor saem de `biblo-seed.ts`, porque o
 * servidor também as usa (`BibloFace`, o rosto da landing) e este módulo é
 * cliente. O porquê de cada valor está no cabeçalho de lá.
 */

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
  /**
   * EXPERIMENTO: o azul do Biblo desce um degrau da rampa no tema claro.
   *
   * `tone` 0,85 é a amostra clara (`#b4d8ff`), calibrada para pousar sobre o
   * vidro escuro do dock; 0,71 é a vizinha (`#1c89e4`), um azul médio. A forma,
   * a semente e o matiz não mudam — só a amostra de cor.
   *
   * **Ele PISCA num quadro ao carregar no tema claro**, e isso é conhecido: o
   * tema mora no localStorage, o servidor renderiza sem saber dele, e o
   * `useTheme` só responde depois da montagem. Conviver com a piscada ou não é
   * a decisão que este experimento existe para informar.
   */
  const { isDark, mounted } = useTheme();
  const light = mounted && !isDark;

  return (
    <Blobatar
      name={BIBLO_NAME}
      size={size}
      hue={BIBLO_HUE}
      // O `tone` PROP vence o trait de mesmo nome na lib (`r.tone ?? t("tone")`
      // em `blob.js`), então passar os dois deixaria o override sem efeito —
      // no claro ele sai de cena e quem manda é `traits`.
      tone={light ? undefined : BIBLO_TONE}
      traits={light ? { tone: 0.5 } : undefined}
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
