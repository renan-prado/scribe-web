"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { SessionOwnerProvider } from "@/features/session/query";
import { idbStorage } from "@/lib/idb-storage";

const OWNER_KEY = "scriba:cache-owner";

/**
 * Diz à árvore de quem é este cache, e apaga o do dono anterior quando ele
 * muda.
 *
 * ## As duas metades, e por que são duas
 *
 * **Correção** é a chave de cada query carregar o id do usuário (ver
 * `features/session/query.ts`): quem entra numa conta nova não tem entrada
 * nenhuma no cache e busca do servidor. Não existe o quadro em que a Biblioteca
 * de outra pessoa aparece na tela — e é por isso que a correção não pode morar
 * num efeito, que roda depois do primeiro desenho.
 *
 * **Higiene** é o efeito abaixo: os dados do dono anterior saem do disco
 * assim que outra conta entra. Sem ele, a lista de sermões de quem emprestou o
 * celular ficaria guardada ali até o `maxAge` vencer, invisível mas presente.
 *
 * O marcador mora no `localStorage`, e não junto do cache no IndexedDB, porque
 * ele precisa ser lido e escrito de forma síncrona e é do tamanho de um uuid; o
 * IndexedDB é para o que é grande e assíncrono.
 *
 * ## Por que aqui, e não na saída
 *
 * Sair do app é um `<form method="post">` que recarrega a página, e são seis
 * formulários espalhados por seis telas. Pendurar a limpeza em cada um deles
 * seria seis lugares para esquecer um, e ainda assim não cobriria a sessão que
 * expira sozinha. Na ENTRADA é um lugar só, e ele pega todos os caminhos: quem
 * quer que esteja logado agora é o dono, e o que era de outro sai.
 */
export function CacheOwner({ userId, children }: { userId: string; children: ReactNode }) {
  const client = useQueryClient();

  useEffect(() => {
    let previous: string | null = null;
    try {
      previous = window.localStorage.getItem(OWNER_KEY);
      window.localStorage.setItem(OWNER_KEY, userId);
    } catch {
      // Armazenamento bloqueado (aba anônima, WebView restrito). Sem marcador
      // não há como saber se o dono trocou, e o escopo da chave continua de pé.
      return;
    }
    if (previous === null || previous === userId) return;
    client.clear();
    void idbStorage.removeItem("scriba-query-cache");
  }, [userId, client]);

  return <SessionOwnerProvider value={userId}>{children}</SessionOwnerProvider>;
}
