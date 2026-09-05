import type { Metadata, Viewport } from "next";
import { Fira_Mono, Geist, Geist_Mono, Poppins } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { PageTransition } from "@/components/PageTransition";
import { Providers } from "@/components/Providers";
import { PwaBootstrap } from "@/components/PwaBootstrap";
import { ThemedToaster } from "@/components/ThemedToaster";
import { ThemeScript } from "@/components/ThemeScript";
import { IS_INDEXABLE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo";
import { APPLE_STARTUP_IMAGES } from "@/shared/splash";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const firaMono = Fira_Mono({
  variable: "--font-fira-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

/**
 * `viewport-fit=cover` é o que faz `env(safe-area-inset-*)` deixar de valer
 * zero. Sem ele, no iPhone o app instalado desenha a nav inferior por baixo da
 * barra do indicador de início — o dedo acerta o gesto do sistema, não o botão.
 * Quem consome os insets é a `MobileBottomNav`.
 *
 * O zoom fica LIBERADO de propósito (`maximumScale: 5`, sem `userScalable`):
 * travar o pinch é a violação de acessibilidade mais comum em PWA, e o app é
 * lido em letra pequena dentro de igreja.
 *
 * `theme-color` NÃO entra aqui — ver `ThemeScript`.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "transcrição de sermões",
    "transcrever sermão",
    "resumo de pregação",
    "aplicativo para estudo bíblico",
    "anotar sermão",
    "citações bíblicas automáticas",
    "IA para igrejas",
    "scriba",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  // Fora de produção o `noindex` vem junto com o `Disallow: /` de
  // `app/robots.ts`: o robots impede o rastreio, a meta tag cobre a URL que já
  // tenha sido descoberta por um link. Ver `IS_INDEXABLE` em `lib/seo.ts`.
  robots: {
    index: IS_INDEXABLE,
    follow: IS_INDEXABLE,
    googleBot: {
      index: IS_INDEXABLE,
      follow: IS_INDEXABLE,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Os SVGs por tema ficam AQUI porque a convenção de arquivo do Next emite
  // um <link> sem `media`, e só o bloco de metadata expressa o
  // `prefers-color-scheme`.
  //
  // Eles NÃO bastam sozinhos, e é por isso que `app/favicon.ico` voltou a
  // existir (agora com a marca certa, não a do scaffold): o Google não
  // aceita SVG como favicon — a lista dele é BMP, GIF, ICO, PNG, JPEG, PPM
  // e TIFF — e um rastreador não avalia `media`. Sem o .ico o site ficava
  // sem nenhum ícone indexável, e a busca seguia mostrando o antigo.
  // Os dois convivem: o .ico entra pela convenção de arquivo e este bloco
  // continua valendo para o navegador.
  icons: {
    icon: [
      {
        url: "/brand/favicon-light-theme.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/brand/favicon-dark-theme.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    // Declarado à mão porque este bloco suprime a convenção `app/apple-icon`
    // (o `favicon.ico` é a única que sobrevive a ele). Sem esta linha o
    // arquivo era servido em /apple-icon.png mas nenhum <link> apontava para
    // ele, e o iOS caía no screenshot da página ao salvar na tela inicial.
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Instalado na tela inicial, o app abre SEM a moldura do Safari. O `capable`
  // emite `mobile-web-app-capable` (o nome moderno; a variante `apple-` legada
  // está no <head> abaixo, para iOS anterior ao 16.4).
  //
  // `statusBarStyle: "default"` mantém a barra de status OPACA e deixa o
  // sistema pintá-la com a nossa `theme-color`. A alternativa
  // (`black-translucent`) empurraria o conteúdo para baixo da barra, e aí o
  // header do app apareceria por trás do relógio.
  appleWebApp: {
    capable: true,
    title: "Scriba",
    statusBarStyle: "default",
    // A tela de abertura no iOS. Sem estes arquivos o iPhone abre o app numa
    // tela BRANCA vazia — ele ignora o `background_color` do manifest, que é o
    // que resolve o mesmo problema no Android. Ver `src/shared/splash.ts`.
    startupImage: APPLE_STARTUP_IMAGES,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `data-scroll-behavior="smooth"` acompanha o `scroll-behavior: smooth` que
    // o CSS declara no <html> para as âncoras da landing. Sem ele o Next avisa
    // no console e, pior, o rolar suave continua valendo na troca de rota — a
    // página desliza inteira em vez de saltar para o topo. Com o atributo, o
    // Next desliga o suave só durante a transição e devolve em seguida.
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${firaMono.variable} ${poppins.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* O Next emite só `mobile-web-app-capable` para o `appleWebApp`
            acima. Esta é a variante legada, que iOS anterior ao 16.4 ainda
            exige para abrir o atalho da tela inicial sem a moldura do Safari;
            as duas juntas não geram o aviso de depreciação do Chrome. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>
          <PageTransition>{children}</PageTransition>
          <ThemedToaster />
          <PwaBootstrap />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
