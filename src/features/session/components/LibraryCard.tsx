import { NavLink } from "@/components/NavLink";
import type { SessionListItem } from "@/lib/domain/session";
import { sessionDragProps } from "../lib/folder-dnd";
import { shortDate } from "../lib/formatting";
import { SessionModeGlyph } from "./SessionModeGlyph";

/**
 * Uma sessão como CARTÃO numa grade regular: mesma largura, mesma altura,
 * mesmo cinza.
 *
 * ## Ele não é o `SessionCard` de volta
 *
 * Aquele foi apagado quando `/recordings` virou redirect, e o que morreu com
 * ele foi o rodapé de metadados, as pastilhas de modo e de estudo, o botão
 * "Ver resumo →" e a paleta `--scriba-*` do app antigo. Aqui há quatro coisas:
 * autor, título, trecho e data. O que este cartão traz de volta não é aquele
 * desenho, é a GRADE — e a grade responde a uma pergunta que o mural não
 * responde.
 *
 * ## O que a grade tem e o mural não
 *
 * **A ordem.** O mural é masonry de colunas de CSS, e a leitura dele é
 * coluna-a-coluna: o segundo sermão mais recente cai ABAIXO do primeiro, não
 * ao lado. É consciente lá (o escalonamento é o desenho), e é exatamente o que
 * atrapalha quem tem duzentas gravações e quer percorrê-las na ordem em que
 * aconteceram. Num grid a cronologia é linha a linha, como se lê.
 *
 * **A comparabilidade.** Altura fixa e uma cor só fazem os cartões lerem como
 * itens da mesma lista, e não como bilhetes soltos num quadro. As quatro cores
 * do post-it são memória visual de um mural; numa grade regular elas viram
 * quatro retângulos coloridos disputando atenção em fileiras.
 *
 * O cinza é `--v2-card`, a MESMA superfície do chip da barra e do trilho das
 * abas, e não um quinto tom inventado para esta tela.
 *
 * **A altura é fixa e o trecho é cortado**, e não o contrário: um grid de
 * alturas iguais com conteúdos desiguais só tem essas duas saídas, e cortar o
 * trecho é a que preserva a fileira. Quem quiser o texto inteiro está a um
 * toque dele.
 *
 * É o `<li>` inteiro, como o post-it: quem usa põe o `<ul>`.
 */
export function LibraryCard({
  session: s,
  now,
  buildHref = (id) => `/summary/${id}`,
}: {
  session: SessionListItem;
  /** "Agora" vem do servidor, ver `LibraryNote`. */
  now: Date;
  buildHref?: (id: string) => string;
}) {
  const includeYear = new Date(s.createdAt).getFullYear() !== now.getFullYear();
  const excerpt = s.shortSummary?.trim();

  return (
    <li className="h-full" {...sessionDragProps(s.id)}>
      <NavLink
        href={buildHref(s.id)}
        prefetchOnPress
        spinner="overlay"
        contentClassName="flex h-full min-w-0 flex-col"
        className="block h-full rounded-2xl bg-v2-card p-4 outline-none transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute active:brightness-95"
      >
        {s.speakerName?.trim() ? (
          <span className="mb-2 truncate text-[11px] font-light leading-none text-v2-ink-mute">
            {s.speakerName.trim()}
          </span>
        ) : null}
        <span className="line-clamp-2 text-pretty text-[15px] font-normal leading-snug text-v2-ink">
          {s.title?.trim() || "Sessão sem título"}
        </span>
        {excerpt ? (
          <span className="mt-2 line-clamp-3 text-[12.5px] font-light leading-relaxed text-v2-ink-soft">
            {excerpt}
          </span>
        ) : null}
        {/* `mt-auto` prende a data no pé do cartão. Sem ele, um cartão sem
            trecho terminaria com a data logo abaixo do título e a fileira
            pareceria desalinhada, embora todos tenham a mesma altura. */}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[11px] font-light text-v2-ink-mute">
          <SessionModeGlyph mode={s.mode} />
          {shortDate(s.createdAt, includeYear)}
        </span>
      </NavLink>
    </li>
  );
}
