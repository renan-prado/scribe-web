import type { TranslationId } from "@/lib/bibles/translations";
import { TRANSLATIONS } from "@/lib/bibles/translations";
import { cn } from "@/lib/utils";

/**
 * O crédito da tradução, abaixo do texto bíblico que ele credita.
 *
 * Aparece onde a Bíblia é LIDA — o seletor de passagem e a gaveta da lateral —,
 * porque é ali que há um parágrafo de texto bíblico na tela e espaço embaixo
 * dele. Num cartão de citação no meio do resumo quem faz esse papel é a SIGLA
 * na pastilha, que é o que a própria licença aceita em espaço curto.
 *
 * **É SUTIL de propósito, e isso não é contradição com "obrigatório".** A
 * licença exige que a menção seja adequada ao meio, não que dispute a leitura:
 * 10px, na tinta mais apagada da escala, acima de um fio. Quem está lendo
 * Gênesis 1 não está lendo o crédito, e ele não pode se comportar como se
 * estivesse.
 *
 * Devolve `null` para tradução sem crédito a dar (a Almeida 1911 é domínio
 * público), e é por isso que ele mora num componente e não numa linha copiada
 * nas duas telas: a condição é uma regra, não um `if` para cada lugar.
 */
export function TranslationCredit({
  translation,
  className,
}: {
  translation: TranslationId;
  className?: string;
}) {
  const credit = TRANSLATIONS[translation].credit;
  if (!credit) return null;

  return (
    <p
      className={cn(
        // O fio tem AR dos dois lados, e bem mais do que parecia bastar: ele
        // separa o último versículo (que é o conteúdo) de uma nota de rodapé
        // (que não é), e a 12px/10px as três coisas liam como um bloco só. A
        // folga de cima é maior que a de baixo de propósito, porque o crédito
        // pertence ao fio e o versículo não.
        "mt-7 border-t border-scriba-hairline pt-5 text-[10px] font-light leading-relaxed text-scriba-ink-mute/80",
        className
      )}
    >
      {credit}
    </p>
  );
}
