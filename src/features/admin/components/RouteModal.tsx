"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * A casca de um modal que É UMA ROTA.
 *
 * Ela existe para os `@modal/(.)…` do painel (ver `admin/@modal/`), e a
 * diferença entre ela e um `<Dialog>` comum é de onde vem o estado: um dialog
 * comum abre porque um `useState` virou `true`; este abre porque o ENDEREÇO
 * mudou. É o que dá ao detalhe de uma sessão e ao de um usuário um link que se
 * cola no chat, um F5 que não fecha o que estava aberto, e um "voltar" do
 * navegador que fecha o modal em vez de sair da lista.
 *
 * **`open` é constante, e não é preguiça.** Este componente só é montado
 * quando a rota interceptada casa; quando ela deixa de casar, o Next desmonta
 * a árvore inteira. Um `useState` aqui seria um segundo estado dizendo a mesma
 * coisa que o roteador já diz, e os dois discordariam no primeiro `back()`.
 *
 * **Fechar é `router.back()`, nunca `push` para a lista.** O modal nasce de uma
 * navegação, então desfazê-la é o que devolve a pessoa ao lugar EXATO de onde
 * ela veio — o filtro que estava aplicado, a rolagem onde estava. Um `push`
 * para `/admin/sessions` empilharia uma entrada nova e traria a lista do topo,
 * com os filtros em branco, que é precisamente o que este desenho existe para
 * evitar.
 *
 * O preço, para quem vier depois: **abrir a URL interceptada direto (um F5, um
 * link colado) NÃO monta isto.** Ali não há o que interceptar, e quem responde
 * é a rota de verdade, em página cheia. É por isso que as duas precisam
 * desenhar o mesmo conteúdo, e é por isso que o conteúdo mora num componente
 * compartilhado em vez de dentro de um dos dois.
 */
export function RouteModal({
  children,
  className,
  label,
}: {
  children: ReactNode;
  /** Largura do popup. O padrão do `DialogContent` é `sm:max-w-sm`, estreito
   *  demais para as duas telas que usam isto. */
  className?: string;
  /**
   * O nome acessível do diálogo, para quem não tem um `DialogTitle` dentro.
   *
   * Um diálogo sem nome é anunciado como "diálogo" e mais nada. A ficha do
   * usuário resolve isso com um `DialogHeader`; a leitura da sessão não pode,
   * porque o título dela já é desenhado lá dentro pelo `AdminPageHeader` — um
   * `DialogTitle` por cima seria o mesmo texto duas vezes na mesma dobra.
   */
  label?: string;
}) {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent className={className} aria-label={label}>
        {children}
      </DialogContent>
    </Dialog>
  );
}
