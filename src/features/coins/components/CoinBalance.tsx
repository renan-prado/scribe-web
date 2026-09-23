"use client";

import { useEffect, useRef, useState } from "react";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { COIN_RING_REFERENCE } from "@/features/coins/pricing";
import { useCoinsStore } from "@/features/coins/store";
import { cn } from "@/lib/utils";

const COIN_C = 2 * Math.PI * 6.5; // circumference for the r=6.5 stroke centerline (stroke-width 13 fills a r=13 disc without overflowing the viewBox)

const DIGIT_TRANSFORM = [
  "[transform:translateY(0px)]",
  "[transform:translateY(-26px)]",
  "[transform:translateY(-52px)]",
  "[transform:translateY(-78px)]",
  "[transform:translateY(-104px)]",
  "[transform:translateY(-130px)]",
  "[transform:translateY(-156px)]",
  "[transform:translateY(-182px)]",
  "[transform:translateY(-208px)]",
  "[transform:translateY(-234px)]",
] as const;

const DIGIT_TRANSITION: Record<number, string> = {
  0: "[transition:transform_650ms_cubic-bezier(0.22,1,0.36,1)_0ms]",
  60: "[transition:transform_650ms_cubic-bezier(0.22,1,0.36,1)_60ms]",
  120: "[transition:transform_650ms_cubic-bezier(0.22,1,0.36,1)_120ms]",
};

function DigitColumn({ digit, delayMs }: { digit: number; delayMs: number }) {
  return (
    <span
      aria-hidden
      className="relative inline-block h-6.5 w-[0.6em] overflow-hidden align-middle"
    >
      <span
        className={cn(
          "block will-change-transform",
          DIGIT_TRANSFORM[digit],
          DIGIT_TRANSITION[delayMs] ?? DIGIT_TRANSITION[0]
        )}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} className="flex h-6.5 items-center justify-center leading-none">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

function Odometer({ value, minWidth = 3 }: { value: number; minWidth?: number }) {
  const str = String(Math.max(0, Math.floor(value))).padStart(minWidth, "0");
  const digits = str.split("").map((d) => Number(d));
  const firstNonZero = digits.findIndex((d) => d !== 0);
  const firstReal = firstNonZero === -1 ? digits.length - 1 : firstNonZero;

  return (
    <span aria-hidden className="inline-flex h-6.5 items-center">
      {digits.map((d, i) => {
        const hidden = i < firstReal;
        const delay = (digits.length - 1 - i) * 60;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional digit slots, order is stable, index is the correct key
          <span key={`slot-${i}`} className={cn("inline-block", hidden && "invisible")}>
            <DigitColumn digit={d} delayMs={delay} />
          </span>
        );
      })}
    </span>
  );
}

/**
 * Chip de saldo do header. Clicável: abre o `BillingDialog`, de onde o usuário
 * compra um pacote avulso ou assina um plano. `interactive={false}` devolve o
 * chip puramente informativo (usado onde não faz sentido vender).
 *
 * ## Ele tem DOIS modos, e a regra que os separa é uma frase
 *
 * **O número absoluto é a verdade de quem NÃO renova; a porcentagem é a de quem
 * renova.** Para a conta gratuita nada mudou: 50 créditos são tudo o que
 * existe, ninguém vai repor, e ver o número cair é exatamente o que precisa
 * acontecer — esconder isso seria esconder o que ela precisa saber para decidir
 * se grava o culto de domingo.
 *
 * Para quem assina, aquele odômetro MENTE: o crédito volta todo mês e ainda
 * acumula, mas ele só anda para baixo, e a leitura que a cabeça faz de um
 * número descendo é "está acabando". Quem paga vê o anel do crédito do mês e o
 * nome do plano, sem número nenhum — porque não há nada que ele possa fazer com
 * o número, e é isso que separa informação de ansiedade. O número real está a
 * dois toques, no `BillingDialog`.
 *
 * **Ele volta sozinho quando passa a importar**: com a franquia do mês gasta E
 * a reserva abaixo de `LOW_RESERVE_COINS`, o anel fica âmbar e o saldo volta
 * escrito. Aí a informação é acionável, e é dever nosso dá-la sem rodeio.
 *
 * Desenho completo em `docs/creditos-na-tela.md`.
 */

/**
 * Abaixo disto o saldo volta a aparecer. 150 moedas ≈ meia hora de gravação, a
 * menor unidade de trabalho que alguém planeja fazer com o app: é o ponto em
 * que "quanto me resta?" deixa de ser curiosidade e vira uma decisão.
 */
const LOW_RESERVE_COINS = 150;

export function CoinBalance({
  initialBalance,
  interactive = true,
  planName,
}: {
  initialBalance: number;
  interactive?: boolean;
  /** Nome do plano ativo. Sem ele o chip fica no modo do saldo absoluto. */
  planName?: string | null;
}) {
  const storeBalance = useCoinsStore((s) => s.balance);
  const cycle = useCoinsStore((s) => s.cycle);

  // **Ele não semeia mais a store, e não ressincroniza nada.** As duas coisas
  // moravam aqui e NÃO FUNCIONAVAM: este chip vive dentro do menu da conta, que
  // é um popup, e base-ui só monta o conteúdo de um `DropdownMenu` quando ele
  // abre. Enquanto ninguém tocasse no avatar, a store ficava em `null` e todo
  // gate que a lê ficava preso em "carregando" — no `/import` isso era o
  // botão Importar substituído por uma pastilha pulsando que nunca terminava.
  // As duas passaram para o `CoinsSync`, no layout de `(shell)`, que está
  // sempre montado; o porquê inteiro está no cabeçalho de lá.
  //
  // O `initialBalance` fica, e agora é só o que ele sempre foi de verdade: o
  // número a desenhar enquanto a store não respondeu.
  const balance = storeBalance ?? initialBalance;
  const prevBalanceRef = useRef(balance);
  const [flash, setFlash] = useState<"debit" | "credit" | null>(null);

  useEffect(() => {
    const prev = prevBalanceRef.current;
    if (balance !== prev) {
      setFlash(balance < prev ? "debit" : "credit");
      const id = window.setTimeout(() => setFlash(null), 700);
      prevBalanceRef.current = balance;
      return () => window.clearTimeout(id);
    }
  }, [balance]);

  // A reserva é o que sobrou dos meses anteriores: saldo menos o que ainda há
  // da franquia deste mês. É ela que decide se o fim da franquia é um aviso ou
  // um não-evento.
  const monthLeft = cycle ? Math.max(0, cycle.grant - cycle.spent) : null;
  const reserve = cycle ? Math.max(0, balance - (monthLeft ?? 0)) : balance;
  const lowOnCredit = cycle !== null && monthLeft === 0 && reserve < LOW_RESERVE_COINS;

  // O modo calmo: assina, tem franquia e ainda há folga. Só aí o número sai da
  // tela — sem plano não há renovação, e com a reserva no fim há o que decidir.
  const quiet = cycle !== null && !!planName && !lowOnCredit;

  const percent = quiet
    ? Math.max(0, Math.min(100, ((monthLeft ?? 0) / Math.max(1, cycle.grant)) * 100))
    : Math.max(0, Math.min(100, (balance / COIN_RING_REFERENCE) * 100));
  const filled = (percent / 100) * COIN_C;

  const chip = (
    <span
      className={cn(
        "flex select-none items-center gap-[7px] rounded-[20px] py-1 pr-3 pl-2.5 transition-colors duration-500",
        flash === "debit"
          ? "bg-scriba-flash-debit"
          : flash === "credit"
            ? "bg-scriba-flash-credit"
            : "bg-scriba-gold-soft"
      )}
    >
      <span className="relative flex size-6.5 flex-none items-center justify-center">
        {/* biome-ignore lint/a11y/noSvgWithoutTitle: aria-hidden decorative coin ring */}
        <svg
          className="absolute inset-0 -rotate-90"
          width="26"
          height="26"
          viewBox="0 0 26 26"
          aria-hidden
        >
          <circle cx="13" cy="13" r="13" fill="var(--scriba-gold-track)" />
          <circle
            cx="13"
            cy="13"
            r="6.5"
            fill="none"
            stroke="var(--scriba-yellow)"
            strokeWidth="13"
            strokeDasharray={`${filled} ${COIN_C - filled}`}
          />
        </svg>
        <span className="relative flex size-5 items-center justify-center rounded-full bg-scriba-paper">
          <span className="coin-hex block h-[10.625px] w-[9.35px] bg-scriba-yellow" />
        </span>
      </span>
      <span className="inline-flex h-6.5 flex-none items-center text-[13px] font-semibold leading-none text-scriba-gold-ink">
        {quiet ? (
          // O nome do plano ocupa o lugar que o odômetro deixou, e ele diz a
          // coisa que o assinante quer confirmar de relance ("estou no Pessoal,
          // está tudo certo"). O chip deixa de ser medidor de combustível e
          // vira crachá.
          <span className="max-w-24 truncate">{planName}</span>
        ) : (
          <span className="tabular-nums">
            <Odometer value={balance} />
          </span>
        )}
      </span>
    </span>
  );

  // O rótulo acessível NUNCA esconde o número: quem usa leitor de tela não tem
  // um anel para olhar, e a decisão de esconder é sobre ATENÇÃO VISUAL, não
  // sobre transparência.
  const label = quiet
    ? `Plano ${planName}. ${monthLeft} de ${cycle.grant} créditos do mês restantes, ${reserve} de reserva.`
    : `${balance} moedas restantes`;

  if (!interactive) {
    return (
      <span role="status" aria-label={label} className="inline-flex">
        {chip}
      </span>
    );
  }

  return (
    <BillingDialog
      trigger={chip}
      triggerLabel={`${label} Adicionar créditos.`}
      triggerClassName={cn(
        "inline-flex rounded-[20px] outline-none transition-transform",
        "hover:brightness-[0.97] active:scale-[0.97]",
        "focus-visible:ring-2 focus-visible:ring-scriba-yellow/60"
      )}
    />
  );
}
