import {
  BarChart3,
  Handshake,
  LayoutDashboard,
  type LucideIcon,
  Mic,
  PiggyBank,
  SlidersHorizontal,
  TrendingUp,
  Users,
} from "lucide-react";

/**
 * As áreas do painel, num lugar só.
 *
 * Elas são desenhadas por DOIS componentes — a lateral do desktop
 * (`AdminSidebar`) e o painel do hambúrguer (`AdminMenu`) —, e a lista mora
 * aqui porque copiada ela divergiria na primeira área nova: uma tela que existe
 * na lateral e não no menu é uma tela que só quem tem monitor encontra.
 */
export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /**
   * As outras rotas que acendem este item. Existe para as áreas em que os
   * recortes viraram ABAS dentro da tela em vez de linhas do menu: quem está
   * em `/admin/feedback` continua dentro de "Conteúdo", e o menu precisa
   * dizer isso.
   */
  match?: string[];
};

/**
 * Oito itens, um por PERGUNTA, e nenhum por recorte.
 *
 * O menu já teve dezessete (onze mais seis num grupo "Financeiro"), e mais da
 * metade deles não era uma área: era um corte dos mesmos números. "Uso &
 * custos" e "Precificação" liam a mesma passada de `llm_usage_events`;
 * "Compromissos" era um filtro de "Lançamentos"; "Leitura da IA" era uma tela
 * com um botão; "Funcionalidades" e "Configurações financeiras" eram os dois
 * lugares de girar um parâmetro. Uma lista assim deixa de ser encontrada por
 * reconhecimento: para achar uma coluna era preciso saber de cor em qual das
 * duas telas parecidas ela estava.
 *
 * O que sobrou responde a uma pergunta cada, e os recortes viraram abas dentro
 * da tela (ver `AdminTabs`), onde eles dizem uma coisa que um item de menu não
 * diz: **isto aqui é o mesmo assunto, visto de outro ângulo.**
 *
 * O grupo do financeiro sumiu junto. Ele existia para quebrar a parede de
 * quatorze itens seguidos; com oito não há parede, e um rótulo de grupo sobre
 * uma linha só é moldura sem quadro.
 *
 * **Oito é também o que faz o painel do hambúrguer caber**: numa grade de três
 * colunas são três fileiras, que abrem embaixo do botão sem passar da metade da
 * tela de um celular. Uma área nova entra aqui e aparece nos dois desenhos; a
 * décima terceira pede uma conversa sobre a grade, não mais uma linha.
 */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/admin/metrics", label: "Métricas", icon: TrendingUp },
  { href: "/admin/costs", label: "Custos", icon: BarChart3 },
  { href: "/admin/finance", label: "Financeiro", icon: PiggyBank },
  {
    href: "/admin/sessions",
    label: "Conteúdo",
    icon: Mic,
    match: ["/admin/sessions", "/admin/feedback", "/admin/lexicon"],
  },
  {
    href: "/admin/partners",
    label: "Crescimento",
    icon: Handshake,
    match: ["/admin/partners", "/admin/coupons"],
  },
  { href: "/admin/users", label: "Usuários", icon: Users },
  { href: "/admin/settings", label: "Configurações", icon: SlidersHorizontal },
];

/**
 * Este item responde pela rota aberta?
 *
 * Mora junto da lista pela mesma razão que ela: a lateral e o painel precisam
 * acender o MESMO item, e duas implementações de "estou aqui" discordam no
 * primeiro `match` que alguém acrescentar de um lado só.
 */
export function isAdminNavActive(item: AdminNavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  const roots = item.match ?? [item.href];
  return roots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}
