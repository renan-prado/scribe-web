"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatCoins } from "@/features/billing/plans";
import { usePendingGifts, useRedeemGift } from "@/features/coins/gifts-query";
import { useCoinsStore } from "@/features/coins/store";

/**
 * O cartão de um presente de moedas, acima das pastas na Biblioteca — o mesmo
 * lugar de `PendingCaptures`, e não por acaso: as duas são coisas que
 * precisam de atenção antes do acervo em si.
 *
 * **Ele NÃO credita nada por conta própria.** O admin só emitiu a PROMESSA
 * (`coin_gifts`, migração 0077); o crédito de verdade acontece no clique do
 * botão, via `POST /api/coins/gifts/:id/redeem`. Até lá a pessoa vê o título e
 * a mensagem que o admin escreveu, e nada muda no saldo.
 *
 * **Ele some sozinho depois do resgate**, pela invalidação da query — não há
 * "dispensar": ou a pessoa ainda não resgatou (o cartão fica) ou já resgatou
 * (ele não existe mais).
 *
 * **É verde, a família `--scriba-mint`**, o "lado bom" do sistema semântico de
 * cor (ver `src/shared/AGENTS.md`) — a mesma usada nos avisos de crédito do
 * financeiro. Um presente é boa notícia, e a cor confirma isso antes de a
 * pessoa ler a primeira palavra.
 *
 * **`hydrated` existe pelo mesmo motivo do de `LibraryBrowser`.** A query fica
 * no cache persistido (IndexedDB), e a restauração dele pode terminar ANTES
 * do primeiro render desta árvore — o servidor não sabe de presente nenhum, o
 * cliente já sabe, e o React descarta a árvore inteira por mismatch. Um quadro
 * de atraso, sem ida à rede, resolve.
 */
export function CoinGiftBanner() {
  const { data } = usePendingGifts();
  const redeem = useRedeemGift();
  const refreshBalance = useCoinsStore((s) => s.refresh);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const gifts = hydrated ? data : undefined;
  if (!gifts || gifts.length === 0) return null;

  async function handleRedeem(giftId: string, amount: number) {
    try {
      await redeem.mutateAsync(giftId);
      void refreshBalance();
      toast.success(`${formatCoins(amount)} moedas resgatadas!`);
    } catch {
      toast.error("Não foi possível resgatar agora. Tente de novo em alguns instantes.");
    }
  }

  return (
    <section className="flex flex-col gap-3">
      {gifts.map((gift) => (
        <div
          key={gift.id}
          className="flex flex-col gap-4 rounded-2xl border border-scriba-mint-accent/30 bg-scriba-mint p-5 sm:flex-row sm:items-center"
        >
          {/** biome-ignore lint/performance/noImgElement: sticker local, decorativo */}
          <img
            src="/stickers/men/019-man.svg"
            alt=""
            aria-hidden
            width={96}
            height={96}
            className="h-20 w-20 shrink-0 sm:h-24 sm:w-24"
          />
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-[15px] font-semibold text-scriba-mint-dark">{gift.title}</h2>
              <p className="text-sm leading-relaxed text-scriba-mint-body">{gift.message}</p>
            </div>
            <Button
              type="button"
              className="w-fit"
              disabled={redeem.isPending}
              onClick={() => handleRedeem(gift.id, gift.amount)}
            >
              {redeem.isPending
                ? "Recebendo…"
                : `Receber ${formatCoins(gift.amount)} moedas grátis`}
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
