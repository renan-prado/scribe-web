import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nova gravação" };

export default function SpikeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
