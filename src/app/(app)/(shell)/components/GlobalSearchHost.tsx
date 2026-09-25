"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { HOME_HREF, HOME_SEARCH_HREF } from "../lib/overlay-routes";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
import { useGlobalSearchStore } from "./GlobalSearchStore";

/**
 * O dono da busca nas telas que AINDA não têm um `/…/search` próprio, e o
 * único lugar onde o Ctrl+K é escutado.
 *
 * ## Por que ele existe em vez de a store ter sumido
 *
 * Na Biblioteca a busca virou ROTA (`/home/search`, ver
 * `home/@overlay/search/page.tsx`): quem abre é um link, quem fecha é o
 * voltar, e a URL sozinha reconstrói a tela — que é o que o aplicativo
 * precisa quando for ele a dirigir o WebView. Mas a lupa também está no
 * `/import`, no `/summary/new` e no `/summary/[id]/edit`, e o atalho está em
 * TODA tela logada. Converter as quatro de uma vez era mexer no editor no
 * mesmo commit que na Biblioteca.
 *
 * Então: a rota manda onde já existe, a `GlobalSearchStore` segura o resto, e
 * este componente é a ponte. **Ele é temporário** — some junto com a store
 * quando as outras telas ganharem o próprio segmento.
 *
 * ## Dois diálogos nunca coexistem
 *
 * Em `/home/search` quem monta a `GlobalSearchDialog` é a rota, e este host se
 * apaga (`return null`). Sem isso haveria duas instâncias na mesma tela, duas
 * `useLibrary()` e dois campos disputando o foco. Ele não perde animação
 * nenhuma ao sumir: só some quando está FECHADO.
 *
 * ## A store fecha em toda navegação
 *
 * Um diálogo que sobrevive à troca de tela é um diálogo que reaparece por cima
 * da tela errada — e é o que acontecia ao escolher um resultado, que navega
 * para `/summary/[id]` sem fechar nada (ver `select` na `GlobalSearchDialog`,
 * que não fecha justamente porque na rota fechar É navegar).
 */
export function GlobalSearchHost() {
  const pathname = usePathname();
  const router = useRouter();
  const open = useGlobalSearchStore((s) => s.open);
  const setOpen = useGlobalSearchStore((s) => s.setOpen);
  const routed = pathname === HOME_SEARCH_HREF;

  // Ctrl+K / Cmd+K, em toda tela logada. `toggle`, não só "abrir": apertar de
  // novo com o diálogo aberto é o gesto de fechar que todo app de comando tem.
  // Onde a busca é rota, o atalho NAVEGA — é a mesma tecla mexendo na mesma
  // coisa, só que pela URL.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      if (pathname === HOME_SEARCH_HREF) router.back();
      else if (pathname === HOME_HREF) router.push(HOME_SEARCH_HREF);
      else setOpen(!useGlobalSearchStore.getState().open);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname, router, setOpen]);

  // Ver "A store fecha em toda navegação" no cabeçalho. O `pathname` é uma
  // dependência de GATILHO e não de leitura — o corpo não o lê, ele só precisa
  // rodar de novo a cada troca de tela —, e é por isso que o Biome o acusa de
  // sobrar. Tirá-lo deixaria o efeito rodando uma vez só, na montagem.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ver acima
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  if (routed) return null;
  return <GlobalSearchDialog open={open} onOpenChange={setOpen} />;
}
