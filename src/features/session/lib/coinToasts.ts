"use client";

import { toast } from "sonner";

/**
 * Avisos de saldo durante uma gravação. Ficam num arquivo próprio porque os
 * três modos de captura (live, áudio, transcrição) precisam exatamente do
 * mesmo texto e do mesmo botão de ação — divergir aqui seria confundir o
 * usuário conforme o modo.
 *
 * O botão "Adicionar créditos" abre o diálogo de compra na PRÓPRIA página: em
 * gravação, navegar para outro lugar destruiria o MediaRecorder e a fila de
 * chunks ainda não enviada.
 */

export function warnLowCoins(
  minutesLeft: number,
  level: "low" | "critical",
  onAddCredits: () => void
): void {
  const minutes = `${minutesLeft} min`;
  const action = { label: "Adicionar", onClick: onAddCredits };

  if (level === "critical") {
    toast.error(`Só restam ~${minutes} de gravação.`, {
      description:
        "Ao zerar, a captura é congelada (nada é perdido) até você adicionar créditos ou encerrar.",
      duration: 12_000,
      action,
    });
    return;
  }

  toast.warning(`Restam ~${minutes} de gravação.`, {
    description: "Adicione créditos agora para não interromper o que está ouvindo.",
    duration: 9_000,
    action,
  });
}

export function notifyCoinsRecovered(): void {
  toast.success("Créditos recebidos.", {
    description: "Pode retomar a gravação de onde parou.",
  });
}
