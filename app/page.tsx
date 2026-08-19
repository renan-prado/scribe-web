import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">scribe-web</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        A lista de resumos vai aparecer aqui em breve. Por enquanto, abra a tela de gravação.
      </p>
      <Link
        href="/spike"
        className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
      >
        Abrir gravação
      </Link>
    </main>
  );
}
