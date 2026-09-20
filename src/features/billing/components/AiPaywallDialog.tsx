"use client";

import { PenLine } from "lucide-react";
import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { ScribaMark } from "@/shared/brand";

/**
 * A parede, quando ela é de IA.
 *
 * ## O que ela diz, e por que essa é a ordem
 *
 * Primeiro o que a pessoa TEM: o editor inteiro, de graça, para sempre. Depois
 * o que falta para a ação que ela acabou de pedir. Nessa ordem, e não na
 * inversa, porque a inversa é o diálogo de sempre — "você atingiu o limite,
 * assine" —, e ele descreve o produto errado. Aqui o editor manual não é uma
 * amostra grátis que vai acabar: ele é o produto, e o que se vende é a máquina
 * que escreve por você.
 *
 * A consequência prática é que este diálogo **sempre oferece uma saída que
 * funciona agora**. Uma parede com um botão só (assinar) trata quem não vai
 * assinar hoje como alguém que não tem mais o que fazer no app; com o
 * "Escrever à mão" ao lado, a resposta ao "não" é uma tela em branco e não a
 * porta da rua.
 *
 * ## Ela não inventa preço nem regra
 *
 * Não há número de moedas nem nome de plano escrito aqui. Quem vende é o
 * `BillingDialog`, que este botão abre por cima — o MESMO que o avatar, o
 * `/profile` e o fim do presente do Biblo abrem. Escrever "a partir de R$ X"
 * nesta tela criaria um quarto lugar com preço, e seria o único que ninguém
 * lembraria de corrigir. Ver `features/billing/plan-features.ts`.
 *
 * **E ela abre um diálogo em vez de navegar para `/assinar`.** Navegar tiraria
 * a pessoa do meio do que ela estava fazendo; o diálogo pousa por cima sem
 * desmontar nada, e quem fechar sem comprar volta exatamente para onde estava.
 * É a mesma decisão da despedida do presente do Biblo.
 */
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** O que a pessoa tentou fazer, na voz dela: "gravar", "importar do YouTube". */
  action: string;
};

export function AiPaywallDialog({ open, onOpenChange, action }: Props) {
  const [billingOpen, setBillingOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              {/* A marca do Scriba, e não um cadeado. Um cadeado é o desenho de
                  "você não pode", e a primeira frase desta tela é justamente o
                  contrário: há muito que você pode, e de graça. */}
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-session-chip-ai">
                <ScribaMark className="size-3" />
                Escrito com IA
              </span>
              <DialogTitle className="text-pretty text-lg font-semibold leading-snug">
                O editor é seu, de graça, para sempre.
              </DialogTitle>
              <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink-soft">
                Escrever, formatar, organizar em tópicos, marcar o que importa e guardar quantos
                textos quiser não custa nada e nunca vai custar. O que precisa de créditos é{" "}
                {action}, porque aí quem escreve é a máquina.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button type="button" onClick={() => setBillingOpen(true)}>
                Ver créditos e planos
              </Button>
              {/* A saída que funciona AGORA. Ver o cabeçalho. */}
              <NavLink
                href="/escrever"
                onClick={() => onOpenChange(false)}
                spinner="none"
                contentClassName="inline-flex items-center justify-center gap-1.5"
                className="inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-scriba-ink-soft transition-colors hover:text-scriba-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
              >
                <PenLine className="size-4" strokeWidth={1.75} />
                Escrever à mão agora
              </NavLink>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BillingDialog open={billingOpen} onOpenChange={setBillingOpen} />
    </>
  );
}
