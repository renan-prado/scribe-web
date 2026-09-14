import { CollectionEmptyState, type CollectionEmptyStep } from "./CollectionEmptyState";

const STEPS: readonly CollectionEmptyStep[] = [
  {
    n: 1,
    title: "Abra um resumo",
    body: "Vá até uma gravação já concluída e finalizada que o tema mais lhe interessar.",
  },
  {
    n: 2,
    title: 'Toque em "Gerar estudo"',
    body: "O Scriba lê o sermão e monta um estudo independente sobre o mesmo tema.",
  },
  {
    n: 3,
    title: "Volte quando quiser",
    body: "Todo estudo que você gerar aparece aqui para ser consultado quando quiser.",
  },
];

/**
 * Empty state da lista de estudos (/studies), sobre a casca do
 * `CollectionEmptyState`. Os passos são os da GERAÇÃO de estudo, que começa
 * fora desta tela, no resumo — e é essa a coisa que a lista vazia precisa
 * dizer.
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
      body="Estudos são peças independentes que o Scriba gera a partir dos seus resumos. Assim que você gerar o primeiro, ele aparece por aqui."
      steps={STEPS}
    />
  );
}
