import type { Metadata } from "next";
import { Fira_Mono, Geist, Geist_Mono, Poppins } from "next/font/google";
import { Toaster } from "sonner";
import { PageTransition } from "@/components/PageTransition";
import { Providers } from "@/components/Providers";
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
  title: {
    default: "Scriba",
    template: "%s | Scriba",
  },
  description: "Transcrição e resumo de sermões em tempo real",
  icons: { icon: "/favicon-260821.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${firaMono.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>
          <PageTransition>{children}</PageTransition>
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
