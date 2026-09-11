import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Cartões compartilhados das telas de admin, na estética do bloco
 * `dashboard-01` do shadcn.
 *
 * O que mudou em relação à versão anterior, e por quê:
 *
 * **A cor saiu do cartão.** Cada KPI trazia um `tone` (`blue` / `rose` /
 * `mint` / `cream`) que pintava uma pastilha com o rótulo dentro. A pastilha
 * era o único lugar da tela em que aquelas quatro famílias apareciam, e a cor
 * não queria dizer nada: "Usuários" era azul e "Custo total" era rosa por
 * arranjo visual, não por significado. Onde ela QUERIA dizer alguma coisa
 * (`netProfitCents >= 0 ? "blue" : "rose"`) o sinal agora é explícito e mora
 * no lugar certo, a pastilha de tendência do `CardAction`, que diz para que
 * lado o número anda em vez de deixar isso para o olho de quem já sabia.
 *
 * **O gradiente mora na GRADE, não no cartão** (`KpiGrid`). É como o
 * `dashboard-01` faz: `*:data-[slot=card]:bg-gradient-to-t` alcança todo filho
 * com o slot de cartão, então um KPI solto no meio de outra tela continua
 * chapado, e só a grade de KPIs ganha o degradê. No escuro ele é DESLIGADO
 * (`dark:*:data-[slot=card]:bg-card`), porque 5% de branco sobre um cartão já
 * claro-sobre-escuro lava a borda em vez de levantar o cartão.
 */

export type KpiTrend = {
  direction: "up" | "down";
  /** O texto da pastilha. Curto: ela divide a linha com o título. */
  label: string;
};

export type KpiTile = {
  label: string;
  value: string;
  hint: string;
  /** A linha em negrito do rodapé, acima do `hint`. Opcional. */
  note?: string;
  trend?: KpiTrend;
  icon?: React.ReactNode;
};

/**
 * A grade dos KPIs. Quatro colunas só a partir de `xl`, e não do `@5xl/main`
 * do bloco original: em `lg` a sidebar já come 16rem, e um "R$ 12.345,67" não
 * cabia nos ~175px que sobravam por cartão.
 */
export function KpiGrid({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {children}
    </section>
  );
}

export function KpiCard({ label, value, hint, note, trend, icon }: KpiTile) {
  const TrendIcon = trend?.direction === "down" ? TrendingDown : TrendingUp;
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {icon}
          <span className="min-w-0 truncate" title={value}>
            {value}
          </span>
        </CardTitle>
        {trend ? (
          <CardAction>
            <Badge variant="outline">
              <TrendIcon />
              {trend.label}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        {note ? (
          <div className="line-clamp-1 flex gap-2 font-medium">
            {note}
            {trend ? <TrendIcon className="size-4" /> : null}
          </div>
        ) : null}
        <div className="text-muted-foreground">{hint}</div>
      </CardFooter>
    </Card>
  );
}

export type ListCardProps = {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
};

export function ListCard({ title, subtitle, className, children }: ListCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export type QuickLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

/** O `Button variant="outline" size="sm"` do bloco, em forma de link. */
export function QuickLink({ href, className, children }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        className
      )}
    >
      {children}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}
