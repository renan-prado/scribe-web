import { HomeSearchOverlay } from "./HomeSearchOverlay";

/**
 * `/home/search`: a busca da Biblioteca, com a Biblioteca atrás.
 *
 * Ela mora no slot `@overlay` de `home/layout.tsx`, e é por isso que o acervo
 * continua na tela: o slot `children` segue casado com a página da Biblioteca
 * (ou com o `home/default.tsx`, numa carga dura). Sem o slot, `home/search`
 * seria um segmento FILHO, substituiria a página, e este endereço aberto
 * direto mostraria a busca sozinha no vazio.
 *
 * O porquê de rota paralela e não interceptada está em `lib/overlay-routes.ts`.
 */
export default function HomeSearchPage() {
  return <HomeSearchOverlay />;
}
