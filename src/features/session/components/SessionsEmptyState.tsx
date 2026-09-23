import { ThemeToggle } from "@/components/ThemeToggle";
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
 * **O switch de tema mora no rodapé deste quadro**, e é o outro lugar do
 * produto que o tem (o primeiro é a seção "Preferências" do `/profile`). Ele
 * está aqui pela mesma razão que o resto: esta é a única tela do app com
 * espaço sobrando, e é a primeira que qualquer pessoa vê. Quem procura a
 * preferência vai ao perfil; quem nem sabe que ela existe descobre aqui, no
 * minuto em que não há mais nada para fazer na tela. E ele SOME junto com o
 * quadro na primeira gravação, que é quando a Biblioteca passa a ter assunto
 * próprio — o perfil continua sendo a casa permanente dele.
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
      action={
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-scriba-ink-mute">
            Aparência
          </span>
          <ThemeToggle />
        </div>
      }
    />
  );
}
