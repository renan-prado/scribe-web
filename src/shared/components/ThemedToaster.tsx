import { Toaster } from "sonner";

/**
 * O sonner desenha num portal FORA da árvore de tokens, então ele não herda a
 * classe `.dark` e precisa do tema na mão.
 *
 * Era um componente cliente só para ler o `useTheme`. O produto tem um tema
 * só, então o valor é literal e o componente voltou a ser servidor — um
 * `"use client"` a menos no root layout, que é a árvore que toda visita
 * carrega.
 */
export function ThemedToaster() {
  return <Toaster position="top-center" richColors theme="dark" />;
}
