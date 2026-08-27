import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scriba — Transcrição de sermões",
    short_name: "Scriba",
    description: "Transcrição e resumo de sermões em tempo real",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Windowing hints so the installed PWA looks native on desktop tray/dock.
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#A5A3C3",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["productivity", "utilities", "education"],
    // Prefer the app window when the OS resolves a Scriba link — matters for
    // "share to Scriba" style flows once we ship them.
    prefer_related_applications: false,
    icons: [
      {
        src: "/favicon-light-theme.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/favicon-light-theme.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Nova gravação",
        short_name: "Gravar",
        description: "Abrir o diálogo de nova gravação",
        url: "/?novo=1",
        icons: [{ src: "/recording-plus.svg", sizes: "any", type: "image/svg+xml" }],
      },
    ],
  };
}
