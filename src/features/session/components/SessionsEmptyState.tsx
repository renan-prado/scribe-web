import { CollectionEmptyState } from "./CollectionEmptyState";

/**
 * Empty state da Biblioteca (/home), a primeira tela de quem entra no Scriba.
 *
 * Ele existe porque essa tela vazia é o primeiro minuto do produto: era uma
 * linha de texto solta ("Nada gravado ainda") num quadro de 600px de altura,
 * que dizia o estado e não dizia o CAMINHO.
 *
 * O caminho já foi três passos numerados; hoje é uma frase. O que ela não pode
 * perder é a MENÇÃO às três portas — quem chega achando que o Scriba só grava
 * não descobre sozinho que dá para importar um vídeo ou escrever à mão.
 *
 * Ele NÃO substitui o "nenhuma gravação com esse recorte" da busca: lista vazia
 * por filtro é outra situação, com outra saída (limpar a busca), e ensinar a
 * gravar ali seria responder outra pergunta. Ver `LibraryBrowser`.
 */
export function SessionsEmptyState() {
  return (
    <CollectionEmptyState
      sticker="/stickers/men/012-man.svg"
      heading="Olá, nenhum conteúdo por aqui, ainda..."
      body="Grave uma pregação, importe um vídeo do YouTube ou escreva um resumo você mesmo. O que você criar aparecerá aqui."
    />
  );
}
