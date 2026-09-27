import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter, LandingHeader, SectionLabel } from "@/shared/components/LandingChrome";
import { PLAY_STORE_URL, TESTING_OPT_IN_URL } from "../links";

export const metadata: Metadata = {
  title: "Como instalar o Scriba no Android · Scriba",
  description:
    "Os três passos do teste fechado do Scriba na Play Store: aceitar o convite de testador, instalar o app e entrar com a conta cadastrada.",
  alternates: { canonical: "/tester/install" },
};

/**
 * As instruções, numa página AVULSA de propósito.
 *
 * Ela existe para ser colada num WhatsApp. É o link que a pessoa recebe horas
 * (ou dias) depois de se cadastrar em `/tester`, e por isso não depende de
 * nada que tenha acontecido antes: quem cai aqui direto, sem ter lido a outra
 * página, lê uma instrução completa e encontra no fim o caminho de volta para
 * o pré-cadastro, caso ainda não esteja na lista.
 *
 * **Os dois primeiros passos são dois links, e a ordem importa.** A ficha do
 * app só existe para quem já aceitou o convite; aberta antes, ela responde que
 * a página não foi encontrada. É esse "não encontrado" que faz a pessoa achar
 * que o app não existe, e é contra ele que a página inteira está escrita.
 *
 * **Sem print das telas do Google Play.** Houve aqui uma reprodução em HTML de
 * cada uma delas, e as duas saíram: o texto de cada passo já nomeia o botão a
 * ser tocado ("Tornar-se um testador", "Instalar"), e a imagem só repetia a
 * frase acima dela em outro formato. Se voltarem, que voltem em HTML, nunca
 * como print: um print carrega a TRILHA de quem o tirou ("acesso antecipado
 * interno"), e quem chega por aqui entra pelo teste fechado e lê outro nome.
 *
 * **Estática**, como as irmãs de `(site)`.
 */
export default function TesterInstallPage() {
  return (
    <div className="w-full overflow-x-clip bg-background text-scriba-ink-strong antialiased">
      <LandingHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="flex flex-col gap-4">
          <SectionLabel>Teste Fechado · Android</SectionLabel>
          <h1 className="text-pretty text-3xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-4xl">
            Como instalar o Scriba
          </h1>
        </div>

        <ol className="mt-12 flex flex-col gap-14">
          <li className="flex flex-col gap-5">
            <StepHead n={1} title="Aceite ser um testador" />
            <p className="text-pretty text-[14.5px] leading-relaxed text-scriba-ink-soft">
              Abra o link abaixo e toque em <Strong>Tornar-se um testador</Strong>.
            </p>
            <PlayLink href={TESTING_OPT_IN_URL} label="Abrir a página do convite" />
          </li>

          <li className="flex flex-col gap-5">
            <StepHead n={2} title="Baixe o app" />
            <p className="text-pretty text-[14.5px] leading-relaxed text-scriba-ink-soft">
              Após aceitar, abra o link da loja e toque em <Strong>Instalar</Strong>. O app
              aparecerá com o rótulo <Strong>(acesso antecipado)</Strong>.
            </p>
            <PlayLink href={PLAY_STORE_URL} label="Abrir o app na Play Store" />
          </li>

          <li className="flex flex-col gap-5">
            <StepHead n={3} title="Entre com a mesma conta Google" />
            <p className="text-pretty text-[14.5px] leading-relaxed text-scriba-ink-soft">
              Crie uma conta no Scriba com o mesmo e-mail que você usou para aceitar o convite.
              Assim as moedas de presente estarão disponíveis para serem resgatadas.
            </p>
          </li>
        </ol>

        <section className="mt-16 flex flex-col gap-5 rounded-3xl border border-scriba-hairline bg-scriba-paper px-5 py-7 sm:px-7">
          <h2 className="text-lg font-semibold text-scriba-ink-strong">
            Se aparecer que a página não foi encontrada
          </h2>
          <p className="text-pretty text-[14px] leading-relaxed text-scriba-ink-soft">
            É o sintoma normal de quem ainda não foi liberado, e quase sempre é uma destas três
            coisas:
          </p>
          <ul className="flex flex-col gap-3 text-[14px] leading-relaxed text-scriba-ink-soft">
            <Bullet>
              <Strong>Ainda não passou o tempo.</Strong> Depois que o e-mail entra na lista, o
              Google leva algumas horas para propagar a liberação. Antes disso os dois links
              respondem a mesma coisa.
            </Bullet>
            <Bullet>
              <Strong>O celular está em outra conta.</Strong> Se você tem mais de uma conta Google
              no aparelho, a Play Store pode estar aberta na que não foi cadastrada. Troque a conta
              na loja e abra o link de novo.
            </Bullet>
            <Bullet>
              <Strong>Você pulou o passo 1.</Strong> A ficha do app só existe depois que o convite é
              aceito. Volte ao primeiro link e confira se o botão virou uma mensagem dizendo que
              você é um testador.
            </Bullet>
          </ul>
          <p className="text-pretty text-[14px] leading-relaxed text-scriba-ink-soft">
            Continuou assim depois de um dia? Responda no mesmo WhatsApp ou escreva pelo{" "}
            <Link
              href="/contact"
              className="font-medium text-scriba-ink-strong underline underline-offset-2"
            >
              contato
            </Link>
            , para uma conferência na lista.
          </p>
        </section>

        <div className="mt-12 border-t border-scriba-hairline-soft pt-8 text-[14px] leading-relaxed text-scriba-ink-soft">
          Ainda não pediu acesso? O pré-cadastro fica em{" "}
          <Link
            href="/tester"
            className="font-medium text-scriba-ink-strong underline underline-offset-2"
          >
            scriba.cc/tester
          </Link>
          .
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-scriba-ink-strong text-[13px] font-semibold text-background"
      >
        {n}
      </span>
      <h2 className="text-xl font-semibold tracking-tight text-scriba-ink-strong">{title}</h2>
    </div>
  );
}

/**
 * Os dois links da loja abrem em outra aba: no celular quem atende é o
 * aplicativo da Play Store, e trocar a aba atual por ele deixaria a pessoa
 * sem as instruções no meio do passo a passo.
 */
function PlayLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="scriba-cta inline-flex items-center justify-center gap-2 self-start rounded-full bg-[image:var(--scriba-cta)] px-5 py-3 text-[13px] font-semibold text-scriba-cta-ink"
    >
      {label}
      <ExternalLink aria-hidden className="size-4" strokeWidth={2.2} />
    </a>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-scriba-ink-mute" />
      <span className="text-pretty">{children}</span>
    </li>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-scriba-ink-strong">{children}</span>;
}
