import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { YoutubeImport } from "@/features/session/components/YoutubeImport";
import { fetchYoutubeVideoInfo } from "@/features/session/server/youtube/oembed";
import { getSessionMeta } from "@/lib/db/sessions";
import { parseYoutubeUrl } from "@/lib/domain/youtube";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSessionMeta(id);
  const name = session?.title?.trim() || "vídeo";
  return { title: `Importando: ${name}` };
}

/**
 * O lugar de uma sessão do modo YouTube ENQUANTO ela é importada.
 *
 * Mora ao lado do formulário que a dispara (`/importar`), e não sob
 * `/recording`, porque aqui não há microfone, cronômetro nem botão: o
 * trabalho é do servidor, e a página existe para esperar por ele.
 *
 * É orquestração pura: resolve a sessão, confere o modo, monta o componente.
 * Quem dispara a importação é o `YoutubeImport`.
 *
 * ## O vídeo aparece antes de o resumo existir
 *
 * A espera dura minutos, e até aqui a tela mostrava a URL crua — a única coisa
 * que ela tinha. Duas coisas a enchem agora, e nenhuma custa uma chamada paga:
 *
 * - **A miniatura é DERIVADA do id** (`youtubeThumbnailUrl`), sem rede nenhuma
 *   do nosso lado. Ela entra na hora, junto com o resto da página.
 * - **O título vem do oEmbed**, que é grátis e público, e entra por `Suspense`.
 *   Esperá-lo aqui atrasaria a montagem do `YoutubeImport`, e é ele quem
 *   DISPARA a importação no `useEffect`: um oEmbed lento adiaria o trabalho de
 *   verdade para mostrar um enfeite. Em streaming o título chega quando
 *   chegar, e enquanto isso o lugar dele é um esqueleto da mesma altura.
 *
 * É o mesmo oEmbed que a rota de importação chama depois da cobrança, e as
 * duas chamadas são de propósito: aquela decide o que vai para o BANCO (com o
 * modelo separando pregador, tema e igreja), esta só desenha uma linha de
 * texto que ninguém guarda.
 */
export default async function RecordingYoutubePage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSessionMeta(id);
  if (!session) notFound();

  // Guard de rota: uma sessão gravada pelo microfone não tem o que importar.
  if (session.mode !== "youtube") redirect(`/summary/${id}`);

  // Já importada, `ended_at` só é preenchido quando a transcrição foi gravada.
  // Voltar aqui (um "atrás" do navegador, um link velho) não pode redisparar
  // uma rota que cobra; a rota também recusa com 409, e este redirect é o que
  // evita a tela de espera piscando antes da recusa.
  if (session.endedAt) redirect(`/summary/${id}`);

  // Sem URL não há o que importar. Acontece se a linha foi criada fora do
  // diálogo; a rota devolveria `invalid_url` e a tela de erro seria um beco.
  if (!session.sourceUrl) redirect("/home");

  const parsed = parseYoutubeUrl(session.sourceUrl);
  if (!parsed) redirect("/home");

  return (
    <YoutubeImport
      sessionId={session.id}
      sourceUrl={session.sourceUrl}
      videoId={parsed.videoId}
      startMs={session.sourceStartMs}
      endMs={session.sourceEndMs}
      title={
        <Suspense
          fallback={
            <span
              aria-hidden
              className="block h-4 w-40 animate-pulse rounded-full bg-scriba-ink-mute/20"
            />
          }
        >
          <VideoTitle url={parsed.canonicalUrl} />
        </Suspense>
      }
    />
  );
}

/**
 * O título do vídeo, cru como o YouTube o mostra — com pregador, data e hora
 * colados, se for assim que o canal escreve. Aqui isso é o certo: a pessoa
 * está reconhecendo o vídeo que ela mandou importar, e o que ela viu no
 * YouTube foi exatamente esta linha. Quem separa os três pedaços é a ROTA, com
 * um modelo, e o resultado daquilo é o que vai para a Biblioteca.
 *
 * Falha do oEmbed devolve `null` e não desenha nada: é enfeite numa tela de
 * espera, e nada nele pode virar erro. Ver `youtube/oembed.ts`.
 */
async function VideoTitle({ url }: { url: string }) {
  const info = await fetchYoutubeVideoInfo(url);
  if (!info) return null;
  return (
    <>
      <span className="line-clamp-2 text-pretty text-[14px] font-medium leading-snug text-scriba-ink">
        {info.title}
      </span>
      {info.channel ? (
        <span className="text-[12px] font-light text-scriba-ink-mute">{info.channel}</span>
      ) : null}
    </>
  );
}
