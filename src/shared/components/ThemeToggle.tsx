"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/shared/hooks/use-theme";

type ThemeToggleProps = {
  className?: string;
  /**
   * Botão redondo de 36px, só o glifo, em vez da pílula de 68px. Para barras
   * apertadas, onde a pílula disputaria espaço com o CTA ou o saldo.
   */
  compact?: boolean;
};

/**
 * O switch de tema: uma pílula com os dois glifos IMPRESSOS na trilha e um
 * botão que desliza sobre o ativo.
 *
 * Os dois glifos ficam visíveis o tempo todo de propósito. Um controle que
 * mostra só o estado atual não diz o que o toque vai fazer, e um que mostra só
 * o destino não diz onde se está; com os dois na trilha, a posição do botão
 * responde as duas perguntas de uma vez.
 *
 * A TRILHA é `--scriba-surface`, que dentro de um cartão é o chão virando
 * encaixe — o mesmo papel que ele tem na trilha de uma barra de progresso. O
 * botão é `--scriba-paper`, a superfície elevada. Nos dois temas o par
 * continua dizendo a mesma coisa: algo pousado dentro de um sulco.
 *
 * Tudo abaixo dele reage à classe que isto escreve no `<html>`; ver `useTheme`
 * e `ThemeScript`.
 *
 * **Ele é `role="switch"` e não dois botões de rádio.** São dois estados, e
 * `aria-checked` já é a resposta; um grupo de rádio exigiria rótulo de grupo
 * mais dois rótulos de opção para dizer o que uma frase diz.
 */
export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { isDark, toggleTheme, mounted } = useTheme();

  const label = isDark ? "Mudar para o tema claro" : "Mudar para o tema escuro";

  if (compact) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={label}
        title={isDark ? "Tema claro" : "Tema escuro"}
        onClick={toggleTheme}
        className={cn(
          "inline-flex size-9 flex-none items-center justify-center rounded-full",
          "bg-scriba-surface text-scriba-ink-soft ring-1 ring-scriba-hairline",
          "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
          "hover:text-scriba-ink-strong",
          className
        )}
      >
        {isDark ? (
          <Moon aria-hidden className="size-4" strokeWidth={2} />
        ) : (
          <Sun aria-hidden className="size-4" strokeWidth={2} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={label}
      title={isDark ? "Tema claro" : "Tema escuro"}
      onClick={toggleTheme}
      className={cn(
        "group relative inline-flex h-9 w-[68px] flex-none items-center rounded-full p-1",
        "bg-scriba-surface ring-1 ring-scriba-hairline",
        "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        className
      )}
    >
      {/* Os glifos da trilha, sempre os dois. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 flex w-1/2 items-center justify-center text-scriba-ink-mute"
      >
        <Sun className="size-3.5" strokeWidth={2} />
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 flex w-1/2 items-center justify-center text-scriba-ink-mute"
      >
        <Moon className="size-3.5" strokeWidth={2} />
      </span>

      {/* O botão que desliza, carregando o glifo do estado ATIVO.

          **Ele é a TINTA, não uma superfície**, e essa foi uma correção: com
          `bg-scriba-paper` ele era o papel pousado no chão, o que funciona no
          escuro (papel é mais claro que o chão) e some no claro, onde os dois
          são quase brancos. Na tinta forte com o glifo na cor da página, ele é
          o objeto de maior contraste do controle nos DOIS temas, que é o que
          se espera de "o estado é este".

          Sem `mounted` não há transição: no primeiro render do cliente o
          componente ainda está no padrão do servidor, e animar dali até o
          estado real faria o controle deslizar sozinho ao abrir a página. */}
      <span
        aria-hidden
        className={cn(
          "relative flex size-7 items-center justify-center rounded-full",
          "bg-scriba-ink-strong text-background shadow-[0_2px_8px_var(--scriba-shadow)]",
          mounted && "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isDark ? "translate-x-[32px]" : "translate-x-0"
        )}
      >
        {isDark ? (
          <Moon className="size-3.5" strokeWidth={2.2} />
        ) : (
          <Sun className="size-3.5" strokeWidth={2.2} />
        )}
      </span>
    </button>
  );
}

/**
 * A variante com rótulo, para superfícies de AJUSTE — hoje, a seção
 * "Preferências" do `/profile`.
 *
 * Ela repete o desenho das outras linhas daquela lista (disco de ícone,
 * rótulo em versalete, valor em negrito, controle à direita) em vez de trazer
 * um layout próprio: ali ela é mais uma preferência, não um destaque.
 */
export function ThemeToggleRow({ className }: ThemeToggleProps) {
  const { isDark } = useTheme();
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="flex size-9 flex-none items-center justify-center rounded-full bg-scriba-blue-soft text-scriba-blue-ink">
        {isDark ? <Moon aria-hidden className="size-4" /> : <Sun aria-hidden className="size-4" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-medium uppercase tracking-wider text-scriba-ink-mute">
          Aparência
        </span>
        <span className="truncate text-sm font-medium text-scriba-ink-strong">
          {isDark ? "Tema escuro" : "Tema claro"}
        </span>
      </div>
      <ThemeToggle />
    </div>
  );
}
