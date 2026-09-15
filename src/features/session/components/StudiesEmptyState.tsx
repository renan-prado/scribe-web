import { CollectionEmptyState } from "./CollectionEmptyState";

/**
 * Empty state da lista de estudos (/studies), sobre a casca do
 * `CollectionEmptyState`. O estudo começa FORA desta tela, no resumo de uma
 * gravação pronta — e é essa a coisa que a lista vazia precisa dizer.
 *
 * Ele não é o único estado vazio de `/studies`: quem não tem o plano
 * `Estudioso` e não tem nenhum estudo vê o `StudiesUpsell` no lugar dele.
 * Ensinar a gerar algo que a pessoa não pode gerar seria pior que não ensinar.
 */
export function StudiesEmptyState() {
  return (
    <CollectionEmptyState
      sticker="/stickers/men/012-man.svg"
      heading="Olá, nenhum estudo por aqui, ainda..."
      body="Estudos são peças independentes que o Scriba gera a partir dos seus resumos. Abra uma gravação já concluída e peça o estudo por lá: ele aparece aqui assim que ficar pronto."
    />
  );
}
