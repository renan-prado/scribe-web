/**
 * Feedback tátil do feed ao vivo. Um toque curto quando um card novo fica
 * visível — o ouvinte percebe sem precisar olhar a tela o tempo todo.
 *
 * Dois caminhos, ambos best-effort:
 * - `navigator.vibrate` (Android/Chrome). Só funciona depois de um gesto do
 *   usuário na página (o toque no botão de gravar já habilita) e é ignorado
 *   pelo browser enquanto a aba está em background.
 * - `haptics:tap` pelo bridge RN. iOS/Safari NÃO implementa a Vibration API,
 *   então dentro do app nativo quem vibra é a shell (expo-haptics/Taptic).
 *   Em browser normal isso vira no-op.
 */
import { postNativeEvent } from "@/features/session/lib/nativeBridge";

/**
 * Toque duplo leve. Pulsos de 20ms porque muitos motores Android não
 * registram nada abaixo de ~15ms; a pausa de 60ms faz o padrão ser sentido
 * como "notificação discreta" e não como alarme.
 */
const NEW_CARD_PATTERN = [20, 60, 20];

export function vibrateNewCard(): void {
  if (typeof window === "undefined") return;

  postNativeEvent({ type: "haptics:tap" });

  try {
    navigator.vibrate?.(NEW_CARD_PATTERN);
  } catch {
    // engolido — alguns browsers lançam se a página não tem user activation
  }
}
