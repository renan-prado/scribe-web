"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCoinsState, useCoinsStore } from "@/features/coins/store";
import {
  COIN_RECOVERY_POLL_MS,
  COIN_WARN_MINUTES_CRITICAL,
  COIN_WARN_MINUTES_LOW,
} from "@/features/session/config";
import { useCoinTick } from "@/features/session/hooks/useCoinTick";
import type { ChargeReason } from "@/lib/coins/pricing";
import { createLogger } from "@/lib/log";

const log = createLogger("coins");

/**
 * Política de saldo de uma gravação em curso. Reúne três comportamentos que
 * antes não existiam ou estavam espalhados:
 *
 *  1. AVISO ANTECIPADO. Enquanto grava, observa quantos minutos ainda cabem no
 *     saldo e avisa em dois degraus (5 min e 2 min). Cada degrau dispara uma
 *     vez só, e rearma se o saldo voltar a subir — comprar créditos no meio do
 *     caminho não deixa o aviso "gasto".
 *
 *  2. CONGELAR EM VEZ DE ENCERRAR. Quando o débito falha por saldo
 *     insuficiente, a captura é PAUSADA (`onFreeze`), não finalizada. Este é o
 *     ponto do comportamento antigo que mais custava ao usuário: acabar o
 *     crédito no meio de um sermão encerrava a gravação e disparava o resumo
 *     com metade do conteúdo, sem chance de reagir. Agora nada é perdido — o
 *     transcript, a fila de chunks e o feed continuam em memória, esperando.
 *
 *  3. DESCONGELAR SOZINHO. O pagamento acontece em outra aba, então esta
 *     página não recebe evento nenhum. O hook ressincroniza o saldo no `focus`
 *     da janela e por polling curto enquanto congelado (só com a aba visível,
 *     para não gastar bateria em segundo plano). Assim que o crédito entra, a
 *     trava cai sozinha e o usuário só precisa apertar "Retomar".
 *
 * O hook NÃO retoma a captura sozinho: reabrir o microfone sem um gesto
 * explícito seria surpreendente (e, em alguns navegadores, bloqueado).
 */

export type CoinGuard = {
  /** True enquanto a gravação está congelada por falta de crédito. */
  outOfCoins: boolean;
  /** Minutos de gravação que o saldo atual ainda paga (null = carregando). */
  minutesLeft: number | null;
  /** Baixa a trava manualmente — usado ao retomar. */
  clear: () => void;
};

type Args = {
  /** Gravando de fato (running && !paused). */
  enabled: boolean;
  reason: ChargeReason;
  sessionId: string;
  /** Custo por minuto iniciado deste modo — base do cálculo de minutos. */
  costPerMinute: number;
  /** Congela a captura. Deve ser a MESMA função do botão de pausa. */
  onFreeze: () => void;
  /** Avisos de saldo baixo. Recebe quantos minutos restam. */
  onWarn?: (minutesLeft: number, level: "low" | "critical") => void;
  /** Chamado uma vez quando o crédito volta e a trava cai. */
  onRecovered?: () => void;
};

export function useCoinGuard({
  enabled,
  reason,
  sessionId,
  costPerMinute,
  onFreeze,
  onWarn,
  onRecovered,
}: Args): CoinGuard {
  const [outOfCoins, setOutOfCoins] = useState(false);
  const balance = useCoinsStore((s) => s.balance);

  const onFreezeRef = useRef(onFreeze);
  onFreezeRef.current = onFreeze;
  const onWarnRef = useRef(onWarn);
  onWarnRef.current = onWarn;
  const onRecoveredRef = useRef(onRecovered);
  onRecoveredRef.current = onRecovered;

  /** Degraus já avisados nesta "descida" de saldo. Zerados quando sobe. */
  const warnedRef = useRef<{ low: boolean; critical: boolean }>({ low: false, critical: false });

  const minutesLeft =
    balance === null || costPerMinute <= 0 ? null : Math.floor(balance / costPerMinute);

  // ---- 2) congelar no esgotamento ----------------------------------------
  const handleDepleted = useCallback(() => {
    log.debug("depleted — freezing capture", { sessionId, reason });
    setOutOfCoins(true);
    onFreezeRef.current();
  }, [sessionId, reason]);

  useCoinTick({ enabled, reason, sessionId, onDepleted: handleDepleted });

  // ---- 1) avisos antecipados ---------------------------------------------
  useEffect(() => {
    if (!enabled || minutesLeft === null) return;

    // Rearma os degraus assim que o saldo volta a folgar — sem isto, comprar
    // créditos e cair de novo no vermelho passaria batido.
    if (minutesLeft > COIN_WARN_MINUTES_LOW) {
      warnedRef.current = { low: false, critical: false };
      return;
    }
    if (minutesLeft <= 0) return; // o congelamento cuida deste caso

    if (minutesLeft <= COIN_WARN_MINUTES_CRITICAL) {
      if (!warnedRef.current.critical) {
        warnedRef.current.critical = true;
        warnedRef.current.low = true;
        onWarnRef.current?.(minutesLeft, "critical");
      }
      return;
    }
    if (!warnedRef.current.low) {
      warnedRef.current.low = true;
      onWarnRef.current?.(minutesLeft, "low");
    }
  }, [enabled, minutesLeft]);

  // ---- 3) descongelar quando o crédito chega ------------------------------
  useEffect(() => {
    if (!outOfCoins) return;

    let cancelled = false;

    const sync = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const next = await getCoinsState().refresh();
      if (cancelled || next === null) return;
      if (next >= costPerMinute) {
        log.debug("balance recovered — unfreezing", { sessionId, balance: next });
        setOutOfCoins(false);
        warnedRef.current = { low: false, critical: false };
        onRecoveredRef.current?.();
      }
    };

    const interval = setInterval(() => void sync(), COIN_RECOVERY_POLL_MS);
    // A volta da aba de pagamento é o sinal mais rápido que temos.
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    void sync();

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [outOfCoins, costPerMinute, sessionId]);

  const clear = useCallback(() => setOutOfCoins(false), []);

  return { outOfCoins, minutesLeft, clear };
}
