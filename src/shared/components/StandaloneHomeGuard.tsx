"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useIsStandalone } from "@/shared/hooks/use-standalone";

/**
 * Dentro do app instalado, a landing page não é destino: troca `/` por
 * `/sign-in` — que, com sessão, o proxy encaminha para `/feed`.
 *
 * **A `start_url` do manifest não basta.** Ela manda no lançamento pelo ícone
 * no Android, mas o "Adicionar à Tela de Início" do iOS historicamente guarda
 * a URL da PÁGINA ABERTA no momento — e a página aberta na hora de instalar é,
 * quase sempre, a landing. Sem esta guarda, quem instalou pelo iPhone abre o
 * "app" na peça de venda, todo dia.
 *
 * É um componente e não uma checagem no `page.tsx` porque a LP é ESTÁTICA (ver
 * o cabeçalho de `app/page.tsx`): a decisão depende do `display-mode` da
 * janela, que só existe no cliente. Um `redirect()` de servidor aqui custaria
 * a estaticidade da única página que todo visitante anônimo carrega.
 */
export function StandaloneHomeGuard(): null {
  const router = useRouter();
  const { isStandalone, ready } = useIsStandalone();

  useEffect(() => {
    if (!ready || !isStandalone) return;
    // `replace`, não `push`: a LP não pode virar uma entrada no histórico do
    // app — o "voltar" do usuário cairia de novo nela.
    router.replace("/sign-in");
  }, [ready, isStandalone, router]);

  return null;
}
