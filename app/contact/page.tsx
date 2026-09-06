import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter, LandingHeader } from "@/shared/components/LandingChrome";

export const metadata: Metadata = {
  title: "Contato · Scriba",
  description: "Como falar com a equipe do Scriba: suporte, privacidade, imprensa e parcerias.",
  alternates: { canonical: "/contact" },
};

const CONTACT_EMAIL = "contato@scriba.cc";

export default function ContactPage() {
  return (
    <div className="w-full overflow-x-clip bg-background text-scriba-ink-strong antialiased">
      <LandingHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-16 text-scriba-ink-strong sm:px-6">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-scriba-ink-strong">
          Contato
        </h1>
        <p className="mb-10 text-sm text-scriba-ink-mute">
          Um endereço para tudo. A gente responde em português.
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-scriba-ink">
          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">E-mail</h2>
            <p>
              Fale com a equipe do Scriba pelo e-mail{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-scriba-blue-ink underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              . Costumamos responder em até 2 dias úteis. Descreva o que aconteceu com o máximo de
              detalhe possível — se for um problema numa gravação, diga a data e o modo de captura
              usado.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              Sobre o que escrever
            </h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Suporte e dúvidas de uso:</strong> problemas na gravação, na transcrição, no
                resumo, no login ou na cobrança de créditos.
              </li>
              <li>
                <strong>Privacidade e proteção de dados (LGPD):</strong> para acessar, corrigir,
                exportar ou excluir seus dados, ou tirar dúvidas sobre o tratamento. Os detalhes
                estão na{" "}
                <Link href="/privacy" className="text-scriba-blue-ink underline underline-offset-2">
                  Política de Privacidade
                </Link>
                .
              </li>
              <li>
                <strong>Imprensa e conteúdo:</strong> pedidos de informação, entrevistas e material
                sobre o produto.
              </li>
              <li>
                <strong>Parcerias e divulgação:</strong> igrejas, ministérios e criadores que
                queiram indicar o Scriba.
              </li>
              <li>
                <strong>Direitos autorais:</strong> notificações de conteúdo infrator, conforme a
                seção 13 dos{" "}
                <Link href="/terms" className="text-scriba-blue-ink underline underline-offset-2">
                  Termos de Uso
                </Link>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              Encerrar a conta
            </h2>
            <p>
              Você pode encerrar sua conta a qualquer momento nas configurações do perfil, ou pedir
              a exclusão pelo mesmo e-mail acima. Após o encerramento, os dados pessoais e as
              transcrições associadas são removidos conforme a Política de Privacidade.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-scriba-hairline-soft pt-6 text-xs text-scriba-ink-mute">
          <Link href="/about" className="text-scriba-blue-ink underline underline-offset-2">
            Sobre o Scriba
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="text-scriba-blue-ink underline underline-offset-2">
            Política de Privacidade
          </Link>{" "}
          · Scriba © {new Date().getFullYear()}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
