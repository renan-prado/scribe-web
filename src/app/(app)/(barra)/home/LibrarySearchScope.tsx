"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { SearchScope } from "../components/SearchScope";

/**
 * O `SearchScope` da Biblioteca, com o `?busca=1` lido do CLIENTE.
 *
 * Ele existe por causa de onde o provider passou a morar: o `layout.tsx` do
 * segmento, e não a página (ver o cabeçalho de lá). Layout não recebe
 * `searchParams` — por construção, ele não é re-renderizado quando só a query
 * muda —, e era de lá que vinha o `defaultOpen` que a lupa das outras telas usa
 * para chegar aqui com o campo já aberto (`LibrarySearchLink` → `/home?busca=1`).
 *
 * `useSearchParams` responde à mesma pergunta do lado de cá, no primeiro render,
 * e o valor só é lido uma vez: o `SearchScope` o usa como estado INICIAL, então
 * abrir e fechar a busca depois disso continua sendo decisão de quem está na
 * tela, não da URL.
 */
export function LibrarySearchScope({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  return <SearchScope defaultOpen={params.get("busca") === "1"}>{children}</SearchScope>;
}
