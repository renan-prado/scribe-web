import { AdminTabs } from "./AdminTabs";

/**
 * As faixas de aba das duas áreas cujas telas ficaram onde estavam, mas
 * deixaram de ser linhas separadas do menu.
 *
 * A lista de cada área mora AQUI, e não copiada no topo de cada página: duas
 * cópias de uma navegação divergem no dia em que uma tela nova entra numa e
 * não na outra, e o sintoma é uma aba que existe numa metade da área e some na
 * outra. É a mesma razão do `SessionModeBadge` ter virado componente.
 *
 * **Conteúdo** junta Sessões e Feedback porque as duas perguntam a mesma coisa,
 * "o que a pessoa recebeu presta?". A nota sem o texto não distingue um resumo
 * que inventou uma citação de uma transcrição que perdeu o meio da pregação;
 * o texto sem a nota não diz se alguém se incomodou. Separadas no menu, cada
 * uma respondia metade.
 *
 * **Léxico** entrou nessa mesma faixa porque responde à mesma pergunta pelo
 * outro lado: Sessões e Feedback olham o que o MODELO escreveu, e o léxico é o
 * único texto de um resumo com a nossa voz — o cartão que abre num nome próprio
 * foi escrito à mão. Quem abre uma sessão para julgar qualidade está a um
 * clique de consertar a parte que é nossa.
 *
 * **Crescimento** junta Parceiros e Cupons porque as duas são portas de
 * entrada de gente, com contas diferentes: o parceiro ganha comissão sobre
 * quem trouxe, o cupom gasta moeda para chamar alguém escolhido. Quem abre uma
 * costuma estar decidindo sobre a outra.
 */

const CONTENT_TABS = [
  { key: "sessoes", href: "/admin/sessions", label: "Sessões" },
  { key: "feedback", href: "/admin/feedback", label: "Feedback" },
  { key: "lexico", href: "/admin/lexico", label: "Léxico" },
] as const;

export function ContentTabs({ active }: { active: "sessoes" | "feedback" | "lexico" }) {
  return (
    <AdminTabs
      tabs={CONTENT_TABS.map((t) => ({
        href: t.href,
        label: t.label,
        active: t.key === active,
      }))}
    />
  );
}

const GROWTH_TABS = [
  { key: "parceiros", href: "/admin/partners", label: "Parceiros" },
  { key: "cupons", href: "/admin/cupons", label: "Cupons de convite" },
] as const;

export function GrowthTabs({ active }: { active: "parceiros" | "cupons" }) {
  return (
    <AdminTabs
      tabs={GROWTH_TABS.map((t) => ({
        href: t.href,
        label: t.label,
        active: t.key === active,
      }))}
    />
  );
}
