"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useBibloWriter } from "@/features/session/biblo-query";
import { BibloDrawer } from "@/features/session/components/BibloDrawer";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useIsMobile } from "@/hooks/use-mobile";
import type { BibloSuggestion } from "@/lib/domain/biblo";
import { cn } from "@/lib/utils";
import { BibloAvatar } from "@/shared/brand";

/** O que a `MobileActionBar` chama para abrir a gaveta a partir de fora. */
export type BibloDockHandle = { open: () => void };

/**
 * O DISCO FLUTUANTE DO BIBLO, e ele é UMA classe para as duas telas.
 *
 * Ele existe em dois lugares — este componente (a leitura e o editor) e o
 * `BibloHomeTrigger` (a Biblioteca, que precisa de um disco próprio porque o
 * dele some e volta com a rolagem, e porque lá ele é um LINK para `/home/chat`
 * em vez de um botão). A classe estava COPIADA nos dois, e o resultado
 * foi o previsível: ao dar ao disco uma superfície própria no tema claro, só
 * uma das cópias mudou, e o mesmo botão passou a ter dois visuais em duas
 * telas do mesmo app.
 *
 * Quem precisar de comportamento próprio (o `pointer-events`, a animação de
 * entrada) acrescenta ao redor, nunca reescreve isto.
 */
export const BIBLO_TRIGGER_CLASS =
  "inline-flex size-14 items-center justify-center rounded-full bg-v2-dock-disc bg-[image:var(--v2-dock-disc-sheen)] shadow-[0_2px_6px_var(--v2-glass-shadow),0_10px_28px_var(--v2-glass-shadow)] ring-1 ring-v2-glass-edge backdrop-blur-xl transition hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute";

/**
 * O botão do Biblo: flutuante, no canto inferior direito, nas DUAS telas.
 *
 * ## Ele é o terceiro do mesmo gesto
 *
 * O `CreateDock` da Biblioteca (o `+`) e o `AdminMenu` do painel (o
 * hambúrguer) já são o mesmo botão com conteúdos diferentes — o cabeçalho do
 * segundo diz isso com todas as letras. Este herda a peça: disco de vidro de
 * 56px no canto, sem véu atrás, o glifo que NÃO gira para virar um "×".
 *
 * **O glifo é o rosto do Biblo**, e é o único dos três com cara em vez de
 * símbolo. É o que faz "conversar com o Scriba" virar "perguntar ao Biblo".
 *
 * ## Por que ele fica na leitura, e não no cabeçalho
 *
 * A pergunta nasce no meio do texto, no parágrafo doze — não no topo dele. Um
 * botão no cabeçalho obriga a rolar até em cima, perguntar, e achar o lugar de
 * volta. É também o único canto que o polegar alcança num celular grande, e,
 * no celular, é de onde a gaveta sobe: o botão VIRA a gaveta.
 *
 * ## Ele NÃO some ao rolar, ao contrário do `+` da Biblioteca
 *
 * Lá o botão se esconde na descida porque "rolar para baixo é LER e o botão
 * cobre o que se está lendo". Aqui o argumento se inverte: a dúvida aparece
 * DURANTE a descida, e um botão que foge exatamente nesse momento é o pior
 * instante possível para ele sumir. Quem resolve o "cobre o texto" é o
 * material — o disco é de vidro com `backdrop-blur`, e o texto continua
 * legível através dele. É a mesma razão de o `AdminMenu` poder ficar parado
 * sobre uma tabela.
 *
 * ## No desktop a gaveta EMPURRA, no celular ela cobre
 *
 * Num monitor sobra largura dos dois lados da coluna de leitura, e mesmo assim
 * a gaveta cobria o lado direito do texto — cortando as linhas justamente no
 * parágrafo que fez a pessoa abrir a conversa. Conversar sobre um texto exige
 * ver o texto. Este componente só liga a classe `biblo-open` no `<body>`; a
 * regra (e a razão de ela morar lá) está em `globals.css`.
 *
 * No celular nada muda: não há largura para dividir, e a gaveta sobe do rodapé
 * por cima do conteúdo, de onde o botão estava.
 *
 * ## O teclado
 *
 * `--kb-inset` (ver `hooks/use-keyboard-inset.ts`) e `max()` com a faixa do
 * iPhone: com o teclado aberto ele a cobre, então somar os dois empurraria o
 * botão para o meio da tela.
 *
 * ## O que ele faz com a gaveta fechada
 *
 * **Continua pensando.** Quem fecha para reler o versículo enquanto a resposta
 * não chega vê o rosto no canto em `thinking`, e voltando a `idle` quando ela
 * chega: é o aviso de "terminei" sem badge, sem ponto vermelho e sem
 * notificação.
 *
 * ## O gatilho no celular mudou de dono
 *
 * `/summary` e `/summary/new` têm hoje uma `MobileActionBar` própria, com o
 * "Pergunte ao Biblo" dentro dela — e não mais o disco flutuante que este
 * componente desenhava sozinho no canto. `hideMobileTrigger` esconde esse
 * disco só no celular (`max-md:hidden`); no desktop ele continua existindo,
 * porque lá não há barra nenhuma. Quem abre a gaveta a partir da barra chama
 * `ref.current.open()` (`BibloDockHandle`), e `onThinkingChange` é como o
 * rosto da barra sabe mostrar `thinking` com a gaveta fechada — sem ele a
 * barra não teria como saber que uma resposta está a caminho.
 */
export const BibloDock = forwardRef<
  BibloDockHandle,
  {
    sessionId: string;
    /**
     * Garante que a linha da sessão exista no banco antes de uma pergunta, e
     * devolve o id dela (`null` quando o salvamento falhou).
     *
     * Só o `/summary/new` passa: lá o id é do APARELHO e a linha nasce no primeiro
     * salvamento, então sem isto a primeira pergunta esbarraria numa sessão que
     * não existe. Ver o cabeçalho do `Composer`.
     */
    ensureSession?: () => Promise<string | null>;
    /** Ausente na tela que não sabe editar: a conversa funciona, sem "Adicionar". */
    onInsert?: (suggestion: BibloSuggestion) => void;
    onRemove?: (suggestion: BibloSuggestion) => void;
    /** Ver "O gatilho no celular mudou de dono" acima. */
    hideMobileTrigger?: boolean;
    onThinkingChange?: (thinking: boolean) => void;
  }
>(function BibloDock(
  { sessionId, ensureSession, onInsert, onRemove, hideMobileTrigger = false, onThinkingChange },
  ref
) {
  const [open, setOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const isMobile = useIsMobile();
  useKeyboardInset();
  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);
  useEffect(() => {
    onThinkingChange?.(thinking);
  }, [thinking, onThinkingChange]);

  /**
   * A conversa é buscada quando a TELA abre, não quando a gaveta abre.
   *
   * O botão está na tela o tempo todo e a gaveta é o que ele vira: o instante
   * entre o toque e a conversa desenhada não tem nada a fazer além de esperar
   * a rede, e é justamente ali que a pessoa está olhando. Com a pré-busca, a
   * primeira abertura já encontra a resposta pronta no cache; da segunda em
   * diante ela vem do disco, sem rede nenhuma (ver `biblo-query.ts`).
   *
   * Não custa nada a ninguém: o `GET /api/biblo` não cobra, não chama modelo e
   * não grava (ver o cabeçalho da rota). E é `prefetchQuery`, que não faz nada
   * quando já há algo fresco guardado.
   */
  const { prefetch } = useBibloWriter(sessionId);
  useEffect(() => {
    prefetch();
  }, [prefetch]);

  /**
   * Inserir FECHA a gaveta no celular, e não no desktop.
   *
   * O efeito do "Adicionar" acontece fora da gaveta, e quem insere quer ver
   * onde o bloco caiu — é o que a rolagem e a piscada dizem
   * (`revealSummaryBlock`). No celular a gaveta COBRE o texto e ocupa 85% da
   * altura: a piscada aconteceria atrás dela, e o gesto pareceria não ter feito
   * nada. No desktop ela EMPURRA (ver `globals.css`), o texto está à vista, e
   * fechar tiraria da tela a conversa que a pessoa não terminou.
   *
   * Só na inserção. O "Desfazer" não fecha nada: quem desfaz está corrigindo
   * dentro da conversa, e não indo olhar o documento.
   */
  const insert = onInsert
    ? (suggestion: BibloSuggestion) => {
        onInsert(suggestion);
        if (isMobile) setOpen(false);
      }
    : undefined;

  // No DESKTOP a gaveta empurra o conteúdo em vez de cobri-lo, e quem faz isso
  // é um `padding-right` no `<body>` (a regra e o porquê estão em
  // `globals.css`). A classe vai no corpo porque a gaveta é `fixed`: ela não
  // ocupa espaço nenhum no fluxo, então não há como um ancestral dela encolher
  // a página — o corpo é o único elemento acima de todo o layout.
  //
  // A limpeza no retorno cobre o caso que não é o fechar: desmontar a tela com
  // a conversa aberta (uma navegação) deixaria o corpo estreito para sempre,
  // com a gaveta já fora da tela.
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("biblo-open");
    return () => document.body.classList.remove("biblo-open");
  }, [open]);

  return (
    <>
      {/* O botão sai da tela enquanto a gaveta está aberta: ele não é um
          interruptor aceso, ele VIROU a gaveta, e ela tem o próprio fechar. */}
      {!open && (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-end px-4 pb-[calc(1rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))]",
            hideMobileTrigger && "max-md:hidden"
          )}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Conversar com o Biblo"
            aria-expanded={false}
            className={cn("pointer-events-auto", BIBLO_TRIGGER_CLASS)}
          >
            <BibloAvatar mood={thinking ? "thinking" : "idle"} size={36} />
          </button>
        </div>
      )}

      {open && (
        <BibloDrawer
          sessionId={sessionId}
          ensureSession={ensureSession}
          onClose={() => setOpen(false)}
          onThinking={setThinking}
          onInsert={insert}
          onRemove={onRemove}
        />
      )}
    </>
  );
});
