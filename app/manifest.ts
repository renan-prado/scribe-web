import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scriba",
    short_name: "Scriba",
    description: "Transcrição e resumo de sermões em tempo real",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#A5A3C3",
    icons: [
      {
        src: "/favicon-260821.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/favicon-260821.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
