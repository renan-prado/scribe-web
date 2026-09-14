import { AdminTabs } from "@/features/admin/components/AdminTabs";

/**
 * A navegação da área financeira, dentro da própria tela.
 *
 * Ela era um `SidebarGroup` de SEIS itens no menu do painel, e seis linhas
 * para uma pergunta só ("como está o dinheiro?") era o que fazia o menu inteiro
 * virar uma parede: mais de um terço dele descrevia recortes de uma área.
 * Como faixa de abas, a área ocupa UMA linha do menu e os recortes aparecem
 * quando alguém já está olhando para eles.
 *
 * **"Em aberto" não é uma tela, é um FILTRO de Lançamentos**, e a faixa diz
 * isso ao pô-los lado a lado com a mesma rota por baixo. Dívida não é um tipo:
 * é um lançamento com `status <> 'paid'` e `due_date`. Enquanto eram dois itens
 * de menu com dois títulos ("Lançamentos" e "Compromissos e dívidas"), a
 * leitura natural era a de duas listas independentes, e a primeira pergunta de
 * quem chegava era se um valor lançado ali aparecia no outro lugar.
 *
 * Configurações saiu daqui: categorias e parâmetros foram para
 * `/admin/configuracoes`, junto do resto do que o painel gira.
 */
export type FinanceTabKey = "geral" | "lancamentos" | "aberto" | "recorrentes" | "projecoes";

const TABS: { key: FinanceTabKey; href: string; label: string }[] = [
  { key: "geral", href: "/admin/financeiro", label: "Visão geral" },
  { key: "lancamentos", href: "/admin/financeiro/lancamentos", label: "Lançamentos" },
  { key: "aberto", href: "/admin/financeiro/lancamentos?visao=aberto", label: "Em aberto" },
  { key: "recorrentes", href: "/admin/financeiro/recorrentes", label: "Custos recorrentes" },
  { key: "projecoes", href: "/admin/financeiro/projecoes", label: "Projeções" },
];

export function FinanceTabs({ active }: { active: FinanceTabKey }) {
  return (
    <AdminTabs
      tabs={TABS.map((t) => ({ href: t.href, label: t.label, active: t.key === active }))}
    />
  );
}
