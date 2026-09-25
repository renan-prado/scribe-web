"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CoinMark } from "@/components/icons/CoinMark";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyButton } from "@/features/admin/components/CopyButton";
import { SessionModeBadge } from "@/features/admin/components/SessionModeBadge";
import { type CoinEconomicsSettings, computeSessionEconomics } from "@/features/coins/economics";
import { SESSION_MODES, type SessionMode } from "@/lib/domain/session";
import { makeMoneyFormatter } from "@/lib/fx/format";
import type { UsdBrlRate } from "@/lib/fx/usd-brl";
import { cn } from "@/lib/utils";
import { brl, duration, INT, moment, percent, TABLE_SURFACE } from "./format";
import { SectionLabel } from "./notices";

/**
 * O custo, a receita e o LUCRO de cada sessão.
 *
 * As duas últimas colunas já foram "custo por 1.000 moedas", e aquele número
 * respondia à pergunta da aba de PREÇOS (o milheiro se paga?), não à desta.
 * Uma sessão não é uma decisão de preço: ela já aconteceu, já cobrou e já
 * custou, e o que se quer saber dela é quanto sobrou. Lucro em real e margem
 * em porcento são a mesma conta nas duas unidades que servem para coisas
 * diferentes — o real SOMA ao longo da lista, a porcentagem COMPARA sessões
 * de tamanhos diferentes.
 *
 * A conta é `computeSessionEconomics`, no mesmo arquivo de onde sai a da aba
 * de preços, e a margem é a REALIZADA: custo medido contra a moeda que o
 * ledger de fato cobrou. A outra margem daquele arquivo, a "do preço de
 * hoje", não existe aqui — uma sessão inteira não tem preço de tabela contra
 * o qual ser comparada.
 *
 * **A coluna "Chamadas" saiu.** Quantas vezes a OpenAI foi chamada é detalhe
 * de pipeline, e a pergunta que ele responde ("onde o custo se reparte?") tem
 * tela própria, a aba Rotas. Aqui ele competia por largura com o dinheiro.
 *
 * **A data virou COLUNA.** Ela morava embaixo do título, em corpo 11, onde
 * servia de legenda e não de dado — e uma coluna que não existe é uma coluna
 * pela qual não se ordena.
 *
 * O título já levou a um INSPETOR que abria a sessão execução por execução
 * (`SessionRunPanel`). Ele existia para o pipeline do estudo, cujo
 * reprocessamento gravava um segundo conjunto de eventos na mesma sessão e
 * fazia a soma descrever duas execuções ao mesmo tempo. Com o estudo fora do
 * produto não há mais duas execuções para separar, e o inspetor saiu junto.
 * O que sobrou como porta é o "ler", que abre o CONTEÚDO da sessão ao lado do
 * custo que ele pagou.
 *
 * ## Por que a ordenação é estado de CLIENTE, e não da URL
 *
 * O resto do painel põe o estado na URL (as abas, o período, os filtros), e a
 * razão escrita lá é que aqueles controles trocam **o que o servidor busca**.
 * Ordenar não troca: as linhas já estão todas aqui, e o servidor faria a mesma
 * consulta para devolver as mesmas linhas em outra ordem. Pagar uma ida ao
 * banco por clique de cabeçalho seria cobrar o preço de um filtro por uma
 * operação que é só de leitura.
 *
 * O preço disso está escrito na legenda: a ordenação reordena as linhas que
 * vieram, que são as mais RECENTES do período. Ordenar por lucro não vai
 * buscar a sessão mais lucrativa de três meses atrás.
 */

/**
 * O que esta tabela precisa de uma sessão.
 *
 * Declarado aqui, e não importado de `server/db/usage.ts`, porque este é um
 * componente CLIENTE e aquele módulo leva `import "server-only"`. Um
 * `import type` seria apagado na compilação e funcionaria, mas deixaria no
 * arquivo uma linha que parece um import de servidor — a mesma linha que a
 * regra da fronteira existe para não ter de julgar caso a caso.
 *
 * `UsageBySession` satisfaz esta forma estruturalmente e traz campos a mais;
 * o dia em que um deles for renomeado, o erro aparece aqui, no `props`.
 */
export type SessionRow = {
  sessionId: string;
  title: string | null;
  createdAt: string;
  durationMs: number | null;
  totalCostUsd: number;
  coins: number;
  userId: string | null;
  ownerDisplayName: string | null;
  mode: SessionMode | null;
};

type SortKey = "date" | "mode" | "profit" | "margin";
type SortDir = "asc" | "desc";

/**
 * A direção que cada coluna assume quando é escolhida pela primeira vez.
 *
 * Três das quatro abrem em `desc`: a pergunta que leva alguém a clicar em
 * "Lucro" é "qual rendeu mais?", e abrir pelo pior obriga a um segundo clique
 * todas as vezes. O modo é a exceção porque ali não há melhor nem pior, só um
 * agrupamento, e ordem de lista se espera crescente.
 */
const FIRST_DIR: Record<SortKey, SortDir> = {
  date: "desc",
  mode: "asc",
  profit: "desc",
  margin: "desc",
};

type Row = SessionRow & {
  revenueBrl: number | null;
  costBrl: number | null;
  profitBrl: number | null;
  margin: number | null;
};

export function SessoesTab({
  sessions,
  rate,
  settings,
  cap,
}: {
  sessions: SessionRow[];
  rate: UsdBrlRate | null;
  settings: CoinEconomicsSettings;
  /** Teto de linhas que o servidor devolve. A legenda o diz quando é atingido. */
  cap: number;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "date", dir: "desc" });
  const money = useMemo(() => makeMoneyFormatter(rate), [rate]);

  const rows = useMemo(() => {
    const withEconomics: Row[] = sessions.map((s) => ({
      ...s,
      ...computeSessionEconomics({
        costUsd: s.totalCostUsd,
        usdToBrl: rate?.rate ?? null,
        coins: s.coins,
        settings,
      }),
    }));
    return withEconomics.sort(compareBy(sort.key, sort.dir));
  }, [sessions, rate, settings, sort]);

  function toggle(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: FIRST_DIR[key] }
    );
  }

  const sortable = (key: SortKey, label: string) => (
    <SortButton
      label={label}
      active={sort.key === key}
      dir={sort.dir}
      onClick={() => toggle(key)}
    />
  );

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Sessões</SectionLabel>
      <div className={TABLE_SURFACE}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sessão</TableHead>
              <TableHead>Dono</TableHead>
              <TableHead aria-sort={ariaSort(sort, "date")}>{sortable("date", "Data")}</TableHead>
              <TableHead aria-sort={ariaSort(sort, "mode")}>{sortable("mode", "Modo")}</TableHead>
              <TableHead className="text-right">Duração</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-1.5">
                  <CoinMark size={14} /> Moedas
                </span>
              </TableHead>
              <TableHead className="text-right" aria-sort={ariaSort(sort, "profit")}>
                {sortable("profit", "Lucro")}
              </TableHead>
              <TableHead className="text-right" aria-sort={ariaSort(sort, "margin")}>
                {sortable("margin", "Margem")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                  Nenhuma sessão com eventos.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow key={s.sessionId} className="group">
                  <TableCell>
                    <span className="block truncate font-medium text-scriba-ink">
                      {s.title?.trim() || "Sessão sem título"}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.65rem] text-scriba-ink-mute/70">
                      {s.sessionId.slice(0, 8)}…
                      <CopyButton value={s.sessionId} />
                      {/* O custo desta linha ao lado do CONTEÚDO que ele
                          pagou, e hoje a única porta que a linha tem. */}
                      <Link
                        href={`/admin/sessions/${s.sessionId}`}
                        className="font-sans text-[0.7rem] font-medium text-scriba-ink-mute hover:text-scriba-ink hover:underline"
                      >
                        ler
                      </Link>
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.ownerDisplayName || (s.userId ? s.userId.slice(0, 8) : "-")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-scriba-ink-soft">
                    {moment(s.createdAt)}
                  </TableCell>
                  <TableCell>
                    <SessionModeBadge mode={s.mode} />
                  </TableCell>
                  <TableCell className="text-right">{duration(s.durationMs)}</TableCell>
                  <TableCell className="text-right">{money(s.totalCostUsd, "fine")}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.coins > 0 ? INT.format(s.coins) : "-"}
                  </TableCell>
                  {/* O sinal é a COR, e SÓ no vermelho. Pintar o lucro de
                      verde acenderia a tabela inteira numa cor que não informa
                      nada (o normal é dar lucro); o prejuízo é a exceção, e é
                      ele que precisa ser achado correndo o olho. */}
                  <TableCell
                    className={cn(
                      "whitespace-nowrap text-right tabular-nums",
                      s.profitBrl != null && s.profitBrl < 0 && "text-scriba-rec"
                    )}
                  >
                    {brl(s.profitBrl)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      s.margin != null && s.margin < 0 && "text-scriba-rec"
                    )}
                  >
                    {percent(s.margin)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* O que a tabela não diz sozinha, e sem o que ela seria lida como fato
          inteiro: de onde vem a receita, e o que o traço quer dizer. */}
      <p className="text-[11.5px] font-light leading-relaxed text-scriba-ink-mute">
        A receita de uma sessão são as moedas que ela debitou, avaliadas à régua de{" "}
        {brl(settings.pricePerThousandBrl)} por 1.000 moedas: o custo é MEDIDO, a receita é
        SIMULADA, a mesma distinção da aba{" "}
        <strong className="font-medium">Preços &amp; margem</strong>. Moeda cobrada fora do período
        (ou sessão que nunca cobrou) deixa a margem em <span className="font-mono">-</span>, porque
        não há receita para dividir — ali o lucro é o custo com sinal negativo.
        {rows.length >= cap ? (
          <>
            {" "}
            A lista traz as <strong className="font-medium">{cap} sessões mais recentes</strong> do
            período, e a ordenação reordena essas {cap}, não o período inteiro.
          </>
        ) : null}
      </p>
    </section>
  );
}

function ariaSort(
  sort: { key: SortKey; dir: SortDir },
  key: SortKey
): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.dir === "asc" ? "ascending" : "descending";
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Icon = active && dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ordenar por ${label}`}
      className={cn(
        "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors",
        "hover:text-scriba-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active && "text-scriba-ink"
      )}
    >
      {label}
      {/* A seta da coluna INATIVA fica apagada em vez de ausente: sem ela,
          nada na tabela diz que aquele cabeçalho é clicável, e a ordenação
          vira um recurso que só encontra quem já sabia que existia. */}
      <Icon className={cn("size-3", active ? "opacity-100" : "opacity-25")} />
    </button>
  );
}

const MODE_RANK = new Map<string, number>(SESSION_MODES.map((m, i) => [m, i]));

/**
 * O comparador de uma coluna.
 *
 * **Vazio vai SEMPRE para o fim**, nas duas direções, e não é detalhe: uma
 * sessão sem margem (moeda cobrada fora do período) subiria ao topo de "menor
 * margem" e responderia à pergunta errada — ela não tem a pior margem, ela
 * não tem margem. Vale igual para modo nulo e data ausente.
 */
function compareBy(key: SortKey, dir: SortDir) {
  const sign = dir === "asc" ? 1 : -1;
  return (a: Row, b: Row): number => {
    if (key === "date") {
      return nullsLastText(a.createdAt || null, b.createdAt || null, sign);
    }
    if (key === "mode") {
      return nullsLast(rankOfMode(a.mode), rankOfMode(b.mode), sign);
    }
    const [x, y] = key === "profit" ? [a.profitBrl, b.profitBrl] : [a.margin, b.margin];
    return nullsLast(x, y, sign);
  };
}

function rankOfMode(mode: string | null): number | null {
  return mode == null ? null : (MODE_RANK.get(mode) ?? null);
}

function nullsLast(a: number | null, b: number | null, sign: number): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return sign * (a - b);
}

function nullsLastText(a: string | null, b: string | null, sign: number): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return sign * a.localeCompare(b);
}
