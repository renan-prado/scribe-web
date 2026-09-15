import type { MetadataRoute } from "next";
import { THEME_COLOR } from "@/shared/theme-color";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` fixa a identidade do app instalado. Sem ele o navegador usa a
    // `start_url` como identidade, e mudar a start_url amanhã faria o Chrome
    // tratar o Scriba como um app NOVO, o usuário ficaria com dois ícones e
    // sem os dados do primeiro.
    id: "/",
    name: "Scriba, Transcrição de sermões",
    short_name: "Scriba",
    description: "Transcrição e resumo de sermões em tempo real",
    // **O app instalado NUNCA abre na landing page.** Quem tocou no ícone já
    // foi convencido; a LP é material de venda, e cair nela ao abrir o app é
    // um passo a mais até o que a pessoa quer. `/sign-in` resolve os dois
    // casos sozinho: com sessão, o proxy manda direto para `/home`
    // (AUTH_ONLY_PREFIXES); sem sessão, é exatamente a tela necessária.
    //
    // O `id: "/"` acima é o que permite mexer nesta linha: sem ele a
    // identidade do app seria a `start_url`, e mudá-la faria o Chrome tratar o
    // Scriba como um app novo, dois ícones na tela inicial.
    start_url: "/sign-in",
    scope: "/",
    display: "standalone",
    // Windowing hints so the installed PWA looks native on desktop tray/dock.
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    // A tela de abertura do Android: fundo desta cor, o ícone no meio, o nome
    // embaixo. É o CHÃO DO APP, a mesma cor do `theme_color` logo abaixo e das
    // telas de abertura do iOS que `src/scripts/generate-splash.mjs` desenha —
    // abertura e primeira tela na mesma tinta, nos dois sistemas. Era
    // `#1C2349`, o índigo da hero antiga, uma cor que o produto não usa em
    // lugar nenhum desde que o app virou grafite: o app abria num clarão azul
    // para então ficar cinza. Antes disso era `#ffffff`, que era o mesmo erro
    // em branco. Mudou aqui? Mude lá.
    background_color: THEME_COLOR,
    // O GRAFITE do app, e não a cor do site. Este valor é o fallback de quem
    // abre sem JS e, mais importante, a cor que o sistema usa na abertura,
    // antes de a página existir: quem toca no ícone vai para `/sign-in` e daí
    // para `/home`, ou seja, o app instalado está SEMPRE na área logada, que
    // tem um tema só — e hoje o produto inteiro tem. A `<meta>` do root layout
    // diz a mesma coisa, e é ela que tem precedência com JS ligado. Ver
    // `src/shared/theme-color.ts`.
    theme_color: THEME_COLOR,
    lang: "pt-BR",
    dir: "ltr",
    categories: ["productivity", "utilities", "education"],
    // Abrir um link do Scriba com o app já aberto REAPROVEITA a janela em vez
    // de empilhar outra. Importa mais aqui do que na maioria dos apps: uma
    // segunda janela durante a gravação significa duas abas disputando o
    // microfone e dois cronômetros cobrando moedas.
    launch_handler: { client_mode: "navigate-existing" },
    // Prefer the app window when the OS resolves a Scriba link, matters for
    // "share to Scriba" style flows once we ship them.
    prefer_related_applications: false,
    // PNG, não SVG: o Chrome não aceita SVG para instalar o PWA nem para o
    // atalho na tela inicial, e ficava sem ícone utilizável. O `maskable`
    // reusa o mesmo arquivo porque o logo é um quadrado cheio e a pena tem
    // ~32% de margem de cada lado, bem dentro da zona segura de 10% que o
    // Android recorta.
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Atalhos do toque longo no ícone (Android) e do menu de contexto do dock
    // (desktop).
    //
    // **Gravar É um deles agora**, e não era: enquanto começar uma gravação
    // exigia escolher um modo num diálogo, não havia rota para apontar. Hoje
    // `/recording?auto=1` é exatamente o que o botão do rodapé faz — abre o
    // microfone e começa. É a ação mais urgente do produto (a pregação já
    // começou), e é a que mais ganha em economizar dois toques.
    //
    // Eram três, e duas apontavam para `/home`: uma delas se chamava "Feed",
    // de quando existia uma tela de acompanhamento separada da Biblioteca. Dois
    // atalhos para o mesmo destino é o menu do sistema mentindo sobre o app.
    shortcuts: [
      {
        name: "Gravar agora",
        short_name: "Gravar",
        description: "Abre o microfone e começa a gravar",
        url: "/recording?auto=1",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Biblioteca",
        short_name: "Biblioteca",
        description: "Suas sessões salvas e importadas",
        url: "/home",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Estudos",
        short_name: "Estudos",
        description: "Os aprofundamentos gerados",
        url: "/studies",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
