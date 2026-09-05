"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Remonta os filhos a cada troca de rota para que `animate-content-fade`
 * (0,5s de opacidade + 4px de deslocamento) toque de novo.
 *
 * **Ela envolve o CONTEÚDO da página, nunca a moldura.** Enquanto morava no
 * root layout, o `key={pathname}` derrubava e remontava tudo o que estava
 * abaixo dela — header, barra inferior do celular e página —, e a animação
 * corria por cima do conjunto. No desktop isso passava como um piscar; no
 * celular, e principalmente no PWA, a barra inferior SUMIA e voltava a cada
 * toque, porque ela é o elemento fixo que o olho está seguindo.
 *
 * Por isso cada moldura instala a sua: `(app)`, `/admin` e `/partners` a
 * colocam em volta dos próprios `children`, com o header e a nav de fora. O
 * root layout mantém só a classe, sem `key`: ela toca uma vez no carregamento
 * completo, para toda rota, e não volta a tocar em navegação de cliente.
 *
 * Uma consequência aceita: entre páginas públicas sem moldura (landing,
 * termos, privacidade) a navegação de cliente deixou de refazer o fade. Elas
 * não têm nada fixo na tela para piscar, e o preço de espalhar a classe por
 * cada uma delas é maior que o ganho.
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={cn("animate-content-fade", className)}>
      {children}
    </div>
  );
}
