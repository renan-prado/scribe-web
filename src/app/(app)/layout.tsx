import type { ReactNode } from "react";
import { ZoomLock } from "@/components/ZoomLock";
import { LexiconProvider } from "@/features/session/components/LexiconProvider";
import { TourProvider } from "@/features/tour/components/TourProvider";
import { getLexiconIndex } from "@/lib/db/lexicon";
import { listSeenTours } from "@/lib/db/tours";
import type { TourSeenMap } from "@/lib/domain/tour";
import { getAuthUser } from "@/lib/supabase/server";
import { APP_VIEWPORT } from "@/shared/viewport";

/**
 * A moldura do Scriba.
 *
 * Ela quase não desenha: não há header nem barra de navegação AQUI. A barra do
 * topo desceu um degrau, para `(shell)/layout.tsx`, e a razão é que ela não
 * cobre tudo que está atrás do login: `/subscribe` e `/subscribe/return` são o fluxo de
 * pagamento em tela cheia e `/refer` traz o próprio voltar. O grupo de rotas
 * é o que diz quem tem barra sem um `if` de pathname que apodrece na primeira
 * rota nova.
 *
 * O que esta moldura garante é o que vale para TODA tela logada: o chão, o
 * recorte do aparelho, o tour e o zoom.
 *
 * O que ela garante é o chão: o grafite `--v2-bg`, ocupando a altura toda. O
 * `flex-1` casa com o `flex flex-col` do `<body>` (ver `app/layout.tsx`), sem
 * ele o chão para onde o conteúdo para, e sobra uma faixa do tema embaixo.
 *
 * **A classe `dark` não é decoração, é o que faz o app ter UM tema.** Ela
 * redeclara os tokens `--scriba-*` neste nó, e eles descem por herança, então
 * todo componente que veio da pele antiga (o `SessionCard`, o `SavedSessionView`)
 * desenha na paleta escura. Sem isso, um cartão branco
 * pousaria sobre o grafite e a tela ficaria com dois desenhos brigando.
 *
 * A Biblioteca não depende mais disso — os post-its dela são `--v2-note-*` e se
 * pintam sozinhos (ver `LibraryNote`) —, mas o `/summary` ainda depende, e é
 * por ele que a classe fica.
 *
 * **O topo respeita o RECORTE do aparelho** (`env(safe-area-inset-top)`).
 * Instalado na tela inicial, o Scriba desenha por baixo da barra de status do
 * sistema — o `viewport-fit=cover` do root layout é o que pede isso, e quem
 * pede também paga: sem o respiro, a hora e a bateria do iPhone pousavam em
 * cima da pena da barra. O inset vale ZERO numa aba comum de navegador, então a
 * conta é a mesma folga de sempre no desktop e a altura exata do recorte no
 * aparelho de quem instalou. Ele fica no LAYOUT, e não em cada tela: é do
 * aparelho, não da página, e repetido em seis lugares bastaria esquecer um
 * para a barra de status voltar a cobrir uma tela só.
 *
 * O irmão dele é o `env(safe-area-inset-bottom)`, que cada tela paga no
 * próprio rodapé (ver `CreateDock`): embaixo a folga depende do que a página
 * põe ali, em cima é sempre a mesma barra.
 *
 * **O `TourProvider` mora AQUI, e não em cada página**, por duas razões que não
 * são organização: o overlay é um só (duas páginas capazes de abrir o próprio
 * empilhariam dois véus), e o mapa do que já foi visto sobrevive à navegação,
 * porque o layout não é refeito ao andar entre as telas. Ver
 * `src/features/tour/AGENTS.md`.
 *
 * **O `ZoomLock` e o `viewport` daqui tiram a pinça de zoom do app.** O app é
 * instalado na tela inicial e vai virar um WebView; ampliar ali não é ler
 * melhor, é a tela sair do lugar com o `CreateDock` fora de vista. O porquê
 * inteiro, e por que a landing continua ampliável, está em
 * `src/shared/viewport.ts`.
 *
 * **O `LexiconProvider` também mora aqui**, e pela primeira das duas razões
 * acima: o índice de nomes que o `RichText` marca é o mesmo para o resumo, o
 * estudo, o editor e o Biblo, e passá-lo por prop até cada um deles seria cinco
 * lugares para esquecer um. A leitura é cacheada em memória por um minuto
 * (`getLexiconIndex`), então este `await` não custa uma consulta por
 * navegação. Ver `LexiconProvider`.
 *
 * **As barras do sistema não são mais assunto desta moldura.** Ela carregava
 * um `data-v2-shell` (para uma regra `:has()` levar o grafite até o `<html>`,
 * que é de onde o Android tira a cor da barra de navegação) e um
 * `AppThemeColor` (para a barra de status). Os dois existiam porque o fundo do
 * DOCUMENTO era o do site, que podia ser branco, enquanto o app era grafite.
 * Com um tema só, `--background` é `--v2-bg` em toda rota: o canvas já nasce
 * certo e a `<meta name="theme-color">` é estática no root layout.
 */
export const viewport = APP_VIEWPORT;

export default async function AppLayout({ children }: { children: ReactNode }) {
  // `getAuthUser` é `cache()`: pedir o usuário aqui não custa uma ida a mais à
  // rede, é a MESMA chamada que a `TopBar` de cada página já faz por dentro.
  const user = await getAuthUser();
  const [seenTours, lexicon] = await Promise.all([
    user ? listSeenTours(user.id).catch((): TourSeenMap => ({})) : ({} as TourSeenMap),
    getLexiconIndex(),
  ]);

  return (
    <TourProvider seen={seenTours}>
      <LexiconProvider entries={lexicon}>
        <ZoomLock />
        <div className="dark flex flex-1 flex-col bg-v2-bg pt-[env(safe-area-inset-top)]">
          {children}
        </div>
      </LexiconProvider>
    </TourProvider>
  );
}
