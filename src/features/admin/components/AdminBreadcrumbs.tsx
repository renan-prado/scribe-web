"use client";

import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const LABELS: Record<string, string> = {
  admin: "Admin",
  users: "Usuários",
  usage: "Uso & custos",
  precificacao: "Precificação",
  metricas: "Métricas",
  partners: "Parceiros",
  features: "Funcionalidades",
  studies: "Estudos",
};

export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const trail = parts.map((seg, i) => {
    const href = `/${parts.slice(0, i + 1).join("/")}`;
    const label = LABELS[seg] ?? seg;
    return { href, label };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        {trail.map((item, i) => {
          const isLast = i === trail.length - 1;
          return (
            <Fragment key={item.href}>
              {/* Os ancestrais somem no celular: com eles, "Admin › Uso &
                  custos" empurrava os botões de voltar e sair da faixa. O
                  título da tela já está no `<h1>` logo abaixo — a trilha é
                  orientação, não a informação principal. */}
              <BreadcrumbItem className={isLast ? "min-w-0" : "hidden sm:inline-flex"}>
                {isLast ? (
                  <BreadcrumbPage className="truncate text-scriba-ink-strong">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={item.href}
                    className="text-scriba-ink-mute hover:text-scriba-ink"
                  >
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {isLast ? null : <BreadcrumbSeparator className="hidden sm:block" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
