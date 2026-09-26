import Link from "next/link";
import type { ReactNode } from "react";

type LandingCtaProps = {
  /** As classes do CTA. */
  className: string;
  /** O texto do botão. */
  label: string;
  /** Ícone à esquerda do texto (a pena da marca, geralmente). */
  icon?: ReactNode;
  /** Destino do CTA. */
  href?: string;
};

export function LandingCta({ className, label, icon, href = "/sign-in" }: LandingCtaProps) {
  return (
    <Link href={href} className={className}>
      {icon}
      {label}
    </Link>
  );
}
