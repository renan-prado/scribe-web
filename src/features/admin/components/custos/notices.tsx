import type { AdminUsageSummary } from "@/features/admin/server/db/usage";
import { INT, moment, percent } from "./format";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
      {children}
    </h2>
  );
}

/**
 * O aviso que precede qualquer leitura desta tela: chamadas cujo modelo não
 * está em `lib/llm/pricing.ts` gravaram custo ZERO.
 *
 * Ele não é decoração de robustez, é a única forma de o painel dizer que está
 * mentindo. Sem ele, um modelo novo configurado por env var faz o custo de uma
 * etapa inteira desaparecer, a margem daquela ação sobe, e a aba de preços
 * recomenda BAIXAR um preço que já não se paga. O sintoma é uma conta boa
 * demais, que é o sintoma que ninguém investiga.
 *
 * Ele aparece em TODAS as abas, e não só na de rotas onde nasceu: o custo
 * subestimado contamina os quatro cortes, e uma pessoa que abriu direto a aba
 * de preços não passa pela outra para ser avisada.
 *
 * O conserto é sempre o mesmo: acrescentar o modelo à tabela de preços.
 */
export function UnpricedNote({ summary }: { summary: AdminUsageSummary }) {
  if (summary.unpricedEvents === 0) return null;
  const share =
    summary.totals.totalEvents > 0 ? summary.unpricedEvents / summary.totals.totalEvents : 0;
  return (
    <section className="rounded-2xl border border-scriba-rose-accent/30 bg-scriba-rose p-5">
      <h2 className="text-[14px] font-semibold text-scriba-rose-accent">Custo subestimado</h2>
      <p className="mt-1 text-[12.5px] font-light leading-relaxed text-scriba-ink">
        {INT.format(summary.unpricedEvents)} de {INT.format(summary.totals.totalEvents)} chamadas (
        {percent(share)}) rodaram em modelos que não estão na tabela de preços interna e gravaram
        custo <span className="font-mono">R$ 0,00</span>:{" "}
        <span className="font-mono">{summary.unpricedModels.join(", ")}</span>. Todo custo e toda
        margem desta tela estão baixos na proporção do que elas consumiram. Acrescente esses modelos
        a <span className="font-mono">lib/llm/pricing.ts</span>, os eventos já gravados continuarão
        em zero.
      </p>
    </section>
  );
}

/**
 * A faixa que explica o recorte por versão, e ela não é decoração.
 *
 * Preço é cobrado por AÇÃO, e uma ação tem dois lados que vêm de tabelas
 * diferentes: o CUSTO sai de `llm_usage_events`, que carrega o carimbo de
 * versão, e a MOEDA sai de `coin_transactions`, que não carrega, o débito é
 * por minuto de gravação, não por chamada de LLM. Recortar só o custo daria
 * margem de uma fatia dividida pela receita do mês inteiro: sempre péssima, e
 * errada.
 *
 * Por isso a versão recorta pelo CARIMBO de um lado e pela JANELA em que ela
 * esteve no ar do outro (ver `VersionWindow` em `features/admin/server/db/usage.ts`).
 * A janela precisa aparecer na TELA: um número recortado por uma versão que
 * ficou seis horas no ar é indistinguível de um recortado por um mês, e as
 * duas leituras levam a decisões de preço opostas.
 */
export function VersionWindowNote({ summary }: { summary: AdminUsageSummary }) {
  const w = summary.versionWindow;
  if (!w) return null;
  return (
    <section className="rounded-2xl border border-scriba-blue-soft bg-scriba-blue-soft/40 p-4">
      <p className="text-[12.5px] font-light leading-relaxed text-scriba-ink">
        Tudo abaixo é o recorte da <span className="font-mono font-semibold">v{w.version}</span>:
        custo pelas chamadas que ela carimbou, moedas pelo período em que ela esteve no ar,{" "}
        <span className="font-medium">
          {moment(w.startsAt)}
          {w.endsAt ? ` a ${moment(w.endsAt)}` : " até agora"}
        </span>
        . O ledger de moedas não guarda versão; a janela é a única forma de recortar os dois lados
        da margem pela mesma fatia de calendário.
      </p>
    </section>
  );
}
