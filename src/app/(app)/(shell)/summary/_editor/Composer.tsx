"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Highlighter,
  Info,
  MapPin,
  Plus,
  Save,
  Shapes,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { BookGlyph } from "@/components/icons/BookGlyph";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BibleDock } from "@/features/session/components/BibleDock";
import { BibloDock, type BibloDockHandle } from "@/features/session/components/BibloDock";
import { EntityFieldDialog } from "@/features/session/components/EntityFieldDialog";
import { FindBar } from "@/features/session/components/FindBar";
import { PassageVerses } from "@/features/session/components/PassageVerses";
import { revealSummaryBlock, SUMMARY_BLOCK_ATTR } from "@/features/session/components/reveal-block";
import { useUnloadGuard } from "@/features/session/hooks/useUnloadGuard";
import { requestLocationSuggestions, requestSpeakerSuggestions } from "@/features/session/lib/api";
import { normalizeSearch } from "@/features/session/lib/search";
import { initialsOf } from "@/features/session/lib/text";
import { SELECTABLE_TRANSLATIONS, TRANSLATIONS } from "@/lib/bibles/translations";
import {
  applyDisplayEdit,
  hasMark,
  splitMarks,
  stripMarks,
  toggleMarkOnDisplay,
} from "@/lib/domain/mark";
import { parseVerseReference } from "@/lib/domain/reference";
import {
  insertionIndex,
  listItems,
  WRITTEN_LIMITS,
  type WrittenBlock,
  type WrittenSummary,
} from "@/lib/domain/summary";
import { cn } from "@/lib/utils";
import { ScribaMark } from "@/shared/brand";
import { TOPBAR_SLOT_ID } from "../../components/AppHeaderShell";
import { MOBILE_BAR_BUTTON_CLASS, MobileActionBar } from "../../components/MobileActionBar";
import { AutoTextarea } from "./AutoTextarea";
import { BlockDragGhost } from "./BlockDragGhost";
import { BlockKeyboardBar } from "./BlockKeyboardBar";
import {
  BLOCK_OPTIONS,
  BLOCK_PLACEHOLDERS,
  type BlockPick,
  bibleTargetLabel,
  convertBlock,
  emptyBlock,
  LEAD_OPTION,
  looksLikeBibleQuery,
  type MenuOption,
  matchBibleQuery,
} from "./blocks";
import { PassagePicker } from "./PassagePicker";
import { useBlockDrag } from "./useBlockDrag";
import { type SaveStatus, useWrittenDraft } from "./useWrittenDraft";

/**
 * `/summary/new`: o editor de blocos.
 *
 * **Ele escreve o MESMO payload que a IA escreve**, e essa é a decisão que
 * governa todo o arquivo. Não há um formato "de texto escrito à mão": o que
 * sai daqui é um `SummaryPayload` numa sessão `manual`, lido pela mesma
 * `SavedSessionView`, achado pela mesma busca, e um dia aprofundado pelo mesmo
 * estudo. Um resumo escrito tem de LER igual a um resumo gerado — se não
 * lesse, seriam dois produtos dentro do mesmo app.
 *
 * **A edição acontece no lugar da leitura, sem pré-visualização.** Cada bloco é
 * uma `textarea` com as classes do `BlockRenderer` correspondente, então o que
 * está na tela já é o resultado. Um botão "pré-visualizar" existiria para
 * responder "como isto vai ficar?", e a resposta certa para essa pergunta é
 * não deixá-la nascer. Até o texto bíblico é buscado na NVI aqui dentro, pelo
 * mesmo `PassageVerses` da leitura. (O "Salvar" do topo é outra coisa:
 * ele abre a página de LEITURA, onde as referências soltas no meio da prosa
 * viram links — isso sim a edição não tem como mostrar, porque ali o texto
 * ainda está sendo digitado.)
 *
 * **Enter cria um parágrafo, Shift+Enter quebra a linha dentro do bloco.** É a
 * convenção de todo editor de blocos, e vale para todos os tipos, inclusive os
 * que são um cartão só (destaque, conclusão): uma regra por tipo faria a mesma
 * tecla fazer coisas diferentes sem nada na tela explicando por quê.
 *
 * **As chaves da lista são o ÍNDICE, de propósito.** Nenhum bloco guarda
 * estado próprio (a `textarea` é controlada, e a altura é recalculada a partir
 * do valor), então reordenar ou apagar no meio só reescreve valores em nós que
 * o React reaproveita — e é o índice que o foco persegue depois de um apagar
 * ou de um mover. Uma chave sintética por bloco pediria um id que o
 * `WrittenSummary` não tem e que teria de ser removido antes de cada envio.
 */
/**
 * A caixa de um bloco no editor, medida em píxeis e não no olho.
 *
 * O texto fica EXATAMENTE onde ficaria sem ela: o recuo horizontal é devolvido
 * pelo negativo, então acender a cor não empurra uma letra. E é uma constante
 * porque a lista e a linha do fim precisam desenhar a mesma caixa — em dois
 * lugares, elas divergiriam no primeiro ajuste.
 *
 * As contas, e elas se seguram umas nas outras:
 *   - a linha de um parágrafo tem 26px (15px × 1,72);
 *   - a caixa acrescenta 8px (`py-2`) de cada lado: 42px de altura, SEMPRE —
 *     todo bloco tem a mesma altura de linha, com ou sem foco;
 *   - o vão entre dois blocos é `gap-8` (32px); a caixa avança 8px para dentro
 *     dele de cada lado, então o que se vê entre duas superfícies são 16px;
 *   - a pílula de mover/marcar/excluir tem 34px, e é MENOR que a caixa de
 *     propósito: ela pousa na borda de cima de uma superfície de 42px. Maior
 *     que a linha que ela controla, virava a linha.
 *   - o recuo lateral é 12px no celular e 20px no desktop: 4px a menos que o
 *     `px` do `<main>` (16 e 24), que é o que impede a caixa de encostar na
 *     borda da tela.
 */
const BLOCK_SURFACE = "-mx-3 -my-2 rounded-[20px] px-3 py-2 transition-colors sm:-mx-5 sm:px-5";

/** O mesmo mínimo da busca da leitura (`SummaryFind`), pela mesma razão: com
 * uma letra só, o rascunho inteiro é resultado. */
const FIND_MIN_QUERY = 2;

/**
 * Tudo o que é TEXTO num bloco, para a busca do editor.
 *
 * Não é só `block.text`: o título de uma Informação, a referência de uma
 * passagem e o autor de uma citação são escritos por quem escreve o resumo, e
 * um "Romanos 8" que não achasse o bloco de Bíblia seria uma busca que ignora
 * justamente o que está mais à vista.
 *
 * E é o texto SEM as cercas do marca-texto, que é o que está na tela: procurar
 * uma frase que tem um trecho grifado no meio dela não pode depender de uma
 * sintaxe que ninguém vê.
 */
function blockHaystack(block: WrittenBlock): string {
  const extras = [
    "title" in block ? block.title : null,
    "reference" in block ? block.reference : null,
    "author" in block ? block.author : null,
  ];
  return [stripMarks(block.text), ...extras].filter(Boolean).join(" ");
}

/** Pastilha neutra do "adicionar autor/local", a mesma família da leitura
 * (`ADD_BADGE_CLASSES` em `SavedSessionView`). */
const ADD_BADGE_CLASSES = cn(
  "inline-flex items-center gap-1 rounded-full bg-scriba-ink-mute/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-soft outline-none transition-colors",
  "hover:bg-scriba-blue-soft/70 hover:text-scriba-blue-ink focus-visible:ring-2 focus-visible:ring-ring/40"
);

type Props = {
  /** O id da URL. `null` em `/summary/new`, onde o aparelho sorteia um. */
  id: string | null;
  /** A linha já existe no banco? Ver `useWrittenDraft`. */
  exists?: boolean;
  initial: WrittenSummary;
  /**
   * Autor e local da sessão. `null` numa folha em branco (`/summary/new`, sem
   * linha ainda) — os dois só existem para EDITAR, nunca aparecem aqui.
   *
   * Continuam vivendo na COLUNA (`sessions.speaker_name`/`speaker_location`),
   * não no `WrittenSummary`: são os mesmos campos que `/summary` edita, e o
   * `PATCH /api/sessions/:id` que os grava é o mesmo dos dois lugares. Editar
   * aqui não é um segundo mecanismo, é o mesmo botão que já existia na
   * leitura, movido para onde a pessoa também os corrige — reabrir um resumo
   * pela porta "Editar" não deveria custar uma volta ao `/summary` só para
   * trocar o nome do pregador.
   */
  speakerName?: string | null;
  speakerLocation?: string | null;
  /** A `TopBar`, montada pela página (ela é server component). */
  header: ReactNode;
};

export function Composer({
  id,
  exists = false,
  initial,
  speakerName: initialSpeakerName = null,
  speakerLocation: initialSpeakerLocation = null,
  header,
}: Props) {
  const router = useRouter();
  const { doc, setDoc, status, offline, draftId, sessionId, flush, ready } = useWrittenDraft({
    id,
    exists,
    initial,
  });

  const [speakerName, setSpeakerName] = useState(initialSpeakerName);
  const [speakerLocation, setSpeakerLocation] = useState(initialSpeakerLocation);
  const [speakerDialogOpen, setSpeakerDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);

  // O gatilho do Biblo no celular é a `MobileActionBar`, não mais o disco
  // flutuante que o `BibloDock` desenhava sozinho. Ver o cabeçalho de lá
  // ("O gatilho no celular mudou de dono").
  const bibloRef = useRef<BibloDockHandle>(null);
  const [bibloThinking, setBibloThinking] = useState(false);

  /**
   * O MESMO PATCH que a leitura usa para o título (`/api/sessions/:id`), e por
   * isso só chama com `sessionId`: a rota confere dono numa linha que precisa
   * existir, e antes do primeiro salvamento não há linha nenhuma para o
   * "Autor" apontar — o campo simplesmente não aparece até lá (ver o
   * `sessionId ?` abaixo).
   *
   * **Este é o único lugar do produto onde autor e local se escrevem.** A
   * leitura os MOSTRA e não os edita mais (ver o cabeçalho do
   * `SavedSessionView`).
   *
   * O `router.refresh()` no fim é o que impede o nome novo de sumir na volta:
   * a leitura é uma rota adiantada inteira no `pointerdown` do botão que traz
   * para cá (`prefetchOnPress`, ver `NavLink`), e um prefetch completo fica
   * guardado no cliente por cinco minutos. Sem jogar essa cópia fora, voltar
   * para `/summary/:id` mostra o autor de antes, com o banco já gravado.
   */
  async function patchSpeakerField(field: "speakerName" | "speakerLocation", value: string) {
    if (!sessionId) return;
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value || null }),
    });
    if (!res.ok) throw new Error("update failed");
    if (field === "speakerName") setSpeakerName(value || null);
    else setSpeakerLocation(value || null);
    router.refresh();
  }

  const speakerInitials = initialsOf(speakerName);

  /**
   * O menu da BARRA, aberto digitando `/` num parágrafo vazio.
   *
   * `index` é o bloco em que ele está; `cursor` é a opção destacada, que as
   * setas movem. A BUSCA não mora aqui: ela é o próprio texto do bloco depois
   * da barra (`/exem`), e guardá-la de novo aqui daria duas verdades sobre o
   * que está escrito na linha.
   *
   * **`convert` é o MESMO menu aberto sobre uma linha que já tem texto**, pelo
   * botão de trocar da pílula (ver `turnAt`). A diferença inteira está em duas
   * coisas: não há `/` escrito na linha — então não há busca, e é por isso que
   * `slashQuery` devolve vazio aqui —, e escolher CONVERTE o bloco em vez de
   * substituí-lo por um vazio, que jogaria fora justamente o que a pessoa não
   * quer redigitar.
   *
   * **`convert` é OBRIGATÓRIO no tipo, e isso é o conserto de um defeito.** Ele
   * nasceu opcional, e meia dúzia de lugares aqui remontam este objeto do zero
   * só para mover o cursor de uma linha — a seta do teclado, o mouse passando
   * por cima de um item. Cada um deles APAGAVA o modo em silêncio: o menu
   * voltava a ler o texto da linha como se fosse uma busca, e "Teste" virava
   * `/este`, que acha o livro de Ester e mais nada. O campo exigido faz o
   * compilador cobrar a resposta de quem constrói um estado novo, e quem só
   * quer mover o cursor passa a ter de preservar o que já estava lá.
   */
  const [slash, setSlash] = useState<{
    index: number;
    cursor: number;
    convert: boolean;
  } | null>(null);
  /**
   * Qual bloco tem o cursor. É o que põe a pílula de controles no ar no
   * celular, onde não existe passar o mouse.
   *
   * **Ele APAGA quando o foco sai do bloco**, e isso custou uma tela cheia de
   * botões acesos para ser aprendido: `active` só era trocado por outro foco,
   * então a pílula revelada por um toque ficava no ar pelo resto da sessão,
   * inclusive depois de a pessoa clicar em outro bloco e voltar. Quem apaga é
   * o `onBlur` do bloco, que só conta como saída quando o foco foi para FORA
   * dele — sem essa conferência, tocar na lixeira do próprio bloco apagaria o
   * estado que mantém a lixeira na tela.
   */
  const [active, setActive] = useState<number | null>(null);
  /**
   * O cursor está na LINHA DO FIM (`WritingLine`), que não é um bloco e por
   * isso não cabe no `active`.
   *
   * Ele existe pela barra de blocos do celular (ver "A barra de blocos"
   * abaixo): a linha do fim é a linha em branco mais provável do editor, e sem
   * saber que o cursor está nela a barra apareceria em todo parágrafo vazio do
   * meio do texto, menos justamente naquele em que se escreve.
   */
  const [tailFocus, setTailFocus] = useState(false);
  /**
   * Em qual bloco há texto SELECIONADO agora. É o que decide se o botão do
   * marca-texto existe na pílula.
   *
   * Um índice, e não um booleano: a pílula é por bloco, e com um booleano
   * global ela apareceria no bloco vizinho quando o foco pulasse de um para o
   * outro sem passar por um recorte vazio.
   */
  const [selectedIn, setSelectedIn] = useState<number | null>(null);
  /** O bloco de passagem cujo seletor está aberto. `-1` = um bloco novo. */
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  /**
   * O COMEÇO da referência, quando o seletor foi aberto pela barra com um
   * livro já digitado (`/atos`, `/atos 1`). É uma referência PARCIAL — só o
   * livro, ou livro e capítulo —, e é o `PassagePicker` que traduz cada forma
   * no passo em que abrir. `null` = o seletor começa dos 66 livros.
   */
  const [pickerSeed, setPickerSeed] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  /**
   * O bloco a REVELAR: rolar até ele e piscar (`revealSummaryBlock`).
   *
   * **É estado, e não uma chamada dentro do `insertAt`, pelo mesmo motivo do
   * `focusIndex` logo acima:** o nó ainda não existe no instante em que o bloco
   * é criado, e o que existe naquele índice é o bloco que estava lá antes —
   * piscar ali piscaria o parágrafo errado.
   *
   * **E é um estado SEPARADO do `focusIndex` porque são gestos diferentes.** O
   * foco é para um bloco que nasceu VAZIO e vai ser digitado (o menu da
   * barra); a revelação é para um bloco que chegou PRONTO da conversa, e ali o cursor
   * não é bem-vindo — no celular ele abre o teclado, que cobre justamente o
   * texto que a rolagem acabou de trazer para o centro.
   */
  const [revealIndex, setRevealIndex] = useState<number | null>(null);

  /**
   * A ideia central é OPCIONAL, e por isso o campo não nasce na tela: ela
   * aparece quando a pessoa pede, pelo menu da barra, e sai por um botão de
   * remover. Um campo fixo em cima de uma folha em branco é uma pergunta feita
   * antes da hora — quem abre o editor quer escrever o texto, e resumir em uma
   * frase é coisa que só se consegue fazer DEPOIS.
   *
   * **O pedido vinha de uma pastilha própria, no topo da folha, e ela saiu.**
   * Havia dois lugares respondendo "o que mais cabe neste texto?" — aquela
   * pastilha e o menu —, e o que decidia em qual deles uma coisa
   * aparecia era um detalhe de implementação (ser ou não ser um bloco do
   * schema) que ninguém que escreve tem como saber. No menu, ela é a primeira
   * opção, do mesmo jeito que a conclusão é a última.
   *
   * O estado é só o "pedi para abrir": o que manda é o texto. Um documento que
   * já tem `shortSummary` (salvo antes, ou vindo do rascunho do aparelho, que
   * chega depois da primeira renderização) mostra o campo sem depender de
   * efeito nenhum para sincronizar as duas coisas.
   */
  const [leadAsked, setLeadAsked] = useState(false);
  const showLead = leadAsked || doc.shortSummary.trim().length > 0;
  const leadRef = useRef<HTMLTextAreaElement | null>(null);

  useUnloadGuard(status !== "synced");

  // O foco é pedido pelo estado, e não no meio do `setDoc`: o elemento que vai
  // receber o cursor pode ainda não existir na hora em que o bloco é criado.
  useEffect(() => {
    if (focusIndex === null) return;
    const el = refs.current[focusIndex];
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
    setFocusIndex(null);
  }, [focusIndex]);

  // O par do efeito acima, para o bloco que chegou pronto. Ver `revealIndex`.
  useEffect(() => {
    if (revealIndex === null) return;
    revealSummaryBlock(revealIndex);
    setRevealIndex(null);
  }, [revealIndex]);

  function patchBlocks(next: (blocks: WrittenBlock[]) => WrittenBlock[]) {
    setDoc((prev) => ({ ...prev, blocks: next(prev.blocks) }));
  }

  /**
   * A CONCLUSÃO é única, e esta linha é essa metade da regra.
   *
   * Enquanto existir uma, ela sai do menu do `+` (ver `menuOptions`) — do mesmo
   * jeito que a ideia central sai enquanto o campo dela estiver na tela. Duas
   * conclusões num texto não são um recurso, são um erro de digitação que
   * ninguém desfaz sem ir procurar a segunda.
   *
   * **A outra metade — ela é a ÚLTIMA, e nada entra abaixo dela — saiu daqui
   * para `insertionIndex` (`domain/summary.ts`).** Ela morava só neste arquivo,
   * e a tela de LEITURA, que insere no mesmo documento pela gaveta do Biblo,
   * não a conhecia: uma passagem adicionada por lá caía depois do fecho.
   */
  const conclusionAt = doc.blocks.findIndex((b) => b.type === "conclusion");

  /**
   * Insere e devolve A POSIÇÃO ONDE O BLOCO CAIU, que não é a pedida sempre que
   * a conclusão é o teto (ver abaixo). Quem inseriu precisa do número certo
   * para revelar o bloco.
   *
   * `focus` existe para a inserção que vem da CONVERSA: o bloco chega pronto, e
   * pôr o cursor nele abre o teclado do celular por cima do que se quer ver.
   */
  function insertAt(index: number, block: WrittenBlock, focus = true): number {
    // A conclusão é o teto, e a regra é a MESMA das duas telas. Ver
    // `insertionIndex`.
    const at = insertionIndex(doc.blocks, block, index);
    patchBlocks((blocks) => {
      const copy = blocks.slice();
      copy.splice(at, 0, block);
      return copy;
    });
    if (focus) setFocusIndex(at);
    setActive(at);
    return at;
  }

  /**
   * Abrir o campo da ideia central e pôr o cursor nele.
   *
   * O foco é pedido no quadro SEGUINTE: a `textarea` não existe no instante do
   * clique, e o foco iria para o nada.
   */
  function askLead() {
    setLeadAsked(true);
    requestAnimationFrame(() => leadRef.current?.focus());
  }

  /**
   * O que o menu da barra oferece AGORA.
   *
   * As duas pontas do documento são únicas e desaparecem quando usadas: a
   * ideia central enquanto o campo dela estiver na tela, a conclusão enquanto
   * houver uma. É a mesma regra por dois caminhos, porque uma é `shortSummary`
   * e a outra é bloco — e do lado de quem escreve elas são a mesma coisa, o
   * cartão que abre e o que fecha.
   */
  const menuOptions: MenuOption[] = [
    ...(showLead ? [] : [LEAD_OPTION]),
    ...BLOCK_OPTIONS.filter((o) => o.type !== "conclusion" || conclusionAt < 0),
  ];

  const [pendingIndex, setPendingIndex] = useState(0);

  function removeAt(index: number) {
    patchBlocks((blocks) => blocks.filter((_, i) => i !== index));
    setActive(null);
    if (index > 0) setFocusIndex(index - 1);
  }

  function moveBy(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= doc.blocks.length) return;
    patchBlocks((blocks) => {
      const copy = blocks.slice();
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
    setActive(target);
    setFocusIndex(target);
  }

  /**
   * O destino de um ARRASTO, que fala em índice de INSERÇÃO e não em vizinho.
   *
   * "Entre o quarto e o quinto" é `to === 4`, e a diferença para o `moveBy`
   * acima está na conta de uma linha: tirando o bloco da lista, todo destino
   * ABAIXO dele desce uma casa. Sem isso, arrastar para baixo sempre para uma
   * posição antes da que a linha indicava.
   *
   * **Sem `setFocusIndex`**, ao contrário do `moveBy`: aquele é um clique num
   * botão que fica ao lado do cursor, este é um dedo sobre a folha, e pedir o
   * cursor aqui abriria o teclado do celular por cima do texto que a pessoa
   * acabou de reorganizar. O `active` acende a pílula no lugar novo, que é o
   * retorno que o gesto pede.
   */
  function moveTo(index: number, insertion: number) {
    const target = insertion > index ? insertion - 1 : insertion;
    if (target === index || target < 0 || target >= doc.blocks.length) return;
    patchBlocks((blocks) => {
      const copy = blocks.slice();
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
    setActive(target);
  }

  function setBlock(index: number, patch: Partial<WrittenBlock>) {
    patchBlocks((blocks) =>
      blocks.map((b, i) => (i === index ? ({ ...b, ...patch } as WrittenBlock) : b))
    );
  }

  /**
   * O MARCA-TEXTO, ligado e desligado pelo mesmo botão.
   *
   * A regra inteira mora em `toggleMark` (`lib/domain/mark.ts`), que é onde a
   * leitura também vai buscar o que é uma marca. Aqui fica só o que é da TELA:
   * pegar o recorte da caixa, pedir o texto novo, e devolver o cursor exatamente
   * sobre o que acabou de ser marcado.
   *
   * **O recorte vem da caixa, e a caixa não mostra as cercas**: o que o
   * `selectionStart` conta são as letras que estão na tela. Por isso o toggle
   * aqui é o `toggleMarkOnDisplay`, que traduz as duas pontas para o texto cru
   * do bloco e devolve a seleção de volta em posições visíveis — e por isso o
   * texto vem de `doc.blocks`, e não do `el.value`, que é o texto já sem elas.
   *
   * **O recorte é lido do DOM, não de um estado.** Guardar `selectionStart` a
   * cada tecla seria um render por movimento de cursor para reproduzir um número
   * que a `textarea` já tem, e que só é consultado neste clique.
   *
   * A devolução do foco é no quadro seguinte porque o texto ainda não foi
   * repintado: `setSelectionRange` sobre o valor antigo selecionaria o intervalo
   * certo do texto errado.
   */
  function markAt(index: number) {
    const el = refs.current[index];
    const block = doc.blocks[index];
    if (!el || !block) return;
    const next = toggleMarkOnDisplay(block.text, el.selectionStart, el.selectionEnd);
    if (!next) return;
    setBlock(index, { text: next.text });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.start, next.end);
    });
  }

  /**
   * O atalho que a web inteira ensinou: "- " ou "* " no começo de um parágrafo
   * o vira uma lista de tópicos, "1. " o vira uma lista numerada.
   *
   * **Ele mora no `setBlock`, e não numa tecla.** Escrito num `onKeyDown` ele
   * teria de reconstruir o que o campo vai conter DEPOIS daquela tecla, e
   * perderia o mesmo gesto feito por colagem ou pelo teclado do celular, que
   * não emite as teclas uma a uma. Aqui a pergunta é sobre o texto que chegou,
   * seja de onde for.
   *
   * O prefixo é COMIDO na conversão: ele era a instrução, não conteúdo. Deixá-lo
   * daria "• - item", que é a marca desenhada duas vezes.
   */
  function autoformatted(block: WrittenBlock, patch: Partial<WrittenBlock>): Partial<WrittenBlock> {
    if (block.type !== "paragraph") return patch;
    const text = (patch as { text?: string }).text;
    if (typeof text !== "string") return patch;
    const marker = /^(#{1,2}|>|[-*]|\d{1,3}[.)])[ \t]/.exec(text);
    if (!marker) return patch;
    const rest = text.slice(marker[0].length);
    const head = marker[1];
    if (head === "#") return { type: "h1", text: rest } as Partial<WrittenBlock>;
    if (head === "##") return { type: "h2", text: rest } as Partial<WrittenBlock>;
    if (head === ">") return { type: "quote", text: rest } as Partial<WrittenBlock>;
    return {
      type: /\d/.test(head) ? "orderedList" : "bulletList",
      text: rest,
    } as Partial<WrittenBlock>;
  }

  /**
   * O NEGRITO do Markdown vira o MARCA-TEXTO, porque negrito não existe aqui.
   *
   * Todo bloco deste editor é `{ type, text }`, string pura, e a única ênfase
   * dentro de uma frase que o produto tem é a faixa amarela (`==assim==`, ver
   * `lib/domain/mark.ts`). O dedo que digita `**` está pedindo "destaque esta
   * parte", e a resposta honesta é dar o destaque que existe em vez de deixar
   * dois asteriscos no meio da frase de alguém, que é o que acontece em
   * qualquer campo que não converta.
   *
   * Só onde a marca APARECE na leitura (`MARKABLE`): convertê-la num título ou
   * numa citação escreveria `==` na tela, que é pior que o `**`.
   */
  function markdownEmphasis(block: WrittenBlock, text: string): string | null {
    if (!MARKABLE.has(block.type)) return null;
    // Sem lookbehind de propósito: `(?<!\s)` só existe no Safari 16.4 em
    // diante, e um literal de regex com ele é um SyntaxError de PARSE — ou
    // seja, o editor inteiro deixaria de carregar num iPhone de 2021, não só a
    // conversão. As duas pontas `\S` dizem a mesma coisa (nada de `** x **`)
    // com sintaxe que todo navegador entende.
    const next = text.replace(/\*\*(\S(?:[^\n*]{0,298}\S)?)\*\*/g, "==$1==");
    return next === text ? null : next;
  }

  /**
   * `->` vira `➤`, em QUALQUER bloco de texto.
   *
   * Diferente do negrito (`markdownEmphasis`), que só converte onde a marca
   * aparece na leitura, isto é troca de caractere pura — não depende de o
   * bloco passar por `RichText` para fazer sentido, então vale igual num
   * título, numa citação ou num parágrafo. **A tinta apagada da seta** (ver
   * `ARROW_GLYPH` em `RichText.tsx`) só se desenha onde `RichText` lê — os
   * mesmos blocos do marca-texto (`MARKABLE`): fora deles ela é o glifo cru,
   * pela mesma razão de a `textarea` não ter como colorir um caractere só.
   */
  function autoArrow(text: string): string | null {
    const next = text.replace(/->/g, "➤");
    return next === text ? null : next;
  }

  /**
   * O menu da barra abre e fecha OLHANDO O TEXTO, nunca numa tecla.
   *
   * É o mesmo raciocínio do autoformato das listas, e pelo mesmo motivo: num
   * `onKeyDown` seria preciso reconstruir o que o campo vai conter depois
   * daquela tecla, e o gesto se perderia numa colagem ou no teclado do celular,
   * que não emite as teclas uma a uma. Aqui a pergunta é sobre o texto que
   * chegou: um parágrafo que passou a ser exatamente `/` abre o menu, e um que
   * deixou de começar por `/` o fecha.
   */
  function syncSlash(index: number, block: WrittenBlock, text: string) {
    if (block.type !== "paragraph") {
      if (slash?.index === index) setSlash(null);
      return;
    }
    if (text === "/") {
      setSlash({ index, cursor: 0, convert: false });
      return;
    }
    if (slash?.index !== index) return;
    // Enquanto a linha começar por `/`, o que vem depois é a BUSCA. Apagou a
    // barra, ou escreveu uma linha de verdade: o menu não tem mais o que
    // filtrar. O cursor volta ao topo porque a lista mudou debaixo dele.
    if (!text.startsWith("/")) setSlash(null);
    else setSlash({ index, cursor: 0, convert: false });
  }

  function changeBlock(index: number, patch: Partial<WrittenBlock>) {
    const block = doc.blocks[index];
    if (!block) {
      setBlock(index, patch);
      return;
    }
    const text = (patch as { text?: string }).text;
    if (typeof text === "string") {
      syncSlash(index, block, text);
      // A seta some primeiro (vale em todo bloco); o negrito→marca-texto entra
      // depois, sobre o texto já com a seta trocada, e só onde `MARKABLE`
      // permite. As duas mexem no comprimento do texto, e cada uma reposiciona
      // o cursor a partir de onde a anterior o deixou.
      const arrowed = autoArrow(text);
      const withArrow = arrowed ?? text;
      const emphasized = markdownEmphasis(block, withArrow);
      const finalText = emphasized ?? withArrow;
      if (arrowed !== null || emphasized !== null) {
        // O cursor tem de andar junto: cada substituição encolhe o texto
        // (`->` vira `➤`, um caractere a menos; `**x**` vira uma marca, quatro
        // a menos NA TELA, porque as cercas que ela abre não aparecem na
        // caixa). Sem isto, quem digita no meio de um parágrafo perde o lugar e
        // continua digitando no fim dele. No quadro seguinte, como em `markAt`:
        // o valor novo ainda não foi pintado.
        //
        // **A conta é em posições VISÍVEIS**, que é a única unidade que o
        // `selectionStart` de uma caixa sem cercas conhece. Em raso os dois
        // números são iguais; em `**x**` → `==x==` eles diferem em quatro, que
        // é exatamente o tamanho do salto que o cursor daria.
        const el = refs.current[index];
        const shown = (value: string) => (MARKABLE.has(block.type) ? stripMarks(value) : value);
        const caret = el?.selectionStart ?? shown(finalText).length;
        const delta = shown(text).length - shown(finalText).length;
        const next = autoformatted(block, { ...patch, text: finalText });
        setBlock(index, next);
        if ("type" in next && next.type !== block.type) {
          // Ver o comentário abaixo: um bloco que MUDA DE TIPO troca de nó no
          // DOM, e o `el` capturado aqui em cima fica apontando para um
          // elemento que não existe mais.
          setFocusIndex(index);
        } else {
          requestAnimationFrame(() => {
            const at = Math.max(0, Math.min(caret - delta, shown(finalText).length));
            el?.setSelectionRange(at, at);
          });
        }
        return;
      }
    }
    const next = autoformatted(block, patch);
    setBlock(index, next);
    // `autoformatted` só devolve `type` quando um atalho (`# `, `- `, `1. `…)
    // de fato converteu o bloco. A conversão troca a árvore de JSX que
    // `BlockBody` desenha — de uma `textarea` de parágrafo para outra dentro
    // de uma moldura de título, lista etc. —, então o nó FOCADO é destruído e
    // um outro nasce no lugar: o foco simplesmente some, porque nada volta a
    // pedi-lo. `setFocusIndex` é o MESMO pedido que `insertAt`/`removeAt`/
    // `moveBy` já fazem para um nó que ainda não existe no instante do clique
    // — aqui o nó é outro pelo mesmo motivo, só que descoberto na digitação.
    if ("type" in next && next.type !== block.type) setFocusIndex(index);
  }

  /**
   * O que o menu da barra oferece com o que já foi digitado depois dela.
   *
   * A peneira é por SUBSTRING sem acento: `/exem` acha "Informação", `/cita`
   * acha "Citação", `/bib` acha "Bíblia". Não é busca aproximada de
   * propósito: a lista tem nove itens, e uma correspondência frouxa aqui
   * significaria o Enter escolher o bloco errado.
   *
   * **No modo `convert` ela é vazia, e tem de ser**: ali o texto da linha é o
   * PARÁGRAFO da pessoa, não um comando, e cortar-lhe a primeira letra para
   * usar o resto como filtro procuraria "risto é o caminho" na lista de
   * blocos. Quem quer filtrar digitando abre o menu pela barra, numa linha em
   * branco — que é onde a barra existe.
   */
  const slashQuery =
    slash !== null && !slash.convert ? (doc.blocks[slash.index]?.text ?? "").slice(1) : "";

  /**
   * O bloco que o menu vai CONVERTER, quando há um.
   *
   * A pergunta não é só "o botão de trocar abriu este menu?", é "há texto a
   * preservar?". Numa linha sem uma letra as duas operações dão no mesmo — um
   * bloco vazio do tipo escolhido —, e aí vale o caminho de sempre
   * (`emptyBlock`), que é o único que sabe abrir o seletor de passagem. É o
   * que deixa `/` e o botão oferecerem a MESMA lista numa linha em branco, e
   * uma lista mais curta só onde encurtá-la significa alguma coisa.
   */
  const convertTarget = (() => {
    if (!slash?.convert) return null;
    const block = doc.blocks[slash.index];
    return block && block.text.trim().length > 0 ? block : null;
  })();
  /**
   * A Bíblia reconhecida no meio do que se digita — o livro, o livro e o
   * capítulo, ou a referência inteira (ver `matchBibleQuery`).
   *
   * **Digitar o livro sempre acha o livro.** Antes, só a referência COMPLETA
   * virava opção, e `/atos` respondia "Nada com 'atos'": a barra parecia não
   * citar a Bíblia até o instante exato em que passava a citar. Cada estágio
   * tem agora a sua opção, e escolher leva ao passo seguinte — direto ao
   * bloco quando a referência fechou, ao `PassagePicker` já dentro do livro
   * (ou do capítulo) quando ainda falta escolher.
   */
  const bible = matchBibleQuery(slashQuery);
  const bibleOptions: MenuOption[] = bible.targets.map((target) => ({
    type: target,
    label: bibleTargetLabel(target),
    hint:
      target.kind === "passage"
        ? "Inserir esta passagem"
        : target.kind === "chapter"
          ? "Escolher os versículos"
          : "Escolher capítulo e versículo",
    icon: <BookGlyph className="size-3" />,
  }));
  const slashOptions = (() => {
    if (slash === null) return [];
    /**
     * TROCAR é uma lista mais curta que inserir, e cada ausência tem uma razão:
     *
     * - **o tipo que o bloco JÁ é** sai porque escolhê-lo não faria nada, e uma
     *   opção que não faz nada num menu de nove é uma que se tenta uma vez;
     * - **a Bíblia** sai porque o texto dela vem da NVI pela referência: virar
     *   passagem apagaria a frase escrita, que é o oposto do que "trocar"
     *   promete (ver `convertBlock`);
     * - **a ideia central** sai porque não é bloco — é o campo do cabeçalho, e
     *   "trocar este parágrafo pelo resumo em uma frase" é outra pergunta;
     * - **a conclusão** sai de qualquer linha que não seja a ÚLTIMA, porque
     *   nada vive abaixo do fecho (ver `insertionIndex`) e converter o
     *   parágrafo do meio quebraria essa ordem sem sair do lugar.
     */
    if (convertTarget) {
      const last = slash.index === doc.blocks.length - 1;
      return menuOptions.filter(
        (o) =>
          typeof o.type === "string" &&
          o.type !== "leadIdea" &&
          o.type !== "bibleQuote" &&
          o.type !== convertTarget.type &&
          (o.type !== "conclusion" || last)
      );
    }
    const q = normalizeSearch(slashQuery).trim();
    const base = !q ? menuOptions : menuOptions.filter((o) => normalizeSearch(o.label).includes(q));
    // A Bíblia vem NA FRENTE quando o livro já está escrito inteiro (ou já há
    // um número depois dele), e ATRÁS quando é só o começo de uma palavra:
    // `/tito` é o livro, mas `/ti` ainda é o começo de "Título" tanto quanto
    // o de "Tiago", e o Enter escolhe o primeiro da lista. Ver `exact` em
    // `matchBibleQuery`.
    if (bibleOptions.length > 0) {
      return bible.exact ? [...bibleOptions, ...base] : [...base, ...bibleOptions];
    }
    // Nenhum livro reconhecido, mas o formato (letras, depois um número) diz
    // que é isto que a pessoa está tentando — um erro de digitação no nome,
    // um apelido que o vocabulário não conhece. Oferecer o seletor completo é
    // um caminho para a frente onde havia um "Nada com…". Ver
    // `looksLikeBibleQuery`.
    if (base.length === 0 && looksLikeBibleQuery(slashQuery)) {
      const bibleOption = menuOptions.find((o) => o.type === "bibleQuote");
      if (bibleOption) return [bibleOption];
    }
    return base;
  })();

  /**
   * Escolher no menu da barra SUBSTITUI o parágrafo, em vez de inserir acima:
   * a pessoa está DENTRO de uma linha dizendo o que aquela linha é, e inserir
   * acima deixaria para trás o parágrafo com a barra dentro, que é o oposto
   * do que a tecla pediu.
   *
   * **Menos quando o menu foi aberto para TROCAR** (`convertTarget`): aí a
   * linha tem texto, e substituí-la por um bloco vazio seria apagar o
   * parágrafo de alguém para responder "este parágrafo é um subtítulo". O
   * texto atravessa, o resto do bloco não (ver `convertBlock`).
   */
  function pickSlash(index: number, pick: BlockPick) {
    const converting = convertTarget !== null && slash?.index === index;
    setSlash(null);
    if (converting && typeof pick === "string" && pick !== "leadIdea") {
      patchBlocks((blocks) => blocks.map((b, i) => (i === index ? convertBlock(b, pick) : b)));
      // O bloco troca de tipo, então troca de árvore no DOM e o nó focado é
      // destruído: é o mesmo pedido de foco que o atalho `# ` já faz em
      // `changeBlock`, pela mesma razão escrita lá.
      setFocusIndex(index);
      return;
    }
    if (pick === "leadIdea") {
      setBlock(index, { text: "" });
      askLead();
      return;
    }
    if (typeof pick !== "string") {
      // A Bíblia digitada na barra. Nos três estágios o desenho é o mesmo do
      // `bibleQuote` pelo seletor — o parágrafo esvazia e o bloco entra na
      // posição da linha —; o que muda é quanto do caminho já foi andado. Com
      // a referência inteira não há o que escolher, e o seletor nem chega a
      // abrir; com o livro (ou o livro e o capítulo), ele abre JÁ DENTRO, no
      // passo que falta.
      setBlock(index, { text: "" });
      if (pick.kind === "passage") {
        insertAt(index, { type: "bibleQuote", reference: pick.reference, text: "" });
        return;
      }
      setPendingIndex(index);
      setPickerSeed(bibleTargetLabel(pick));
      setPickerFor(-1);
      return;
    }
    if (pick === "bibleQuote") {
      // A passagem não tem o que digitar, e um bloco sem referência ficaria na
      // tela pedindo um segundo toque. O seletor abre e a passagem entra NA
      // posição desta linha; o parágrafo vazio desce e vira a linha seguinte,
      // que é onde se continua escrevendo.
      setBlock(index, { text: "" });
      setPendingIndex(index);
      setPickerSeed(null);
      setPickerFor(-1);
      return;
    }
    patchBlocks((blocks) => blocks.map((b, i) => (i === index ? emptyBlock(pick) : b)));
    setFocusIndex(index);
  }

  /**
   * ## A barra de blocos: o menu da `/` ao alcance do polegar
   *
   * **A barra `/` é um atalho de teclado, e o celular não tem teclado.** Ali a
   * barra mora no terceiro nível do teclado virtual, então o ÚNICO caminho
   * para inserir um título, uma passagem ou uma conclusão custava dois toques
   * antes do primeiro caractere. `BlockKeyboardBar` põe as mesmas opções numa
   * fileira acima do teclado, a um toque, e o `+` da ponta abre o mesmo
   * `SlashMenu` de sempre para quem quer filtrar digitando (ou citar rápido,
   * `/atos 1:1`).
   *
   * **Ela aparece SÓ com o cursor numa linha em branco, e some assim que a
   * linha deixa de ser uma.** É a pergunta "o que é esta linha?" ficando na
   * tela exatamente enquanto ela está aberta: com uma palavra escrita a
   * resposta já foi dada (é um parágrafo), e com um bloco escolhido também. É
   * também o que a mantém honesta: escolher no menu SUBSTITUI a linha, e
   * substituir uma linha que já tem texto seria apagar o que a pessoa escreveu.
   *
   * **Ela TOMA O LUGAR da `MobileActionBar` em vez de somar-se a ela.** Duas
   * faixas empilhadas comeriam ~120px sobre um teclado que já cobre metade da
   * tela, e buscar/Biblo/salvar não são o gesto de quem está com o cursor numa
   * linha vazia. Ela é bem mais baixa que a de ações (40px contra 56), traz só
   * os GLIFOS e não tem fundo: é uma régua de ferramentas do teclado, não a
   * navegação do app. Quando a linha ganha texto, a de ações volta.
   *
   * **Com o `SlashMenu` aberto, nenhuma das duas fica.** A linha passa a ter
   * `/` escrito — deixou de ser em branco —, e devolver a barra de ações no
   * mesmo quadro em que o menu abre seria uma faixa piscando por baixo dele.
   * O menu É a barra naquele instante.
   */
  const writingFocus: number | "tail" | null = (() => {
    if (tailFocus) return "tail";
    if (active === null) return null;
    const block = doc.blocks[active];
    return block && isBlankParagraph(block) ? active : null;
  })();

  /** Sem "Parágrafo": a linha em branco que põe a barra no ar já é um. */
  const barOptions = menuOptions.filter((o) => o.type !== "paragraph");

  /**
   * Escolher na fileira é escolher no menu, e o caminho é literalmente o mesmo
   * (`pickSlash`). A linha do fim não é um bloco ainda, então ela vira um
   * parágrafo vazio ANTES — sem foco, porque `pickSlash` decide para onde o
   * cursor vai a seguir, e cada tipo decide diferente.
   *
   * Os dois `patchBlocks` encadeiam sem se atropelar: são atualizações
   * funcionais, e a segunda recebe o documento que a primeira devolveu.
   */
  function pickFromBar(target: number | "tail", pick: BlockPick) {
    const index =
      target === "tail" ? insertAt(doc.blocks.length, emptyBlock("paragraph"), false) : target;
    pickSlash(index, pick);
  }

  /**
   * O `+`: escreve a barra na linha e abre o menu — o mesmo estado que digitar
   * `/` produziria, pela mesma porta.
   *
   * `setFocusIndex` não é redundante: o texto da `textarea` controlada passa de
   * vazio para `/`, e sem pedir o cursor de volta ele fica ANTES da barra, onde
   * a próxima letra digitada escaparia do filtro do menu.
   */
  function openSlashFrom(target: number | "tail") {
    if (target === "tail") {
      const at = insertAt(doc.blocks.length, { type: "paragraph", text: "/" });
      setSlash({ index: at, cursor: 0, convert: false });
      return;
    }
    setBlock(target, { text: "/" });
    setSlash({ index: target, cursor: 0, convert: false });
    setFocusIndex(target);
  }

  /**
   * ## O botão que abre o menu sobre um bloco que já existe
   *
   * **A barra `/` responde "o que é esta linha?" antes de escrever, e não
   * havia nada respondendo DEPOIS.** Quem digitou um parágrafo e percebeu que
   * ele era um título tinha de apagar a frase, digitar `/`, escolher e
   * redigitá-la — ou aprender o atalho `# `, que existe e que ninguém
   * descobre sem ser avisado. O botão é a mesma pergunta feita com o texto já
   * na tela.
   *
   * **Ele é UM botão com dois glifos, porque são dois momentos da mesma
   * pergunta.** Numa linha em branco não há o que trocar, e o que ele faz é
   * ESCOLHER o que vai nascer ali: o `+` é essa promessa, e o caminho é
   * literalmente o de digitar a barra (`openSlashFrom`), com a busca e a
   * Bíblia que vêm junto dela. Com texto na linha a escolha já foi feita uma
   * vez, e o que resta é trocá-la: as formas (`Shapes`) são esse glifo, e o
   * menu abre sem escrever nada na frase de ninguém.
   *
   * **O `+` some da PÍLULA do bloco quando ele é uma passagem**: um
   * `bibleQuote` não tem texto seu para virar outra coisa, e o que se troca
   * nele — a referência — já é a pastilha que ele desenha.
   *
   * O cursor volta para a linha porque o menu é do TECLADO: as setas o
   * percorrem, o Enter escolhe, o Escape desiste, e tudo isso mora no
   * `onKeyDown` da caixa.
   */
  function turnAt(index: number) {
    const block = doc.blocks[index];
    if (!block) return;
    // Um parágrafo em branco é o terreno da barra: escrever `/` nele é o gesto
    // que a pessoa faria, e passar por ele mantém UM caminho só para inserir.
    if (isBlankParagraph(block)) {
      openSlashFrom(index);
      return;
    }
    setSlash({ index, cursor: 0, convert: true });
    setFocusIndex(index);
  }

  function onKeyDown(index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const block = doc.blocks[index];
    const isList = block?.type === "bulletList" || block?.type === "orderedList";

    /**
     * Com o menu da barra aberto, o teclado é DELE.
     *
     * Este ramo vem antes de tudo, e a ordem é o que o faz funcionar: o Enter
     * deste editor cria um bloco, e com a regra de baixo valendo aqui seria
     * impossível escolher uma opção sem antes fechar o menu com o mouse. As
     * setas também: sem interceptá-las, elas andariam com o cursor dentro de
     * uma linha que só tem uma barra escrita.
     */
    if (slash?.index === index && slashOptions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        const count = slashOptions.length;
        // Circular: numa lista de nove itens, chegar ao fim e voltar ao começo
        // é mais curto que subir oito vezes.
        // Atualização FUNCIONAL, e não um objeto novo: mover o cursor é a
        // única coisa que esta tecla faz, e remontar o estado aqui apagava o
        // modo `convert` do menu. Ver o cabeçalho de `slash`.
        setSlash((cur) => (cur ? { ...cur, cursor: (cur.cursor + step + count) % count } : cur));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickSlash(index, slashOptions[Math.min(slash.cursor, slashOptions.length - 1)].type);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      /**
       * Numa LISTA, Enter é o comportamento nativo da `textarea`: ele abre uma
       * linha, e uma linha é um item. Não há nada a fazer, e é por isso que este
       * ramo termina sem `preventDefault` — foi ele que precisou existir, porque
       * o Enter de todo o resto do editor CRIA UM BLOCO, e com essa regra valendo
       * aqui era impossível escrever o segundo tópico de uma lista.
       *
       * A exceção é o Enter no vazio, que é como toda lista da web termina:
       * estando na última linha e ela em branco, a lista se fecha e um parágrafo
       * nasce abaixo. A linha em branco que sobraria é comida no caminho — ela
       * era a intenção de sair, não um item.
       */
      if (isList) {
        const caret = el.selectionStart;
        const lineStart = el.value.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;
        const currentLine = el.value.slice(lineStart, caret);
        const atEnd = caret === el.value.length && el.selectionEnd === caret;
        if (currentLine.trim().length === 0 && atEnd) {
          e.preventDefault();
          const kept = el.value.slice(0, lineStart).replace(/\n$/, "");
          if (listItems(kept).length === 0) {
            // Uma lista sem nenhum item não é uma lista que acabou, é uma que
            // nunca começou: ela volta a ser o parágrafo que era, no lugar, em
            // vez de deixar um bloco vazio para trás e abrir outro.
            setBlock(index, { type: "paragraph", text: "" });
            return;
          }
          // `kept` saiu do que está NA CAIXA, que é o texto sem as cercas do
          // marca-texto: gravá-lo direto apagaria toda marca da lista para
          // fechar a última linha dela.
          setBlock(index, { text: applyDisplayEdit(block?.text ?? "", kept) });
          insertAt(index + 1, emptyBlock("paragraph"));
        }
        return;
      }
      e.preventDefault();
      insertAt(index + 1, emptyBlock("paragraph"));
      return;
    }

    if (e.key === "Backspace" && el.value.length === 0 && el.selectionStart === 0) {
      /**
       * **Apagar numa linha vazia DESFAZ o bloco, e o parágrafo é o chão.**
       *
       * O gesto de quem chega aqui é "não era isto que eu queria": o título
       * escolhido no menu ainda não tem uma letra, e a tecla que se aperta
       * para desfazer uma escolha errada é o Backspace. A regra valia só para
       * as listas, e valia por acidente de quem a escreveu primeiro — num
       * título, num destaque ou numa citação vazia a MESMA tecla apagava o
       * bloco inteiro e jogava o cursor para a linha de cima, que é uma
       * resposta bem maior do que a pergunta.
       *
       * O parágrafo é o fundo do poço porque ele é o bloco sem escolha: um
       * Backspace nele, aí sim, apaga a linha (é o que todo editor faz).
       *
       * O bloco troca de árvore no DOM ao trocar de tipo, e por isso o foco é
       * pedido de novo — a mesma razão escrita em `changeBlock`.
       */
      if (block && block.type !== "paragraph") {
        e.preventDefault();
        // Vazio de TEXTO não é vazio: o rótulo da Informação e o autor da
        // citação são campos do bloco, não da linha sob o cursor. Com um deles
        // escrito, a tecla não faz nada — que é o que ela faz em toda caixa
        // vazia — em vez de levar embora o que está dois centímetros acima.
        const extra =
          ("title" in block ? block.title : undefined) ??
          ("author" in block ? block.author : undefined);
        if (extra?.trim()) return;
        setBlock(index, { type: "paragraph", text: "" });
        setFocusIndex(index);
        return;
      }
      if (doc.blocks.length > 1) {
        e.preventDefault();
        removeAt(index);
      }
    }
  }

  /**
   * ## A busca do editor: "procurar neste rascunho"
   *
   * O botão de busca da barra de baixo procura DENTRO do texto que está na
   * tela, e não no acervo — a mesma correção que a lupa do `/summary` já tinha
   * feito (ver `SummaryFind`). Sobre um documento aberto, uma lupa promete
   * procurar dentro dele; quem quer o acervo tem o voltar, que é por onde
   * entrou. No DESKTOP a lupa do cabeçalho continua sendo a GLOBAL, porque lá
   * ela divide a barra com as três portas de criação e o polegar não decide
   * nada.
   *
   * **A unidade aqui é o BLOCO, e não a ocorrência.** Na leitura o destaque são
   * `Range`s entregues à CSS Custom Highlight API, sobre o texto já pintado;
   * aqui cada bloco é uma `textarea`, e o que está dentro de uma `textarea`
   * nenhuma das duas coisas alcança — nem o `Range`, nem o `::highlight`. Então
   * o resultado é o bloco: ele rola até o centro, PISCA (`revealSummaryBlock`,
   * o mesmo retorno que a inserção pela conversa já usa) e fica com a borda
   * acesa enquanto a busca está aberta. Acender todos os que casam de uma vez é
   * o que responde "quantos e onde" sem pintar uma palavra.
   *
   * O termo é comparado sem acento e sem caixa (`normalizeSearch`), como no
   * acervo, e varre também o que o bloco tem além do corpo: o título de uma
   * Informação, a referência de uma passagem, o autor de uma citação.
   *
   * O mínimo de 2 letras é o mesmo da leitura: com uma letra só, "a" acende o
   * texto inteiro, e um rascunho todo aceso não é um resultado de busca.
   */
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);

  const findNeedle = normalizeSearch(findQuery.trim());
  const findEnough = findNeedle.length >= FIND_MIN_QUERY;

  const findHits = useMemo(() => {
    if (!findOpen || !findEnough) return [];
    const hits: number[] = [];
    doc.blocks.forEach((block, i) => {
      if (normalizeSearch(blockHaystack(block)).includes(findNeedle)) hits.push(i);
    });
    return hits;
  }, [findOpen, findEnough, findNeedle, doc.blocks]);

  const findCurrent = findHits.length > 0 ? Math.min(findIndex, findHits.length - 1) : -1;

  // Termo novo recomeça do primeiro resultado: manter o quinto ao trocar de
  // palavra levaria o texto para um lugar que ninguém pediu.
  // biome-ignore lint/correctness/useExhaustiveDependencies: o alvo é a troca de termo, não o valor dele
  useEffect(() => {
    setFindIndex(0);
  }, [findNeedle]);

  /**
   * Rolar até o resultado em foco, UMA vez por (termo, posição).
   *
   * A trava é a mesma do `SummaryFind`, e aqui ela vale mais: `findHits` é
   * recalculado a cada tecla digitada no PRÓPRIO texto (o editor continua
   * editável com a busca aberta), e sem ela a página escorregaria sozinha
   * enquanto alguém corrige a palavra que acabou de achar.
   */
  const revealedFor = useRef("");
  useEffect(() => {
    if (findCurrent < 0) return;
    const key = `${findNeedle}::${findCurrent}`;
    if (revealedFor.current === key) return;
    revealedFor.current = key;
    revealSummaryBlock(findHits[findCurrent]);
  }, [findCurrent, findHits, findNeedle]);

  function stepFind(delta: number) {
    setFindIndex((prev) => {
      const total = findHits.length;
      if (total === 0) return 0;
      return (Math.min(prev, total - 1) + delta + total) % total;
    });
  }

  function closeFind() {
    setFindOpen(false);
    setFindQuery("");
  }

  /**
   * "Salvar": manda o que falta e ABRE A LEITURA, nessa ordem.
   *
   * **O rótulo diz SALVAR porque é isso que se procura num editor**, e o botão
   * chamava-se "Ver como ficou". O salvamento sozinho já acontece — cada
   * mudança cai no aparelho em 300ms e no banco em 1,8s (ver `useWrittenDraft`)
   * —, e um botão que anuncia a leitura deixava a pergunta que todo mundo faz
   * ("e isto está salvo?") sem nada na tela para respondê-la, com o chip de
   * estado do lado dizendo a resposta em voz baixa. Abrir a leitura continua
   * sendo o que ele faz depois, e é o destino certo: o texto salvo é o texto
   * lido.
   *
   * O `await flush()` é a coisa toda. Ele espera o texto da tela estar no
   * banco — inclusive a palavra digitada durante um salvamento automático que
   * já estava no ar, que era por onde escapava a leitura desatualizada (ver o
   * cabeçalho de `useWrittenDraft`).
   *
   * **E um envio que FALHOU não navega, quando havia algo por enviar.** É a
   * outra maneira de a leitura abrir sem o que a pessoa acabou de escrever, e
   * a mais cruel: no elevador, o botão levaria a um texto de dois parágrafos
   * atrás com nada explicando a diferença. Ficando aqui, quem explica é o chip
   * ao lado do botão, a vinte pixels dali.
   *
   * Com tudo já sincronizado, uma falha não impede nada: não há o que perder,
   * e quem só quer LER o que escreveu não deve ficar preso no editor porque a
   * rede caiu depois de o texto estar salvo.
   *
   * `dirty` é lido ANTES do `await` de propósito — a pergunta é "havia algo
   * por salvar quando o dedo tocou?", e `status` depois da espera ainda seria
   * o valor deste render, não o de agora.
   */
  async function openReading() {
    const dirty = status !== "synced";
    setLeaving(true);
    const sentId = await flush();
    if (sentId) {
      // O texto acabou de mudar no banco, e a leitura pode estar GUARDADA no
      // cliente: o cartão da Biblioteca adianta `/summary/:id` inteiro no
      // toque (`prefetchOnPress`, ver `NavLink`), e um prefetch completo vale
      // cinco minutos. Sem esta linha, "Salvar" abre o resumo de antes da
      // edição — o sintoma clássico dele é recarregar a página e ver o texto
      // certo. `refresh` é a única alavanca do cliente sobre esse cache.
      router.refresh();
      router.push(`/summary/${sentId}`);
      return;
    }
    // O envio falhou (`flush` só devolve `null` assim).
    if (dirty || !sessionId) {
      setLeaving(false);
      return;
    }
    router.push(`/summary/${sessionId}`);
  }

  const empty = doc.blocks.length === 0;
  const endsBlank = doc.blocks.length > 0 && isBlankParagraph(doc.blocks[doc.blocks.length - 1]);

  /**
   * A CONCLUSÃO FECHA A FOLHA, e a linha do fim desaparece junto.
   *
   * Nada se escreve abaixo do fecho, do mesmo jeito que nada se escreve acima
   * da ideia central: as duas pontas do documento são únicas e FIXAS, e o que
   * está entre elas é o texto. Uma caixa de digitar embaixo da conclusão
   * prometia um lugar que não existe — o `insertionIndex` já é o teto, então o
   * parágrafo digitado ali nascia ACIMA do fecho, e a letra aparecia a um
   * cartão de distância de onde o cursor estava.
   *
   * A pergunta é "existe conclusão?", e não "ela é a última?": o teto vale
   * onde quer que ela esteja (um resumo gerado antigo pode ter blocos depois
   * dela), e a linha do fim é, por definição, a posição mais baixa da folha.
   *
   * Quem quer escrever mais um parágrafo com o fecho já posto continua tendo
   * o Enter no fim do bloco de cima, que cai onde deve: logo antes da
   * conclusão.
   */
  const closed = conclusionAt >= 0;

  /**
   * ## Arrastar um bloco: o gesto que as setas não dão
   *
   * As duas setas da pílula andam UMA casa por toque. Pôr o terceiro parágrafo
   * depois do décimo custa sete cliques com o olho perseguindo o bloco tela
   * abaixo; com o dedo (ou o punho da margem esquerda) é um gesto só. As setas
   * ficam, e passam a ser o que sempre foram melhores em ser: o ajuste de um
   * vizinho, e o caminho de quem usa teclado.
   *
   * O teto é a CONCLUSÃO, a mesma regra do `insertionIndex`: nada cai abaixo do
   * fecho, e ela própria não se move (`canDrag`). Um gesto que não passa pelo
   * menu não pode furar a invariante que o menu respeita.
   *
   * O resto — o punho, o pressionar e segurar, a rolagem automática e a linha
   * de destino — mora em `useBlockDrag`, e a prévia em `BlockDragGhost`.
   */
  const listRef = useRef<HTMLDivElement | null>(null);
  const surfaceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const blockDrag = useBlockDrag({
    count: doc.blocks.length,
    ceiling: closed ? conclusionAt : doc.blocks.length,
    canDrag: (i) => doc.blocks[i]?.type !== "conclusion",
    nodeAt: (i) => surfaceRefs.current[i] ?? null,
    container: () => listRef.current,
    onDrop: moveTo,
    // O menu da barra e a pílula somem no instante em que o bloco se solta: são
    // controles de uma linha parada, e um deles ficaria pousado sobre o lugar
    // de onde o bloco saiu.
    onStart: () => {
      setSlash(null);
      setActive(null);
    },
  });

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[1024px] flex-col gap-6 px-4 pb-24 sm:gap-8 sm:px-6">
      {header}

      {/* A busca deste rascunho, FIXA no topo enquanto aberta (ela sai do
          fluxo, então esta posição no JSX não é a posição dela na tela). Ver
          "A busca do editor" acima e o cabeçalho de `FindBar`. */}
      {findOpen ? (
        <FindBar
          query={findQuery}
          total={findEnough ? findHits.length : null}
          index={findCurrent < 0 ? 0 : findCurrent}
          label="Procurar neste texto"
          onQueryChange={setFindQuery}
          onStep={stepFind}
          onClose={closeFind}
        />
      ) : null}

      {/* A COLUNA DE ESCRITA, mais estreita que a barra do topo.

          O `<main>` tem 1024px para a `TopBar` terminar onde ela termina na
          Biblioteca — ela é a mesma peça em toda tela do app, e o avatar
          saltar de lugar ao entrar aqui seria a barra mudando de desenho. A
          FOLHA fica em 768, a mesma medida da leitura: o que se escreve aqui
          é lido no `/summary`, e escrever com a linha 256px mais larga do que
          ela vai ser quebraria a promessa de que o que se vê é o que sai.

          O `PassagePicker` fica FORA desta coluna: é um diálogo, portal, sem
          posição no fluxo. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 sm:gap-8">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            {/* Numa folha em branco que nunca foi salva, "Salvo" é tecnicamente
                verdade e mentira na prática: não há nada salvo porque não há
                nada. O chip entra quando passa a existir algo sobre o que
                afirmar. */}
            {sessionId || status !== "synced" ? (
              <StatusChip status={status} offline={offline} />
            ) : (
              <span />
            )}
            {sessionId ? (
              <button
                type="button"
                onClick={openReading}
                disabled={leaving}
                className="inline-flex items-center gap-1.5 rounded-full bg-scriba-ink-mute/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-soft transition-colors hover:bg-scriba-blue-soft/70 hover:text-scriba-blue-ink disabled:opacity-60"
              >
                <Save className="size-3.5" />
                Salvar
              </button>
            ) : null}
          </div>

          <AutoTextarea
            value={doc.title}
            onChange={(v) =>
              setDoc((prev) => ({ ...prev, title: v.slice(0, WRITTEN_LIMITS.title) }))
            }
            ariaLabel="Título"
            placeholder="Título"
            className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-3xl md:text-4xl"
          />

          {/* Autor e local só existem depois do primeiro salvamento (o PATCH
              precisa de uma linha para apontar) — mesmo botão da leitura,
              trazido para cá para não obrigar uma volta ao `/summary`. */}
          {sessionId ? (
            <div className="flex flex-wrap items-center gap-2">
              {speakerName?.trim() ? (
                <button
                  type="button"
                  onClick={() => setSpeakerDialogOpen(true)}
                  className={cn(
                    "group inline-flex items-center gap-2 rounded-full -mx-1 px-1 py-0.5 outline-none transition-colors",
                    "hover:bg-scriba-blue-soft/60 focus-visible:ring-2 focus-visible:ring-ring/40"
                  )}
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-scriba-blue-soft text-[10px] font-semibold text-scriba-blue-ink">
                    {speakerInitials}
                  </span>
                  <span className="text-sm font-medium leading-none text-scriba-ink">
                    {speakerName}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSpeakerDialogOpen(true)}
                  className={ADD_BADGE_CLASSES}
                >
                  <Plus className="size-3" strokeWidth={2.5} />
                  Adicionar autor
                </button>
              )}
              {speakerLocation?.trim() ? (
                <button
                  type="button"
                  onClick={() => setLocationDialogOpen(true)}
                  className={cn(
                    "group -mx-1 inline-flex w-fit items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-light text-scriba-ink-mute outline-none transition-colors",
                    "hover:bg-scriba-blue-soft/60 focus-visible:ring-2 focus-visible:ring-ring/40"
                  )}
                >
                  <MapPin className="size-3" />
                  {speakerLocation}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setLocationDialogOpen(true)}
                  className={ADD_BADGE_CLASSES}
                >
                  <Plus className="size-3" strokeWidth={2.5} />
                  Adicionar local
                </button>
              )}
            </div>
          ) : null}
        </header>

        {/* O VÃO é do contêiner, e nada mais mora dentro dele.

            Ele já foi de 56px para abrigar um disco de `+` que aparecia entre
            cada dois blocos. Eram dois discos por bloco, acendendo e apagando ao
            passar do mouse, e o preço de manter cada um longe do vizinho era um
            vão duas vezes maior que o da leitura. Hoje o `+` mora na pílula do
            bloco, junto de mover e excluir, e o vão voltou a ser só espaço: 32px,
            contra os 28 da leitura.

            **A linha do cabeçalho é o PRIMEIRO item desta lista**, e não uma irmã
            dela lá em cima: assim o espaço abaixo dela é decidido por quem sabe o
            que vem depois, e não pelo `gap` do `<main>`. */}
        <div ref={listRef} className="relative flex flex-col gap-8">
          {/* ONDE O BLOCO VAI CAIR, enquanto ele está no ar.

              Uma linha no vão entre dois blocos, e não o vizinho abrindo espaço
              para ele: abrir espaço significa mudar a altura da lista debaixo do
              dedo, e as caixas de todos os blocos foram medidas no início do
              gesto justamente para que nada se mexa (ver `useBlockDrag`). A
              linha diz a mesma coisa sem mover uma letra.

              Ela é `absolute` sobre o contêiner, e por isso ele é `relative`. */}
          {blockDrag.drag ? (
            <div
              aria-hidden
              style={{ top: blockDrag.drag.indicatorTop }}
              // Ela tem a largura da SUPERFÍCIE, não a da coluna de texto: é o
              // bloco que vai cair ali, e o bloco avança 12px (20 no sm) para
              // fora da coluna de cada lado. É o mesmo par do `BLOCK_SURFACE`.
              className="pointer-events-none absolute -left-3 -right-3 z-20 h-0.5 -translate-y-1/2 rounded-full bg-scriba-blue sm:-left-5 sm:-right-5"
            />
          ) : null}
          <div className="h-px w-full bg-scriba-hairline" />

          {/* A IDEIA CENTRAL, quando existe, é o primeiro item do texto.
              Ela não é um bloco — é o `shortSummary` do payload, a frase que
              aparece no cartão da Biblioteca e na busca —, e por isso não tem
              pílula de mover nem de excluir: a posição dela é fixa, e quem a
              tira é o `×` do próprio cartão. Está aqui dentro, e não no
              cabeçalho onde morava, porque é aqui que ela vai estar na LEITURA
              (ver `SummaryView`): o editor promete que o que se escreve é o que
              se lê, e a única frase que abria o texto num lugar e aparecia em
              outro era esta.

              A roupa é a do `LeadIdea`, com uma diferença que não é estética:
              sem a animação do gradiente. Lá ela diz "isto a máquina escreveu";
              aqui quem escreve é a pessoa, e um cartão pulsando sob o cursor é
              movimento embaixo do texto que está sendo digitado. */}
          {showLead ? (
            <section className="flex flex-col gap-2 rounded-[26px] bg-[image:var(--session-surface-quote)] bg-[size:200%_100%] p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-session-chip-ai">
                  <ScribaMark className="size-3" />
                  Ideia central
                </span>
                <button
                  type="button"
                  aria-label="Remover a ideia central"
                  title="Remover a ideia central"
                  onClick={() => {
                    setLeadAsked(false);
                    setDoc((prev) => ({ ...prev, shortSummary: "" }));
                  }}
                  className="-mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-scriba-ink-mute transition-colors hover:bg-scriba-rose hover:text-scriba-rose-ink"
                >
                  <X className="size-4" />
                </button>
              </div>
              <AutoTextarea
                value={doc.shortSummary}
                onChange={(v) =>
                  setDoc((prev) => ({
                    ...prev,
                    shortSummary: v.slice(0, WRITTEN_LIMITS.shortSummary),
                  }))
                }
                textareaRef={(el) => {
                  leadRef.current = el;
                }}
                ariaLabel="Ideia central"
                placeholder="Em uma frase, do que trata esta mensagem."
                className="text-pretty text-[17px] font-light leading-[1.7] text-session-verse-text"
              />
            </section>
          ) : null}

          {doc.blocks.map((block, i) => {
            // A busca acende TODOS os blocos que casam e destaca o da vez. Ver
            // "A busca do editor": aqui o resultado é o bloco, porque o que
            // está dentro de uma `textarea` não aceita destaque de texto.
            const hit = findHits.includes(i);
            const currentHit = findCurrent >= 0 && findHits[findCurrent] === i;
            const body = (
              <BlockBody
                block={block}
                index={i}
                onFocus={() => setActive(i)}
                onChange={(patch) => changeBlock(i, patch)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onSelect={(e) => {
                  const el = e.currentTarget;
                  setSelectedIn(el.selectionEnd > el.selectionStart ? i : null);
                }}
                onOpenPicker={() => setPickerFor(i)}
                registerRef={(el) => {
                  refs.current[i] = el;
                }}
              />
            );

            return (
              // Nem o `onBlur` nem o `onPointerDown` daqui são interação: o
              // primeiro APAGA um estado quando o cursor sai do bloco, o segundo
              // arma o pressionar-e-segurar do arrasto (`useBlockDrag`). Não há
              // ação atrás deste `div` para um leitor de tela alcançar — quem
              // move o bloco pelo teclado são as setas da pílula.
              // biome-ignore lint/a11y/noStaticElementInteractions: ver acima
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: ver o cabeçalho
                key={i}
                // O índice no DOM é o que deixa a inserção pela conversa rolar
                // até o bloco e piscar nele. Ver `revealSummaryBlock`.
                {...{ [SUMMARY_BLOCK_ATTR]: i }}
                {...blockDrag.pressProps(i)}
                className={cn(
                  "group relative flex flex-col",
                  // O bloco que está no ar continua no lugar, APAGADO: tirá-lo
                  // da lista mudaria a altura de tudo abaixo dele no meio do
                  // gesto, e é a imobilidade da folha que faz a linha de destino
                  // significar alguma coisa.
                  blockDrag.drag?.from === i && "opacity-30"
                )}
                onBlur={(e) => {
                  // `relatedTarget` é quem RECEBEU o foco. Se for um filho deste
                  // bloco (a lixeira, o mover, a pastilha da passagem), o cursor
                  // não saiu daqui e o bloco continua sendo o ativo.
                  if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                  setActive((cur) => (cur === i ? null : cur));
                  // O menu da barra é a linha sendo escrita: sem o cursor nela,
                  // ele fica pousado sobre um `/` que ninguém está digitando.
                  // Escolher uma opção não passa por aqui — os itens usam
                  // `onMouseDown` com `preventDefault`, que não tira o foco.
                  setSlash((cur) => (cur?.index === i ? null : cur));
                  // A barra ABANDONADA some com o menu que ela abriu: uma linha
                  // que ficou só com `/` é um comando que ninguém completou, e
                  // não um parágrafo com uma barra dentro. Sem isto, o `+` da
                  // barra de blocos (`openSlashFrom`) deixaria esse resíduo
                  // toda vez que alguém abrisse o menu e desistisse — e
                  // desistir sem apagar nada é o que o botão deve permitir.
                  if (block.type === "paragraph" && block.text === "/") setBlock(i, { text: "" });
                }}
              >
                {/* A pílula não fica no ar durante um arrasto: ela é o controle
                    de uma linha PARADA, e os botões dela pousariam sobre o vão
                    de onde o bloco acabou de sair. */}
                {blockDrag.drag ? null : (
                  <BlockControls
                    shown={active === i}
                    blank={block.text.trim().length === 0 || block.text === "/"}
                    /* A passagem fica de fora: o texto dela vem da NVI pela
                     referência, então não há frase sua para virar outro bloco,
                     e o que se troca nela — a referência — já é a pastilha que
                     ela desenha. Ver `turnAt`. */
                    onTurn={block.type === "bibleQuote" ? undefined : () => turnAt(i)}
                    /* A CONCLUSÃO não se move, e nada se move para depois dela:
                     ela é o fecho, e as setas são o único caminho que restaria
                     para desmanchar a posição que a inserção garante. Os
                     botões ficam ali, desabilitados (o `ControlButton` já
                     desenha isso a 30% quando não recebe `onClick`) — sumir
                     com eles faria a pílula deste bloco ter uma largura
                     diferente da dos vizinhos. */
                    onUp={i > 0 && block.type !== "conclusion" ? () => moveBy(i, -1) : undefined}
                    onDown={
                      i < doc.blocks.length - 1 &&
                      block.type !== "conclusion" &&
                      conclusionAt !== i + 1
                        ? () => moveBy(i, 1)
                        : undefined
                    }
                    /* O marca-texto só existe com um recorte na mão, e só nos
                     blocos cuja LEITURA passa pelo `RichText` — marcar onde a
                     marca não vai aparecer seria um botão que engole o gesto.
                     Ver `MARKABLE`. */
                    onMark={
                      selectedIn === i && MARKABLE.has(block.type) ? () => markAt(i) : undefined
                    }
                    onDelete={() => removeAt(i)}
                  />
                )}
                {/* O bloco em foco POUSA NUMA SUPERFÍCIE, e é assim que se vê
                    onde o cursor está. Ele existe pelo celular, onde não há
                    ponteiro e o teclado cobre metade da tela — sem nada aceso,
                    "onde eu estava?" só se responde rolando até achar o cursor.

                    Foi uma barra na margem esquerda antes, e barra na margem é o
                    vocabulário de CITAÇÃO: é exatamente o que o bloco `quote`
                    desenha três linhas abaixo (`border-l-2 pl-4`). O mesmo traço
                    para "isto é uma citação" e para "é aqui que você está" faz um
                    parágrafo comum parecer citado enquanto é escrito.

                    A caixa é sempre a mesma (`BLOCK_SURFACE`), com ou sem foco:
                    o recuo já está lá e o negativo já o devolveu, então acender a
                    cor não empurra uma letra.

                    É `focus-within` puro, e não o `active`: a superfície não tem
                    nada a que sobreviver — ela é o foco, e mais nada —, e o
                    `active` existe para os botões, que precisam continuar
                    clicáveis no toque seguinte. */}
                <div
                  // A caixa VISÍVEL do bloco: é ela que o arrasto mede e é ela
                  // que a prévia clona. Ver `useBlockDrag`.
                  ref={(el) => {
                    surfaceRefs.current[i] = el;
                  }}
                  className={cn(
                    BLOCK_SURFACE,
                    "relative focus-within:bg-scriba-blue-soft/40",
                    // O amarelo é o MESMO da busca da leitura e do marca-texto:
                    // um segundo tom para "achei aqui" seria uma segunda
                    // gramática para a mesma ideia. O da vez é o cheio, os
                    // outros ficam no claro — sem essa diferença, achar o
                    // quinto de doze seria contar de cima.
                    hit && "ring-1 ring-scriba-yellow-light/40",
                    currentHit && "bg-scriba-yellow-light/10 ring-scriba-yellow"
                  )}
                >
                  {/* O PUNHO, na margem esquerda, e ele mora dentro do RECUO da
                      superfície — não fora dela.

                      A superfície avança 20px para além da coluna de texto
                      (`-mx-5`), e esses 20px são exatamente o `px-5` dela: um
                      absoluto em `left-0` cai nesse vão, à esquerda de toda
                      letra e sem cobrir nenhuma. Pô-lo FORA da superfície seria
                      bonito e quebraria em janela estreita — a coluna encosta
                      nas bordas do `<main>` antes dos 1024px, e o punho sairia
                      da tela sem nada avisando.

                      **Ele é mais ESTREITO que o recuo, e é daí que sai o vão
                      até o texto.** Com 20px ele preenchia os 20px do `px-5`
                      inteiros e encostava na primeira letra. O recuo não pode
                      crescer para abrir espaço (a superfície já avança até a
                      borda do `<main>` em janela estreita, e mais um pixel para
                      fora é uma barra de rolagem horizontal), e o punho não
                      pode sair dele pela mesma razão — então quem cede é o
                      punho: 16px de alvo com um glifo de 12, que deixa 6px de
                      ar antes do texto começar.

                      **Ele é CENTRADO na superfície**, e não alinhado ao topo
                      dela. Alinhado ao topo ele nasce alto em quase todo bloco
                      e por razões diferentes em cada um: o `h1` empurra o texto
                      com um `mt-4`, a Informação é uma moldura com `py-4`, a
                      passagem e a conclusão são cartões de `p-6` — não existe um
                      número que sirva aos oito. E centrar não é só o conserto
                      mais robusto, é o mais honesto: o punho move o BLOCO
                      inteiro, não a linha em que ele está, e quem se ancora no
                      alto é a pílula, que é de outra coisa.

                      **Ele não existe no celular** (`hidden sm:flex`), e é a
                      mesma razão pela qual a pílula flutua acima do bloco: não
                      há margem esquerda ali. No dedo quem move é pressionar e
                      segurar a linha, ver `useBlockDrag`.

                      `cursor-grab` é metade do convite; a outra metade é ele
                      aparecer só ao passar o mouse, como a pílula. */}
                  {blockDrag.drag || block.type === "conclusion" ? null : (
                    <button
                      type="button"
                      aria-label={`Arrastar o bloco ${i + 1} para outro lugar`}
                      title="Arrastar para mover"
                      {...blockDrag.handleProps(i)}
                      className="-translate-y-1/2 absolute top-1/2 left-0 hidden h-6 w-4 cursor-grab touch-none items-center justify-center rounded-md text-scriba-ink-mute opacity-0 transition-opacity hover:bg-scriba-blue-soft/60 hover:text-scriba-ink focus-visible:opacity-100 active:cursor-grabbing group-hover:opacity-100 sm:flex"
                    >
                      <GripVertical className="size-3" />
                    </button>
                  )}
                  {/* `relative` para o ÂNCORA do menu da barra cobrir
                      EXATAMENTE a linha: esta caixa começa onde o texto começa,
                      e o âncora é um `absolute inset-0` invisível dentro dela.
                      A barra só abre num parágrafo VAZIO, então o cursor está
                      no início da linha — que é esta borda. É por isso que aqui
                      não há medição de geometria dentro da `textarea`, que é a
                      única coisa da página cuja posição o DOM não expõe. O menu
                      em si não mora aqui: ele sai por portal para o `body`, e
                      as coordenadas saem deste âncora (ver `SlashMenu`). */}
                  <div className="relative min-w-0">
                    {body}
                    {slash?.index === i ? (
                      <SlashMenu
                        options={slashOptions}
                        cursor={slash.cursor}
                        query={slashQuery}
                        // Funcional pela mesma razão das setas: o mouse
                        // passando por cima de um item só move o cursor, e um
                        // objeto novo aqui apagava o modo `convert` no caminho
                        // entre o botão que abriu o menu e o item escolhido.
                        onHover={(cursor) => setSlash((cur) => (cur ? { ...cur, cursor } : cur))}
                        onPick={(pick) => pickSlash(i, pick)}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {/* A linha do fim: uma linha em branco de parágrafo, sempre presente.
              É a única posição que não depende de um bloco existir — todas as
              outras saem da pílula de um deles —, e a única em que se escreve
              sem escolher nada antes (ver `WritingLine`). É ela que mantém
              "escrever no fim do texto" sempre à mão, e é nela (ou em qualquer
              outra linha em branco) que a barra `/` abre o menu de blocos.

              Ela SOME quando o último bloco já é um parágrafo vazio, que é o que
              um Enter no fim do texto acabou de criar: as duas desenham a mesma
              linha em branco, e empilhadas seriam duas onde a pessoa pediu
              uma. E some de vez quando há conclusão, ver `closed`. */}
          {endsBlank || closed ? null : (
            <div
              className={cn(BLOCK_SURFACE, "group relative focus-within:bg-scriba-blue-soft/40")}
            >
              {/* **A linha do fim TAMBÉM tem o `+`, e é onde ele mais falta.**
                  A pílula é por BLOCO, e esta linha não é um — então, numa folha
                  em branco, onde não há bloco nenhum, o editor inteiro ficava
                  sem o botão: o único caminho para pedir um título era saber que
                  a `/` existe. Aqui ela é só o `+`: não há o que mover, o que
                  excluir nem o que marcar numa linha que ainda não é nada. */}
              <BlockControls shown={tailFocus} blank onTurn={() => openSlashFrom("tail")} />
              <WritingLine
                emphasis={empty}
                // Ela não passa pelo `active` (não é um bloco), e é a linha em
                // branco mais provável do editor. Ver `tailFocus`.
                onFocusChange={setTailFocus}
                onWrite={(text) => {
                  const at = insertAt(doc.blocks.length, { type: "paragraph", text });
                  // A barra digitada na linha do fim faz a MESMA coisa que
                  // dentro de um bloco: ela vira um parágrafo com `/` dentro, e
                  // o bloco recém-criado (agora mapeado por `doc.blocks.map`
                  // acima) desenha o menu sobre ele. Sem isto, o único lugar do
                  // editor onde se escreve sem escolher nada antes seria
                  // justamente o único onde a barra não funcionaria.
                  if (text === "/") setSlash({ index: at, cursor: 0, convert: false });
                }}
              />
            </div>
          )}
        </div>
      </div>

      <PassagePicker
        open={pickerFor !== null}
        // Editando uma referência que já existe, o seletor abre direto no
        // capítulo/versículo atual — não na lista de livros. Num bloco NOVO
        // (`pickerFor === -1`) vale o que a barra já sabia: o livro digitado,
        // o livro e o capítulo, ou nada (`pickerSeed`), e aí o começo do zero
        // de sempre.
        initialReference={
          pickerFor !== null && pickerFor >= 0
            ? ((doc.blocks[pickerFor] as { reference?: string } | undefined)?.reference ?? null)
            : pickerSeed
        }
        onOpenChange={(v) => {
          if (!v) setPickerFor(null);
        }}
        onPick={(reference) => {
          if (pickerFor === -1) insertAt(pendingIndex, { type: "bibleQuote", reference, text: "" });
          else if (pickerFor !== null) setBlock(pickerFor, { reference });
          setPickerFor(null);
        }}
      />

      <EntityFieldDialog
        kind="speaker"
        open={speakerDialogOpen}
        onOpenChange={setSpeakerDialogOpen}
        title={speakerName?.trim() ? "Editar autor" : "Adicionar autor"}
        placeholder="Nome do pregador"
        initialValue={speakerName ?? ""}
        fetchSuggestions={requestSpeakerSuggestions}
        onSave={(v) => patchSpeakerField("speakerName", v)}
      />
      <EntityFieldDialog
        kind="location"
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        title={speakerLocation?.trim() ? "Editar local" : "Adicionar local"}
        placeholder="Igreja ou local"
        initialValue={speakerLocation ?? ""}
        fetchSuggestions={requestLocationSuggestions}
        onSave={(v) => patchSpeakerField("speakerLocation", v)}
      />

      {/* O Biblo, e ele aparece desde a FOLHA EM BRANCO.

          Ele esperava o primeiro salvamento, e isso o tirava da tela justamente
          onde ele é mais útil: diante da folha vazia, onde a conversa dele é
          "Sobre qual assunto você gostaria de conversar?". O endereço nunca foi o problema —
          o `draftId` existe desde o primeiro quadro, sorteado no aparelho.

          Quem resolve a linha que ainda não existe é o `ensureSession`: o
          `flush` salva ANTES de cada pergunta, o que cria a linha na primeira
          e, nas seguintes, garante que o Biblo leia no servidor o texto que
          está na tela — e não o de duas frases atrás. A invariante "linha vazia
          no banco é impossível" (ver `useWrittenDraft`) continua de pé por um
          fio: quem abre a gaveta e não pergunta nada não cria nada.

          Aqui ele SABE inserir: o `insertAt` é o mesmo do menu do `+`, e a
          sugestão entra como bloco de verdade, no lugar que o Biblo propôs. Ver
          `BibloDock`. */}
      {/* A Bíblia fica na borda direita, aqui como na leitura: quem escreve o
          resumo de um sermão confere uma passagem tanto quanto quem o lê, e o
          `PassagePicker` do `+` não serve para isso — ele existe para INSERIR
          um bloco, e inserir no texto é um preço alto demais por uma consulta.
          Ver `BibleDock`. */}
      <BibleDock />
      {/* No celular, a barra unificada, e as duas PONTAS dela são desta tela: a
          busca procura neste rascunho (ver "A busca do editor") e a ação é o
          "Salvar", o mesmo botão do cabeçalho, ao alcance do polegar.
          O "+" das três portas fica na Biblioteca — criar a próxima sessão no
          meio de um texto que está sendo escrito é o gesto raro aqui. No
          desktop o Biblo continua sendo o disco de sempre. Ver o cabeçalho de
          `MobileActionBar`. */}
      {/* A fileira de blocos, no lugar da barra de ações enquanto o cursor está
          numa linha em branco. Ver "A barra de blocos" acima e o cabeçalho de
          `BlockKeyboardBar`. */}
      {ready && slash === null && writingFocus !== null && (
        <BlockKeyboardBar
          options={barOptions}
          onPick={(pick) => pickFromBar(writingFocus, pick)}
          onMore={() => openSlashFrom(writingFocus)}
        />
      )}
      {ready && slash === null && writingFocus === null && (
        <MobileActionBar
          onAskBiblo={() => bibloRef.current?.open()}
          bibloThinking={bibloThinking}
          onSearch={() => (findOpen ? closeFind() : setFindOpen(true))}
          searchOpen={findOpen}
          searchLabel="Procurar neste texto"
          trailing={
            sessionId ? (
              <button
                type="button"
                onClick={openReading}
                disabled={leaving}
                aria-label="Salvar"
                className={MOBILE_BAR_BUTTON_CLASS}
              >
                <Save aria-hidden className="size-5" strokeWidth={1.75} />
              </button>
            ) : undefined
          }
        />
      )}
      {ready && (
        <BibloDock
          ref={bibloRef}
          sessionId={draftId}
          ensureSession={flush}
          hideMobileTrigger
          onThinkingChange={setBibloThinking}
          onInsert={(suggestion) => {
            // Sem foco, com revelação: ver `revealIndex`.
            setRevealIndex(insertAt(suggestion.afterIndex + 1, suggestion.block, false));
          }}
          onRemove={(suggestion) => {
            // Remove a ÚLTIMA ocorrência igual à sugerida, e não um índice
            // guardado: entre o "Adicionar" e o "Remover" a pessoa pode ter
            // escrito, movido ou apagado blocos, e um índice velho apagaria o
            // parágrafo errado. Comparar o conteúdo é o que sobrevive a isso.
            const needle = JSON.stringify(suggestion.block);
            patchBlocks((blocks) => {
              const at = blocks.map((b) => JSON.stringify(b)).lastIndexOf(needle);
              return at < 0 ? blocks : blocks.filter((_, i) => i !== at);
            });
          }}
        />
      )}

      {/* O bloco NA MÃO: um clone da caixa de origem seguindo o ponteiro, por
          portal. Ver `BlockDragGhost`. */}
      {blockDrag.drag && blockDrag.source ? (
        <BlockDragGhost
          source={blockDrag.source}
          width={blockDrag.drag.width}
          elementRef={blockDrag.ghostRef}
        />
      ) : null}

      {/* `ready` só é falso por um instante, enquanto o rascunho do aparelho é
          consultado. Ele não esconde a tela (isso faria a página piscar em todo
          carregamento); serve para não anunciar "Salvo" antes de saber se há
          trabalho local por sincronizar. */}
      {ready ? null : <span className="sr-only">Carregando o rascunho…</span>}
    </main>
  );
}

/** Um parágrafo sem uma letra: a linha em branco que espera o `/`. */
function isBlankParagraph(block: WrittenBlock): boolean {
  return block.type === "paragraph" && block.text.length === 0;
}

/**
 * O menu da BARRA: as opções de bloco, filtradas pelo que se digita depois da
 * `/`, chamadas pelo teclado ou pelo mouse.
 *
 * É o ÚNICO caminho para inserir um bloco — não há mais um botão `+`. Ele
 * responde "o que é esta linha?" enquanto as mãos estão no teclado, filtra
 * enquanto se digita e é percorrido com as setas; uma lista VERTICAL é a
 * forma que a seta pede, e o realce do item focado só faz sentido numa lista
 * em que existe um item focado.
 *
 * Ela pousa SOBRE o texto que continua ali embaixo, e por isso tem contorno e
 * sombra: uma lista sem borda sobre parágrafos vira duas camadas de texto na
 * mesma tinta.
 *
 * `pointer-events` ficam ligados: o mouse também escolhe, e passar por cima
 * move o mesmo cursor que as setas movem — dois destaques ao mesmo tempo, um
 * do mouse e outro do teclado, é a ambiguidade que faz o Enter parecer aleatório.
 *
 * ## Ele abre para BAIXO, menos quando não cabe
 *
 * Abrir sempre para baixo é o caminho certo em toda linha, menos justamente na
 * que mais recebe a barra: a última. Escrever é escrever para BAIXO, então o
 * cursor vive perto do rodapé da janela, e ali uma lista de nove itens
 * (~20rem) nasce inteira fora da tela — a pessoa digita `/`, não vê nada
 * acontecer, apaga e conclui que o atalho não existe.
 *
 * **A medida é contra o VIEWPORT VISÍVEL, não contra `window.innerHeight`, e
 * essa troca é o que consertou o corte no celular.** No modo padrão do
 * Android (`resizes-visual`, o mesmo que o `useKeyboardInset` existe para
 * compensar) o teclado NÃO encolhe `innerHeight` — a conta achava que sobrava
 * espaço embaixo contando um espaço que o teclado já tinha comido, escolhia
 * "para baixo" e a lista nascia cortada por baixo do teclado. `visualViewport`
 * encolhe nos dois modos, então a conta passa a valer nos dois.
 *
 * **E a lista se ENCOLHE ao espaço que sobrou, nos dois lados.** Antes só o
 * lado "embaixo" era medido contra o teto de altura; "em cima" bastava ter
 * MAIS espaço que embaixo para ser escolhido, sem checar se aquele espaço
 * bastava — numa janela baixa dos dois lados, "em cima" ainda estourava o
 * topo da tela. Agora os dois lados clampam a própria altura ao que
 * realmente têm (`SLASH_MENU_MIN_HEIGHT` a `SLASH_MENU_MAX_HEIGHT`), com
 * rolagem interna cobrindo o resto.
 *
 * A medida roda no MOMENTO em que o menu monta — que costuma ser o momento em
 * que o teclado já está aberto, já que a barra só se digita com o campo em
 * foco — e de novo a cada `resize`/`scroll` do `visualViewport` **e da página**
 * enquanto ele vive: o teclado pode ainda estar animando ao abrir, e o iOS rola
 * a página para manter o cursor visível depois do primeiro quadro. O menu vive
 * pouco, só enquanto a linha está em foco, então ouvir os eventos custa pouco.
 *
 * `useLayoutEffect` e não `useEffect`: medir depois da pintura faria a lista
 * aparecer embaixo e pular para cima num segundo quadro, que é pior que
 * qualquer dos dois lugares.
 *
 * ## Ele mora no `document.body`, e é posicionado à mão
 *
 * A lista era `position: absolute` dentro da caixa do bloco, e herdava dela
 * duas coisas que não são dela: o contexto de empilhamento (um `z-40` só vale
 * dentro do próprio contexto) e qualquer `overflow` de um ancestral, que corta
 * o que passa da borda. Num portal para o `body` ela não tem ancestral nenhum,
 * e em troca precisa das próprias coordenadas.
 *
 * `position: fixed` é o que casa com a medição: `getBoundingClientRect()`
 * devolve coordenadas do viewport de LAYOUT, que é exatamente o sistema em que
 * um elemento fixo é posicionado. O preço é seguir a rolagem à mão, e é por
 * isso que a lista de eventos acima ganhou o `scroll` da janela — em captura,
 * para pegar também um contêiner rolável no meio do caminho.
 *
 * ## A borda de cima não é o topo da tela
 *
 * É o que está por baixo da BARRA do app e do recorte do aparelho. Sem essa
 * conta, um `/` digitado nos primeiros parágrafos abria a lista para cima e ela
 * nascia por trás do cabeçalho, com os primeiros itens ("Ideia central") fora
 * de alcance. A barra é medida pelo nó de verdade (`TOPBAR_SLOT_ID`), e não por
 * um número escrito aqui, porque a altura dela muda com o que a tela pendura no
 * vão; o recorte vem de `--safe-area-top`, que é `env(safe-area-inset-top)`
 * declarado em `globals.css` só para poder ser LIDO por JavaScript.
 */
/** A altura que a lista cheia pede. Ver `useSlashPlacement`. */
const SLASH_MENU_MAX_HEIGHT = 320;
/** O menor que a lista pode encolher sem virar inútil: menos que isto e a
 *  rolagem interna trabalha mais do que ajuda. */
const SLASH_MENU_MIN_HEIGHT = 120;
/** A folga entre a lista e a borda do viewport visível, no lado que sobrou. */
const SLASH_MENU_EDGE_GAP = 12;
/** O vão entre a lista e a linha que a abriu (o antigo `mt-1`/`mb-1`). */
const SLASH_MENU_ANCHOR_GAP = 4;
/** A largura cheia da lista (as antigas `20rem`). */
const SLASH_MENU_WIDTH = 320;

type SlashPlacement = { side: "up" | "down"; style: CSSProperties };

/** Os cinco números que a medida produz. Comparados um a um porque o objeto é
 *  sempre novo, e o que importa é se algum PIXEL mudou. */
function sameStyle(a: CSSProperties, b: CSSProperties): boolean {
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.bottom === b.bottom &&
    a.width === b.width &&
    a.maxHeight === b.maxHeight
  );
}

/** O recorte do aparelho, em pixels. Ver o cabeçalho do `SlashMenu`. */
function safeAreaTop(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--safe-area-top");
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

/** Onde a barra do app termina, ou o topo do recorte quando ela já rolou para
 *  fora da tela. É a `collisionBoundary` de cima. */
function boundaryTop(viewportTop: number): number {
  const header = document.getElementById(TOPBAR_SLOT_ID)?.closest("header");
  const headerBottom = header ? header.getBoundingClientRect().bottom : Number.NEGATIVE_INFINITY;
  return Math.max(viewportTop + safeAreaTop(), headerBottom);
}

/**
 * Para que lado o menu abre, a que altura ele encolhe e em que coordenada ele
 * pousa, medido contra o que está VISÍVEL — não contra `window.innerHeight`.
 * Ver o cabeçalho do `SlashMenu`, que tem o raciocínio inteiro.
 */
function useSlashPlacement(anchorRef: React.RefObject<HTMLElement | null>): SlashPlacement {
  const [placement, setPlacement] = useState<SlashPlacement>({
    side: "down",
    // Fora da tela até a primeira medida: um menu desenhado na quina superior
    // esquerda por um quadro é mais visível que um menu que aparece pronto.
    style: { position: "fixed", left: -9999, top: -9999, width: SLASH_MENU_WIDTH },
  });
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const measure = () => {
      const box = anchor.getBoundingClientRect();
      const vv = window.visualViewport;
      const viewportTop = vv?.offsetTop ?? 0;
      const viewportLeft = vv?.offsetLeft ?? 0;
      const viewportWidth = vv?.width ?? window.innerWidth;
      const viewportHeight = vv?.height ?? window.innerHeight;

      const top = boundaryTop(viewportTop);
      const bottom = viewportTop + viewportHeight;
      const gap = SLASH_MENU_ANCHOR_GAP + SLASH_MENU_EDGE_GAP;
      const below = bottom - box.bottom - gap;
      const above = box.top - top - gap;
      // Só sobe quando não cabe embaixo E há mais espaço em cima: numa janela
      // baixa demais para os dois lados, embaixo é o lugar em que a rolagem da
      // PÁGINA alcança a lista; em cima ela ficaria presa contra a barra sem
      // para onde rolar.
      const side = below < SLASH_MENU_MAX_HEIGHT && above > below ? "up" : "down";
      // A lista se encolhe ao espaço que o lado escolhido tem, e nunca menos
      // que o mínimo: sem isto, "up" com pouco espaço em cima ainda estourava
      // o topo da tela — ele só comparava contra "embaixo", nunca contra o
      // que cabia de fato ali em cima.
      const room = side === "up" ? above : below;
      const maxHeight = Math.max(SLASH_MENU_MIN_HEIGHT, Math.min(SLASH_MENU_MAX_HEIGHT, room));

      const width = Math.min(SLASH_MENU_WIDTH, viewportWidth - SLASH_MENU_EDGE_GAP * 2);
      // A lista nasce alinhada ao começo do texto e recua se isso a jogaria
      // para fora da borda direita do que está visível.
      const left = Math.max(
        viewportLeft + SLASH_MENU_EDGE_GAP,
        Math.min(box.left, viewportLeft + viewportWidth - width - SLASH_MENU_EDGE_GAP)
      );

      const style: CSSProperties = { position: "fixed", left, width, maxHeight };
      if (side === "up") {
        // Ancorada pela BASE, para a lista crescer afastando-se da linha em vez
        // de cobri-la. `bottom` de um elemento fixo conta do fim do viewport de
        // LAYOUT, que é `innerHeight` — não do viewport visual.
        style.bottom = window.innerHeight - box.top + SLASH_MENU_ANCHOR_GAP;
      } else {
        style.top = box.bottom + SLASH_MENU_ANCHOR_GAP;
      }
      // A rolagem dispara este cálculo a cada quadro, e um objeto novo por
      // quadro remontaria o `style` de uma lista de sete itens sessenta vezes
      // por segundo sem um pixel mudar de lugar.
      setPlacement((cur) =>
        cur.side === side && sameStyle(cur.style, style) ? cur : { side, style }
      );
    };
    measure();
    // O teclado pode ainda estar abrindo no instante em que a barra é digitada
    // (a animação leva alguns quadros), e a rolagem que o iOS faz para manter
    // o cursor visível também muda `offsetTop` depois do primeiro quadro. Com
    // o menu num portal, a rolagem da PÁGINA também precisa ser ouvida: nada
    // mais o move junto com a linha que o abriu.
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchorRef]);
  return placement;
}

const SLASH_MENU_SHELL =
  "z-50 rounded-2xl border border-scriba-hairline bg-scriba-surface shadow-[0_12px_32px_var(--scriba-shadow)]";

function SlashMenu({
  options,
  cursor,
  query,
  onHover,
  onPick,
}: {
  options: MenuOption[];
  cursor: number;
  query: string;
  onHover: (cursor: number) => void;
  onPick: (pick: BlockPick) => void;
}) {
  // O ÂNCORA fica no lugar do menu antigo, invisível e sem alvo de toque: ele é
  // só a caixa que diz onde a linha está. O menu em si sai pelo portal, e por
  // isso precisa de alguém medindo por ele aqui dentro.
  const anchorRef = useRef<HTMLSpanElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { style } = useSlashPlacement(anchorRef);

  /**
   * O item focado pela SETA se mantém visível dentro da lista, que tem altura
   * limitada (`useSlashPlacement`) e rolagem própria. Sem isto, andar com o
   * teclado além do que cabe na tela move o cursor para um item que ninguém vê
   * — a lista não acompanha, e a pessoa navega às cegas.
   *
   * `block: "nearest"` é o que faz o hover do MOUSE não disputar com isto: um
   * item hoverado já está visível por definição (não dá para apontar o mouse
   * para algo fora da área rolada), então "nearest" não move nada nesse caso —
   * só a navegação por teclado, que pode apontar para fora, de fato rola.
   *
   * Os filhos do contêiner SÃO os botões, na mesma ordem de `options`.
   */
  useLayoutEffect(() => {
    const item = ref.current?.children[cursor];
    if (item instanceof HTMLElement) item.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const menu =
    options.length === 0 ? (
      <div data-slash-menu style={style} className={cn(SLASH_MENU_SHELL, "px-3 py-2.5")}>
        <p className="text-scriba-ink-mute text-xs">Nada com “{query}”.</p>
      </div>
    ) : (
      <div
        ref={ref}
        data-slash-menu
        style={style}
        className={cn(SLASH_MENU_SHELL, "flex flex-col gap-0.5 overflow-y-auto p-1.5")}
      >
        {options.map((o, i) => (
          <button
            // O rótulo, e não o `type`: as opções de Bíblia trazem um OBJETO
            // ali (qual livro, qual capítulo), e não há duas com o mesmo nome
            // na lista.
            key={o.label}
            type="button"
            // `onMouseDown` com `preventDefault`, e não `onClick`: um clique tira
            // o foco da `textarea` antes de o handler rodar, e sem o foco o
            // `onBlur` do bloco já fechou este menu — o toque cairia no vazio.
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(o.type);
            }}
            onMouseEnter={() => onHover(i)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
              i === cursor ? "bg-scriba-blue-soft text-scriba-blue-ink" : "text-scriba-ink-soft"
            )}
          >
            <span className="flex size-5 shrink-0 items-center justify-center">{o.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-xs">{o.label}</span>
              <span className="block truncate text-[11px] text-scriba-ink-mute">{o.hint}</span>
            </span>
          </button>
        ))}
      </div>
    );

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 block" />
      {/* Sem guarda de `typeof document`: este menu só existe depois de alguém
          digitar uma barra, e digitar é coisa que não acontece no servidor. */}
      {createPortal(menu, document.body)}
    </>
  );
}

/**
 * A linha em branco depois do último bloco: uma `textarea` vazia, permanente,
 * com a roupa de parágrafo.
 *
 * **Ela existe para não obrigar um menu antes de cada parágrafo.** Escrever um
 * texto é escrever parágrafos; pedir que a pessoa escolha "Parágrafo" antes de
 * cada um cobraria um clique por aquilo que ela ia fazer de qualquer jeito — e
 * numa folha em branco esse clique é um degrau entre abrir o editor e começar.
 * Quem quer um título, uma passagem ou qualquer outro bloco digita `/`; quem
 * quer escrever, escreve.
 *
 * **O bloco nasce na primeira tecla, e ela não se perde.** Esta `textarea` não
 * guarda texto: o que foi digitado vira o parágrafo, o foco vai para ele
 * (`insertAt` pede o cursor no fim) e a linha volta a ficar vazia, agora abaixo
 * do bloco novo. Do lado de quem digita, a letra apareceu onde o cursor estava
 * e a digitação continua.
 *
 * **A exceção é a composição em andamento** (`isComposing`): com acento morto
 * ou com o teclado do celular, trocar o elemento no meio de uma composição
 * descarta o caractere que está sendo montado. Nesse caso o texto fica aqui até
 * o `compositionend`, e só então vira bloco.
 */
function WritingLine({
  emphasis,
  onWrite,
  onFocusChange,
}: {
  emphasis?: boolean;
  onWrite: (text: string) => void;
  /** O cursor entrou ou saiu desta linha. Ver `tailFocus` no `Composer`. */
  onFocusChange?: (focused: boolean) => void;
}) {
  const [text, setText] = useState("");

  function hand(value: string) {
    setText("");
    onWrite(value);
  }

  return (
    <textarea
      rows={1}
      value={text}
      onFocus={() => onFocusChange?.(true)}
      onBlur={() => onFocusChange?.(false)}
      aria-label="Escrever um parágrafo"
      placeholder={
        emphasis
          ? "Comece a escrever, ou digite / para ver as opções"
          : BLOCK_PLACEHOLDERS.paragraph
      }
      onChange={(e) => {
        const value = e.target.value;
        if ("isComposing" in e.nativeEvent && e.nativeEvent.isComposing) {
          setText(value);
          return;
        }
        if (!value.trim()) return;
        hand(value);
      }}
      onCompositionEnd={(e) => {
        const value = e.currentTarget.value;
        if (!value.trim()) return;
        hand(value);
      }}
      onKeyDown={(e) => {
        // Enter aqui é o que ele é em todo bloco: um parágrafo novo. Sem isto
        // a quebra viraria um `\n` dentro de um bloco que ainda não existe.
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onWrite(e.currentTarget.value);
          setText("");
        }
      }}
      // `block` pela MESMA razão da `AutoTextarea`, e esta linha era a única
      // caixa do editor que não a tinha: uma `textarea` é inline-block por
      // padrão e pousa na linha de base do pai, deixando por baixo dela o
      // espaço dos descendentes. São uns quatro píxeis que caem DENTRO da
      // superfície do foco, sempre embaixo — e é isso que fazia a frase parecer
      // colada no topo de uma caixa alta demais. Sem `text-pretty` pelo motivo
      // escrito em `src/app/AGENTS.md`: a `textarea` não o aplica.
      className="block w-full resize-none overflow-hidden bg-transparent font-light text-[17px] text-scriba-ink leading-[1.72] outline-none placeholder:text-scriba-ink-mute/60"
    />
  );
}

/**
 * Mover e excluir, flutuando no vão acima do bloco.
 *
 * No vão, e não ao lado: fora da margem esquerda não há espaço no celular, e
 * dentro da linha os botões empurrariam o texto para o lado toda vez que
 * aparecessem — o cursor de quem está escrevendo saltaria junto.
 *
 * Ela tem 32px, MENOR que os 42 da caixa do bloco, e pousa na borda de cima
 * dela. Com 40px ela era do tamanho da linha inteira que controlava, e uma
 * barra de ferramentas do tamanho do conteúdo deixa de parecer uma barra.
 *
 * **E ela fica INTEIRA acima do texto** (`bottom-full`). Antes descia 12px
 * abaixo da borda da caixa, o que sobre uma linha de 26px significa cobrir a
 * metade de cima dela, do lado direito — onde o cursor chega quando a frase
 * fica longa. No desktop é um estorvo com jeito de detalhe; no celular é a
 * lixeira debaixo do dedo de quem só queria tocar no fim da palavra.
 *
 * A pílula abre com a pergunta "o que é esta linha?" (`onTurn`, ver `turnAt`)
 * e segue com o que só faz sentido sobre um bloco que já existe: marcar um
 * recorte, mover e excluir. O fio separa as duas coisas — o começo mexe no que
 * a linha É, o fim mexe em onde ela está e se ela fica.
 *
 * **A METADE DE TRÁS é opcional, e é `onDelete` quem a liga.** Excluir é a
 * única ação que todo bloco tem (mover depende de haver vizinho, marcar de
 * haver recorte), então ele é o sinal de que há um bloco ali. Sem ele a pílula
 * é só o `+`: é o que a linha do FIM recebe, que não é bloco nenhum e não tem
 * o que mover nem o que excluir.
 */
function BlockControls({
  shown,
  blank,
  onTurn,
  onUp,
  onDown,
  onMark,
  onDelete,
}: {
  shown: boolean;
  /**
   * A linha não tem uma letra — e uma que só tem `/` dentro também não, porque
   * ali a barra é um comando em andamento, não texto. É o que decide entre o
   * `+` e as formas; sem a segunda metade, o glifo trocava debaixo do dedo no
   * instante em que o menu que ele acabou de abrir aparecia.
   */
  blank: boolean;
  /** Abre o menu de blocos sobre esta linha. `undefined` numa passagem, que
   *  não tem texto seu para virar outra coisa. Ver `turnAt`. */
  onTurn?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  /**
   * Marca ou desmarca o trecho selecionado. `undefined` quando não há recorte
   * na mão, ou quando este bloco não desenha marca na leitura — e aí o botão
   * não fica desabilitado, ele SOME.
   *
   * É a única exceção à regra da largura fixa que os dois botões de mover
   * seguem (eles ficam a 30% em vez de sumir, para a pílula deste bloco ter a
   * mesma largura da dos vizinhos). A razão é que mover é uma ação que sempre
   * existe — estar no topo é circunstância —, e marcar depende de um gesto que
   * ainda não aconteceu. Um botão permanentemente apagado, que só acende
   * quando se arrasta o dedo sobre uma palavra, é uma charada; um que aparece
   * no instante da seleção é uma resposta.
   */
  onMark?: () => void;
  /** Excluir o bloco — e, por ser a única ação que TODO bloco tem, o sinal de
   *  que há um bloco aqui. Sem ele a pílula é só o `+`. Ver o cabeçalho. */
  onDelete?: () => void;
}) {
  /** Há um bloco de verdade sob esta pílula, e não a linha do fim. */
  const isBlock = onDelete !== undefined;
  return (
    <div
      className={cn(
        // `bottom-full`, e não um `-top-3`: a pílula fica INTEIRA acima da
        // linha, nos 32px de espaço vazio que existem entre um texto e o
        // seguinte (8 de recuo da caixa + 16 de vão + 8 da caixa de cima) —
        // que é exatamente a altura dela. Com `-top-3` ela descia 20px sobre a
        // própria linha que controla, e no celular isso é a barra de botões em
        // cima da palavra que está sendo digitada: o dedo pousa no lixeira ao
        // tentar pôr o cursor no fim da frase.
        "absolute right-0 bottom-full z-10 flex items-center gap-0.5 rounded-full bg-scriba-surface p-1 shadow-sm transition-opacity",
        "ring-1 ring-scriba-hairline ring-inset",
        "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        shown && "opacity-100"
      )}
    >
      {/* O `+` (ou as formas) ABRE a pílula porque é a pergunta mais antiga das
          quatro: o que esta linha é. Ver `turnAt`. */}
      {onTurn ? (
        <ControlButton
          label={blank ? "Escolher o que vai nesta linha" : "Trocar o tipo deste bloco"}
          onClick={onTurn}
        >
          {blank ? <Plus className="size-3.5" /> : <Shapes className="size-3.5" />}
        </ControlButton>
      ) : null}
      {/* O MARCA-TEXTO entra aqui, e não numa barra flutuante sobre a seleção.
          Uma barra própria teria de ser posicionada em cima de um recorte
          dentro de uma `textarea`, que é a única coisa da página cuja geometria
          o DOM não expõe — daria um espelho de medição só para achar o pixel.
          Numa barra que já existe, e que já aparece na hora certa, isto é um
          botão a mais. */}
      {onMark ? (
        <ControlButton keepFocus label="Marcar o trecho selecionado" onClick={onMark}>
          <Highlighter className="size-3.5" />
        </ControlButton>
      ) : null}
      {/* O fio separa o que a linha É do que acontece com ela, e só existe se
          houver o que separar dos DOIS lados. Ele era incondicional: numa
          passagem — sem o `+`, porque ela não tem texto para virar outra coisa,
          e sem o marca-texto, porque o texto dela é da NVI — ficava sozinho na
          ponta esquerda da pílula, um traço perdido antes do primeiro botão. */}
      {(onTurn || onMark) && isBlock ? (
        <span aria-hidden className="mx-0.5 h-4 w-px bg-scriba-hairline" />
      ) : null}
      {isBlock ? (
        <>
          <ControlButton label="Mover para cima" onClick={onUp}>
            <ChevronUp className="size-3.5" />
          </ControlButton>
          <ControlButton label="Mover para baixo" onClick={onDown}>
            <ChevronDown className="size-3.5" />
          </ControlButton>
          <ControlButton label="Excluir bloco" onClick={onDelete} destructive>
            <Trash2 className="size-3.5" />
          </ControlButton>
        </>
      ) : null}
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  destructive,
  keepFocus,
  children,
}: {
  label: string;
  onClick?: () => void;
  destructive?: boolean;
  /**
   * Não tira o foco da caixa ao ser apertado.
   *
   * É o que o botão do marca-texto precisa: ele age sobre o RECORTE que está na
   * `textarea`, e apertar um botão comum move o foco para ele. Os navegadores
   * até preservam `selectionStart`/`selectionEnd` de uma caixa desfocada, mas
   * "até preservam" não é contrato — e o modo de falhar seria o pior possível,
   * um botão que não faz nada em um navegador só.
   *
   * `preventDefault` no `mousedown` é o jeito canônico: o foco nunca sai, então
   * não há recorte a preservar.
   */
  keepFocus?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={keepFocus ? (e) => e.preventDefault() : undefined}
      aria-label={label}
      title={label}
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full text-scriba-ink-mute transition-colors disabled:opacity-30",
        // `rose` é o VINHO da paleta (#3A2321), não a tinta rosada: sobre o
        // grafite, um fundo claro com o glifo branco vira um borrão vermelho no
        // canto da tela. Fundo escuro com o glifo rosado é o mesmo aviso, no
        // tom em que o resto do app fala.
        destructive
          ? "hover:bg-scriba-rose hover:text-scriba-rose-ink"
          : "hover:bg-scriba-blue-soft/60 hover:text-scriba-ink"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Onde o marca-texto vale.
 *
 * São exatamente os blocos cuja LEITURA passa pelo `RichText`, que é quem
 * transforma `==assim==` na faixa amarela. Oferecer o botão fora dessa lista
 * seria deixar a pessoa marcar um trecho e descobrir, na leitura, que a marca
 * virou dois sinais de igual no meio da frase.
 *
 * Ficam de fora, e cada um por uma razão própria: o `h1` e o `h2`, onde a
 * hierarquia já é o destaque; o `highlight`, que É a frase destacada e ganharia
 * uma segunda camada de amarelo sobre a primeira; o `bibleQuote`, cujo texto
 * vem da NVI e não é nosso para grifar; e o `quote`, que na leitura não passa
 * pelo `RichText`. Se o `quote` passar a passar, ele entra aqui no mesmo
 * commit.
 */
const MARKABLE = new Set<WrittenBlock["type"]>([
  "paragraph",
  "example",
  "conclusion",
  "bulletList",
  "orderedList",
]);

/**
 * O texto VISÍVEL com a faixa amarela atrás dos trechos marcados, para o
 * espelho.
 *
 * Ele reproduz exatamente o que está na caixa — que é o texto SEM as cercas
 * (ver `applyDisplayEdit`) —, e é essa fidelidade que faz o espelho quebrar a
 * linha onde a caixa quebra, a razão de ele existir. As cercas já estiveram
 * aqui dentro, pintadas de amarelo junto com a palavra, quando a caixa também
 * as mostrava; hoje nenhum dos dois as mostra.
 *
 * Sem `px` nenhum, ao contrário da leitura: qualquer recuo horizontal aqui
 * empurra o texto invisível e tira o espelho de fase com a caixa.
 */
/** O que toda caixa deste editor recebe igual. */
type SharedField = {
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
  placeholder: string;
};

function MarkMirror({ text }: { text: string }) {
  return (
    <>
      {splitMarks(text).map((piece, index) =>
        piece.marked ? (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: lista derivada de string imutável
            key={index}
            className="highlight-mark [-webkit-box-decoration-break:clone] [box-decoration-break:clone]"
          >
            {piece.text}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: lista derivada de string imutável
          <Fragment key={index}>{piece.text}</Fragment>
        )
      )}
    </>
  );
}

/**
 * Uma caixa de prosa que MOSTRA o marca-texto enquanto se escreve.
 *
 * Mesma solução da frase de destaque e da lista: uma `textarea` não tem como
 * pintar parte do próprio texto, então o amarelo vem de um espelho atrás dela,
 * com a mesma tipografia e a mesma largura. O espelho só é montado quando há
 * marca — o caso comum é não haver, e um `div` a mais por parágrafo num texto
 * de cinquenta blocos é trabalho de layout por nada.
 *
 * **Nenhum dos dois leva `text-pretty`**, e é por isso que ele saiu das classes
 * destes três blocos: a `textarea` não o aplica, então ele nunca fez efeito
 * aqui — só dava ao espelho uma quebra de linha que a caixa não tem.
 *
 * **E a caixa não mostra as cercas.** Ela recebe o texto visível
 * (`stripMarks`) e devolve cada edição para o texto cru por `applyDisplayEdit`
 * — o bloco continua guardando `==assim==`, e quem escreve nunca vê os quatro
 * sinais de igual. Ver "O TEXTO CRU E O TEXTO VISÍVEL" em `lib/domain/mark.ts`.
 */
function MarkableField({
  shared,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  shared: SharedField;
  value: string;
  onChange: (text: string) => void;
  ariaLabel: string;
  className: string;
}) {
  return (
    <div className="relative">
      {hasMark(value) ? (
        <div
          aria-hidden
          className={cn(
            className,
            "pointer-events-none absolute inset-0 whitespace-pre-wrap break-words text-transparent"
          )}
        >
          <MarkMirror text={value} />
        </div>
      ) : null}
      <AutoTextarea
        {...shared}
        value={stripMarks(value)}
        onChange={(next) => onChange(applyDisplayEdit(value, next))}
        ariaLabel={ariaLabel}
        className={cn(className, "relative")}
      />
    </div>
  );
}

/**
 * O corpo de um bloco, com as classes do `BlockRenderer` equivalente.
 *
 * A duplicação das classes é deliberada e é o custo de não ter editor de rich
 * text: renderizar o `BlockRenderer` de verdade aqui exigiria um modo "editável"
 * dentro dele, e o componente de LEITURA passaria a carregar estado de edição
 * que 99% das telas não usam. Ao mudar o desenho de um bloco lá, ajuste aqui no
 * mesmo commit — é o que mantém a promessa de que o que se escreve é o que se lê.
 */
function BlockBody({
  block,
  index,
  onFocus,
  onChange,
  onKeyDown,
  onSelect,
  onOpenPicker,
  registerRef,
}: {
  block: WrittenBlock;
  index: number;
  onFocus: () => void;
  onChange: (patch: Partial<WrittenBlock>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onOpenPicker: () => void;
  registerRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const shared: SharedField = {
    onKeyDown,
    onFocus,
    onSelect,
    textareaRef: registerRef,
    placeholder: BLOCK_PLACEHOLDERS[block.type],
  };

  if (block.type === "bibleQuote") {
    const parsed = parseVerseReference(block.reference);
    const hasRange = parsed && parsed.startVerse != null && parsed.endVerse != null;

    /**
     * A pastilha da referência, que é o que se CLICA para trocar a passagem.
     *
     * O bloco inteiro era o botão, e deixou de ser quando o texto bíblico
     * entrou aqui dentro: um botão com uma passagem de sete versículos dentro
     * tem por nome acessível a passagem inteira, e clicar no meio de um texto
     * para abrir um seletor não é o que um texto promete. Clicável é a
     * referência — que é justamente a parte que se troca.
     *
     * `whitespace-nowrap` e `shrink-0`: no celular "Romanos 6:1-4" quebrava em
     * duas linhas dentro do próprio balão.
     */
    const chip = (
      <button
        type="button"
        onClick={() => {
          onFocus();
          onOpenPicker();
        }}
        aria-label={
          block.reference
            ? `Trocar a passagem do bloco ${index + 1}: ${block.reference}`
            : `Escolher a passagem do bloco ${index + 1}`
        }
        title="Trocar a passagem"
        className="veil-chip inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 font-medium text-xs transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <BookGlyph className="size-3" />
        {block.reference || "Escolher passagem"}
      </button>
    );

    /**
     * A TRADUÇÃO desta citação, e aqui ela é GRAVADA no bloco.
     *
     * É a diferença entre este chip e o gêmeo da leitura (`BibleQuoteBlock`):
     * lá a troca vale para aquela leitura e morre com a página, porque quem lê
     * pode não ser quem escreveu; aqui quem está mexendo é o dono do texto, e a
     * escolha viaja no jsonb — "esta passagem em Almeida" continua em Almeida
     * para todo mundo que abrir o resumo, inclusive por link.
     *
     * "Padrão" grava a AUSÊNCIA do campo, e não o id da tradução padrão: um
     * bloco sem escolha segue a preferência de quem lê, e é esse o estado em
     * que nasce toda citação. Gravar "BLIVRE" ali congelaria a passagem numa
     * tradução que ninguém escolheu.
     */
    const translationChip = (
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={onFocus}
          aria-label={`Tradução da passagem do bloco ${index + 1}`}
          title="Trocar a tradução desta passagem"
          className="veil-chip inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-semibold text-[10px] uppercase tracking-wider transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          {block.translation ? TRANSLATIONS[block.translation].short : "Padrão"}
          <ChevronDown aria-hidden className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuItem
            onClick={() => onChange({ translation: undefined })}
            className="items-start gap-2.5"
          >
            <Check
              aria-hidden
              className={cn(
                "mt-0.5 size-3.5 flex-none",
                block.translation ? "opacity-0" : "opacity-100"
              )}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">Padrão</span>
              <span className="font-light text-muted-foreground text-xs leading-snug">
                Selecione sua tradução preferida como padrão no seu perfil
              </span>
            </span>
          </DropdownMenuItem>
          {SELECTABLE_TRANSLATIONS.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onClick={() => onChange({ translation: option.id })}
              className="items-start gap-2.5"
            >
              <Check
                aria-hidden
                className={cn(
                  "mt-0.5 size-3.5 flex-none",
                  block.translation === option.id ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{option.name}</span>
                <span className="font-light text-muted-foreground text-xs leading-snug">
                  {option.hint}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );

    // Sem faixa de versículos não há o que citar, e a leitura desenha a MENÇÃO
    // (uma pastilha solta, `ChapterMention`) em vez da moldura vazia. Aqui vale
    // o mesmo: a moldura em volta de nada era o que o `BlockRenderer` recusa a
    // desenhar, e desenhá-la só na edição quebraria a promessa de que o que se
    // escreve é o que se lê.
    if (!hasRange) return <div className="py-1">{chip}</div>;

    return (
      <figure className="animate-insight-gradient relative flex flex-col gap-3.5 rounded-[26px] bg-[image:var(--session-surface-quote)] bg-[size:200%_100%] p-6">
        {/* Duas pastilhas na mesma linha, e elas trocam coisas diferentes: a
            primeira, QUAL passagem; a segunda, em qual tradução. `flex-wrap`
            porque no celular "1 Coríntios 13:1-13" já ocupa a largura toda. */}
        <figcaption className="flex flex-wrap items-center gap-2">
          {chip}
          {translationChip}
        </figcaption>
        {/* O texto da NVI, buscado pelo MESMO `PassageVerses` da leitura.
            Mostrar aqui um aviso de que "a passagem entra depois" era pedir fé
            num bloco que é o único do editor sem nada para digitar: escolhida a
            referência, não há mais nada a fazer, e a única confirmação de que
            se escolheu a certa é o texto. A busca é em cache por referência
            (`passageQueryOptions`), então abrir a leitura em seguida não a
            refaz. */}
        <div className="font-light text-[17px] text-session-verse-text leading-relaxed">
          <PassageVerses
            bookDisplay={parsed.bookDisplay}
            chapter={parsed.chapter}
            startVerse={parsed.startVerse as number}
            endVerse={parsed.endVerse as number}
            translation={block.translation}
          />
        </div>
      </figure>
    );
  }

  if (block.type === "bulletList" || block.type === "orderedList") {
    /**
     * Uma lista é UMA `textarea`, com um item por linha, e os marcadores são
     * pintados ATRÁS dela por um espelho.
     *
     * É a mesma solução da frase de destaque, algumas linhas abaixo, e pela
     * mesma impossibilidade: uma `textarea` é uma caixa de texto simples, não
     * tem `::marker` nem como desenhar coisa alguma por linha. O espelho é um
     * `div` com a MESMA tipografia, a MESMA largura útil e o MESMO recuo,
     * então ele quebra as linhas exatamente onde a caixa quebra — e cada item
     * do espelho ocupa o mesmo número de linhas que o item da caixa, o que é o
     * que mantém a bolinha na altura certa mesmo num tópico de três linhas.
     *
     * Daí duas regras que parecem detalhe e não são:
     *
     * - **o texto do espelho é TRANSPARENTE, e precisa estar lá.** Ele não é
     *   visível; ele é o que empurra o próximo marcador para baixo na medida
     *   certa. Um espelho só com os marcadores os empilharia todos no topo.
     * - **nada de `text-pretty` em nenhum dos dois.** Ele muda a quebra e a
     *   `textarea` não o aplica: seria a única diferença capaz de tirar os
     *   marcadores de fase com o texto. Pela mesma razão o `pl-5` daqui é o
     *   `ml-5` da leitura (ver `BlockRenderer`) — os dois números andam juntos.
     *
     * A NUMERAÇÃO é contada aqui, pulando as linhas em branco, porque é assim
     * que a leitura conta: lá quem numera é o `<ol>`, que só enxerga os itens
     * que sobraram depois do `listItems`. Contar as linhas cruas faria a caixa
     * mostrar "3." num item que a leitura vai chamar de 2.
     *
     * O marcador fica numa calha de 20px: a bolinha centrada, o número
     * encostado à direita, que é aproximadamente onde `list-disc` e
     * `list-decimal` os põem. Os poucos pixels de diferença entre a escrita e a
     * leitura são o preço de não ter editor de rich text, e eles caem na
     * MARCA — o texto, que é o que se lê, começa no mesmo lugar nas duas.
     */
    const ordered = block.type === "orderedList";
    const face = "text-[17px] font-light leading-[1.72]";
    let position = 0;
    return (
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {block.text.split(/\r?\n/).map((item, index) => {
            const filled = item.trim().length > 0;
            if (filled) position += 1;
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: a linha É a posição, não um dado com identidade
                key={`marker-${index}`}
                className={cn(
                  face,
                  "relative whitespace-pre-wrap break-words pl-5 text-transparent"
                )}
              >
                {/* **A linha em branco TAMBÉM tem marcador**, e essa é a
                    diferença que faz o botão parecer ter funcionado.

                    Ele só aparecia em linha com texto, então acrescentar um
                    bloco de tópicos desenhava uma caixa vazia e mais nada: o
                    gesto não tinha retorno nenhum, e quem tocou tocava de novo.
                    O mesmo valia para o item que o Enter abre — a bolinha
                    chegava com a primeira letra, sempre um passo atrás do dedo.

                    Ele é APAGADO (`opacity-50`) porque não é um item ainda, é o
                    lugar do próximo. E isso não é enfeite: numa lista numerada
                    a linha em branco mostra o número que ela VAI ter
                    (`position + 1`) sem consumir a contagem, senão a caixa
                    diria "3." num item que a leitura vai chamar de 2 (é o
                    `listItems` que pula as linhas vazias, e o `<ol>` da leitura
                    só enxerga o que sobrou). Com um item abaixo dela, o mesmo
                    número aparece duas vezes por um instante — apagado num
                    deles, que é o que o lê como sombra em vez de contradição. */}
                <span
                  className={cn(
                    "absolute top-0 left-0 w-5 text-scriba-ink-mute",
                    ordered ? "pr-1.5 text-right tabular-nums" : "text-center",
                    filled ? null : "opacity-50"
                  )}
                >
                  {ordered ? `${filled ? position : position + 1}.` : "•"}
                </span>
                {/* O espaço fixo dá ALTURA à linha em branco. Sem ele o item
                    vazio que o Enter acabou de abrir tem zero de altura no
                    espelho e um de altura na caixa, e todos os marcadores
                    abaixo dele sobem uma linha. */}
                <MarkMirror text={item || " "} />
              </div>
            );
          })}
        </div>
        {/* O texto visível, sem as cercas do marca-texto, como em toda caixa
            deste editor. As LINHAS do espelho continuam saindo do texto cru:
            uma marca nunca atravessa o `\n` (ver `MARK_RE`), então as duas
            contagens de linha são a mesma, e é o `MarkMirror` quem tira as
            cercas de cada uma. */}
        <AutoTextarea
          {...shared}
          value={stripMarks(block.text)}
          onChange={(text) => onChange({ text: applyDisplayEdit(block.text, text) })}
          ariaLabel={ordered ? "Tópicos numerados" : "Tópicos"}
          className={cn(face, "relative whitespace-pre-wrap break-words pl-5 text-scriba-ink")}
        />
      </div>
    );
  }

  if (block.type === "h1") {
    return (
      <AutoTextarea
        {...shared}
        value={block.text}
        onChange={(text) => onChange({ text })}
        ariaLabel="Título"
        className="mt-4 font-heading font-bold text-[22px] text-scriba-ink-strong leading-tight tracking-tight sm:text-2xl"
      />
    );
  }

  if (block.type === "h2") {
    return (
      <AutoTextarea
        {...shared}
        value={block.text}
        onChange={(text) => onChange({ text })}
        ariaLabel="Subtítulo"
        className="mt-4 font-heading font-semibold text-lg text-session-verse-text leading-snug tracking-tight"
      />
    );
  }

  if (block.type === "highlight") {
    /**
     * A marca amarela é um GRADIENTE atrás das palavras (`.highlight-phrase`,
     * em `globals.css`), e uma `textarea` não tem como recebê-la: o fundo de
     * uma caixa de texto é o retângulo da caixa, e o que a leitura pinta é a
     * linha de cada palavra, com `box-decoration-break: clone` para a marca
     * recomeçar a cada quebra.
     *
     * Então o amarelo vem de um ESPELHO: o mesmo texto, com a mesma
     * tipografia e a mesma largura útil, em tinta transparente, atrás da
     * caixa. Os dois quebram a linha no mesmo lugar porque nada além da cor
     * os separa — e é por isso que o `text-pretty` da leitura não veio junto:
     * ele mexe na quebra, e a `textarea` não o aplica, então ele seria a
     * única diferença capaz de desalinhar a marca do texto.
     *
     * O `px-1` da caixa e o `px-1` do espelho dão o mesmo recuo por caminhos
     * diferentes (padding de bloco contra padding de inline centrado), e o
     * `py-0.5` dos dois faz a primeira linha começar na mesma altura.
     */
    const face = "text-center font-semibold text-lg leading-relaxed sm:text-xl";
    return (
      <div className="my-3 flex flex-col items-center px-4 text-center sm:px-8">
        <div className="relative w-full">
          {block.text ? (
            <div
              aria-hidden
              className={cn(
                face,
                "pointer-events-none absolute inset-0 whitespace-pre-wrap break-words py-0.5 text-transparent"
              )}
            >
              <span className="highlight-phrase px-1 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
                {block.text}
              </span>
            </div>
          ) : null}
          <AutoTextarea
            {...shared}
            value={block.text}
            onChange={(text) => onChange({ text })}
            ariaLabel="Frase de destaque"
            className={cn(face, "relative px-1 py-0.5 text-scriba-ink-strong")}
          />
        </div>
      </div>
    );
  }

  if (block.type === "example") {
    // A mesma moldura do `BlockRenderer`: barra grossa à esquerda, fundo
    // próprio e o rótulo em versalete. Ele é o bloco mais recente do editor, e
    // entrou junto com a edição de um resumo GERADO — sem ele, abrir aqui o
    // resumo de uma pregação e salvar apagaria os exemplos que a IA separou.
    //
    // O RÓTULO é editável, ao contrário de todo outro bloco fixo do menu: o
    // bloco entrou para servir um uso só (o exemplo do pregador) e passou a
    // servir qualquer nota à parte do texto corrido — "Informação" é o nome
    // que cabe nos dois, e quem quiser dizer o que é escreve por cima dele.
    // Vazio, ele mostra o próprio "Informação" como placeholder — é o que o
    // `BlockRenderer` também desenha na leitura quando `title` está ausente.
    return (
      <aside className="relative rounded-2xl border-[var(--session-example-border)] border-l-4 bg-[var(--session-example-bg)] px-5 py-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-scriba-ink-mute">
          <Info className="size-3 shrink-0" />
          <input
            value={block.title ?? ""}
            onChange={(e) =>
              onChange({ title: e.target.value.slice(0, WRITTEN_LIMITS.exampleTitle) })
            }
            onFocus={onFocus}
            aria-label="Título do bloco de informação"
            placeholder="Informação"
            className="min-w-0 flex-1 bg-transparent font-semibold text-[10px] uppercase tracking-[0.14em] outline-none placeholder:text-scriba-ink-mute/70"
          />
        </div>
        <MarkableField
          shared={shared}
          value={block.text}
          onChange={(text) => onChange({ text })}
          ariaLabel={block.title?.trim() || "Informação"}
          className="font-light text-scriba-ink text-[17px] leading-relaxed"
        />
      </aside>
    );
  }

  if (block.type === "quote") {
    return (
      <figure className="flex flex-col gap-1.5 border-scriba-hairline border-l-2 pl-4">
        <AutoTextarea
          {...shared}
          value={block.text}
          onChange={(text) => onChange({ text })}
          ariaLabel="Citação"
          className="font-light text-[17px] text-scriba-ink-soft italic leading-relaxed"
        />
        <input
          value={block.author ?? ""}
          onChange={(e) => onChange({ author: e.target.value.slice(0, WRITTEN_LIMITS.author) })}
          onFocus={onFocus}
          aria-label="Quem disse"
          placeholder="Quem disse (opcional)"
          className="w-full bg-transparent font-normal text-scriba-ink-mute text-xs outline-none placeholder:text-scriba-ink-mute/60"
        />
      </figure>
    );
  }

  if (block.type === "conclusion") {
    return (
      <section className="animate-insight-gradient mt-2 flex flex-col gap-3 rounded-[26px] bg-[image:var(--session-surface-quote)] bg-[size:200%_100%] p-6">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[10px] text-session-chip-ai uppercase tracking-[0.14em]">
          <ScribaMark className="size-3" />
          Conclusão
        </span>
        <MarkableField
          shared={shared}
          value={block.text}
          onChange={(text) => onChange({ text })}
          ariaLabel="Conclusão"
          className="font-light text-[17px] text-session-verse-text leading-[1.7]"
        />
      </section>
    );
  }

  return (
    <MarkableField
      shared={shared}
      value={block.text}
      onChange={(text) => onChange({ text })}
      ariaLabel="Parágrafo"
      className="font-light text-[17px] text-scriba-ink leading-[1.72]"
    />
  );
}

/**
 * O que está salvo, e ONDE.
 *
 * **São DOIS estados bons, e não quatro**: "Salvo" (o banco já tem esta
 * versão) e "Sync" (o texto está no aparelho e a subida está a caminho). Eram
 * "Salvando…" e "Salvo neste aparelho", duas frases para o mesmo fato — que há
 * trabalho por sincronizar —, e a segunda ainda gastava três palavras para
 * dizer, num canto de 10px, uma coisa que quem escreve não tem o que fazer a
 * respeito. A distinção que importa é essa: já subiu, ou ainda vai subir.
 *
 * **A bolinha E O TEXTO são verdes nos dois**, e isso é a correção de um defeito
 * de cor, não uma escolha nova: a bolinha usava `--scriba-mint-strong`, que na
 * paleta escura é um CINZA (#B3B4BA), e o texto usava `--scriba-mint-dark`, que
 * é BRANCO (#F5F5F5) — o chip dizia "Salvo" num cartão verde sem nada verde
 * dentro, que é exatamente o desenho de um indicador desligado. Os dois agora
 * são `--scriba-mint-accent`, o mesmo verde que o resto do app usa para "deu
 * certo", e ele dá 9,3:1 sobre o `--scriba-mint` (a tinta de família se mede
 * sobre a superfície DA FAMÍLIA, ver `src/shared/AGENTS.md`).
 *
 * **A falha tem DUAS frases, e a diferença não é estilo.** O chip dizia "sem
 * conexão" para qualquer envio que não desse certo, e em produção o envio
 * falhava com o wi-fi perfeito (o banco recusava o modo `manual`): a tela
 * culpava a internet de quem estava escrevendo por um erro que era nosso.
 * Quem sabe se havia rede é o `navigator.onLine` no instante da falha, ver
 * `useWrittenDraft`. Em ambas o fato continua o mesmo — o trabalho está
 * guardado no aparelho —, e é isso que a pessoa precisa saber antes de fechar
 * a aba.
 *
 * **As cores do estado de erro são o VINHO com a tinta rosada**, o par que o
 * resto do app usa (ver o `ControlButton` da lixeira e `src/shared/AGENTS.md`).
 * Ele já foi `rose-body` com `rose-ink` — rosa claro sobre rosa claro, dois
 * tons a um passo um do outro: no celular, no sol, o aviso mais importante da
 * tela era o único texto ilegível dela.
 */
function StatusChip({ status, offline }: { status: SaveStatus; offline: boolean }) {
  const failed = status === "error";
  const label = failed
    ? offline
      ? "Sem internet · salvo neste aparelho"
      : "Erro ao salvar · está neste aparelho"
    : status === "synced"
      ? "Salvo"
      : "Sync";

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-[10px] uppercase tracking-wider",
        failed ? "bg-scriba-rose text-scriba-rose-ink" : "bg-scriba-mint text-scriba-mint-accent"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          failed ? "bg-scriba-rose-accent" : "bg-scriba-mint-accent"
        )}
      />
      {label}
    </span>
  );
}
