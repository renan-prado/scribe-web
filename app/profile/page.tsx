import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/db/profiles";

export const metadata = {
  title: "Perfil",
};

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function initialsFrom(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || source.slice(0, 1).toUpperCase();
}

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/sign-in");

  const shownName = profile.displayName?.trim() || profile.email?.split("@")[0] || "Sua conta";
  const memberSince = DATE_FMT.format(new Date(profile.createdAt));
  const initials = initialsFrom(profile.displayName, profile.email);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-16">
      <header className="flex items-center justify-between">
        <Link
          href="/home"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>
      </header>

      <section className="flex flex-col items-center gap-4 text-center">
        <Avatar size="lg" className="size-20">
          {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt={shownName} /> : null}
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {shownName}
          </h1>
          {profile.email ? <p className="text-sm text-muted-foreground">{profile.email}</p> : null}
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card p-5">
        <dl className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Nome</dt>
            <dd className="font-medium text-foreground">{shownName}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium text-foreground">{profile.email ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Membro desde</dt>
            <dd className="font-medium text-foreground">{memberSince}</dd>
          </div>
        </dl>
      </section>

      <form action="/auth/sign-out" method="post">
        <Button type="submit" variant="destructive" size="lg" className="w-full gap-2">
          <LogOut className="size-4" />
          Sair da conta
        </Button>
      </form>
    </main>
  );
}
