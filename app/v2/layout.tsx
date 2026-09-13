import type { ReactNode } from "react";

/**
 * A moldura do Scriba v2.
 *
 * Ela é deliberadamente VAZIA: nem `AppHeader`, nem `MobileBottomNav`, nem
 * `TourProvider`. O v2 é a pele nova, e ela nasce de uma tela em branco; herdar
 * a moldura de `(app)` seria começar preso ao que viemos refazer. O que o v2
 * precisar de chrome, ele desenha aqui, quando desenhar.
 *
 * O que ela garante é o chão: preto, ocupando a altura toda. O `flex-1` casa
 * com o `flex flex-col` do `<body>` (ver `app/layout.tsx`), sem ele o preto
 * para onde o conteúdo para, e sobra uma faixa do tema embaixo.
 *
 * **A classe `dark` aqui não é decoração, é o que faz o v2 ter UM tema.** Ela
 * redeclara os tokens `--scriba-*` neste nó, e eles descem por herança, então
 * todo componente reaproveitado do app atual (o `SessionCard`, por exemplo)
 * desenha na paleta escura mesmo para quem escolheu o tema claro no app. Sem
 * isso, um cartão branco pousaria sobre o preto do v2 e a tela ficaria com dois
 * desenhos brigando. Quando o v2 tiver tema claro próprio, esta linha sai junto
 * com a exceção do `--v2-bg` em `app/globals.css`.
 */
export default function V2Layout({ children }: { children: ReactNode }) {
  return <div className="dark flex flex-1 flex-col bg-v2-bg">{children}</div>;
}
