import type { ReactNode } from "react";
import { TourProvider } from "@/features/tour/components/TourProvider";
import { listSeenTours } from "@/lib/db/tours";
import type { TourSeenMap } from "@/lib/domain/tour";
import { getAuthUser } from "@/lib/supabase/server";

/**
 * A moldura do Scriba.
 *
 * Ela quase não desenha: não há header nem barra de navegação aqui. Cada tela
 * renderiza a sua própria `TopBar`, e a razão é que a barra LÊ o perfil e o
 * saldo (ela é um server component), então o layout não teria como passá-la a
 * páginas que precisam dela em posições diferentes.
 *
 * O que ela garante é o chão: preto, ocupando a altura toda. O `flex-1` casa
 * com o `flex flex-col` do `<body>` (ver `app/layout.tsx`), sem ele o preto
 * para onde o conteúdo para, e sobra uma faixa do tema embaixo.
 *
 * **A classe `dark` não é decoração, é o que faz o app ter UM tema.** Ela
 * redeclara os tokens `--scriba-*` neste nó, e eles descem por herança, então
 * todo componente que veio da pele antiga (o `SessionCard`, o `SavedSessionView`,
 * a página de estudo) desenha na paleta escura. Sem isso, um cartão branco
 * pousaria sobre o preto e a tela ficaria com dois desenhos brigando.
 *
 * **O `TourProvider` mora AQUI, e não em cada página**, por duas razões que não
 * são organização: o overlay é um só (duas páginas capazes de abrir o próprio
 * empilhariam dois véus), e o mapa do que já foi visto sobrevive à navegação,
 * porque o layout não é refeito ao andar entre as telas. Ver
 * `src/features/tour/AGENTS.md`.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  // `getAuthUser` é `cache()`: pedir o usuário aqui não custa uma ida a mais à
  // rede, é a MESMA chamada que a `TopBar` de cada página já faz por dentro.
  const user = await getAuthUser();
  const seenTours = user
    ? await listSeenTours(user.id).catch((): TourSeenMap => ({}))
    : ({} as TourSeenMap);

  return (
    <TourProvider seen={seenTours}>
      <div className="dark flex flex-1 flex-col bg-v2-bg">{children}</div>
    </TourProvider>
  );
}
