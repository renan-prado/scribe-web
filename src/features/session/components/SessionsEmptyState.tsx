import { CollectionEmptyState, type CollectionEmptyStep } from "./CollectionEmptyState";

const STEPS: readonly CollectionEmptyStep[] = [
  {
    n: 1,
    title: "Toque em Gravar",
    body: "Deixe o aparelho com a tela virada para quem prega, o mais perto possível. Distância e eco são o que mais atrapalham.",
  },
  {
    n: 2,
    title: "Encerre ao final",
    body: "O áudio sobe inteiro, vira transcrição e volta como resumo organizado. Não é preciso fazer mais nada.",
  },
  {
    n: 3,
    title: "Ou importe do YouTube",
    body: "Se a pregação já está em vídeo, cole o link em Importar: o resumo sai da legenda, sem gravar nada.",
  },
];

/**
 * Empty state da Biblioteca (/home), a primeira tela de quem entra no Scriba.
 *
 * Ele existe porque essa tela vazia é o primeiro minuto do produto: era uma
 * linha de texto solta ("Nada gravado ainda") num quadro de 600px de altura,
 * que dizia o estado e não dizia o CAMINHO. Os três passos são o caminho, e o
 * terceiro é o que não se descobre sozinho — quem chega achando que o Scriba só
 * grava não procura a importação do YouTube no menu.
 *
 * Ele NÃO substitui o "nenhuma gravação com esse recorte" da busca: lista vazia
 * por filtro é outra situação, com outra saída (limpar a busca), e ensinar a
 * gravar ali seria responder outra pergunta. Ver `LibraryBrowser`.
 */
export function SessionsEmptyState() {
  return (
    <CollectionEmptyState
      sticker="/stickers/men/012-man.svg"
      heading="Olá, nada gravado por aqui, ainda..."
      body="A Biblioteca guarda tudo o que você grava e todo vídeo que você importa, com resumo, orador e local. O primeiro aparece aqui assim que ficar pronto."
      steps={STEPS}
    />
  );
}
