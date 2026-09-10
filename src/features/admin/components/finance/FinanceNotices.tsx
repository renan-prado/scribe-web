import { AlertTriangle, Info } from "lucide-react";

/**
 * A faixa de avisos do painel financeiro.
 *
 * Ela é obrigatória em toda tela que mostra um total, e a razão é a mesma que
 * levou `/admin/usage` a abrir com o aviso de modelo sem preço: um painel
 * financeiro erra em SILÊNCIO. Sem cotação do dólar, sem custo recorrente
 * cadastrado ou com a receita de assinatura lançada duas vezes, o total
 * continua sendo um número plausível, e o sintoma é sempre uma conta boa
 * demais, que é a que ninguém investiga.
 *
 * Amarelo e não vermelho: nada aqui está quebrado, e um vermelho que aparece
 * toda visita deixa de ser lido. O vermelho fica reservado para o que impede
 * a leitura (`tone="danger"`), como a ausência total de cotação.
 */
export function FinanceNotices({
  warnings,
  tone = "warning",
}: {
  warnings: string[];
  tone?: "warning" | "danger" | "info";
}) {
  if (warnings.length === 0) return null;

  const styles = {
    warning: {
      wrap: "border-scriba-cream-accent/30 bg-scriba-cream",
      icon: "text-scriba-cream-accent",
      text: "text-scriba-cream-ink",
    },
    danger: {
      wrap: "border-scriba-rose-accent/30 bg-scriba-rose",
      icon: "text-scriba-rose-accent",
      text: "text-scriba-rose-ink",
    },
    info: {
      wrap: "border-scriba-hairline bg-scriba-lilac",
      icon: "text-scriba-lilac-accent",
      text: "text-scriba-lilac-ink",
    },
  }[tone];

  const Icon = tone === "info" ? Info : AlertTriangle;

  return (
    <section className={`flex flex-col gap-2 rounded-2xl border p-4 ${styles.wrap}`}>
      {warnings.map((warning) => (
        <p
          key={warning}
          className={`flex items-start gap-2 text-[12.5px] leading-[1.5] ${styles.text}`}
        >
          <Icon className={`mt-0.5 size-4 shrink-0 ${styles.icon}`} />
          <span>{warning}</span>
        </p>
      ))}
    </section>
  );
}

/**
 * A legenda que separa MEDIDO de DIGITADO.
 *
 * A mesma decisão de `/admin/precificacao`: um painel em que os dois lados
 * parecem igualmente factuais convida a decidir com base num número que
 * alguém inventou. Aqui a divisão é ainda mais afiada, porque metade da
 * receita e quase todo o custo variável vêm de medição real e a outra metade
 * é digitada à mão.
 */
export function MeasuredBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-scriba-mint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-scriba-mint-accent">
      {children}
    </span>
  );
}

export function ManualBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-scriba-lilac px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-scriba-lilac-accent">
      {children}
    </span>
  );
}
