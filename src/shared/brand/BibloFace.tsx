import { blobatar } from "blobatar";
import { idle } from "blobatar/expression";
import { cn } from "@/lib/utils";
import { BIBLO_HUE, BIBLO_NAME, BIBLO_TONE } from "@/shared/brand/biblo-seed";

/**
 * O rosto do Biblo desenhado NO SERVIDOR, para a landing page.
 *
 * O `BibloAvatar` é `"use client"`: ele anima, e a animação é da
 * `@blobatar/react`. Na LP isso custaria o pacote e a hidratação na única
 * página que todo visitante anônimo carrega, por uma cara que nunca se mexe
 * nem responde a clique — exatamente o que a regra de `src/app/AGENTS.md`
 * ("a LP não importa componente `"use client"`") existe para evitar.
 *
 * **E é o MESMO rosto, não uma imitação dele.** A `blobatar()` é uma função
 * pura sem dependência que devolve markup, e recebe a mesma semente e as
 * mesmas coordenadas de `biblo-seed.ts`. Conferido: as duas rotas produzem a
 * cabeça `#b4d8ff` e os mesmos traçados. Um rosto redesenhado à mão aqui seria
 * um segundo personagem que ninguém encontraria dentro do app.
 *
 * `idle` porque na página ele está PARADO: `thinking` e `happy` dizem o estado
 * de uma máquina que aqui não está rodando (ver `BibloAvatar`).
 */
export function BibloFace({
  size = 32,
  className,
  title,
}: {
  size?: number;
  className?: string;
  /** Vira o `<title>` do SVG. `undefined` deixa o rosto decorativo. */
  title?: string;
}) {
  const svg = blobatar(BIBLO_NAME, {
    size,
    hue: BIBLO_HUE,
    tone: BIBLO_TONE,
    expression: idle,
    title,
  });
  return (
    <span
      className={cn("inline-flex shrink-0", className)}
      // O markup vem de uma função pura sobre três constantes deste
      // repositório, nada aqui passa por entrada de usuário. É a mesma razão
      // do `LandingJsonLd`, o único outro `dangerouslySetInnerHTML` da LP.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: ver acima.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
