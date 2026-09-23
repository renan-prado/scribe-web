import type { ReactNode } from "react";
import { TopBar } from "../components/TopBar";

/**
 * A barra do perfil, e ela mora aqui por duas razões que se resolvem no mesmo
 * arquivo.
 *
 * **A primeira é o piscar.** O `loading.tsx` envolve a PÁGINA num `<Suspense>`,
 * nunca o layout do mesmo segmento; com a barra dentro da página, o vão dela
 * ficava vazio enquanto o esqueleto estava na tela — o avatar continuava lá,
 * porque é do layout de cima, e o título e o voltar sumiam e voltavam. Esta
 * tela espera três respostas do banco antes do primeiro pixel, então aqui o
 * intervalo é dos maiores do app. Mesma correção do `home/layout.tsx`.
 *
 * **A segunda é o VOLTAR, que não existia.** O perfil é aberto pelo menu da
 * conta, de qualquer tela, e a barra dele não tinha nada no canto esquerdo além
 * da pena, que é marcação e não clica. No desktop ainda há o avatar e o resto do
 * app em volta; no celular a tela era um beco, e a única saída era o voltar do
 * sistema — que num WebView fecha o aplicativo. `/home` é o destino porque é
 * onde se cai ao entrar, e é o mesmo alvo do voltar do `/summary` e do
 * `/import`.
 */
export default function PerfilLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <TopBar title="Perfil" backHref="/home" />
      {children}
    </>
  );
}
