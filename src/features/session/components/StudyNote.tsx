import { BookOpen, FileText } from "lucide-react";
import type { DeepeningListItem } from "@/lib/db/deepenings";
import { shortDate } from "../lib/formatting";
import { PostItNote } from "./PostItNote";

/**
 * O post-it de um ESTUDO, o cartão dos Estudos. É o `<li>` inteiro: quem o usa
 * põe o `<ul>`.
 *
 * Mesma casca da Biblioteca (`PostItNote`), outro recheio. As duas telas são
 * murais do mesmo acervo — uma guarda o que foi pregado, a outra o que se
 * estudou a partir dali —, e enquanto uma era um mural de anotações e a outra
 * uma lista de fichas, trocar de aba parecia trocar de produto.
 *
 * **O cartão passa o id da SESSÃO como cor**, não o do estudo: assim o estudo
 * nasce da mesma cor do sermão que o gerou, e os dois murais se respondem.
 *
 * O que CAIU do cartão antigo, e não foi pouco: a abertura do estudo, a
 * pastilha do ícone, o bloco "Baseado em" com título, autor, data e duração do
 * sermão, e o link para o resumo. É a mesma conta do post-it da Biblioteca —
 * numa coluna de ~150px, cada linha a mais empurra a data para fora do
 * primeiro olhar —, e o caminho para o sermão continua existindo dentro do
 * próprio estudo, que é onde ele é lido.
 *
 * O que ficou é a mesma tripla: o autor da pregação em cima, o título do
 * estudo no meio, a data em que ele foi gerado embaixo.
 *
 * **A linha do `hint` ficou, e na Biblioteca as pastilhas equivalentes não.**
 * Lá o cartão nomeia o que foi buscado (o sermão é o próprio cartão); aqui a
 * busca também casa pela transcrição e pelos versículos de um sermão que o
 * post-it do estudo nem cita, e "por que este cartão está aqui?" fica sem
 * resposta nenhuma. É a saída que o cabeçalho do `LibraryBrowser` já previa:
 * uma marca no cartão do RESULTADO, não o resumo de volta em todos eles.
 *
 * **Não há glifo de modo no rodapé.** Na Biblioteca ele distingue gravação de
 * importação; aqui todo cartão é um estudo, e um ícone que nunca muda não é
 * informação, é enfeite ocupando a linha da data.
 */
type Props = {
  study: DeepeningListItem;
  /** "Agora" vem do servidor, pela mesma razão do `LibraryNote`: o ano da data
   *  não pode divergir entre o HTML e a hidratação. */
  now: Date;
  /** A referência que casou no versículo, quando a busca achou o estudo por
   *  algo que o cartão não mostra. */
  verseHit?: string | null;
  /** Verdadeiro quando o que casou está na transcrição do sermão. */
  transcriptHit?: boolean;
};

export function StudyNote({ study: s, now, verseHit, transcriptHit }: Props) {
  const includeYear = new Date(s.createdAt).getFullYear() !== now.getFullYear();

  return (
    <PostItNote
      colorKey={s.sessionId}
      href={`/studies/${s.sessionId}`}
      eyebrow={s.sessionSpeakerName?.trim() || null}
      title={s.studyTitle}
      // A linha que explica um casamento invisível. Ela é da COR do cartão, e
      // não uma pastilha azul ou verde: sobre quatro papéis diferentes, uma
      // pastilha de cor fixa some em uns e grita em outros — e o que ela diz é
      // um detalhe da busca, não um selo.
      hint={
        verseHit ? (
          <>
            <BookOpen aria-hidden className="size-3.5 shrink-0 -translate-y-[1.5px]" />
            {verseHit}
          </>
        ) : transcriptHit ? (
          <>
            <FileText aria-hidden className="size-3.5 shrink-0 -translate-y-[1.5px]" />
            Trecho na transcrição
          </>
        ) : null
      }
      footer={shortDate(s.createdAt, includeYear)}
    />
  );
}
