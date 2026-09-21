"use client";

import { ChevronDown, ChevronUp, Eye, Highlighter, MapPin, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookGlyph } from "@/components/icons/BookGlyph";
import { BibleDock } from "@/features/session/components/BibleDock";
import { BibloDock } from "@/features/session/components/BibloDock";
import { EntityFieldDialog } from "@/features/session/components/EntityFieldDialog";
import { PassageVerses } from "@/features/session/components/PassageVerses";
import { revealSummaryBlock, SUMMARY_BLOCK_ATTR } from "@/features/session/components/reveal-block";
import { useUnloadGuard } from "@/features/session/hooks/useUnloadGuard";
import { requestLocationSuggestions, requestSpeakerSuggestions } from "@/features/session/lib/api";
import { normalizeSearch } from "@/features/session/lib/search";
import { initialsOf } from "@/features/session/lib/text";
import { hasMark, splitMarks, toggleMark } from "@/lib/domain/mark";
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
import { AutoTextarea } from "./AutoTextarea";
import {
  BLOCK_OPTIONS,
  BLOCK_PLACEHOLDERS,
  type BlockPick,
  emptyBlock,
  LEAD_OPTION,
  type MenuOption,
} from "./blocks";
import { PassagePicker } from "./PassagePicker";
import { type SaveStatus, useWrittenDraft } from "./useWrittenDraft";

/**
 * `/escrever`: o editor de blocos.
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
 * mesmo `PassageVerses` da leitura. (O "Ver como ficou" do topo é outra coisa:
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
 *   - a caixa acrescenta 8px (`py-2`) de cada lado: 42px de altura, SEMPRE, e
 *     é esse "sempre" que importa. Uma linha em branco com um disco de 36px
 *     dentro ficava 10px mais alta que o parágrafo ao lado, e eram duas
 *     alturas de linha no mesmo documento. Hoje NENHUM controle é mais alto
 *     que a linha de texto: todo disco tem 24px e o alvo de toque cresce por
 *     fora, com padding e margem negativa, sem empurrar altura nenhuma.
 *   - o vão entre dois blocos é `gap-8` (32px); a caixa avança 8px para dentro
 *     dele de cada lado, então o que se vê entre duas superfícies são 16px;
 *   - a pílula de adicionar/mover/excluir tem 34px, e é MENOR que a caixa de
 *     propósito: ela pousa na borda de cima de uma superfície de 42px. Maior
 *     que a linha que ela controla, virava a linha.
 *   - o recuo lateral é 12px no celular e 20px no desktop: 4px a menos que o
 *     `px` do `<main>` (16 e 24), que é o que impede a caixa de encostar na
 *     borda da tela.
 *   - QUEM COMEÇA COM O DISCO recua menos à esquerda (`ROW_LEADING_DISC`): 8px
 *     até o disco, os mesmos 8 do disco até o texto. Aquele recuo é para
 *     TEXTO, e um disco de 24px já traz a própria margem visual — com 20px
 *     antes dele e 9 acima, a mesma linha tinha duas medidas de respiro.
 */
const BLOCK_SURFACE = "-mx-3 -my-2 rounded-[20px] px-3 py-2 transition-colors sm:-mx-5 sm:px-5";

/**
 * O recuo esquerdo de uma linha que começa pelo disco do `+`: 8px, igual nos
 * dois tamanhos de tela. Some com a diferença entre celular e desktop porque
 * quem manda aqui é o disco, e ele tem o mesmo tamanho nos dois.
 *
 * O texto vem 32px adiante (`pl-8`, ou o `gap-2` depois do disco na linha do
 * fim): 8 de recuo + 24 do disco + 8 de vão.
 */
const ROW_LEADING_DISC = "pl-2 sm:pl-2";

/** Pastilha neutra do "adicionar autor/local", a mesma família da leitura
 * (`ADD_BADGE_CLASSES` em `SavedSessionView`). */
const ADD_BADGE_CLASSES = cn(
  "inline-flex items-center gap-1 rounded-full bg-scriba-ink-mute/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-soft outline-none transition-colors",
  "hover:bg-scriba-blue-soft/70 hover:text-scriba-blue-ink focus-visible:ring-2 focus-visible:ring-ring/40"
);

type Props = {
  /** O id da URL. `null` em `/escrever`, onde o aparelho sorteia um. */
  id: string | null;
  /** A linha já existe no banco? Ver `useWrittenDraft`. */
  exists?: boolean;
  initial: WrittenSummary;
  /**
   * Autor e local da sessão. `null` numa folha em branco (`/escrever`, sem
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

  /**
   * Mesmo PATCH que a leitura usa (`/api/sessions/:id`), e por isso só chama
   * com `sessionId`: a rota confere dono numa linha que precisa existir, e
   * antes do primeiro salvamento não há linha nenhuma para o "Autor"
   * apontar — o campo simplesmente não aparece até lá (ver o `sessionId ?`
   * abaixo).
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
  }

  const speakerInitials = initialsOf(speakerName);

  /** Onde o menu do `+` está aberto: depois do bloco de índice N (-1 = no fim). */
  const [adderAt, setAdderAt] = useState<number | null>(null);
  /**
   * O menu da BARRA, aberto digitando `/` num parágrafo vazio.
   *
   * `index` é o bloco em que ele está; `cursor` é a opção destacada, que as
   * setas movem. A BUSCA não mora aqui: ela é o próprio texto do bloco depois
   * da barra (`/exem`), e guardá-la de novo aqui daria duas verdades sobre o
   * que está escrito na linha.
   */
  const [slash, setSlash] = useState<{ index: number; cursor: number } | null>(null);
  /**
   * Qual bloco tem o cursor. É o que põe os controles e os `+` no ar no
   * celular, onde não existe passar o mouse.
   *
   * **Ele APAGA quando o foco sai do bloco**, e isso custou uma tela cheia de
   * botões acesos para ser aprendido: `active` só era trocado por outro foco,
   * então um `+` revelado por um clique ficava no ar pelo resto da sessão,
   * inclusive depois de a pessoa clicar em outro bloco e voltar. Quem apaga é
   * o `onBlur` do bloco, que só conta como saída quando o foco foi para FORA
   * dele — sem essa conferência, tocar no lixeira do próprio bloco apagaria o
   * estado que mantém a lixeira na tela.
   */
  const [active, setActive] = useState<number | null>(null);
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
   * foco é para um bloco que nasceu VAZIO e vai ser digitado (o menu do `+`);
   * a revelação é para um bloco que chegou PRONTO da conversa, e ali o cursor
   * não é bem-vindo — no celular ele abre o teclado, que cobre justamente o
   * texto que a rolagem acabou de trazer para o centro.
   */
  const [revealIndex, setRevealIndex] = useState<number | null>(null);

  /**
   * A ideia central é OPCIONAL, e por isso o campo não nasce na tela: ela
   * aparece quando a pessoa pede, pelo menu do `+`, e sai por um botão de
   * remover. Um campo fixo em cima de uma folha em branco é uma pergunta feita
   * antes da hora — quem abre o editor quer escrever o texto, e resumir em uma
   * frase é coisa que só se consegue fazer DEPOIS.
   *
   * **O pedido vinha de uma pastilha própria, no topo da folha, e ela saiu.**
   * Havia dois lugares respondendo "o que mais cabe neste texto?" — aquela
   * pastilha e o menu do `+` —, e o que decidia em qual deles uma coisa
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

  /**
   * O menu de blocos fecha com Esc e com um clique fora dele.
   *
   * Ele flutua, e o que flutua tem de saber ir embora: o `X` é uma saída, não
   * A saída. O `pointerdown` que ABRE o menu já aconteceu quando este efeito é
   * registrado, então não há risco de ele se fechar no mesmo clique.
   */
  useEffect(() => {
    if (adderAt === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAdderAt(null);
    }
    function onDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (!target?.closest("[data-block-menu]")) setAdderAt(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [adderAt]);

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
    setAdderAt(null);
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
    setAdderAt(null);
    setLeadAsked(true);
    requestAnimationFrame(() => leadRef.current?.focus());
  }

  function addOfType(index: number, pick: BlockPick) {
    // A ideia central não é bloco: ela é o `shortSummary`, e o que o menu faz
    // é abrir o campo dela lá em cima, na posição fixa que ela tem. Ver
    // `LEAD_OPTION`.
    if (pick === "leadIdea") {
      askLead();
      return;
    }
    // A passagem não tem o que digitar: ela nasce do seletor, e sem referência
    // não haveria bloco nenhum para mostrar. Por isso o `+` abre o seletor em
    // vez de inserir um bloco vazio que ficaria na tela pedindo um segundo
    // toque.
    if (pick === "bibleQuote") {
      setAdderAt(null);
      setPendingIndex(index);
      setPickerFor(-1);
      return;
    }
    insertAt(index, emptyBlock(pick));
  }

  /**
   * O que o menu do `+` oferece AGORA.
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
    if (!el) return;
    const next = toggleMark(el.value, el.selectionStart, el.selectionEnd);
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
      setSlash({ index, cursor: 0 });
      return;
    }
    if (slash?.index !== index) return;
    // Enquanto a linha começar por `/`, o que vem depois é a BUSCA. Apagou a
    // barra, ou escreveu uma linha de verdade: o menu não tem mais o que
    // filtrar. O cursor volta ao topo porque a lista mudou debaixo dele.
    if (!text.startsWith("/")) setSlash(null);
    else setSlash({ index, cursor: 0 });
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
      const emphasized = markdownEmphasis(block, text);
      if (emphasized !== null) {
        // O cursor tem de andar junto: `**x**` vira `==x==`, dois caracteres a
        // menos por par convertido. Sem isto, quem marca uma palavra no meio de
        // um parágrafo perde o lugar e continua digitando no fim dele. No
        // quadro seguinte, como em `markAt`: o valor novo ainda não foi pintado.
        const el = refs.current[index];
        const caret = el?.selectionStart ?? emphasized.length;
        const delta = text.length - emphasized.length;
        setBlock(index, autoformatted(block, { ...patch, text: emphasized }));
        requestAnimationFrame(() => {
          const at = Math.max(0, Math.min(caret - delta, emphasized.length));
          el?.setSelectionRange(at, at);
        });
        return;
      }
    }
    setBlock(index, autoformatted(block, patch));
  }

  /**
   * O que o menu da barra oferece com o que já foi digitado depois dela.
   *
   * A peneira é por SUBSTRING sem acento: `/exem` acha "Exemplo", `/cita` acha
   * "Citação", `/bib` acha "Bíblia". Não é busca aproximada de
   * propósito: a lista tem nove itens, e uma correspondência frouxa aqui
   * significaria o Enter escolher o bloco errado.
   */
  const slashQuery = slash !== null ? (doc.blocks[slash.index]?.text ?? "").slice(1) : "";
  const slashOptions = (() => {
    if (slash === null) return [];
    const q = normalizeSearch(slashQuery).trim();
    if (!q) return menuOptions;
    return menuOptions.filter((o) => normalizeSearch(o.label).includes(q));
  })();

  /**
   * Escolher no menu da barra SUBSTITUI o parágrafo, em vez de inserir acima.
   *
   * É a diferença entre este menu e o do `+`: lá a pessoa aponta uma POSIÇÃO e
   * pede um bloco novo; aqui ela está DENTRO de uma linha dizendo o que aquela
   * linha é. Inserir acima deixaria para trás o parágrafo com a barra dentro,
   * que é o oposto do que a tecla pediu.
   */
  function pickSlash(index: number, pick: BlockPick) {
    setSlash(null);
    if (pick === "leadIdea") {
      setBlock(index, { text: "" });
      askLead();
      return;
    }
    if (pick === "bibleQuote") {
      // A passagem não tem o que digitar, e um bloco sem referência ficaria na
      // tela pedindo um segundo toque. O seletor abre e a passagem entra NA
      // posição desta linha; o parágrafo vazio desce e vira a linha seguinte,
      // que é onde se continua escrevendo. Ver `addOfType`.
      setBlock(index, { text: "" });
      setPendingIndex(index);
      setPickerFor(-1);
      return;
    }
    patchBlocks((blocks) => blocks.map((b, i) => (i === index ? emptyBlock(pick) : b)));
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
        setSlash({ index, cursor: (slash.cursor + step + count) % count });
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
          setBlock(index, { text: kept });
          insertAt(index + 1, emptyBlock("paragraph"));
        }
        return;
      }
      e.preventDefault();
      insertAt(index + 1, emptyBlock("paragraph"));
      return;
    }

    if (e.key === "Backspace" && el.value.length === 0 && el.selectionStart === 0) {
      // Numa lista vazia, apagar DESFAZ a lista em vez de apagar o bloco: o
      // gesto de quem chega aqui é "não era isto que eu queria", e devolver o
      // parágrafo é o desfazer que ele pede. Apagar o bloco inteiro tiraria da
      // tela a linha em que a pessoa está.
      if (isList) {
        e.preventDefault();
        setBlock(index, { type: "paragraph", text: "" });
        return;
      }
      if (doc.blocks.length > 1) {
        e.preventDefault();
        removeAt(index);
      }
    }
  }

  /**
   * "Ver como ficou": manda o que falta e ABRE A LEITURA, nessa ordem.
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

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[1024px] flex-col gap-6 px-4 pb-24 sm:gap-8 sm:px-6">
      {header}

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
                <Eye className="size-3.5" />
                Ver como ficou
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
        <div className="flex flex-col gap-8">
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
                className="text-pretty text-[15px] font-light leading-[1.7] text-session-verse-text"
              />
            </section>
          ) : null}

          {doc.blocks.map((block, i) => {
            // Um parágrafo VAZIO é uma linha em branco esperando, e é o momento
            // em que "na verdade eu queria um título aqui" ainda está em aberto.
            // Por isso ele ganha o `+` ao lado, igual à linha do fim: os dois são
            // a mesma coisa na tela, e um Enter que caísse numa linha nua faria a
            // oferta aparecer e sumir conforme a linha fosse real ou não.
            const blank = isBlankParagraph(block);
            const body = (
              <BlockBody
                block={block}
                index={i}
                onFocus={() => {
                  setActive(i);
                  // Voltar a escrever FECHA o menu que ficou aberto num vão. Ele
                  // não tem como se fechar sozinho — não é um popover, é uma
                  // fileira no meio do texto —, e uma fileira de sete pastilhas
                  // esquecida três parágrafos acima é a segunda coisa que não
                  // some desta tela.
                  setAdderAt(null);
                }}
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
              // O `onBlur` daqui não é interação: ele APAGA um estado quando o
              // cursor sai do bloco. Não há ação atrás deste `div` para um leitor
              // de tela alcançar.
              // biome-ignore lint/a11y/noStaticElementInteractions: ver acima
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: ver o cabeçalho
                key={i}
                // O índice no DOM é o que deixa a inserção pela conversa rolar
                // até o bloco e piscar nele. Ver `revealSummaryBlock`.
                {...{ [SUMMARY_BLOCK_ATTR]: i }}
                className="group relative flex flex-col"
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
                }}
              >
                {/* Enquanto QUALQUER menu está aberto, pílula nenhuma aparece —
                    não só a deste bloco. Com duas fileiras de pastilhas o menu
                    cobre o começo do bloco de baixo, e a pílula daquele bloco
                    ficava metade escondida e metade para fora, uma casquinha
                    saindo da beirada do menu. Estar por cima (z-30) não resolvia:
                    o que aparecia era justamente o pedaço que o menu não cobre. */}
                <BlockControls
                  hidden={adderAt !== null}
                  shown={active === i}
                  onAdd={() => setAdderAt(i)}
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
                {adderAt === i ? (
                  <BlockMenu
                    options={menuOptions}
                    onClose={() => setAdderAt(null)}
                    onPick={(pick) => addOfType(i, pick)}
                  />
                ) : null}
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
                  className={cn(
                    BLOCK_SURFACE,
                    "relative focus-within:bg-scriba-blue-soft/60",
                    blank && ROW_LEADING_DISC
                  )}
                >
                  {/* O `+` da linha em branco FLUTUA, e o corpo nunca sai do
                      lugar na árvore. Ele já foi um irmão numa `flex` ao lado do
                      texto, e aí a primeira letra digitada trocava a estrutura —
                      a linha deixava de ser branca, a `flex` sumia, e o React
                      desmontava a `textarea` junto com ela para montar outra:
                      escrevia-se uma letra e o foco ia para o nada. Agora o que
                      muda entre branca e escrita é uma CLASSE (o `pl-8` que
                      abre lugar para o disco) e um irmão que aparece antes dela
                      — a caixa de texto é sempre o mesmo nó.

                      O `top-2`/`left-2` são o `py-2` da caixa e o recuo de quem
                      começa por um disco: um filho absoluto se mede pela caixa de
                      PADDING, e sem eles o disco pousaria na quina. Os 26px são a
                      altura da linha, e é nela que o disco se centra. */}
                  {blank ? (
                    <div className="absolute top-2 left-2 flex h-[26px] items-center">
                      <DiscButton label="Adicionar bloco" visible onClick={() => setAdderAt(i)}>
                        <Plus className="size-3.5" />
                      </DiscButton>
                    </div>
                  ) : null}
                  {/* `pl-8` = o disco (24) mais o vão (8), contados a partir do
                      recuo de 8 que o `ROW_LEADING_DISC` já pôs. O mesmo número
                      que a linha do fim alcança por `gap-2` depois do disco. */}
                  {/* `relative` para o menu da barra pousar EXATAMENTE sob o
                      cursor: esta caixa começa onde o texto começa, e o menu é
                      `absolute left-0 top-full` dentro dela. A barra só abre num
                      parágrafo VAZIO, então o cursor está no início da linha —
                      que é esta borda. É por isso que aqui não há medição de
                      geometria dentro da `textarea`, que é a única coisa da
                      página cuja posição o DOM não expõe. */}
                  <div className={cn("relative min-w-0", blank && "pl-8")}>
                    {body}
                    {slash?.index === i ? (
                      <SlashMenu
                        options={slashOptions}
                        cursor={slash.cursor}
                        query={slashQuery}
                        onHover={(cursor) => setSlash({ index: i, cursor })}
                        onPick={(pick) => pickSlash(i, pick)}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {/* A linha do fim: uma linha em branco de parágrafo com o `+` ao lado.
              É a única posição que não depende de um bloco existir — todas as
              outras saem da pílula de um deles —, e a única em que se escreve sem
              escolher nada antes (ver `WritingLine`). É ela que mantém "escrever
              no fim do texto" a um clique de distância, e por isso o `+` da
              pílula pode inserir só ACIMA sem deixar posição nenhuma órfã.

              Ela SOME quando o último bloco já é um parágrafo vazio, que é o que
              um Enter no fim do texto acabou de criar: os dois desenham a mesma
              linha em branco com o mesmo `+`, e empilhadas seriam duas linhas
              vazias onde a pessoa pediu uma. */}
          {endsBlank ? null : (
            <div className="relative">
              {adderAt === doc.blocks.length ? (
                <BlockMenu
                  options={menuOptions}
                  onClose={() => setAdderAt(null)}
                  onPick={(pick) => addOfType(doc.blocks.length, pick)}
                />
              ) : null}
              {/* A MESMA caixa dos blocos, para a linha do fim acender igual
                  quando recebe o cursor, e o mesmo recuo curto de quem começa por
                  um disco. O texto fica a 40px da borda nos dois lugares: aqui
                  por `gap-2` depois do disco de 24, na linha em branco pelo
                  `pl-8` — o mesmo número por dois caminhos, porque lá o disco
                  flutua para a caixa de texto não ser remontada a cada primeira
                  letra. */}
              <div
                className={cn(
                  BLOCK_SURFACE,
                  ROW_LEADING_DISC,
                  "flex items-center gap-2 focus-within:bg-scriba-blue-soft/60"
                )}
              >
                <DiscButton
                  label="Adicionar bloco"
                  visible
                  onClick={() => setAdderAt(doc.blocks.length)}
                >
                  <Plus className="size-3.5" />
                </DiscButton>
                <WritingLine
                  emphasis={empty}
                  onWrite={(text) => {
                    const at = insertAt(doc.blocks.length, { type: "paragraph", text });
                    // A barra digitada na linha do fim faz a MESMA coisa que
                    // dentro de um bloco: ela vira um parágrafo com `/` dentro,
                    // e o menu abre sobre ele. Sem isto, o único lugar do
                    // editor onde se escreve sem escolher nada antes seria
                    // justamente o único onde a barra não funcionaria.
                    if (text === "/") setSlash({ index: at, cursor: 0 });
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <PassagePicker
        open={pickerFor !== null}
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
          "Sobre qual assunto você gostaria de escrever?". O endereço nunca foi o problema —
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
      {ready && (
        <BibloDock
          sessionId={draftId}
          ensureSession={flush}
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

      {/* `ready` só é falso por um instante, enquanto o rascunho do aparelho é
          consultado. Ele não esconde a tela (isso faria a página piscar em todo
          carregamento); serve para não anunciar "Salvo" antes de saber se há
          trabalho local por sincronizar. */}
      {ready ? null : <span className="sr-only">Carregando o rascunho…</span>}
    </main>
  );
}

/** Um parágrafo sem uma letra: a linha em branco que oferece o `+`. */
function isBlankParagraph(block: WrittenBlock): boolean {
  return block.type === "paragraph" && block.text.length === 0;
}

/**
 * O disco do `+`.
 *
 * O `+` de uma linha em branco e o `×` que fecha o menu são o MESMO botão com
 * glifos diferentes, e é por isso que este componente existe. O `×` nasce
 * exatamente onde o `+` estava — mesmo tamanho, mesmo lugar —, senão abrir o
 * menu troca um disco de 24px por um botão de 36 três píxeis ao lado, e o olho
 * lê isso como a tela inteira tendo se mexido.
 *
 * **O disco tem 24px, e o alvo de toque cresce por fora.** Ele já teve 36, e 36
 * é mais alto que a linha de texto que ele acompanha: a linha em branco ficava
 * 10px mais alta que o parágrafo de cima, duas alturas de linha no mesmo
 * documento. Hoje o que cresce é a área clicável, por `padding` com `margin`
 * negativa, e ela não empurra altura nenhuma.
 *
 * **Quem acende é o `Composer`, e não um `group-hover`.** Cada vão pertence a
 * dois blocos, e o `+` entre eles aparece ao passar por qualquer um dos dois —
 * um `group-` só enxerga o ancestral em que foi declarado, e o vão mora dentro
 * de um só. No celular a mesma vaga é preenchida pelo bloco em edição.
 */
function DiscButton({
  label,
  visible,
  onClick,
  children,
}: {
  label: string;
  visible?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "group/disc inline-flex shrink-0 items-center transition-opacity",
        "opacity-0 focus-visible:opacity-100",
        visible && "opacity-100",
        // O alvo é 36×36 sem ocupar mais que os 24 do disco: o `p-1.5` estica a
        // área e o `-m-1.5` devolve o espaço ao layout.
        "-m-1.5 justify-center p-1.5"
      )}
    >
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full border border-scriba-hairline text-scriba-ink-mute transition-colors",
          "group-hover/disc:border-scriba-ink-mute group-hover/disc:text-scriba-ink"
        )}
      >
        {children}
      </span>
    </button>
  );
}

/**
 * A fileira de opções, aberta NO LUGAR da linha, flutuando sobre ela.
 *
 * **Ela não empurra mais nada.** Em fluxo, as sete pastilhas quebravam em duas
 * linhas e empurravam o documento inteiro para baixo — o texto que a pessoa
 * está olhando para decidir o que vem a seguir saltava no instante do clique, e
 * o que estava sob o mouse deixava de estar. Flutuando, o que se mexe é só ela.
 *
 * **Ela começa exatamente onde a linha começa**: o `-top-2` desconta o avanço da
 * caixa do bloco para dentro do vão, e o `-inset-x-*` a alinha com as bordas da
 * superfície. O `×` cai em cima do `+` que a abriu — mesmo disco, mesmo lugar,
 * só o glifo muda —, então abrir o menu parece a linha virando o menu.
 *
 * Ela QUEBRA em linhas, não rola na horizontal. As sete opções não cabem numa
 * linha nem no desktop (a coluna de leitura tem 768px), e a versão com
 * `overflow-x-auto` punha uma barra de rolagem cinza atravessando a página para
 * esconder as duas últimas — a Conclusão deixava de existir para quem não
 * descobrisse que aquilo arrastava.
 *
 * O `data-block-menu` é como o `Composer` sabe que um clique caiu DENTRO dela
 * (ver o efeito que a fecha por fora); o fundo opaco, na cor do chão, é o que
 * impede o texto de baixo de aparecer no meio das pastilhas. Sem fio em volta,
 * sem sombra e sem cor própria: os três a transformavam numa caixa pousada
 * sobre o documento, e ela é a própria linha trocando de conteúdo.
 */
/**
 * O menu da BARRA: as mesmas opções do `+`, chamadas pelo teclado.
 *
 * ## Por que ele não é o `BlockMenu`
 *
 * Aquele é uma fileira de pastilhas que ocupa a LINHA INTEIRA, aberta por um
 * disco que a pessoa mirou com o dedo: ele responde "o que cabe nesta
 * posição?" e é tocado. Este responde "o que é esta linha?" enquanto as mãos
 * estão no teclado, é filtrado enquanto se digita e é percorrido com as setas.
 * Uma lista VERTICAL é a forma que a seta pede, e o realce do item focado só
 * faz sentido numa lista em que existe um item focado.
 *
 * Eles compartilham o que importa, que são as OPÇÕES (`menuOptions`): duas
 * listas de blocos divergiriam no primeiro tipo novo, e o menu que ficasse para
 * trás simplesmente não o ofereceria, sem erro nenhum na tela.
 *
 * ## A caixa
 *
 * Ela TEM contorno e sombra, ao contrário do `BlockMenu`, e a diferença não é
 * gosto: aquele é a linha trocando de conteúdo, e por isso é opaco e sem
 * moldura; este pousa SOBRE o texto que continua ali embaixo, e uma lista sem
 * borda sobre parágrafos vira duas camadas de texto na mesma tinta.
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
 * foco — e de novo a cada `resize`/`scroll` do `visualViewport` enquanto ele
 * vive: o teclado pode ainda estar animando ao abrir, e o iOS rola a página
 * para manter o cursor visível depois do primeiro quadro. O menu vive pouco,
 * só enquanto a linha está em foco, então ouvir os dois eventos custa pouco.
 *
 * `useLayoutEffect` e não `useEffect`: medir depois da pintura faria a lista
 * aparecer embaixo e pular para cima num segundo quadro, que é pior que
 * qualquer dos dois lugares.
 */
/** A altura que a lista cheia pede. Ver `useSlashPlacement`. */
const SLASH_MENU_MAX_HEIGHT = 320;
/** O menor que a lista pode encolher sem virar inútil: menos que isto e a
 *  rolagem interna trabalha mais do que ajuda. */
const SLASH_MENU_MIN_HEIGHT = 120;
/** A folga entre a lista e a borda do viewport visível, no lado que sobrou. */
const SLASH_MENU_EDGE_GAP = 12;

type SlashPlacement = { side: "up" | "down"; maxHeight: number };

/**
 * Para que lado o menu abre e a que altura ele encolhe, medido contra o que
 * está VISÍVEL — não contra `window.innerHeight`. Ver o cabeçalho do
 * `SlashMenu`, que tem o raciocínio inteiro (o defeito do teclado, e por que
 * os dois lados clampam a própria altura).
 */
function useSlashPlacement(ref: React.RefObject<HTMLDivElement | null>): SlashPlacement {
  const [placement, setPlacement] = useState<SlashPlacement>({
    side: "down",
    maxHeight: SLASH_MENU_MAX_HEIGHT,
  });
  useLayoutEffect(() => {
    const anchor = ref.current?.parentElement;
    if (!anchor) return;
    const measure = () => {
      const box = anchor.getBoundingClientRect();
      const vv = window.visualViewport;
      const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const visibleTop = vv?.offsetTop ?? 0;
      const below = visibleBottom - box.bottom;
      const above = box.top - visibleTop;
      // Só sobe quando não cabe embaixo E há mais espaço em cima: numa janela
      // baixa demais para os dois lados, embaixo é o lugar em que a rolagem da
      // PÁGINA alcança a lista; em cima ela ficaria presa contra o topo da
      // tela sem para onde rolar.
      const side = below < SLASH_MENU_MAX_HEIGHT && above > below ? "up" : "down";
      // A lista se encolhe ao espaço que o lado escolhido tem, e nunca menos
      // que o mínimo: sem isto, "up" com pouco espaço em cima ainda estourava
      // o topo da tela — ele só comparava contra "embaixo", nunca contra o
      // que cabia de fato ali em cima.
      const room = (side === "up" ? above : below) - SLASH_MENU_EDGE_GAP;
      const maxHeight = Math.max(SLASH_MENU_MIN_HEIGHT, Math.min(SLASH_MENU_MAX_HEIGHT, room));
      setPlacement({ side, maxHeight });
    };
    measure();
    // O teclado pode ainda estar abrindo no instante em que a barra é digitada
    // (a animação leva alguns quadros), e a rolagem que o iOS faz para manter
    // o cursor visível também muda `offsetTop` depois do primeiro quadro. O
    // menu vive pouco — só enquanto a linha está em foco —, então ouvir os
    // dois eventos custa pouco e corrige o caso em que a medida do mount já
    // nasceu velha.
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [ref]);
  return placement;
}

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
  const ref = useRef<HTMLDivElement>(null);
  const { side, maxHeight } = useSlashPlacement(ref);
  // A caixa acompanha o lado: para cima ela é ancorada pela BASE, para a lista
  // crescer afastando-se da linha em vez de cobri-la.
  const place = side === "up" ? "bottom-full mb-1" : "top-full mt-1";

  if (options.length === 0) {
    return (
      <div
        ref={ref}
        data-slash-menu
        className={cn(
          "absolute left-0 z-40 w-[min(20rem,calc(100vw-3rem))] rounded-2xl border border-scriba-hairline bg-scriba-surface px-3 py-2.5 shadow-[0_12px_32px_var(--scriba-shadow)]",
          place
        )}
      >
        <p className="text-scriba-ink-mute text-xs">Nada com “{query}”.</p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-slash-menu
      style={{ maxHeight }}
      className={cn(
        "absolute left-0 z-40 flex w-[min(20rem,calc(100vw-3rem))] flex-col gap-0.5 overflow-y-auto rounded-2xl border border-scriba-hairline bg-scriba-surface p-1.5 shadow-[0_12px_32px_var(--scriba-shadow)]",
        place
      )}
    >
      {options.map((o, i) => (
        <button
          key={o.type}
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
}

function BlockMenu({
  options,
  onClose,
  onPick,
}: {
  /** O que cabe AGORA: as duas opções únicas saem quando usadas. Ver `menuOptions`. */
  options: MenuOption[];
  onClose: () => void;
  onPick: (pick: BlockPick) => void;
}) {
  return (
    <div
      data-block-menu
      className={cn(
        "-top-2 -inset-x-3 sm:-inset-x-5 absolute z-30 flex items-start gap-2",
        // Nem contorno, nem sombra, nem cor própria: o fundo é o do chão, e o
        // menu é a linha trocando de conteúdo, não uma caixa pousada sobre o
        // documento. O que o mantém legível é ser OPACO e estar por cima —
        // `z-30` contra os `z-10` da pílula de um bloco, porque com duas
        // fileiras de pastilhas ele cobre parte do bloco de baixo e o que está
        // embaixo não pode aparecer no meio das opções nem acender ao passar o
        // mouse sobre elas.
        "rounded-[20px] bg-scriba-surface p-2"
      )}
    >
      {/* `h-[26px]`: a altura da linha de texto, para o `×` pousar na mesma
          altura em que o `+` estava. */}
      <div className="flex h-[26px] shrink-0 items-center">
        <DiscButton label="Fechar" visible onClick={onClose}>
          <X className="size-3.5" />
        </DiscButton>
      </div>
      <div className="-my-0.5 flex min-w-0 flex-1 flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.type}
            type="button"
            title={o.hint}
            onClick={() => onPick(o.type)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-scriba-hairline px-2.5 py-1.5 font-medium text-scriba-ink-soft text-xs transition-colors hover:bg-scriba-blue-soft/60 hover:text-scriba-blue-ink focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A linha em branco depois do último bloco: uma `textarea` vazia, permanente,
 * com a roupa de parágrafo.
 *
 * **Ela existe para o `+` ser opcional.** Escrever um texto é escrever
 * parágrafos; pedir que a pessoa escolha "Parágrafo" num menu antes de cada um
 * é cobrar um clique por aquilo que ela ia fazer de qualquer jeito — e numa
 * folha em branco esse clique é um degrau entre abrir o editor e começar. Quem
 * quer um título, uma passagem ou uma conclusão pede pelo `+`, que continua ali
 * do lado; quem quer escrever, escreve.
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
}: {
  emphasis?: boolean;
  onWrite: (text: string) => void;
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
      aria-label="Escrever um parágrafo"
      placeholder={emphasis ? "Comece a escrever…" : BLOCK_PLACEHOLDERS.paragraph}
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
      className="w-full resize-none overflow-hidden text-pretty bg-transparent font-light text-[15px] text-scriba-ink leading-[1.72] outline-none placeholder:text-scriba-ink-mute/60"
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
 * **O `+` mora aqui**, e não mais no vão entre dois blocos. Lá eram dois discos
 * por bloco, acendendo e apagando conforme o mouse passava, e uma tela de texto
 * com uma dúzia de botõezinhos piscando ao redor. Aqui é um botão a mais numa
 * barra que já existe e já aparece na hora certa. Ele insere ACIMA do bloco —
 * é o que diz o rótulo, e é o que mantém toda posição alcançável: para o fim do
 * texto existe a linha em branco do rodapé, que está sempre lá.
 */
function BlockControls({
  hidden,
  shown,
  onAdd,
  onUp,
  onDown,
  onMark,
  onDelete,
}: {
  /** Há um menu de blocos aberto em algum lugar: nenhuma pílula aparece. */
  hidden?: boolean;
  shown: boolean;
  /** Abre o menu de blocos na posição deste bloco, ou seja, ACIMA dele. */
  onAdd: () => void;
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
  onDelete: () => void;
}) {
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
        shown && "opacity-100",
        // `invisible`, e não `hidden`: assim ela some junto com a transição em
        // vez de desaparecer no primeiro quadro.
        hidden && "invisible opacity-0"
      )}
    >
      <ControlButton label="Adicionar bloco acima" onClick={onAdd}>
        <Plus className="size-3.5" />
      </ControlButton>
      {/* O MARCA-TEXTO entra aqui, e não numa barra flutuante sobre a seleção.
          Uma barra própria teria de ser posicionada em cima de um recorte
          dentro de uma `textarea`, que é a única coisa da página cuja geometria
          o DOM não expõe — daria um espelho de medição só para achar o pixel. E
          o argumento que tirou o `+` do vão vale igual aqui: numa barra que já
          existe, e que já aparece na hora certa, isto é um botão a mais.

          O fio fica DEPOIS dele: o `+` e o marca-texto são as duas ações que
          escrevem no texto, e mover/excluir são as que mexem no bloco. */}
      {onMark ? (
        <ControlButton keepFocus label="Marcar o trecho selecionado" onClick={onMark}>
          <Highlighter className="size-3.5" />
        </ControlButton>
      ) : null}
      <span aria-hidden className="mx-0.5 h-4 w-px bg-scriba-hairline" />
      <ControlButton label="Mover para cima" onClick={onUp}>
        <ChevronUp className="size-3.5" />
      </ControlButton>
      <ControlButton label="Mover para baixo" onClick={onDown}>
        <ChevronDown className="size-3.5" />
      </ControlButton>
      <ControlButton label="Excluir bloco" onClick={onDelete} destructive>
        <Trash2 className="size-3.5" />
      </ControlButton>
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
 * O texto CRU com a faixa amarela atrás dos trechos marcados, para o espelho.
 *
 * Ele reproduz o texto exatamente como está na caixa, `==` inclusive, e é essa
 * fidelidade que faz o espelho quebrar a linha onde a caixa quebra — a razão de
 * ele existir. As cercas ficam DENTRO do amarelo, o que é um efeito colateral
 * que se aceitou de bom grado: elas são a única coisa na tela que ensina a
 * sintaxe a quem não usou o botão.
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
            className="highlight-phrase [-webkit-box-decoration-break:clone] [box-decoration-break:clone]"
          >{`==${piece.text}==`}</span>
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
        value={value}
        onChange={onChange}
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

    // Sem faixa de versículos não há o que citar, e a leitura desenha a MENÇÃO
    // (uma pastilha solta, `ChapterMention`) em vez da moldura vazia. Aqui vale
    // o mesmo: a moldura em volta de nada era o que o `BlockRenderer` recusa a
    // desenhar, e desenhá-la só na edição quebraria a promessa de que o que se
    // escreve é o que se lê.
    if (!hasRange) return <div className="py-1">{chip}</div>;

    return (
      <figure className="animate-insight-gradient relative flex flex-col gap-3.5 rounded-[26px] bg-[image:var(--session-surface-quote)] bg-[size:200%_100%] p-6">
        <figcaption>{chip}</figcaption>
        {/* O texto da NVI, buscado pelo MESMO `PassageVerses` da leitura.
            Mostrar aqui um aviso de que "a passagem entra depois" era pedir fé
            num bloco que é o único do editor sem nada para digitar: escolhida a
            referência, não há mais nada a fazer, e a única confirmação de que
            se escolheu a certa é o texto. A busca é em cache por referência
            (`passageQueryOptions`), então abrir a leitura em seguida não a
            refaz. */}
        <div className="font-light text-[15px] text-session-verse-text leading-relaxed">
          <PassageVerses
            bookDisplay={parsed.bookDisplay}
            chapter={parsed.chapter}
            startVerse={parsed.startVerse as number}
            endVerse={parsed.endVerse as number}
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
    const face = "text-[15px] font-light leading-[1.72]";
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
        <AutoTextarea
          {...shared}
          value={block.text}
          onChange={(text) => onChange({ text })}
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
    return (
      <aside className="relative rounded-2xl border-[var(--session-example-border)] border-l-4 bg-[var(--session-example-bg)] px-5 py-4">
        <span className="mb-1.5 block font-semibold text-[10px] text-scriba-ink-mute uppercase tracking-[0.14em]">
          Exemplo
        </span>
        <MarkableField
          shared={shared}
          value={block.text}
          onChange={(text) => onChange({ text })}
          ariaLabel="Exemplo"
          className="font-light text-scriba-ink text-sm leading-relaxed"
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
          className="font-light text-[15px] text-scriba-ink-soft italic leading-relaxed"
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
          className="font-light text-[15px] text-session-verse-text leading-[1.7]"
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
      className="font-light text-[15px] text-scriba-ink leading-[1.72]"
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
