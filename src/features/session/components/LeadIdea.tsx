import { ScribaMark } from "@/shared/brand";

/**
 * A FRASE DE ABERTURA de uma leitura: a "Ideia central" do resumo e a "Tese
 * central" do estudo.
 *
 * Um componente só para as duas porque elas são a mesma coisa em telas
 * diferentes — a única frase que a IA escreve SOBRE o texto, e não a partir
 * dele, posta no topo para dizer do que aquilo trata antes de a pessoa
 * decidir ler. O estudo desenhava a sua à mão, com filete verde e corpo
 * próprio, e o resultado era que abrir um estudo parecia abrir outro produto.
 *
 * O rótulo continua sendo de cada tela: no resumo é a ideia do SERMÃO, no
 * estudo é a tese que o próprio estudo defende, e chamar as duas de "ideia
 * central" apagaria a diferença que importa.
 *
 * Duas roupas:
 *
 * - `"card"`: o mesmo cartão do bloco `conclusion`, superfície em degradê e a
 *   marca do Scriba na pastilha. As duas frases que a IA escreve sobre o texto
 *   passam a ter a mesma roupa, uma abrindo e a outra fechando a leitura. **As
 *   cores saem de tokens de sessão**, então dentro de `.tone-study` o mesmo
 *   cartão nasce verde sem uma linha a mais.
 * - `"rule"`: filete à esquerda e texto solto, o resumo montado no `/recording`.
 *
 * Não leva `"use client"`: o `/summary` o monta de dentro de um componente
 * cliente e a página do estudo, que é servidor, o monta direto.
 */
type Props = {
  /** "Ideia central" no resumo, "Tese central" no estudo. */
  label: string;
  text: string;
  variant?: "rule" | "card";
  /** O `data-tour` do passo que aponta para esta frase, quando há um. */
  tourId?: string;
};

export function LeadIdea({ label, text, variant = "rule", tourId }: Props) {
  if (!text) return null;

  if (variant === "card") {
    return (
      <section
        data-tour={tourId}
        className="animate-insight-gradient relative flex flex-col gap-3 rounded-[26px] bg-[image:var(--session-surface-quote)] bg-[size:200%_100%] p-6"
      >
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-session-chip-ai">
          <ScribaMark className="size-3" />
          {label}
        </span>
        {/* Corpo nas MESMAS medidas do bloco `conclusion`
            (`text-[15px] font-light leading-[1.7]`): se as duas têm a mesma
            roupa, ter tamanhos diferentes faria uma parecer mais importante
            que a outra. Quem dá destaque à abertura é o lugar dela, no topo,
            não o corpo da letra. */}
        <p
          key={text}
          className="animate-content-fade text-pretty text-[15px] font-light leading-[1.7] text-session-verse-text"
        >
          {text}
        </p>
      </section>
    );
  }

  return (
    <div
      data-tour={tourId}
      className="-mb-2 flex flex-col gap-2 border-l-[2.5px] border-scriba-ink-soft pl-4"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
        {label}
      </span>
      <p
        key={text}
        className="animate-content-fade text-pretty text-lg font-normal leading-snug text-scriba-ink-strong text-balance"
      >
        {text}
      </p>
    </div>
  );
}
