"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/shared/hooks/use-theme";

/**
 * O sonner desenha num portal FORA da árvore de tokens, então ele não herda a
 * classe do `<html>` e precisa do tema na mão.
 *
 * Ele voltou a ser um componente CLIENTE quando o produto voltou a ter dois
 * temas. Enquanto havia um só, o valor era literal e isto era servidor — um
 * `"use client"` a menos na árvore que toda visita carrega. O custo de volta é
 * esse, e não há como evitá-lo: o tema mora no localStorage, que só o cliente
 * lê, e um toast escuro numa tela clara é o tipo de coisa que aparece
 * justamente no pior momento, em cima de um erro.
 */
export function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-center"
      richColors
      theme={theme}
      // O preto puro (`--normal-bg`) é o padrão do sonner para o tema escuro,
      // e nenhum toast SEM tipo (o "Conteúdo atualizado!" do puxar-para-
      // atualizar, por exemplo) usa `richColors` — ele fica nesse preto. Aqui
      // ele vira o mesmo VIDRO do dock mobile (`--v2-glass-panel` +
      // `backdrop-blur`), não um cinza chapado: no claro o token já responde
      // com a superfície sólida certa (ver "O dock" em `src/shared/AGENTS.md`).
      style={
        {
          "--normal-bg": "var(--v2-glass-panel)",
          "--normal-border": "var(--v2-glass-edge)",
          "--normal-text": "var(--scriba-ink)",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "backdrop-blur-xl" } }}
    />
  );
}
