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
    // PNG, não SVG: o Chrome não aceita SVG para instalar o PWA nem para o
    // atalho na tela inicial, e ficava sem ícone utilizável. O `maskable`
    // reusa o mesmo arquivo porque o logo é um quadrado cheio e a pena tem
    // ~32% de margem de cada lado — bem dentro da zona segura de 10% que o
    // Android recorta.
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
