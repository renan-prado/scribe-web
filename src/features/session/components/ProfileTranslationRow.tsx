"use client";

import { BookOpen, Check, ChevronDown } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveBibleTranslation } from "@/features/session/lib/api";
import {
  DEFAULT_TRANSLATION,
  SELECTABLE_TRANSLATIONS,
  TRANSLATIONS,
  type TranslationId,
} from "@/lib/bibles/translations";
import { cn } from "@/lib/utils";

/**
 * "Tradução da Bíblia" no /profile: a preferência de quem LÊ, que vale para
 * toda passagem que não tenha escolha própria.
 *
 * ## "Padrão do Scriba" é uma opção de verdade, e não a primeira da lista
 *
 * Ela grava `null`, e existe porque o padrão do produto pode mudar: quem
 * escolher a Bíblia Livre hoje e vier a preferir sempre o que nós
 * escolhermos não tem como voltar a esse estado se a única forma de sair de
 * uma tradução for entrar em outra. É o mesmo raciocínio do tema "sistema".
 *
 * ## O molde é o das IRMÃS, não o dos cartões da página
 *
 * Dentro de "Preferências" há três linhas (tema, Bíblia, instalar o app) e elas
 * dividem uma anatomia: disco de 36px, `gap-3`, RÓTULO em maiúsculas pequenas
 * sobre o VALOR atual, e o controle na ponta. Esta linha nasceu com o molde
 * errado, o dos cartões da página (`ProfileTourRow`, "Indique a um amigo"):
 * disco de 44px arredondado, `gap-3.5` e uma frase de descrição no lugar do
 * valor. Como cartão ela seria coerente; dentro do mesmo cartão das outras
 * duas, ela ficava um degrau fora do prumo em tudo, ícone, recuo do texto e
 * altura.
 *
 * A descrição saiu junto, e não por espaço: nestas linhas quem responde é o
 * VALOR. "Bíblia Livre" embaixo de "Tradução da Bíblia" diz o que a frase
 * dizia, na forma que as vizinhas usam.
 *
 * ## E o crédito fica aqui
 *
 * A Bíblia Livre é CC BY 4.0 Brasil: uso livre, menção obrigatória. Na tela de
 * leitura a menção é a SIGLA na pastilha, que é o que os próprios autores
 * dizem bastar em espaço curto; aqui há linha para o crédito inteiro, e é o
 * único lugar do produto onde ele cabe por extenso. Ele acompanha a tradução
 * escolhida, não o `DEFAULT_TRANSLATION`: quem está lendo Almeida 1911, que é
 * domínio público, não tem a quem creditar.
 */
export function ProfileTranslationRow({ current }: { current: TranslationId | null }) {
  const [chosen, setChosen] = useState<TranslationId | null>(current);
  const [pending, startTransition] = useTransition();
  const effective = chosen ?? DEFAULT_TRANSLATION;
  const credit = TRANSLATIONS[effective].credit;

  function choose(next: TranslationId | null) {
    const previous = chosen;
    // Otimista: a lista fecha com a escolha já na tela. Desfaz na falha, que é
    // o mesmo desenho da escrita da Biblioteca: um controle que só responde
    // depois da rede lê como travado.
    setChosen(next);
    startTransition(async () => {
      const ok = await saveBibleTranslation(next);
      if (!ok) {
        setChosen(previous);
        toast.error("Não consegui salvar a tradução. Tente de novo.");
      }
    });
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3">
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-scriba-blue-soft text-scriba-blue-ink">
          <BookOpen aria-hidden className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-scriba-ink-mute">
            Tradução da Bíblia
          </span>
          <span className="truncate text-sm font-medium text-scriba-ink-strong">
            {TRANSLATIONS[effective].name}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            // `h-9`, a altura do disco à esquerda e a da pílula do tema, que é
            // o controle da linha de cima: três alturas diferentes em três
            // linhas empilhadas é o que fazia a coluna da direita balançar.
            className="inline-flex h-9 flex-none items-center gap-1.5 rounded-full bg-scriba-surface px-3.5 text-xs font-semibold text-scriba-ink-strong ring-1 ring-scriba-hairline outline-none transition-colors hover:bg-v2-card-hover focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
          >
            {TRANSLATIONS[effective].short}
            <ChevronDown aria-hidden className="size-3.5 text-scriba-ink-mute" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {SELECTABLE_TRANSLATIONS.map((option) => (
              <DropdownMenuItem
                key={option.id}
                onClick={() => choose(option.id)}
                className="items-start gap-2.5"
              >
                <Check
                  aria-hidden
                  className={cn(
                    "mt-0.5 size-3.5 flex-none",
                    chosen === option.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{option.name}</span>
                  <span className="text-xs font-light leading-snug text-muted-foreground">
                    {option.hint}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => choose(null)} className="items-start gap-2.5">
              <Check
                aria-hidden
                className={cn("mt-0.5 size-3.5 flex-none", chosen ? "opacity-0" : "opacity-100")}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">Padrão do Scriba</span>
                <span className="text-xs font-light leading-snug text-muted-foreground">
                  Hoje é a {TRANSLATIONS[DEFAULT_TRANSLATION].name}. Acompanha o que escolhermos.
                </span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* O crédito alinha com o TEXTO da linha, não com o disco: os 48px são o
          disco (36) mais o `gap-3` (12). Alinhado à esquerda do disco, ele lia
          como um terceiro item da lista em vez de nota daquela linha. */}
      {credit ? (
        <p className="mt-4 pl-12 text-[11px] font-light leading-relaxed text-scriba-ink-mute">
          {credit}
        </p>
      ) : null}
    </div>
  );
}
