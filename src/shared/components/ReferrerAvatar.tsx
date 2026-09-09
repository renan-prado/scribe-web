"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A foto de quem indicou, no selo "indicado por".
 *
 * Mora em `src/shared/` e não em `src/features/referrals/` por uma razão de
 * bundle: quem usa isto é o hero da LANDING PAGE, e `app/AGENTS.md` proíbe a
 * LP de importar componente cliente de `src/features/` — foi assim que o app
 * de gravação inteiro passou a ser baixado para desenhar cinco cards estáticos.
 * `LandingCta` e `StandaloneHomeGuard` moram aqui pelo mesmo motivo.
 *
 * TRÊS estados, e o terceiro é o que costuma faltar:
 *
 * 1. **Tem foto** — `next/image`, servida do nosso domínio pelo
 *    `remotePattern` do `lh3.googleusercontent.com` (ver `next.config.ts`).
 *    Com `width`/`height`, então sem CLS.
 * 2. **Não tem foto** — parceiro que ainda não fez o primeiro login não tem
 *    avatar nenhum. Desenha a inicial. É desfecho normal, não erro.
 * 3. **Tinha foto e ela não carregou** — URL do Google expirada, conta que
 *    trocou de imagem, rede ruim. Sem o `onError` abaixo, isto vira um
 *    quadrado quebrado no elemento mais visível da página; com ele, cai no
 *    estado 2, que já é bonito.
 *
 * `alt` vazio de propósito: o nome vem escrito ao lado, e um leitor de tela que
 * anunciasse "foto de Fulano. Indicado por Fulano" leria duas vezes a mesma
 * informação.
 */

type Props = {
  name: string;
  avatarUrl: string | null;
  /** Lado do círculo, em px. */
  size?: number;
  className?: string;
};

export function ReferrerAvatar({ name, avatarUrl, size = 20, className }: Props) {
  const [broken, setBroken] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (!avatarUrl || broken) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
        className={cn(
          "inline-flex flex-none items-center justify-center rounded-full bg-scriba-blue-soft font-semibold text-scriba-blue-ink",
          className
        )}
      >
        {initial}
      </span>
    );
  }

  return (
    <Image
      src={avatarUrl}
      alt=""
      aria-hidden
      width={size}
      height={size}
      onError={() => setBroken(true)}
      className={cn("flex-none rounded-full object-cover", className)}
      style={{ width: size, height: size }}
    />
  );
}
