"use client";

import { Blobatar } from "@blobatar/react";
import { useGaze } from "@blobatar/react/gaze";
import { idle } from "blobatar/expression";
import "blobatar/motion.css";
import "blobatar/gaze.css";
import { cn } from "@/lib/utils";
import { BIBLO_HUE, BIBLO_NAME, BIBLO_TONE } from "@/shared/brand/biblo-seed";

/**
 * O Biblo no topo do hero, com os olhos seguindo o ponteiro.
 *
 * ## Por que ele é o único cliente que a LP ganhou por gosto
 *
 * A regra de `src/app/AGENTS.md` é que a LP não importa componente `"use
 * client"` para desenhar coisa que não responde a clique — foi o que tirou o
 * `<Feed>` e o `<SummaryView>` dos mockups. **Este responde**: os olhos
 * acompanham o cursor, e é isso que faz alguém reparar num personagem antes de
 * ler o título. O rosto PARADO da página, dentro da gaveta do mockup, continua
 * sendo o `BibloFace`, que é servidor puro e não custa um byte de JS.
 *
 * O preço são a `@blobatar/react` e a camada de gaze no bundle inicial, e ele
 * se paga UMA vez: a segunda aparição (ao lado do título da seção do Biblo) não
 * custa pacote novo, só o próprio driver. O que não vale é espalhar rosto vivo
 * por seção que não fala dele.
 *
 * Os rostos DENTRO do mockup de celular (os balões da gaveta) continuam sendo
 * o `BibloFace` estático, e devem continuar: ali eles são a foto de uma tela,
 * não o personagem olhando para quem lê.
 *
 * ## As duas folhas de estilo não são opcionais
 *
 * `motion.css` é o que anima, e `gaze.css` é o que permite os olhos se
 * deslocarem: sem ele `--mo-track-travel` fica no valor inicial (`0px`) e o
 * rosto renderiza perfeito e nunca se move — o mesmo sintoma de não haver
 * gaze nenhum, sem erro em lugar nenhum.
 *
 * `travel` vem pelo HOOK, e não por CSS. A biblioteca aceita os dois caminhos e
 * avisa que o CSS vence o hook silenciosamente se os dois forem usados; um
 * caminho só, e é este.
 *
 * ## O que a biblioteca já decide por nós
 *
 * Nada se prende sob `prefers-reduced-motion` nem sem ponteiro fino, e as duas
 * condições são OBSERVADAS: ligar "reduzir movimento" no meio da sessão
 * desprende o driver. No celular, então, isto é o rosto parado — que é o certo,
 * porque lá não existe cursor para seguir.
 */
export function BibloHeroFace({ size = 88, className }: { size?: number; className?: string }) {
  // `travel` é a excursão em unidades do `viewBox` de 100, ou seja, uma fração
  // da própria cabeça, e não pixels: o rosto do hero tem 88px e o mesmo número
  // vale em qualquer tamanho.
  //
  // **6 é o dobro do que a biblioteca recomenda (1,5–4), e é decisão de
  // produto.** Na faixa dela o movimento existe mas não se NOTA: num rosto de
  // 88px no topo de uma dobra cheia de texto, 3 unidades são ~2,6px de olho, e
  // quem passa o mouse não repara que ele acompanha — o efeito só paga o JS que
  // ele custa se for percebido. A 6 o olho anda ~5px e a cabeça parece virar.
  //
  // O teto é o estrabismo: o olho do Biblo é grande em relação à cabeça, e
  // passando de ~7 ele encosta na borda dela e o rosto quebra. Confira na tela
  // com o ponteiro nos quatro cantos antes de subir mais.
  //
  // `settle` é a constante de tempo da perseguição, 110ms por padrão. 70 chega
  // mais rápido no alvo sem virar olho flutuante (0 tira a suavização inteira,
  // e aí o olho teleporta).
  const { ref } = useGaze({ travel: 6, settle: 70, lookAt: "pointer" });
  return (
    <Blobatar
      ref={ref}
      name={BIBLO_NAME}
      size={size}
      hue={BIBLO_HUE}
      tone={BIBLO_TONE}
      expression={idle}
      // `always`, como no app: o alvo principal é um telefone, onde não há
      // hover para disparar a animação.
      animate="always"
      className={cn("shrink-0", className)}
    />
  );
}
