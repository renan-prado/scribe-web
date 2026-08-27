import type { Metadata } from "next";
import { Fira_Mono, Geist, Geist_Mono, Poppins } from "next/font/google";
import { Toaster } from "sonner";
import { PageTransition } from "@/components/PageTransition";
import { Providers } from "@/components/Providers";
import { PwaBootstrap } from "@/components/PwaBootstrap";
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

const SITE_URL = "https://scriba.cc";
const DESCRIPTION =
  "Scriba transcreve e resume sermões em tempo real com IA — citações bíblicas detectadas automaticamente, destaques do pregador e resumo estruturado ao final.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Scriba — Transcrição de sermões em tempo real",
    template: "%s | Scriba",
  },
  description: DESCRIPTION,
  keywords: [
    "transcrição de sermões",
    "resumo de pregação",
    "IA para igrejas",
    "transcrição em tempo real",
    "citações bíblicas automáticas",
    "scriba",
  ],
  authors: [{ name: "Scriba", url: SITE_URL }],
  creator: "Scriba",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "Scriba",
    title: "Scriba — Transcrição de sermões em tempo real",
    description: DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Scriba" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Scriba — Transcrição de sermões em tempo real",
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: {
    icon: [
      {
        url: "/favicon-light-theme.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-dark-theme.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${firaMono.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>
          <PageTransition>{children}</PageTransition>
          <Toaster position="top-center" richColors />
          <PwaBootstrap />
        </Providers>
      </body>
    </html>
  );
}
