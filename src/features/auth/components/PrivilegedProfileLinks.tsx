import { ChevronRight, Handshake, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Os mesmos atalhos de papel do `PrivilegedMenuItems`, desenhados como cartão
 * do `/profile` — e visíveis **só no celular**.
 *
 * Existem porque o menu do avatar, onde eles moram, é `hidden sm:flex`: no
 * telefone o header não tem avatar nenhum, e quem é admin ou parceiro
 * simplesmente não tinha por onde chegar em `/admin` e `/partners` sem digitar
 * a URL. O `/profile` é o lugar natural — é para lá que o item "Perfil" da
 * barra inferior leva, e é onde já moram conta e preferências.
 *
 * **É um SERVER component, pela mesma razão que o irmão dele.** Atrás de um
 * `isAdmin &&` dentro de um componente cliente, as strings "Admin", "Área do
 * parceiro", "/admin" e "/partners" viajariam no JavaScript de TODO usuário
 * logado — o booleano esconde o item na tela, não o código que o desenha.
 * Renderizado no servidor, quem não tem o papel recebe `null` e nunca vê os
 * nomes.
 *
 * E, como lá, isto NÃO é controle de acesso: os gates de `/admin` e
 * `/partners` respondem 404 a quem digitar a URL. Aqui é só não anunciar a
 * porta.
 */
export function PrivilegedProfileLinks({
  isAdmin,
  isPartner,
}: {
  isAdmin: boolean;
  isPartner: boolean;
}) {
  if (!isAdmin && !isPartner) return null;

  return (
    <section className="rounded-[28px] bg-scriba-paper p-6 ring-1 ring-scriba-hairline sm:hidden">
      <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-mute">
        Seus acessos
      </h2>
      <div className="flex flex-col gap-2">
        {isPartner ? (
          <PrivilegedLink
            href="/partners"
            label="Área do parceiro"
            icon={<Handshake className="size-4" />}
          />
        ) : null}
        {isAdmin ? (
          <PrivilegedLink
            href="/admin"
            label="Admin"
            icon={<LayoutDashboard className="size-4" />}
          />
        ) : null}
      </div>
    </section>
  );
}

function PrivilegedLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 outline-none transition-colors hover:bg-scriba-surface focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <span className="flex size-9 flex-none items-center justify-center rounded-full bg-scriba-blue-soft text-scriba-blue-ink">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-scriba-ink-strong">
        {label}
      </span>
      <ChevronRight aria-hidden className="size-4 flex-none text-scriba-ink-mute" />
    </Link>
  );
}
