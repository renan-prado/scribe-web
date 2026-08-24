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
      <BreadcrumbList>
        {trail.map((item, i) => {
          const isLast = i === trail.length - 1;
          return (
            <Fragment key={item.href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="text-[color:var(--scriba-ink-strong)]">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={item.href}
                    className="text-[color:var(--scriba-ink-mute)] hover:text-[color:var(--scriba-ink)]"
                  >
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {isLast ? null : <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
