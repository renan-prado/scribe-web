"use client";

import { ChevronDown, ChevronUp, Eye, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { BookGlyph } from "@/components/icons/BookGlyph";
import { useUnloadGuard } from "@/features/session/hooks/useUnloadGuard";
import type { WrittenBlock, WrittenBlockType, WrittenSummary } from "@/lib/domain/summary";
import { WRITTEN_LIMITS } from "@/lib/domain/summary";
import { cn } from "@/lib/utils";
import { ScribaMark } from "@/shared/brand";
import { AutoTextarea } from "./AutoTextarea";
import { BLOCK_OPTIONS, BLOCK_PLACEHOLDERS, emptyBlock } from "./blocks";
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
 * não deixá-la nascer. (O "Ver como ficou" do rodapé é outra coisa: ele abre a
 * página de LEITURA, onde o texto bíblico é buscado na NVI e as referências
 * viram links — o que a edição não pode mostrar sem virar a página de
 * leitura.)
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
type Props = {
  /** `null` num texto novo: a sessão nasce no primeiro salvamento. */
  id: string | null;
  initial: WrittenSummary;
  /** A `TopBar`, montada pela página (ela é server component). */
  header: ReactNode;
};

export function Composer({ id, initial, header }: Props) {
  const router = useRouter();
  const { doc, setDoc, status, sessionId, flush, ready } = useWrittenDraft({ id, initial });

  /** Onde o menu do `+` está aberto: depois do bloco de índice N (-1 = no fim). */
  const [adderAt, setAdderAt] = useState<number | null>(null);
  /** Qual bloco está sendo editado. É o que mostra os controles no celular. */
  const [active, setActive] = useState<number | null>(null);
  /** O bloco de passagem cujo seletor está aberto. `-1` = um bloco novo. */
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);

  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

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

  function patchBlocks(next: (blocks: WrittenBlock[]) => WrittenBlock[]) {
    setDoc((prev) => ({ ...prev, blocks: next(prev.blocks) }));
  }

  function insertAt(index: number, block: WrittenBlock) {
    patchBlocks((blocks) => {
      const copy = blocks.slice();
      copy.splice(index, 0, block);
      return copy;
    });
    setAdderAt(null);
    setFocusIndex(index);
    setActive(index);
  }

  function addOfType(index: number, type: WrittenBlockType) {
    // A passagem não tem o que digitar: ela nasce do seletor, e sem referência
    // não haveria bloco nenhum para mostrar. Por isso o `+` abre o seletor em
    // vez de inserir um bloco vazio que ficaria na tela pedindo um segundo
    // toque.
    if (type === "bibleQuote") {
      setAdderAt(null);
      setPendingIndex(index);
      setPickerFor(-1);
      return;
    }
    insertAt(index, emptyBlock(type));
  }

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

  function onKeyDown(index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      insertAt(index + 1, emptyBlock("paragraph"));
      return;
    }
    const el = e.currentTarget;
    if (
      e.key === "Backspace" &&
      el.value.length === 0 &&
      el.selectionStart === 0 &&
      doc.blocks.length > 1
    ) {
      e.preventDefault();
      removeAt(index);
    }
  }

  async function openReading() {
    setLeaving(true);
    const savedId = (await flush()) ?? sessionId;
    if (!savedId) {
      setLeaving(false);
      return;
    }
    router.push(`/summary/${savedId}`);
  }

  const empty = doc.blocks.length === 0;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 pt-2 pb-24 sm:gap-8 sm:px-6">
      {header}

      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          {/* Numa folha em branco que nunca foi salva, "Salvo" é tecnicamente
              verdade e mentira na prática: não há nada salvo porque não há
              nada. O chip entra quando passa a existir algo sobre o que
              afirmar. */}
          {sessionId || status !== "synced" ? <StatusChip status={status} /> : <span />}
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
          onChange={(v) => setDoc((prev) => ({ ...prev, title: v.slice(0, WRITTEN_LIMITS.title) }))}
          ariaLabel="Título"
          placeholder="Título"
          className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-3xl md:text-4xl"
        />

        {/* A "ideia central" NÃO é um bloco, e por isso não está no menu do
            `+`: ela é o `shortSummary` do payload, a frase que aparece no
            cartão da Biblioteca e na busca. Campo fixo aqui em cima, com a
            roupa que ela vai vestir na leitura (`LeadIdea`), para que a pessoa
            veja onde aquilo vai parar. */}
        <section className="flex flex-col gap-2 rounded-[26px] bg-[image:var(--session-surface-quote)] bg-[size:200%_100%] p-5">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-session-chip-ai">
            <ScribaMark className="size-3" />
            Ideia central
          </span>
          <AutoTextarea
            value={doc.shortSummary}
            onChange={(v) =>
              setDoc((prev) => ({
                ...prev,
                shortSummary: v.slice(0, WRITTEN_LIMITS.shortSummary),
              }))
            }
            ariaLabel="Ideia central"
            placeholder="Em uma frase, do que trata esta mensagem."
            className="text-pretty text-[15px] font-light leading-[1.7] text-session-verse-text"
          />
        </section>
      </header>

      <div className="h-px w-full bg-scriba-hairline" />

      <div className="flex flex-col">
        {doc.blocks.map((block, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: ver o cabeçalho
          <div key={i} className="group relative flex flex-col">
            <BlockControls
              shown={active === i}
              onUp={i > 0 ? () => moveBy(i, -1) : undefined}
              onDown={i < doc.blocks.length - 1 ? () => moveBy(i, 1) : undefined}
              onDelete={() => removeAt(i)}
            />
            <BlockBody
              block={block}
              index={i}
              onFocus={() => setActive(i)}
              onChange={(patch) => setBlock(i, patch)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onOpenPicker={() => setPickerFor(i)}
              registerRef={(el) => {
                refs.current[i] = el;
              }}
            />
            {/* A linha DEPOIS do último bloco não é desenhada aqui: ela é a do
                rodapé, logo abaixo. As duas ocupam a mesma posição
                (`doc.blocks.length`), e com as duas no ar havia dois `+`
                empilhados no fim da lista — abrir um abria os dois, porque
                `adderAt` é um número, não um endereço de componente. */}
            {i < doc.blocks.length - 1 ? (
              <InsertRow
                open={adderAt === i + 1}
                alwaysVisible={active === i}
                onToggle={() => setAdderAt((cur) => (cur === i + 1 ? null : i + 1))}
                onPick={(type) => addOfType(i + 1, type)}
              />
            ) : null}
          </div>
        ))}

        {/* O `+` do fim é o único PERMANENTE, e é ele quem responde pela
            posição "depois do último bloco" — os `+` entre blocos aparecem no
            passar do mouse e no bloco em edição. Num documento vazio ele é a
            tela inteira: um disco com um mais ao lado de um texto de rascunho,
            que é o que o Medium mostra numa história em branco. */}
        <InsertRow
          open={adderAt === doc.blocks.length}
          alwaysVisible
          emphasis={empty}
          onToggle={() =>
            setAdderAt((cur) => (cur === doc.blocks.length ? null : doc.blocks.length))
          }
          onPick={(type) => addOfType(doc.blocks.length, type)}
        />
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

      {/* `ready` só é falso por um instante, enquanto o rascunho do aparelho é
          consultado. Ele não esconde a tela (isso faria a página piscar em todo
          carregamento); serve para não anunciar "Salvo" antes de saber se há
          trabalho local por sincronizar. */}
      {ready ? null : <span className="sr-only">Carregando o rascunho…</span>}
    </main>
  );
}

/**
 * A linha de inserção entre dois blocos.
 *
 * Fechada, é um `+` que aparece ao passar o mouse (e fica visível no bloco em
 * edição, porque no celular não existe passar o mouse). Aberta, ela vira a
 * fileira de opções — inline, no lugar onde o bloco vai nascer, e não um menu
 * flutuante: o menu apareceria por cima do texto, tapando justamente a parte
 * que a pessoa está olhando para decidir o que vem a seguir.
 */
function InsertRow({
  open,
  alwaysVisible,
  emphasis,
  onToggle,
  onPick,
}: {
  open: boolean;
  alwaysVisible?: boolean;
  emphasis?: boolean;
  onToggle: () => void;
  onPick: (type: WrittenBlockType) => void;
}) {
  if (open) {
    return (
      <div className="flex items-center gap-2 py-3">
        <button
          type="button"
          aria-label="Fechar"
          onClick={onToggle}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-scriba-hairline text-scriba-ink-mute transition-colors hover:bg-scriba-blue-soft/60 hover:text-scriba-ink"
        >
          <X className="size-4" />
        </button>
        {/* QUEBRA em linhas, não rola na horizontal. As sete opções não cabem
            numa linha nem no desktop (a coluna de leitura tem 768px), e a
            versão com `overflow-x-auto` punha uma barra de rolagem cinza
            atravessando a página para esconder as duas últimas — a Conclusão
            deixava de existir para quem não descobrisse que aquilo arrastava.
            Duas linhas de pastilhas ocupam a mesma altura que a barra ocupava,
            e mostram tudo. */}
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 py-1">
          {BLOCK_OPTIONS.map((o) => (
            <button
              key={o.type}
              type="button"
              title={o.hint}
              onClick={() => onPick(o.type)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-scriba-hairline px-3 py-2 text-xs font-medium text-scriba-ink-soft transition-colors hover:bg-scriba-blue-soft/60 hover:text-scriba-blue-ink focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", emphasis ? "py-2" : "h-7")}>
      <button
        type="button"
        aria-label="Adicionar bloco"
        onClick={onToggle}
        className={cn(
          "inline-flex items-center gap-2 rounded-full text-scriba-ink-mute transition-opacity",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          alwaysVisible && "opacity-100"
        )}
      >
        <span className="inline-flex size-9 items-center justify-center rounded-full border border-scriba-hairline transition-colors hover:border-scriba-ink-mute hover:text-scriba-ink">
          <Plus className="size-4" />
        </span>
        {emphasis ? (
          <span className="text-sm font-light text-scriba-ink-mute">Comece a escrever…</span>
        ) : null}
      </button>
    </div>
  );
}

/**
 * Mover e excluir, flutuando no vão acima do bloco.
 *
 * No vão, e não ao lado: fora da margem esquerda não há espaço no celular, e
 * dentro da linha os botões empurrariam o texto para o lado toda vez que
 * aparecessem — o cursor de quem está escrevendo saltaria junto.
 */
function BlockControls({
  shown,
  onUp,
  onDown,
  onDelete,
}: {
  shown: boolean;
  onUp?: () => void;
  onDown?: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "-top-3.5 absolute right-0 z-10 flex items-center gap-0.5 rounded-full border border-scriba-hairline bg-scriba-surface px-1 py-1 shadow-sm transition-opacity",
        "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        shown && "opacity-100"
      )}
    >
      <ControlButton label="Mover para cima" onClick={onUp}>
        <ChevronUp className="size-4" />
      </ControlButton>
      <ControlButton label="Mover para baixo" onClick={onDown}>
        <ChevronDown className="size-4" />
      </ControlButton>
      <ControlButton label="Excluir bloco" onClick={onDelete} destructive>
        <Trash2 className="size-4" />
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick?: () => void;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full text-scriba-ink-mute transition-colors disabled:opacity-30",
        destructive
          ? "hover:bg-scriba-rose-body hover:text-scriba-rose-ink"
          : "hover:bg-scriba-blue-soft/60 hover:text-scriba-ink"
      )}
    >
      {children}
    </button>
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
  onOpenPicker,
  registerRef,
}: {
  block: WrittenBlock;
  index: number;
  onFocus: () => void;
  onChange: (patch: Partial<WrittenBlock>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onOpenPicker: () => void;
  registerRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const shared = {
    onKeyDown,
    onFocus,
    textareaRef: registerRef,
    placeholder: BLOCK_PLACEHOLDERS[block.type],
  };

  if (block.type === "bibleQuote") {
    return (
      <button
        type="button"
        onClick={() => {
          onFocus();
          onOpenPicker();
        }}
        aria-label={`Trocar a passagem do bloco ${index + 1}`}
        className="animate-insight-gradient flex w-full flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[26px] bg-[image:var(--session-surface-quote)] bg-[size:200%_100%] p-6 text-left"
      >
        {/* `whitespace-nowrap` e `shrink-0`: a pastilha é a referência, e no
            celular ela quebrava "Romanos 6:1-4" em duas linhas dentro do
            próprio balão para caber ao lado da frase. A frase é que desce para
            a linha seguinte (`flex-wrap`) — ela é a explicação, e explicação
            cede espaço para o dado. */}
        <span className="veil-chip inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 font-medium text-xs">
          <BookGlyph className="size-3" />
          {block.reference || "Escolher passagem"}
        </span>
        <span className="font-light text-scriba-ink-mute text-xs">
          O texto da NVI entra aqui na leitura.
        </span>
      </button>
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
    return (
      <div className="mt-2 mb-4 flex flex-col items-center gap-1.5 px-4 text-center sm:px-8">
        <span
          aria-hidden
          className="select-none font-semibold text-4xl text-scriba-hairline-soft leading-none"
        >
          "
        </span>
        <AutoTextarea
          {...shared}
          value={block.text}
          onChange={(text) => onChange({ text })}
          ariaLabel="Frase de destaque"
          className="text-pretty text-center font-semibold text-lg text-scriba-ink-strong leading-relaxed sm:text-xl"
        />
      </div>
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
        <AutoTextarea
          {...shared}
          value={block.text}
          onChange={(text) => onChange({ text })}
          ariaLabel="Conclusão"
          className="text-pretty font-light text-[15px] text-session-verse-text leading-[1.7]"
        />
      </section>
    );
  }

  return (
    <AutoTextarea
      {...shared}
      value={block.text}
      onChange={(text) => onChange({ text })}
      ariaLabel="Parágrafo"
      className="text-pretty font-light text-[15px] text-scriba-ink leading-[1.72]"
    />
  );
}

/**
 * O que está salvo, e ONDE.
 *
 * "Salvo neste aparelho" não é um estado de erro disfarçado: enquanto a pausa
 * de 1,8s não termina, o texto realmente só existe no IndexedDB, e dizer
 * "Salvo" ali seria prometer uma coisa que ainda não aconteceu. Quando o envio
 * falha, a frase muda de tom mas o fato continua o mesmo — o trabalho está
 * guardado, e é isso que a pessoa precisa saber antes de fechar a aba.
 */
function StatusChip({ status }: { status: SaveStatus }) {
  const label =
    status === "synced"
      ? "Salvo"
      : status === "saving"
        ? "Salvando…"
        : status === "error"
          ? "Sem conexão · salvo neste aparelho"
          : "Salvo neste aparelho";

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-[10px] uppercase tracking-wider",
        status === "synced"
          ? "bg-scriba-mint text-scriba-mint-dark"
          : status === "error"
            ? "bg-scriba-rose-body text-scriba-rose-ink"
            : "bg-scriba-ink-mute/10 text-scriba-ink-soft"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "synced"
            ? "bg-scriba-mint-strong"
            : status === "error"
              ? "bg-scriba-rose-accent"
              : "bg-scriba-ink-mute"
        )}
      />
      {label}
    </span>
  );
}
