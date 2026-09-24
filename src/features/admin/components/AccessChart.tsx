"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export type AccessChartPoint = {
  day: string;
  /** Contas distintas com ao menos um pulso de presença naquele dia. */
  acessos: number;
  /** Cadastros novos naquele dia, do mesmo `groupByDay` do funil. */
  cadastros: number;
};

const chartConfig = {
  acessos: { label: "Contas ativas", color: "var(--chart-1)" },
  cadastros: { label: "Cadastros", color: "var(--chart-2)" },
} satisfies ChartConfig;

const dayFormatter = (value: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", opts);

/**
 * "Cadastros" e "contas ativas" são DUAS perguntas, e por isso não empilham:
 * uma é gente NOVA, a outra é gente que voltou a usar. Empilhar as áreas
 * (`stackId`) somaria as duas como se fossem partes do mesmo total, que não
 * são — a maioria de quem acessa num dia qualquer não se cadastrou naquele
 * dia. Cada área é medida contra o zero, sozinha.
 */
export function AccessChart({ data }: { data: AccessChartPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contas ativas por dia</CardTitle>
        <CardDescription>
          Quantas contas diferentes abriram o Scriba a cada dia, contra quantas se cadastraram no
          mesmo dia.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fillAcessos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-acessos)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-acessos)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillCadastros" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-cadastros)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-cadastros)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string) =>
                dayFormatter(value, { day: "2-digit", month: "2-digit" })
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    dayFormatter(String(value), { day: "2-digit", month: "long" })
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="acessos"
              type="natural"
              fill="url(#fillAcessos)"
              stroke="var(--color-acessos)"
            />
            <Area
              dataKey="cadastros"
              type="natural"
              fill="url(#fillCadastros)"
              stroke="var(--color-cadastros)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
