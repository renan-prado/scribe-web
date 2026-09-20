"use client";

import { useCaptureQueue } from "../capture-queue";
import { PendingCaptureNote } from "./PendingCaptureNote";

/**
 * O bloco das gravações que ainda não viraram resumo, no topo da Biblioteca.
 *
 * **Ele fica ACIMA dos meses, num bloco próprio, e não misturado ao mural.**
 * Uma gravação pendente não tem título nem autor, que é justamente o que os
 * meses ordenam; enfiada em "Setembro" ela viraria um cartão estranho no meio
 * de cartões iguais, e o aviso que ela carrega dependeria de a pessoa rolar até
 * o lugar certo. No topo, ele é a primeira coisa que se lê ao abrir o app, que
 * é o único momento em que essa informação tem valor.
 *
 * **Ele some sozinho.** Não há botão de dispensar, e isso é deliberado: o
 * cartão não é um aviso sobre uma gravação, ele É a gravação. Ele sai da tela
 * quando o resumo existe (e aí o post-it de verdade aparece lá embaixo) ou
 * quando a pessoa apaga o áudio, e nunca antes disso.
 *
 * **Durante a busca ele não aparece.** Quem abriu a lupa está procurando um
 * sermão pelo nome ou por algo que foi dito nele, e uma gravação sem
 * transcrição não casa com nada: ela ficaria fixa no topo de toda busca,
 * inclusive das que não encontraram nada, dizendo "1 resultado" onde houve
 * zero.
 */
export function PendingCaptures({ now }: { now: Date }) {
  const captures = useCaptureQueue((s) => s.captures);
  if (captures.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-1 text-[15px] font-medium text-v2-ink-soft">
        {captures.length === 1
          ? "Esperando para ser processada"
          : "Esperando para serem processadas"}
      </h2>
      {/* O MESMO mural dos meses (ver `LibraryBrowser`), para o bloco não ler
          como outra tela colada em cima da Biblioteca. Com um cartão só ele é
          uma coluna, o que é o certo: o aviso ocupa o canto, não a faixa. */}
      <ul className="columns-2 gap-4 sm:columns-3 lg:columns-4">
        {captures.map((capture) => (
          <PendingCaptureNote key={capture.id} capture={capture} now={now} />
        ))}
      </ul>
    </section>
  );
}
