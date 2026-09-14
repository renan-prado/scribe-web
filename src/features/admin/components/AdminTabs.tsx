import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A faixa de abas de uma tela do painel.
 *
 * Ela existe porque a sidebar não é lugar de recorte. O painel chegou a ter
 * dezessete itens de menu, e boa parte deles não era uma ÁREA, era um corte
 * dos mesmos números: "Uso & custos" e "Precificação" liam a mesma passada de
 * `llm_usage_events` com dois cabeçalhos, dois filtros de período e duas
 * fileiras de KPI quase iguais; "Sessões" e "Feedback" perguntam as duas "o
 * texto está bom?"; "Parceiros" e "Cupons" são as duas portas de entrada de
 * gente. Com cada corte virando uma linha do menu, a navegação deixa de
 * responder "onde eu vejo X" e passa a exigir que se saiba de cor qual das
 * duas telas parecidas tem a coluna que se quer.
 *
 * Uma aba diz o que um item de menu não diz: **estes cortes são do mesmo
 * assunto**. E ela custa um clique dentro da tela em vez de uma leitura da
 * lista inteira.
 *
 * É LINK, não estado de cliente: toda tela do admin é `force-dynamic` e a aba
 * troca o que o servidor busca, não o que o navegador esconde. Como link, ela
 * também sobrevive a um F5 e pode ser colada para alguém.
 */
export type AdminTab = {
  href: string;
  label: string;
  active: boolean;
};

export function AdminTabs({ tabs, className }: { tabs: AdminTab[]; className?: string }) {
  return (
    <nav
      aria-label="Seções desta tela"
      className={cn(
        "flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border border-scriba-hairline-soft bg-scriba-paper p-1",
        className
      )}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
            tab.active
              ? "bg-scriba-blue-soft text-scriba-blue-ink"
              : "text-scriba-ink-mute hover:text-scriba-ink"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
