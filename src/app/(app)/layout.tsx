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
 * O que ela garante é o chão: o grafite `--v2-bg`, ocupando a altura toda. O
 * `flex-1` casa com o `flex flex-col` do `<body>` (ver `app/layout.tsx`), sem
 * ele o chão para onde o conteúdo para, e sobra uma faixa do tema embaixo.
 *
 * **A classe `dark` não é decoração, é o que faz o app ter UM tema.** Ela
 * redeclara os tokens `--scriba-*` neste nó, e eles descem por herança, então
 * todo componente que veio da pele antiga (o `SessionCard`, o `SavedSessionView`,
 * a página de estudo) desenha na paleta escura. Sem isso, um cartão branco
 * pousaria sobre o grafite e a tela ficaria com dois desenhos brigando.
 *
 * A Biblioteca não depende mais disso — os post-its dela são `--v2-note-*` e se
 * pintam sozinhos (ver `LibraryNote`) —, mas o `/summary` e o `/studies` ainda
 * dependem, e é por eles que a classe fica.
 *
 * **O topo respeita o RECORTE do aparelho** (`env(safe-area-inset-top)`).
 * Instalado na tela inicial, o Scriba desenha por baixo da barra de status do
 * sistema — o `viewport-fit=cover` do root layout é o que pede isso, e quem
 * pede também paga: sem o respiro, a hora e a bateria do iPhone pousavam em
 * cima do hambúrguer. O inset vale ZERO numa aba comum de navegador, então a
 * conta é a mesma folga de sempre no desktop e a altura exata do recorte no
 * aparelho de quem instalou. Ele fica no LAYOUT, e não em cada tela: é do
 * aparelho, não da página, e repetido em seis lugares bastaria esquecer um
 * para a barra de status voltar a cobrir uma tela só.
 *
 * O irmão dele é o `env(safe-area-inset-bottom)`, que cada tela paga no
 * próprio rodapé (ver `RecordDock`): embaixo a folga depende do que a página
 * põe ali, em cima é sempre a mesma barra.
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
      <div className="dark flex flex-1 flex-col bg-v2-bg pt-[env(safe-area-inset-top)]">
        {children}
      </div>
    </TourProvider>
  );
}
