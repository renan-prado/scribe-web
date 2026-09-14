import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter, LandingHeader } from "@/shared/components/LandingChrome";

export const metadata: Metadata = {
  title: "Sobre o Scriba · Scriba",
  description:
    "O que é o Scriba, para quem ele foi feito e como funciona a transcrição e o resumo de sermões em tempo real.",
  alternates: { canonical: "/about" },
};

const CONTACT_EMAIL = "contato@scriba.cc";

export default function AboutPage() {
  return (
    <div className="w-full overflow-x-clip bg-background text-scriba-ink-strong antialiased">
      <LandingHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-16 text-scriba-ink-strong sm:px-6">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-scriba-ink-strong">
          Sobre o Scriba
        </h1>
        <p className="mb-10 text-sm text-scriba-ink-mute">
          Transcrição e resumo de pregações, para quem ouve.
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-scriba-ink">
          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">O que é</h2>
            <p>
              O Scriba é um aplicativo web em português que acompanha uma pregação ao vivo pelo
              microfone do celular ou do computador. Enquanto o pregador fala, o Scriba transcreve o
              que é dito, reconhece as passagens bíblicas citadas e separa as frases mais
              importantes. Quando a mensagem termina, você recebe um resumo estruturado: ideia
              central, pontos principais, versículos citados, frases marcantes e aplicações para a
              semana.
            </p>
            <p className="mt-2">
              Ele roda inteiramente no navegador, sem instalar nada e sem gravador externo. Se
              quiser, dá para adicioná-lo à tela inicial e abrir como um app comum (PWA).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              Para quem foi feito
            </h2>
            <p>
              Para quem ouve, e não para quem prega. Membros que querem lembrar da mensagem durante
              a semana, líderes de célula e pequenos grupos preparando a discussão, estudantes de
              teologia e qualquer pessoa que acompanhe pregações e queira revisá-las depois. O
              vocabulário é bíblico e teológico, em português do Brasil.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">Como funciona</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Durante o sermão:</strong> o celular grava e a tela fica quieta. É de
                propósito: o Scriba é para quem quer prestar atenção na pregação, não olhar o
                aparelho.
              </li>
              <li>
                <strong>Depois do amém:</strong> o áudio é transcrito e um resumo único e
                estruturado é gerado a partir da transcrição inteira.
              </li>
              <li>
                <strong>Durante a semana:</strong> a partir de um sermão salvo você gera um estudo
                de aprofundamento, relê a transcrição e consulta qualquer versículo citado.
              </li>
            </ul>
            <p className="mt-2">
              A cobrança é em créditos, por minuto iniciado de gravação, com a transcrição e o
              resumo já inclusos. Você também pode importar um vídeo do YouTube e receber o mesmo
              resumo a partir da legenda, por um preço fechado por vídeo. A conta começa gratuita,
              com créditos de boas-vindas e sem cartão.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              Inteligência artificial, com responsabilidade
            </h2>
            <p>
              As transcrições, os versículos reconhecidos e os resumos são produzidos com apoio de
              modelos de inteligência artificial (atualmente da OpenAI). Esses modelos podem errar,
              inclusive em citações bíblicas e teológicas. O Scriba não é fonte doutrinária oficial
              e não substitui aconselhamento pastoral, teológico ou profissional, revise o que for
              ensinar ou publicar. O áudio bruto não é retido após o processamento; a transcrição e
              o resumo ficam na sua conta, privados por padrão.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">Quem mantém</h2>
            <p>
              O Scriba é um produto independente, desenvolvido e operado por sua equipe no Brasil.
              Para dúvidas, suporte, imprensa ou parcerias, fale com a gente pelo e-mail{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-scriba-blue-ink underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              ou pela página de{" "}
              <Link href="/contact" className="text-scriba-blue-ink underline underline-offset-2">
                contato
              </Link>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-scriba-hairline-soft pt-6 text-xs text-scriba-ink-mute">
          <Link href="/privacy" className="text-scriba-blue-ink underline underline-offset-2">
            Política de Privacidade
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="text-scriba-blue-ink underline underline-offset-2">
            Termos de Uso
          </Link>{" "}
          · Scriba © {new Date().getFullYear()}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
