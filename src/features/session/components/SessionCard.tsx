import { BookOpen, FileText, MapPin, Mic } from "lucide-react";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { NavLink } from "@/components/NavLink";
import type { SessionListItem } from "@/lib/db/sessions";
import { cn } from "@/lib/utils";
import { formatDurationShort, shortDate } from "../lib/formatting";
import { initialsOf } from "../lib/text";
import { SessionCardMenu } from "./SessionCardMenu";

/**
 * O cartão de uma sessão salva. É o `<li>` inteiro: quem o usa põe o `<ul>`.
 *
 * Ele morava dentro do `SessionsBrowser` do `/recordings`, e saiu de lá quando
 * o `/v2/home` passou a listar as mesmas sessões: um cartão copiado é um
 * cartão que diverge do original no primeiro ajuste que alguém fizer num dos
 * dois. As duas listas mostram a mesma coisa, então mostram pelo mesmo
 * componente.
 *
 * O que veio junto e o que ficou de fora: as pastilhas de BUSCA (`verseHit`,
 * `transcriptOnlyHit`) são opcionais porque só a Biblioteca busca, o `/v2/home`
 * lista tudo e nunca as passa. O resto, modo, duração, orador, local, estudo
 * gerado, é da sessão, não da tela, e aparece sempre.
 *
 * **O `header` é a única coisa que muda de uma tela para a outra**, e a razão é
 * que o v2 está sendo desenhado enquanto o app de hoje está em produção:
 *
 * - `"mode"` (padrão, a Biblioteca) abre com o disco do MODO ao lado do título,
 *   e põe autor e local na linha de baixo do cartão.
 * - `"speaker"` (o `/v2/home`) abre com o AUTOR, no mesmo empilhamento do
 *   cabeçalho da página de resumo: avatar + nome, título, local. Quem lê uma
 *   lista de sermões procura pelo pregador tanto quanto pelo tema, e ter as duas
 *   telas falando a mesma língua é metade do valor de abrir uma a partir da
 *   outra.
 *
 * Sem autor, o empilhado perde a LINHA do autor e não o empilhamento: um avatar
 * "?" seria um rosto inventado para ninguém, mas trocar a anatomia do cartão no
 * meio da lista, por causa de um campo em branco, é pior, a lista passa a ter
 * dois desenhos e nenhum motivo visível para isso.
 *
 * Não leva `"use client"`: sem estado e sem hook, ele funciona como server
 * component no `/v2/home` e é empacotado no bundle do cliente quando o
 * `SessionsBrowser`, que é client, o importa.
 */
type Props = {
  session: SessionListItem;
  /** "Agora" vem de fora porque o `/recordings` o recebe do servidor: um
   * `new Date()` no cliente pode cair do outro lado da meia-noite em relação
   * ao HTML e derrubar a hidratação da página inteira por causa de um rótulo. */
  now: Date;
  /** A sessão já tem estudo gerado. */
  isDeepened: boolean;
  deleteAction: (formData: FormData) => Promise<void>;
  /** A referência bíblica que casou com a busca. Aparece mesmo quando o cartão
   * já casaria pelo título: ela não é justificativa, é informação, dizer QUAL
   * versículo daquele capítulo o pregador citou é metade do que se quer saber
   * ao procurar por "Jonas 1". */
  verseHit?: string | null;
  /** Casou pela transcrição e por mais nada visível no cartão, sem a pastilha
   * ele apareceria na lista sem nenhuma explicação para estar ali. */
  transcriptOnlyHit?: boolean;
  /** O que abre o cartão. Ver o cabeçalho deste arquivo. */
  header?: "mode" | "speaker";
  /** Para onde o cartão aponta. Toda sessão salva abre no resumo; quem passa a
   * função é quem sabe o prefixo da rota. */
  buildHref?: (id: string) => string;
};

export function SessionCard({
  session: s,
  now,
  isDeepened,
  deleteAction,
  verseHit = null,
  transcriptOnlyHit = false,
  header = "mode",
  buildHref = (id) => `/summary/${id}`,
}: Props) {
  const includeYear = new Date(s.createdAt).getFullYear() !== now.getFullYear();
  // Importada do YouTube: nunca passou por microfone nenhum, e o cartão precisa
  // dizer isso, o ícone de mic e a duração lidos juntos sugerem uma gravação
  // que a pessoa fez, e ela não fez.
  const isYoutube = s.mode === "youtube";
  const href = buildHref(s.id);
  const speaker = s.speakerName?.trim() ?? "";
  const location = s.speakerLocation?.trim() ?? "";
  const stacked = header === "speaker";
  const modeIcon = isYoutube ? <YoutubeIcon className="size-4" /> : <Mic className="size-4" />;

  return (
    <li
      // CARTÃO INTEIRO CLICÁVEL, por "stretched link": quem carrega o destino
      // continua sendo o `<a>` do título, e é o `::after` dele que se estica
      // até as bordas deste `<li>`. Envolver o cartão num `<a>` seria mais
      // simples e está errado: o menu de contexto é um `<button>`, e botão
      // dentro de link é HTML inválido e armadilha de teclado.
      //
      // `relative` aqui é o que dá ao `::after` uma caixa para preencher, e por
      // isso o link precisa deixar de ser `relative` (ver o `static` lá
      // embaixo).
      //
      // O retorno visual mora no próprio `::after`, como um véu de
      // `--scriba-ink-strong`, que INVERTE por tema: escurece no claro e
      // clareia no escuro, uma declaração só para os dois. Tinta chapada não
      // serviria, o fundo do cartão é `background-image` e uma cor de fundo
      // ficaria por baixo dele, invisível.
      //
      // `:active` alcança os ANCESTRAIS do elemento acionado, é o que faz
      // `group-active:` funcionar a partir de um <li> e o que dá retorno ao
      // toque no celular, onde `hover:` é código morto (ver
      // `src/shared/AGENTS.md`).
      className="group relative flex flex-col rounded-3xl border border-scriba-hairline-soft bg-[image:var(--feed-card)] bg-[size:200%_100%] p-5 transition-colors hover:border-scriba-ink-strong/20 sm:p-6"
    >
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start gap-2">
          <NavLink
            href={href}
            spinner="overlay"
            contentClassName={
              stacked ? "flex min-w-0 flex-col gap-2.5" : "flex min-w-0 items-center gap-2.5"
            }
            // `static` derruba o `relative` que o `spinner="overlay"` põe no
            // link: sem isso o `::after` se mediria pelo próprio link, e o
            // alvo pararia na linha do título. O `cn` do NavLink é
            // tailwind-merge, então a classe passada aqui vence a de lá.
            // De brinde, o véu de "carregando" do overlay também passa a
            // cobrir o cartão inteiro.
            className="static flex min-w-0 flex-1 rounded-md outline-none after:absolute after:inset-0 after:rounded-3xl after:transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 group-hover:after:bg-scriba-ink-strong/[0.035] group-active:after:bg-scriba-ink-strong/[0.07]"
          >
            {stacked ? (
              <>
                {/* Avatar e nome nas MESMAS medidas do cabeçalho do `/summary`
                    (`SavedSessionView`): disco de 24px, sigla de 10px, nome em
                    `text-sm`. Abrir o resumo a partir daqui não deve parecer
                    trocar de produto. */}
                {speaker ? (
                  <span className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-scriba-blue-soft text-[10px] font-semibold text-scriba-blue-ink">
                      {initialsOf(speaker)}
                    </span>
                    <span className="truncate text-sm font-medium leading-none text-scriba-ink">
                      {speaker}
                    </span>
                  </span>
                ) : null}
                {/* `leading-normal` (1.5) e não o `leading-tight` (1.25) do
                    cabeçalho `mode`: aqui o título é o meio de um
                    empilhamento de três, e um título de duas linhas apertadas
                    entre autor e local vira um bloco só. Lá ele é a primeira
                    linha do cartão e o apertado serve. */}
                <span className="text-pretty text-[15px] font-semibold leading-normal tracking-tight text-scriba-ink-strong sm:text-base">
                  {s.title?.trim() || "Sessão sem título"}
                </span>
                {/* Local e data na MESMA linha, separados por um ponto. A
                    data desceu do rodapé: ali ela dividia espaço com duração e
                    pastilhas, e três informações de peso igual na base do
                    cartão não são lidas, são varridas. Aqui ela fecha a
                    identificação da sessão, quem pregou, sobre o quê, onde e
                    quando. Sem local, a data vem sozinha, sem o ponto solto. */}
                <span className="inline-flex flex-wrap items-center gap-1.5 text-xs font-light text-scriba-ink-mute">
                  {location ? (
                    <>
                      <MapPin className="size-3 shrink-0" />
                      {location}
                      <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                    </>
                  ) : null}
                  {shortDate(s.createdAt, includeYear)}
                </span>
              </>
            ) : (
              <>
                {/* O VÉU (`.veil-chip`), o mesmo tratamento da pastilha de
                    referência bíblica. Era `bg-[image:var(--scriba-cta)]`, o
                    gradiente do BOTÃO primário: um bloco cheio, do peso de uma
                    ação, para marcar o TIPO da sessão, que é informação
                    passiva. Aqui o ícone só precisa ser legível, e o véu
                    entrega 8:1 sem competir com o título ao lado. */}
                <div className="veil-chip flex size-9 shrink-0 items-center justify-center rounded-lg">
                  {modeIcon}
                </div>
                <span className="text-pretty text-[15px] font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-base">
                  {s.title?.trim() || "Sessão sem título"}
                </span>
              </>
            )}
          </NavLink>
          {/* Acima do `::after` do link, senão o véu cobre o botão e o menu
              deixa de abrir. */}
          <div className="relative z-10">
            <SessionCardMenu sessionId={s.id} href={href} deleteAction={deleteAction} />
          </div>
        </div>
        {s.shortSummary?.trim() ? (
          /* O respiro extra some no cabeçalho `mode`: lá o resumo vem logo
             abaixo de uma linha só de título, e o `gap-2` do container basta.
             No empilhado ele vem depois de três linhas, e sem ele o cartão
             inteiro lê como um parágrafo só. */
          <p
            className={cn(
              "text-pretty text-[13px] font-light leading-snug text-scriba-ink-soft",
              stacked && "mt-3"
            )}
          >
            {s.shortSummary}
          </p>
        ) : null}
        {verseHit ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-scriba-blue-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-scriba-blue-ink">
            <BookOpen className="size-3" />
            {verseHit}
          </span>
        ) : null}
        {transcriptOnlyHit ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-scriba-mint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-scriba-mint-ink">
            <FileText className="size-3" />
            Trecho na transcrição
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {/* Autor e local moram aqui embaixo só no cabeçalho `mode`; no
            empilhado eles já abriram o cartão. */}
        {!stacked && (speaker || location) ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {s.speakerName?.trim() ? (
              <span className="text-[12px] font-medium text-scriba-ink">{s.speakerName}</span>
            ) : null}
            {s.speakerLocation?.trim() ? (
              <>
                <span className="text-scriba-ink-mute">·</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-light text-scriba-ink-mute">
                  <MapPin className="size-3" />
                  {s.speakerLocation}
                </span>
              </>
            ) : null}
          </span>
        ) : null}
        <div className="flex flex-col gap-3 border-t border-scriba-hairline pt-3 sm:flex-row sm:items-center sm:gap-2">
          {/* A fileira de metadados é do cabeçalho `mode`. No empilhado a data
              já está lá em cima, e duração e pastilhas saíram de vez: nenhuma
              das duas muda o que a pessoa faz na lista, e juntas ocupavam a
              linha inteira dizendo isso. O que sobra no rodapé é a ação. */}
          {stacked ? null : (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[11px] font-light text-scriba-ink-mute">
                {shortDate(s.createdAt, includeYear)}
              </span>
              {formatDurationShort(s.durationMs) ? (
                <>
                  <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                  <span className="text-[11px] font-light text-scriba-ink-mute">
                    {formatDurationShort(s.durationMs)}
                  </span>
                </>
              ) : null}
              {isYoutube ? (
                <>
                  <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                  <span
                    title="Importada de um vídeo do YouTube"
                    className="inline-flex items-center gap-1 rounded-full bg-scriba-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-scriba-cream-accent"
                  >
                    <YoutubeIcon className="size-3" />
                    YouTube
                  </span>
                </>
              ) : null}
              {isDeepened ? (
                <>
                  <span className="size-[3px] rounded-full bg-scriba-ink-mute/60" />
                  <span
                    title="Você já gerou o estudo deste sermão"
                    className="inline-flex items-center gap-1 rounded-full bg-scriba-blue-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-scriba-blue-ink"
                  >
                    <BookOpen className="size-3" />
                    Estudo
                  </span>
                </>
              ) : null}
            </div>
          )}
          <div className="sm:ml-auto">
            <NavLink
              href={href}
              className="inline-flex w-full items-center justify-center rounded-full bg-scriba-blue-soft px-4 py-2 text-[11px] font-semibold text-scriba-blue-ink transition-colors hover:bg-scriba-blue-soft/70 sm:w-auto"
            >
              Ver resumo →
            </NavLink>
          </div>
        </div>
      </div>
    </li>
  );
}
