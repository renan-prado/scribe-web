import type { Metadata } from "next";
import { Fira_Mono, Geist, Geist_Mono, Poppins } from "next/font/google";
import { PageTransition } from "@/components/PageTransition";
import { Providers } from "@/components/Providers";
import { PwaBootstrap } from "@/components/PwaBootstrap";
import { ThemedToaster } from "@/components/ThemedToaster";
import { ThemeScript } from "@/components/ThemeScript";
import { IS_INDEXABLE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${firaMono.variable} ${poppins.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>
          <PageTransition>{children}</PageTransition>
          <ThemedToaster />
          <PwaBootstrap />
        </Providers>
      </body>
    </html>
  );
}
