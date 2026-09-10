"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";

/**
 * As abas da leitura de uma sessão no painel.
 *
 * Recebe os painéis já RENDERIZADOS pelo servidor, como o `PartnerTabs`: a
 * página continua sendo server component, o conteúdo é buscado uma vez com o
 * client service-role, e este arquivo só cuida da troca de aba.
 *
 * A ordem é a da avaliação: **resumo primeiro**, porque é o que a pessoa lê;
 * transcrição depois, porque é contra ela que se confere o que o resumo
 * afirma; estudo e feed por último, que existem só em parte das sessões.
 *
 * Abas em vez de tudo empilhado porque as três leituras são longas e
 * concorrentes: com elas na mesma coluna, conferir uma frase do resumo contra
 * a transcrição vira role de mil linhas.
 */

export type SessionReaderPanel = {
  value: string;
  label: string;
  content: ReactNode;
};

export function SessionReaderTabs({ panels }: { panels: SessionReaderPanel[] }) {
  return (
    <Tabs defaultValue={panels[0]?.value}>
      <TabsList aria-label="Partes da sessão">
        {panels.map((p) => (
          <TabsTab key={p.value} value={p.value}>
            {p.label}
          </TabsTab>
        ))}
      </TabsList>
      {panels.map((p) => (
        <TabsPanel key={p.value} value={p.value}>
          {p.content}
        </TabsPanel>
      ))}
    </Tabs>
  );
}
