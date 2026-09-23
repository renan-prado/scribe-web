import type { Metadata } from "next";
import { YoutubeUrlForm } from "@/features/session/components/YoutubeUrlForm";
import { extractYoutubeUrl, parseClipRange, parseTimecode } from "@/lib/domain/youtube";
import { SearchTrigger } from "../components/SearchTrigger";
import { TopBar } from "../components/TopBar";

export const metadata: Metadata = { title: "Importar do YouTube" };

type PageProps = {
  searchParams: Promise<{
    url?: string;
    /** O que uma folha de compartilhamento entrega: texto com o link no meio. */
    text?: string;
    /** O id cru, a forma mais curta de montar um link para cá. */
    v?: string;
    inicio?: string;
    fim?: string;
  }>;
};

/**
 * `/importar`, onde se cola o link de um vídeo.
 *
 * Página própria, e não um passo dentro do diálogo de gravação: escolher COMO
 * capturar e escolher QUAL vídeo são duas perguntas, e o diálogo responde a
 * primeira. Ver o cabeçalho de `YoutubeUrlForm`.
 *
 * Ela não lê nada do servidor, a linha da sessão só nasce quando o formulário
 * é enviado. O saldo de moedas, que o formulário consulta, vem da gaveta da
 * `TopBar`.
 *
 * ## O endereço aceita o vídeo por parâmetro
 *
 * ```
 * /importar?url=https://youtu.be/XXXXXXXXXXX
 * /importar?v=XXXXXXXXXXX
 * /importar?text=Assista%20isso%20https://youtu.be/XXXXXXXXXXX   (compartilhamento)
 * /importar?url=…&inicio=12:00&fim=45:30
 * ```
 *
 * Existe para o COMPARTILHAMENTO: o caminho natural de um vídeo até aqui é
 * alguém mandando o link, e hoje esse alguém tem de abrir o app, achar a porta
 * e colar. Com a URL pronta, o mesmo link vira um destino — e quando o
 * `share_target` do manifest existir, é este endereço que ele vai alimentar,
 * sem nada de novo do lado de cá. O `text=` já está aqui porque é o campo que
 * a folha de compartilhamento do Android manda, e ele quase nunca vem limpo:
 * `extractYoutubeUrl` acha o link no meio da frase.
 *
 * **O que a URL NÃO faz é importar.** Ela preenche o campo, e o botão continua
 * sendo a única porta: a rota seguinte cobra 30 moedas, e um endereço que
 * dispara sozinho transforma um link colado num grupo (ou um prefetch do
 * navegador) em débito na conta de quem abriu.
 *
 * Parâmetro que não faz sentido é IGNORADO, nunca vira erro na tela: quem
 * chega por um link torto vê o formulário vazio, que é o estado de sempre, e
 * não uma tela de erro sobre algo que ela não digitou.
 *
 * **A barra é a do `/summary`**: um voltar no lugar do hambúrguer, sem título,
 * com a lupa e o avatar de sempre. É uma tela de uma tarefa só, aberta a partir
 * do menu, e o que ela precisa oferecer é a saída — o nome dela já está escrito
 * no formulário, duas linhas abaixo.
 *
 * **E o formulário fica no MEIO da tela** (`flex-1` + `justify-center`). São
 * três linhas de conteúdo numa página inteira: encostadas no topo, sob uma
 * barra quase vazia, elas ficavam penduradas com meia tela de vão embaixo.
 */
export default async function ImportarPage({ searchParams }: PageProps) {
  const { url, text, v, inicio, fim } = await searchParams;

  // A ordem é da mais explícita para a mais bagunçada. `v` é montado à mão em
  // link nosso; `url` é o campo do compartilhamento; `text` é a frase inteira.
  const shared = [v ? `https://www.youtube.com/watch?v=${v}` : null, url, text]
    .map((candidate) => (candidate ? extractYoutubeUrl(candidate) : null))
    .find((parsed) => parsed !== null && parsed !== undefined);

  // O recorte só é oferecido quando há vídeo: dois campos de tempo sobre um
  // formulário vazio perguntam sobre um vídeo que ninguém escolheu.
  const start = shared ? (inicio ? parseTimecode(inicio) : shared.startMs) : null;
  const end = shared && fim ? parseTimecode(fim) : null;
  const range = parseClipRange(start, end);
  const clip = range.ok ? range.clip : null;

  return (
    <main className="mx-auto flex w-full max-w-[1024px] flex-1 flex-col px-4 pb-10">
      {/* Sem `MobileActionBar` nesta tela (ela É uma porta de criação, não
          teria sentido abrir outra a partir dela), a lupa fica visível no
          celular também — `mobileVisible`, ver o cabeçalho de `SearchTrigger`. */}
      <TopBar backHref="/home" trailing={<SearchTrigger mobileVisible />} />
      <div className="flex flex-1 flex-col justify-center">
        <YoutubeUrlForm
          initialUrl={shared?.canonicalUrl ?? ""}
          initialStartMs={clip?.startMs ?? null}
          initialEndMs={clip?.endMs ?? null}
        />
      </div>
    </main>
  );
}
