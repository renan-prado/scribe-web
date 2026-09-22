"use client";

import { Folder as FolderIcon, MapPin, Pencil, PenLine, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { LinkPendingSwap, NavLink } from "@/components/NavLink";
import { PageBlurOverlay } from "@/components/PageBlurOverlay";
import { useCoinsStore } from "@/features/coins/store";
import { ConfirmDialog } from "@/features/session/components/ConfirmDialog";
import { EntityFieldDialog } from "@/features/session/components/EntityFieldDialog";
import { HallucinationReportDialog } from "@/features/session/components/HallucinationReportDialog";
import { MoveToFolderDialog } from "@/features/session/components/MoveToFolderDialog";
import { SessionMenu } from "@/features/session/components/SessionMenu";
import { SummaryDeck } from "@/features/session/components/SummaryDeck";
import {
  SummaryFindArea,
  SummaryFindBar,
  SummaryFindProvider,
} from "@/features/session/components/SummaryFind";
import { SummaryView } from "@/features/session/components/SummaryView";
import { TitleDialog } from "@/features/session/components/TitleDialog";
import { useFolders } from "@/features/session/folders-query";
import { requestLocationSuggestions, requestSpeakerSuggestions } from "@/features/session/lib/api";
import { initialsOf } from "@/features/session/lib/text";
import { useLibrarySync, useLibraryWriter } from "@/features/session/query";
import { FOLDER_ICON_INK, folderPath } from "@/lib/domain/folder";
import type { SessionMode } from "@/lib/domain/session";
import type { SummaryPayload } from "@/lib/domain/summary";
import { cn } from "@/lib/utils";

/** Neutral pill matching the "Salvo" / "Estudo" family for "add missing meta"
 * CTAs. Rendered when speaker or location is unknown. */
const ADD_BADGE_CLASSES = cn(
  "inline-flex items-center gap-1 rounded-full bg-scriba-ink-mute/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-soft outline-none transition-colors",
  "hover:bg-scriba-blue-soft/70 hover:text-scriba-blue-ink focus-visible:ring-2 focus-visible:ring-ring/40"
);

/**
 * A tela de uma sessão salva: cabeçalho editável, o resumo e o menu.
 *
 * Título, autor e local são cada um o seu próprio diálogo, abertos pela
 * pastilha correspondente — a edição acontece no lugar em que o dado está, e
 * não num formulário com os três campos que obrigaria a procurar o que se veio
 * corrigir.
 *
 * **O CORPO são dois slides, não um** (`SummaryDeck`): o resumo e, quando a
 * sessão tem uma, a transcrição, com os pontinhos em cima. A transcrição já
 * morou atrás do menu de três pontinhos, num diálogo; o porquê da mudança está
 * no cabeçalho do `SummaryDeck`.
 *
 * **E EDITAR é um botão do cabeçalho**, ao lado do menu, pela mesma razão
 * invertida: era a ação mais usada do menu, no meio das raras.
 */
type SavedSessionViewProps = {
  id: string;
  title: string;
  createdAtLabel: string;
  createdAtShortLabel: string;
  durationLabel: string;
  durationMs: number | null;
  speakerName: string | null;
  speakerLocation: string | null;
  /**
   * SE existe transcrição, não ELA.
   *
   * O texto viajava aqui dentro, no payload de toda abertura do resumo, e só
   * dois dos três usos que esta tela fazia dele queriam mais do que este
   * booleano. O terceiro — desenhá-lo — mora no segundo slide do `SummaryDeck`,
   * que busca o texto sozinho quando alguém desliza até ele. Ver a migração
   * 0061.
   *
   * Aqui ele decide também se existe um segundo slide: sem transcrição não há
   * carrossel nem pontinhos, e o resumo é desenhado direto.
   */
  hasTranscript: boolean;
  summary: SummaryPayload | null;
  /**
   * A barra do topo, montada pela PÁGINA e entregue pronta.
   *
   * Slot, e não um `backHref`: a `TopBar` é um server component (ela lê o
   * perfil e o saldo), e esta view é `"use client"` — daqui não há como
   * renderizá-la, só como receber o nó já pronto. É também o que trouxe o
   * voltar, a lupa e o avatar para cá: esta tela tinha um link "Voltar" de 12px
   * próprio, e abrir um cartão trocava o cabeçalho do app por outro.
   */
  header?: ReactNode;
  /**
   * Quanta ficha técnica o cabeçalho mostra.
   *
   * - `"full"` (padrão): local numa linha, e a data por extenso com a duração
   *   noutra (curta no celular, longa no desktop).
   * - `"compact"` (o `/summary`): local e data na MESMA linha, separados
   *   por um ponto, e a duração sai. É o cabeçalho do cartão do `/home`
   *   repetido aqui, para que abrir um cartão não pareça trocar de produto; e
   *   a duração some porque ela é do arquivo, não do sermão, ninguém abre um
   *   resumo para saber quantos minutos ele durou.
   *
   * Em `"compact"` quem manda a data já manda SIMPLIFICADA, em
   * `createdAtShortLabel`, "6 set" em vez de "06 de set. de 2026".
   */
  meta?: "full" | "compact";
  /**
   * Como esta sessão nasceu. Só `"manual"` muda alguma coisa aqui, e muda uma:
   * o menu perde "Gerar novamente".
   *
   * Ele refaz o resumo A PARTIR DA TRANSCRIÇÃO, e não há transcrição — a
   * chamada custaria 15 moedas para apagar o que a pessoa escreveu e pôr no
   * lugar um resumo de um texto vazio.
   *
   * "Algo está errado" CONTINUA em todo modo: numa sessão `manual` não há o que
   * auditar contra transcrição nenhuma, então a rota (`/api/hallucination-report`)
   * não chama modelo — só registra a nota como `acknowledged`, sem custo.
   *
   * (A transcrição some junto, mas não por aqui: quem some com o segundo slide
   * é o `hasTranscript`, que numa sessão `manual` é sempre falso.)
   *
   * **"Editar" não é mais uma delas**: o botão aparece em TODO modo. Um
   * resumo gerado é um texto sobre uma pregação, e a IA erra um nome ou perde a
   * frase que valia a mensagem inteira; consertar à mão custa um minuto, contra
   * 15 moedas de um reprocessamento que pode errar de novo. O que tornava isso
   * proibido era o editor conhecer menos tipos de bloco que o resumo, e não é
   * mais o caso — ver `WRITTEN_BLOCK_TYPES`.
   */
  mode?: SessionMode;
  /** A pasta da sessão, ou `null` para "sem pasta". Ver `src/lib/domain/folder.ts`. */
  folderId?: string | null;
};

export function SavedSessionView({
  id,
  title: initialTitle,
  createdAtLabel,
  createdAtShortLabel,
  durationLabel,
  durationMs,
  speakerName: initialSpeakerName,
  speakerLocation: initialSpeakerLocation,
  hasTranscript,
  summary,
  header,
  meta = "full",
  mode = "audio",
  folderId: initialFolderId = null,
}: SavedSessionViewProps) {
  const [titleDialogOpen, setTitleDialogOpen] = useState(false);
  const [speakerDialogOpen, setSpeakerDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveFolderOpen, setMoveFolderOpen] = useState(false);
  const [folderId, setFolderId] = useState(initialFolderId);
  // As pastas para o diálogo "Mover para pasta". `enabled` do próprio hook
  // espera o dono do cache, então chamar aqui sem o diálogo aberto não custa
  // nada: a Biblioteca (se aberta antes) já deixou a lista pronta.
  const { data: folders } = useFolders();
  // O CAMINHO até a pasta atual, para a pastilha do cabeçalho (ver abaixo).
  // Vazio enquanto a lista de pastas ainda não chegou (primeira visita sem
  // cache): a pastilha simplesmente não desenha nesse instante, e reaparece no
  // quadro seguinte — o mesmo tipo de espera que o resto da tela já tolera em
  // outros dados que vêm do cache do aparelho.
  const folderTrail = folderPath(folders ?? [], folderId);

  const router = useRouter();
  const refreshCoins = useCoinsStore((s) => s.refresh);
  // A Biblioteca guardada no aparelho. Apagar e renomear daqui mexem NELA, e
  // mexer no cache é como a lista concorda com o que acabou de acontecer sem
  // esperar uma volta ao servidor. Ver `features/session/query.ts`.
  const library = useLibraryWriter();
  // Todo caminho de criação termina AQUI — gravar, importar, escrever —, então
  // este é o lugar onde se descobre que a Biblioteca guardada no aparelho ainda
  // não sabe desta sessão. Ver `useLibrarySync`.
  useLibrarySync(id);

  const [title, setTitle] = useState(initialTitle);
  const [speakerName, setSpeakerName] = useState(initialSpeakerName);
  const [speakerLocation, setSpeakerLocation] = useState(initialSpeakerLocation);

  async function handleDelete() {
    // OTIMISTA: o cartão sai da Biblioteca ANTES da resposta. É o que permite
    // navegar para lá em seguida e encontrar a lista já sem ele — sem isto, a
    // pessoa apagaria um sermão, voltaria, e o veria ainda lá até a
    // revalidação chegar, o que se lê como "não apagou".
    const undo = library.remove(id);
    router.push("/home");

    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      undo();
      toast.error("Não foi possível excluir. Tente novamente.");
    }
  }

  async function handleReprocess() {
    if (reprocessing) return;
    setReprocessing(true);
    try {
      const res = await fetch("/api/final-summary/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 402 || body.error === "insufficient_balance") {
        toast.error("Moedas insuficientes para reprocessar.");
        return;
      }
      if (!res.ok) {
        toast.error("Não consegui reprocessar o resumo. Tente novamente.");
        return;
      }
      void refreshCoins();
      toast.success("Resumo atualizado.");
      // O resumo curto que o cartão usa na BUSCA acabou de mudar, e este é o
      // único caminho em que ele muda sem passar por `patchField`.
      void library.invalidate();
      router.refresh();
    } catch {
      toast.error("Falha de conexão ao reprocessar.");
    } finally {
      setReprocessing(false);
    }
  }

  async function patchField(field: "title" | "speakerName" | "speakerLocation", value: string) {
    const body = { [field]: value || null };
    // O mesmo de `handleDelete`, e pela mesma razão: o cartão da Biblioteca
    // mostra autor e título, e sem isto renomear aqui deixaria a lista com o
    // nome velho até a próxima revalidação. `speakerLocation` entra junto
    // porque a BUSCA procura por local, mesmo o cartão não o exibindo.
    const undo = library.patch(id, { [field]: value || null });
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("update failed");
    } catch (error) {
      undo();
      throw error;
    }
    if (field === "title") setTitle(value || title);
    else if (field === "speakerName") setSpeakerName(value || null);
    else setSpeakerLocation(value || null);
  }

  async function handleMoveToFolder(nextFolderId: string | null) {
    // Otimista nas DUAS pontas: o estado local (o que este diálogo mostra
    // marcado da próxima vez que abrir) e o cartão da Biblioteca guardado no
    // aparelho, pelo mesmo motivo de `patchField` acima — sem isto, voltar
    // para a Biblioteca mostraria a sessão na pasta antiga até a próxima
    // revalidação.
    const previousFolderId = folderId;
    const undo = library.patch(id, { folderId: nextFolderId });
    setFolderId(nextFolderId);
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: nextFolderId }),
      });
      if (!res.ok) throw new Error("update failed");
    } catch (error) {
      undo();
      setFolderId(previousFolderId);
      throw error;
    }
  }

  const initials = initialsOf(speakerName);
  const written = mode === "manual";

  return (
    // `pt-2`, e não o `py-8` de antes: a barra do topo encosta no alto da tela
    // como encosta na Biblioteca, senão o mesmo cabeçalho pousaria 30px mais
    // baixo ao abrir um cartão.
    // O provider da busca envolve a tela INTEIRA porque o botão dela mora na
    // `TopBar`, que chega pronta pelo slot `header` e é renderizada aqui
    // dentro: contexto anda pela posição de render, não pela de criação. Ver
    // `SummaryFind`.
    <SummaryFindProvider>
      <main className="mx-auto flex min-h-svh w-full max-w-[1024px] flex-col gap-6 px-4 pb-8 sm:gap-8 sm:px-6 sm:pb-10">
        <PageBlurOverlay
          open={reprocessing}
          title="Reprocessando o resumo"
          subtitle="Refazendo os pontos centrais da mensagem."
        />
        {header}
        {/* A barra da busca, quando aberta, entre o cabeçalho e o texto, e
            alinhada com a coluna de leitura — é nela que se procura. Ver
            `SummaryFind`. */}
        <SummaryFindBar />

        {/* A COLUNA DE LEITURA, mais estreita que a barra do topo.

            O `<main>` tem 1024px, e é ele que alinha a `TopBar` com a da
            Biblioteca: a barra é a mesma peça em toda tela do app, e ela
            terminar 256px antes aqui faria o avatar saltar de lugar ao abrir um
            cartão. O TEXTO fica em 768, porque a largura de um parágrafo não é
            largura de layout, é MEDIDA DE LINHA — a 1024 a linha passa de 120
            caracteres e o olho perde o começo da seguinte.

            Os diálogos e o `PageBlurOverlay` ficam FORA desta coluna de
            propósito: os primeiros são portais (não têm posição no fluxo) e o
            segundo cobre a tela inteira. **E é também o que a busca varre**: o
            termo não acende dentro de um diálogo fechado, que contaria
            ocorrências que ninguém vê. */}
        <SummaryFindArea className="mx-auto flex w-full max-w-3xl flex-col gap-6 sm:gap-8">
          {/* O holofote do passo "Título, autor e local são seus" recorta o
              cabeçalho INTEIRO, e não só o título: os três campos editáveis moram
              aqui, e apontar para um deles deixaria os outros dois sem explicação
              na única tela em que eles aparecem. */}
          <header data-tour="summary-header" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
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
                    {initials}
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
              <div className="flex items-center gap-2">
                <span
                  role="status"
                  aria-label="Sessão salva"
                  className="hidden items-center gap-1.5 rounded-full bg-scriba-mint px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-scriba-mint-accent sm:inline-flex"
                >
                  {/* VERDE (`mint-accent`) na bolinha E no texto. Eram
                      `mint-strong` (um cinza, #B3B4BA) e `mint-dark` (branco,
                      #F5F5F5): o chip dizia "Salvo" num cartão verde sem nada
                      verde dentro, o desenho exato de um indicador desligado.
                      É o mesmo par do chip do editor, ver `StatusChip` no
                      `Composer`. */}
                  <span className="size-1.5 rounded-full bg-scriba-mint-accent" />
                  Salvo
                </span>
                {/* EDITAR é um botão, e não mais um item do menu de três
                    pontinhos. Ele era a ação mais usada do menu e estava no
                    lugar das raras — apagar, reprocessar, reportar erro —, o
                    que cobrava dois toques por aquilo que se faz toda vez que a
                    IA erra um nome. A pastilha é a MESMA do "Adicionar autor"
                    (`ADD_BADGE_CLASSES`), porque é a mesma promessa: toque aqui
                    e conserte o que está na tela.

                    Ele é um `NavLink` e não um `button` com `push`: o destino é
                    uma ROTA, e como link ele ganha o abrir em nova aba, o
                    copiar endereço e o prefetch do router.

                    **E o `NavLink` é a parte que não é escolha de estilo.** O
                    editor é um pedaço grande de JavaScript, e o toque ficava
                    sem resposta nenhuma até a tela trocar — a reação natural de
                    quem usa é tocar de novo, que é como um clique vira três.

                    Quem gira é a PENA (`LinkPendingSwap`), e não um spinner ao
                    lado dela: a pastilha tem duas coisas dentro, e acrescentar
                    uma terceira faria a largura dela crescer no meio do clique,
                    empurrando o menu de três pontinhos para o lado. Trocando o
                    glifo, a pastilha não muda de tamanho — e o `spinner="none"`
                    é justamente o que desliga o spinner padrão do `NavLink`
                    para essa troca ser a única. O `prefetchOnPress` adianta a
                    rota INTEIRA no `pointerdown`, nos ~100ms entre o dedo
                    encostar e sair. Ver `NavLink`. */}
                {summary ? (
                  <NavLink
                    href={`/escrever/${id}`}
                    prefetchOnPress
                    spinner="none"
                    contentClassName="inline-flex items-center gap-1"
                    className={ADD_BADGE_CLASSES}
                  >
                    <LinkPendingSwap className="size-3">
                      <PenLine className="size-3" strokeWidth={2.5} />
                    </LinkPendingSwap>
                    Editar
                  </NavLink>
                ) : null}
                <SessionMenu
                  onDelete={() => setDeleteOpen(true)}
                  onReprocess={summary && !written ? handleReprocess : undefined}
                  reprocessing={reprocessing}
                  onReportHallucination={() => setReportOpen(true)}
                  onMoveToFolder={() => setMoveFolderOpen(true)}
                  written={written}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTitleDialogOpen(true)}
              className="group -mx-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-scriba-blue-soft/60"
            >
              <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-3xl md:text-4xl">
                {title}
                <Pencil className="ml-2 inline size-4 align-middle opacity-0 text-scriba-ink-mute transition-opacity group-hover:opacity-60" />
              </h1>
            </button>

            {/* A MARCAÇÃO da pasta, só quando a sessão está em uma — sem
                pasta não há pastilha nenhuma aqui, nunca "Sem pasta" escrito
                por extenso. O toque abre o MESMO `MoveToFolderDialog` do menu
                de três pontinhos: duas portas para o mesmo diálogo, uma para
                quem já sabe que quer mudar de pasta, outra para quem só
                queria confirmar em qual pasta está.

                **Ela mostra o CAMINHO, não a última pasta.** Com três níveis
                (migração 0069), "Romanos" sozinho não diz se é o Romanos de
                2025 ou o de 2026, e a Biblioteca permite os dois nomes
                justamente porque cada um mora numa mãe diferente. É a mesma
                migalha de pão do `LibraryBrowser`, sem os botões: aqui ela
                INFORMA, não navega. */}
            {folderTrail.length > 0 ? (
              <button
                type="button"
                onClick={() => setMoveFolderOpen(true)}
                className={cn(
                  "-mx-1 inline-flex w-fit max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-scriba-ink-soft outline-none transition-colors",
                  "hover:bg-scriba-blue-soft/60 hover:text-scriba-ink focus-visible:ring-2 focus-visible:ring-ring/40"
                )}
              >
                <FolderIcon
                  aria-hidden
                  strokeWidth={1.75}
                  className={cn(
                    "size-3.5 shrink-0",
                    FOLDER_ICON_INK[folderTrail[folderTrail.length - 1].color ?? "mist"]
                  )}
                />
                <span className="truncate">{folderTrail.map((f) => f.name).join(" › ")}</span>
              </button>
            ) : null}

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
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
                    {meta === "compact" ? (
                      <>
                        <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                        {createdAtShortLabel}
                      </>
                    ) : null}
                  </button>
                ) : (
                  <span className="inline-flex w-fit items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLocationDialogOpen(true)}
                      className={cn(ADD_BADGE_CLASSES, "w-fit")}
                    >
                      <Plus className="size-3" strokeWidth={2.5} />
                      Adicionar local
                    </button>
                    {meta === "compact" ? (
                      <span className="text-xs font-light text-scriba-ink-mute">
                        {createdAtShortLabel}
                      </span>
                    ) : null}
                  </span>
                )}
                {/* A ficha longa (data por extenso + duração) é do cabeçalho
                    `full`. No `compact` a data já subiu para a linha do local. */}
                {meta === "full" ? (
                  <p className="hidden text-[11px] font-light text-scriba-ink-mute sm:block">
                    {createdAtLabel}
                    {durationLabel ? ` · ${durationLabel}` : ""}
                  </p>
                ) : null}
              </div>
              {/* Aqui morava o "Gerar estudo" (`DeepenButton`), a única porta para
                  o `/studies` a partir de uma sessão. O modo estudo está saindo do
                  produto e, enquanto ele não sai de verdade, o acesso a ele foi
                  retirado da interface — com o botão, foram junto a consulta de
                  `hasDeepening` e a checagem de `study_generation` que a página
                  fazia só para desenhá-lo (ver `summary/[id]/page.tsx`). O
                  componente continua no repositório, inteiro, para o dia em que a
                  decisão for a outra.

                  Ele também era o motivo de este cabeçalho ter três colunas no
                  desktop; a data que morava debaixo dele continua onde estava. */}
              {/* No mobile a data fica embaixo; no desktop ela mora na coluna
                  esquerda, sob o local. No `compact` ela não está em nenhum dos
                  dois: mora na linha do local, como no cartão. */}
              {meta === "full" ? (
                <p className="text-[11px] font-light text-scriba-ink-mute sm:hidden">
                  {createdAtShortLabel}
                </p>
              ) : null}
            </div>
          </header>

          <div className="h-px w-full bg-scriba-hairline" />

          {/* O resumo e a transcrição, um ao lado do outro, com os pontinhos
              em cima da "Ideia central". Sem transcrição (toda sessão escrita à
              mão) o `SummaryDeck` devolve o resumo direto, sem trilho e sem
              pontinhos — ver o cabeçalho dele. */}
          <SummaryDeck sessionId={id} durationMs={durationMs} hasTranscript={hasTranscript}>
            <SummaryView summary={summary} hasTranscript={hasTranscript} running={false} />
          </SummaryDeck>
        </SummaryFindArea>

        <HallucinationReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          sessionId={id}
          onReprocess={summary && !written ? handleReprocess : undefined}
          written={written}
        />

        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={written ? "Excluir este texto?" : "Excluir este resumo?"}
          description={
            written
              ? "Este texto será apagado permanentemente. Esta ação não pode ser desfeita."
              : "O resumo e a transcrição desta gravação serão apagados permanentemente. Esta ação não pode ser desfeita."
          }
          confirmLabel="Excluir"
          pendingLabel="Excluindo…"
          onConfirm={handleDelete}
        />

        <MoveToFolderDialog
          open={moveFolderOpen}
          onOpenChange={setMoveFolderOpen}
          folders={folders ?? []}
          currentFolderId={folderId}
          onMove={handleMoveToFolder}
        />

        <TitleDialog
          open={titleDialogOpen}
          onOpenChange={setTitleDialogOpen}
          initialValue={title}
          onSave={(v) => patchField("title", v)}
        />

        <EntityFieldDialog
          kind="speaker"
          open={speakerDialogOpen}
          onOpenChange={setSpeakerDialogOpen}
          title={speakerName?.trim() ? "Editar autor" : "Adicionar autor"}
          placeholder="Nome do pregador"
          initialValue={speakerName ?? ""}
          fetchSuggestions={requestSpeakerSuggestions}
          onSave={(v) => patchField("speakerName", v)}
        />
        <EntityFieldDialog
          kind="location"
          open={locationDialogOpen}
          onOpenChange={setLocationDialogOpen}
          title={speakerLocation?.trim() ? "Editar local" : "Adicionar local"}
          placeholder="Igreja ou local"
          initialValue={speakerLocation ?? ""}
          fetchSuggestions={requestLocationSuggestions}
          onSave={(v) => patchField("speakerLocation", v)}
        />
      </main>
    </SummaryFindProvider>
  );
}
