"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";

/**
 * As três seções do painel do parceiro.
 *
 * Recebe os painéis já RENDERIZADOS pelo servidor. É o que permite a página
 * continuar sendo um server component, os dados são buscados uma vez, e este
 * componente só decide qual pedaço está visível. Trocar de aba não vai ao
 * servidor.
 *
 * Os cartões de dinheiro NÃO entram aqui: eles ficam acima das abas, sempre à
 * vista. Esconder "quanto tenho a receber" atrás de uma aba seria esconder a
 * única resposta que o parceiro veio buscar.
 */

type Props = {
  divulgacao: ReactNode;
  ganhos: ReactNode;
  pagamentos: ReactNode;
};

export function PartnerTabs({ divulgacao, ganhos, pagamentos }: Props) {
  return (
    <Tabs defaultValue="divulgacao">
      <TabsList aria-label="Seções do painel">
        <TabsTab value="divulgacao">Divulgação</TabsTab>
        <TabsTab value="ganhos">Ganhos</TabsTab>
        <TabsTab value="pagamentos">Pagamentos</TabsTab>
      </TabsList>
      {/* `gap-6` sobrescreve o `gap-4` do primitivo: é o vão entre blocos
          desta tela, o mesmo que a coluna de fora usa. Ele fica aqui, e não no
          `ui/tabs`, porque o /admin usa o mesmo primitivo com painéis de outra
          densidade. */}
      <TabsPanel value="divulgacao" className="gap-6">
        {divulgacao}
      </TabsPanel>
      <TabsPanel value="ganhos" className="gap-6">
        {ganhos}
      </TabsPanel>
      <TabsPanel value="pagamentos" className="gap-6">
        {pagamentos}
      </TabsPanel>
    </Tabs>
  );
}
