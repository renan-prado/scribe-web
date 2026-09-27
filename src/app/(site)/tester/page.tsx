import type { Metadata } from "next";
import { formatCoins } from "@/features/billing/plans";
import { INITIAL_COIN_BALANCE } from "@/features/coins/pricing";
import { TESTER_GIFT_COINS } from "@/lib/domain/tester";
import { BibloFace } from "@/shared/brand/BibloFace";
import { BibloHeroFace } from "@/shared/brand/BibloHeroFace";
import { LandingFooter, LandingHeader, SectionLabel } from "@/shared/components/LandingChrome";
import { CoinMark } from "@/shared/icons/CoinMark";
import { MicGlyph } from "@/shared/icons/MicGlyph";
import { WriteGlyph } from "@/shared/icons/WriteGlyph";
import { YoutubeIcon } from "@/shared/icons/YoutubeIcon";
import { TesterSignupForm } from "./TesterSignupForm";

export const metadata: Metadata = {
  title: "Teste fechado no Android · Scriba",
  description:
    "Entre para a lista de testadores do Scriba no Android. Basta o e-mail da conta Google e um WhatsApp para receber o link do download assim que o Google liberar.",
  alternates: { canonical: "/tester" },
};

/**
 * O convite do teste fechado da Play Store.
 *
 * **Uma página só para uma fila manual**, e a fila é a razão de a página
 * existir: o Google Play não deixa baixar um app em teste fechado por link
 * público. Ele só aparece para quem tem o e-mail da conta Google dentro da
 * lista de testadores do console, e pôr um endereço lá é trabalho de gente.
 * Sem este formulário, o pedido chegaria por mensagem solta, sem o endereço
 * certo, e sem um lugar de onde copiar a lista em lote.
 *
 * **Ela é a metade de cima de um par.** Aqui a pessoa PEDE; em
 * `/tester/install` ela INSTALA, e as duas telas estão separadas porque
 * acontecem em dias diferentes: entre uma e outra há a espera do Google. Uma
 * página só teria de mostrar instruções que ainda não funcionam, e uma
 * instrução que falha na primeira tentativa é lida como app quebrado.
 *
 * **"O que acontece depois" só aparece DEPOIS.** Ele desce como `children`
 * do formulário e é renderizado no estado de sucesso, nunca antes. Antes de
 * enviar, aquela lista responde uma pergunta que ainda não foi feita e empurra
 * o formulário, que é a única coisa a fazer nesta tela, para fora da primeira
 * dobra do celular. Depois de enviar, ela é exatamente o que se quer ler, e
 * cai no lugar onde o olho já está.
 *
 * O markup dela continua sendo do SERVIDOR (é `children`, não uma prop de
 * dado), então nada disso custa JavaScript a mais.
 *
 * **Estática**, como as outras páginas de `(site)`: nada aqui lê cookie,
 * sessão ou header. Os pedaços vivos são dois, e os dois são componentes
 * cliente: o formulário, que fala com `/api/tester/signup`, e o rosto do
 * Biblo ao lado do título, que segue o ponteiro.
 *
 * **Fora do `sitemap.ts` de propósito.** O teste fechado é uma temporada, não
 * um pedaço do produto: listar o endereço é pedir um erro de cobertura no
 * Search Console no dia em que ele sair do ar. Ele segue rastreável e
 * indexável, como `/sign-in`.
 */

export default function TesterPage() {
  return (
    <div className="w-full overflow-x-clip bg-background text-scriba-ink-strong antialiased">
      <LandingHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="flex flex-col gap-4">
          <SectionLabel>Teste Fechado · Android</SectionLabel>
          {/* O rosto do Biblo ao lado do título, VIVO: o `BibloHeroFace`, o
              mesmo do hero da landing, com os olhos seguindo o ponteiro. Já foi
              o `BibloFace` estático aqui, e o preço de ser servidor puro era um
              personagem que não faz nada ao lado de um convite — parado, ele lê
              como ilustração, não como alguém convidando.

              O que ele custa é a `@blobatar/react` no bundle DESTA página, e a
              exceção é local: a regra de `src/app/AGENTS.md` sobre não importar
              `"use client"` para desenhar é da LANDING, que é a página que todo
              visitante anônimo carrega. Esta é o fim de um link compartilhado, e
              já traz um componente cliente (o formulário).

              A biblioteca não prende o driver sob `prefers-reduced-motion` nem
              sem ponteiro fino, então no celular isto é exatamente o rosto
              parado de antes, sem trabalho nenhum. */}
          <div className="flex items-center gap-4">
            <BibloHeroFace size={88} className="size-[88px]" />
            <h1 className="text-pretty text-3xl font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-4xl">
              Seja um testador do Scriba!
            </h1>
          </div>
          <p className="text-pretty text-[15px] leading-relaxed text-scriba-ink-soft">
            O app está em fase de teste fechado na Play Store (Google), o que quer dizer que ele só
            aparece para quem está em nossa lista de testadores.
          </p>
        </div>

        <WhatIsScriba />

        <div className="mt-12 flex flex-col gap-6">
          <TesterSignupForm>
            <WhatHappensNext />
          </TesterSignupForm>
          <p className="flex items-center gap-2.5 rounded-2xl border border-scriba-hairline bg-scriba-paper px-4 py-3 text-[14px] leading-relaxed text-scriba-ink">
            <CoinMark className="size-4 shrink-0 text-scriba-yellow" />
            <span className="text-pretty">
              Quem participar do nosso acesso antecipado ganha{" "}
              <strong className="font-semibold text-scriba-ink-strong">
                {formatCoins(TESTER_GIFT_COINS)} moedas de presente
              </strong>
              , além das {formatCoins(INITIAL_COIN_BALANCE)} que toda conta nova recebe.
            </span>
          </p>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

/**
 * "O que é o Scriba", ANTES do formulário.
 *
 * Quem cai aqui por um link compartilhado pode nunca ter visto a landing: o
 * convite pedia e-mail e telefone para instalar um app que a página não se
 * dava o trabalho de explicar. São as MESMAS quatro capacidades da `/`, na
 * mesma ordem (ver `Capabilities` e `HeroPromises` em `(site)/page.tsx`), em
 * uma frase cada. Capacidade nova lá é card novo aqui, ou as duas páginas
 * passam a vender produtos diferentes.
 *
 * **Resumida, não repetida.** A landing gasta uma seção com mockup em cada
 * uma porque a pergunta dela é "por que eu usaria isso?"; aqui a pessoa já
 * decidiu se interessar, e a pergunta é só "o que eu vou instalar?". Um bloco
 * comprido antes do formulário empurraria para fora da tela a única coisa que
 * há para fazer nesta página.
 *
 * **Os glifos são os do PRODUTO**, não os traçados à mão do hero da landing:
 * `MicGlyph`, `WriteGlyph` e `YoutubeIcon` são os mesmos que marcam o modo de
 * cada sessão dentro do app, e quem instalar vai reencontrá-los na
 * Biblioteca. O quarto não é glifo, é o ROSTO do Biblo, e ali ele é o
 * `BibloFace` estático: o vivo já está no título, e dois rostos seguindo o
 * ponteiro na mesma tela viram enfeite.
 */
function WhatIsScriba() {
  const items = [
    {
      icon: <MicGlyph className="size-4" />,
      title: "Grave e receba um resumo",
      body: "A pregação, a aula da EBD ou a reunião do grupo. O Scriba transcreve tudo e devolve um resumo organizado, com as ideias centrais e as referências bíblicas separadas.",
    },
    {
      icon: <WriteGlyph className="size-4" />,
      title: "Escreva suas próprias ideias",
      body: "Um editor com o vocabulário de um resumo: título, passagem bíblica, frase de destaque, citação e conclusão. Serve para começar do zero ou para lapidar o que foi gerado.",
    },
    {
      icon: <YoutubeIcon className="size-4" />,
      title: "Resuma um vídeo do YouTube",
      body: "Cole o link e o Scriba traz a legenda do vídeo e monta o mesmo resumo. Dá para importar só um trecho, quando a pregação está no meio de uma transmissão longa.",
    },
    {
      icon: <BibloFace size={18} className="size-[18px]" />,
      title: "Converse com o Biblo",
      body: "O expert nas Escrituras do Scriba tira dúvidas, sugere conteúdo para a anotação e aponta versículos relacionados ao que você está estudando.",
    },
  ];

  return (
    <section className="mt-12 flex flex-col gap-5 border-t border-scriba-hairline-soft pt-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-pretty text-xl font-semibold tracking-tight text-scriba-ink-strong">
          Scriba: o bloco de notas inteligente que todo cristão deveria ter
        </h2>
        <p className="text-pretty text-[14px] leading-relaxed text-scriba-ink-soft">
          Para quem ainda não conhece, o Scriba faz quatro coisas:
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.title}
            className="flex flex-col gap-2 rounded-2xl border border-scriba-hairline bg-scriba-paper px-4 py-4"
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-scriba-ink"
              >
                {item.icon}
              </span>
              <h3 className="text-[14.5px] font-semibold text-scriba-ink-strong">{item.title}</h3>
            </div>
            <p className="text-pretty text-[13.5px] font-light leading-relaxed text-scriba-ink-soft">
              {item.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Os quatro passos entre o envio do formulário e as moedas na conta. Só é
 * renderizado depois do envio, ver o cabeçalho da página.
 */
function WhatHappensNext() {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-scriba-ink-strong">O que acontece agora</h2>
      <ol className="flex flex-col gap-5">
        <Step n={1} title="O e-mail entra na lista de testadores">
          Quem guarda essa lista é o console do Google Play, e o que entra nela é o e-mail da conta
          Google do seu celular. Isso é feito no mesmo dia.
        </Step>
        <Step n={2} title="O Google leva algumas horas para liberar">
          Esta é a parte que ninguém controla. Depois que o endereço entra na lista, o Google ainda
          precisa propagar a liberação, e isso costuma levar de duas a quatro horas, podendo passar
          disso. Antes desse prazo o link do app responde que a página não foi encontrada, e não é
          erro seu.
        </Step>
        <Step n={3} title="O link chega no WhatsApp">
          Assim que liberar, a mensagem vem com o link e o passo a passo. São dois toques: aceitar o
          convite e instalar.
        </Step>
        <Step n={4} title="As moedas de presente ficam esperando">
          Basta entrar no app com essa mesma conta Google: o presente de{" "}
          {formatCoins(TESTER_GIFT_COINS)} moedas aparece na Biblioteca, num cartão com o botão de
          resgatar, e fica lá até ser tocado.
        </Step>
      </ol>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-scriba-ink-strong text-[12px] font-semibold text-background"
      >
        {n}
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[15px] font-semibold text-scriba-ink-strong">{title}</h3>
        <p className="text-pretty text-[14px] leading-relaxed text-scriba-ink-soft">{children}</p>
      </div>
    </li>
  );
}
