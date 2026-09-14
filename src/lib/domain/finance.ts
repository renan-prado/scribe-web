/**
 * Vocabulário do controle financeiro, CLIENT-SAFE.
 *
 * Tipos, schemas Zod e rótulos em português. Vive em `lib/domain/` pela regra
 * do repositório: o cliente nunca importa de uma rota de `app/api`, então o que
 * as duas pontas compartilham mora aqui. As rotas montam os schemas de corpo a
 * partir destes; as telas leem os rótulos daqui.
 *
 * Nada neste arquivo toca o banco, o Supabase ou `serverEnv`. É o que permite
 * a um formulário `"use client"` importar `ENTRY_STATUS_LABELS` sem arrastar o
 * service-role para o bundle.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enumerações
// ---------------------------------------------------------------------------

export const FINANCE_KINDS = ["revenue", "expense"] as const;
export type FinanceKind = (typeof FINANCE_KINDS)[number];

export const CATEGORY_KINDS = ["revenue", "expense", "both"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/** Fixo não escala com uso; variável escala. Ver o cabeçalho da migração 0043. */
export const COST_NATURES = ["fixed", "variable"] as const;
export type CostNature = (typeof COST_NATURES)[number];

/**
 * Os três estados de um lançamento, e a distinção é a do §14 da especificação:
 *
 *   paid    → REALIZADO. Aconteceu, o dinheiro se moveu.
 *   pending → obrigação ou direito FIRMADO e ainda não liquidado (uma dívida).
 *   planned → PREVISTO. Sabemos que deve acontecer, nada foi firmado.
 *
 * O que NÃO está aqui é "projetado": projeção não é lançamento, é o resultado
 * de premissas (`finance_scenarios`) e não se guarda, se recalcula.
 */
export const ENTRY_STATUSES = ["paid", "pending", "planned"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const CADENCES = ["monthly", "quarterly", "semiannual", "annual"] as const;
export type Cadence = (typeof CADENCES)[number];

export const CURRENCIES = ["BRL", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const RECURRING_STATUSES = ["active", "cancelled"] as const;
export type RecurringStatus = (typeof RECURRING_STATUSES)[number];

/** Meses cobertos por uma cobrança de cada cadência. Base do equivalente mensal. */
export const MONTHS_PER_CADENCE: Record<Cadence, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

// ---------------------------------------------------------------------------
// Rótulos (pt-BR inline, como o resto do app, ver AGENTS.md da raiz)
// ---------------------------------------------------------------------------

export const KIND_LABELS: Record<FinanceKind, string> = {
  revenue: "Receita",
  expense: "Despesa",
};

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  revenue: "Receita",
  expense: "Despesa",
  both: "Ambos",
};

export const NATURE_LABELS: Record<CostNature, string> = {
  fixed: "Fixo",
  variable: "Variável",
};

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  paid: "Liquidado",
  pending: "Pendente",
  planned: "Previsto",
};

/**
 * O mesmo status lido do lado da receita. "Pago" e "Recebido" são o mesmo
 * estado do banco, a especificação lista os quatro como se fossem quatro
 * estados, e não são: o que muda é a direção do dinheiro, que já está em
 * `kind`. Guardar quatro produziria combinações sem sentido ("receita paga").
 */
export const ENTRY_STATUS_LABELS_REVENUE: Record<EntryStatus, string> = {
  paid: "Recebido",
  pending: "A receber",
  planned: "Previsto",
};

export function entryStatusLabel(status: EntryStatus, kind: FinanceKind): string {
  return kind === "revenue" ? ENTRY_STATUS_LABELS_REVENUE[status] : ENTRY_STATUS_LABELS[status];
}

export const CADENCE_LABELS: Record<Cadence, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export const RECURRING_STATUS_LABELS: Record<RecurringStatus, string> = {
  active: "Ativo",
  cancelled: "Cancelado",
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  BRL: "Real (R$)",
  USD: "Dólar (US$)",
};

// ---------------------------------------------------------------------------
// Tipos de leitura
// ---------------------------------------------------------------------------

export type FinanceCategory = {
  id: string;
  slug: string;
  name: string;
  kind: CategoryKind;
  nature: CostNature;
  sortOrder: number;
  archivedAt: string | null;
};

export type FinanceRecurring = {
  id: string;
  kind: FinanceKind;
  description: string;
  counterparty: string | null;
  categoryId: string | null;
  amountCents: number;
  currency: Currency;
  cadence: Cadence;
  startDate: string;
  endDate: string | null;
  status: RecurringStatus;
  notes: string | null;
  createdAt: string;
};

export type FinanceEntry = {
  id: string;
  kind: FinanceKind;
  description: string;
  counterparty: string | null;
  categoryId: string | null;
  amountCents: number;
  currency: Currency;
  /** Câmbio congelado na liquidação. Nulo enquanto não liquidado. */
  fxRate: number | null;
  paidCents: number;
  status: EntryStatus;
  competenceDate: string;
  dueDate: string | null;
  settledAt: string | null;
  recurringId: string | null;
  notes: string | null;
  createdAt: string;
};

export type FinanceScenario = {
  id: string;
  slug: string;
  name: string;
  growthBps: number;
  churnBps: number;
  newCustomersPerMonth: number;
  ticketCents: number | null;
  extraFixedCostCents: number;
  taxBps: number | null;
  horizonMonths: number;
  sortOrder: number;
};

export type FinanceSettings = {
  cashBalanceCents: number;
  cashBalanceAt: string | null;
  taxBps: number;
  projectionUsdBrl: number | null;
};

// ---------------------------------------------------------------------------
// Schemas de escrita
// ---------------------------------------------------------------------------

/**
 * Uma data ISO curta (`YYYY-MM-DD`), que é o formato de `date` no Postgres e o
 * que um `<input type="date">` produz. Recusar timestamp completo aqui é
 * deliberado: `2026-09-09T03:00:00Z` gravado numa coluna `date` vira o dia 9
 * ou o 8 dependendo do fuso do servidor, e a diferença aparece como uma
 * despesa que mudou de mês sozinha.
 */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use o formato AAAA-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "data inválida");

/** Teto de R$ 100 milhões por lançamento. Um erro de digitação não deve virar
 * um número que quebra todo gráfico da tela sem que ninguém entenda por quê. */
const AmountSchema = z.number().int().positive().max(10_000_000_000);

const NullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const CategoryInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    kind: z.enum(CATEGORY_KINDS),
    nature: z.enum(COST_NATURES),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    archived: z.boolean().optional(),
  })
  .strict();
export type CategoryInput = z.infer<typeof CategoryInputSchema>;

/**
 * ARMADILHA DO ZOD 4, e é a razão de cada schema abaixo vir em DUAS metades.
 *
 * `.partial()` LANÇA sobre um objeto que tem `.refine()`, e lança no import do
 * módulo, não na validação, então o `tsc` passa e o build quebra na coleta de
 * rotas. Por isso o objeto cru fica separado: a criação usa o objeto refinado,
 * o PATCH usa `.partial()` do objeto CRU e reaplica o refinamento numa versão
 * tolerante a campos ausentes.
 *
 * Reaplicar em vez de confiar só no CHECK do banco é deliberado: o CHECK
 * devolve 23514, e um erro de constraint traduzido para o operador é sempre
 * pior que a mensagem que o schema escreve.
 */
const RecurringFieldsSchema = z
  .object({
    kind: z.enum(FINANCE_KINDS),
    description: z.string().trim().min(1).max(200),
    counterparty: NullableText(160),
    categoryId: z.uuid().nullable().optional(),
    amountCents: AmountSchema,
    currency: z.enum(CURRENCIES),
    cadence: z.enum(CADENCES),
    startDate: IsoDateSchema,
    endDate: IsoDateSchema.nullable().optional(),
    status: z.enum(RECURRING_STATUSES).optional(),
    notes: NullableText(2000),
  })
  .strict();

export const RecurringInputSchema = RecurringFieldsSchema.refine(
  (v) => !v.endDate || v.endDate >= v.startDate,
  { message: "o término não pode ser antes do início", path: ["endDate"] }
);
export type RecurringInput = z.infer<typeof RecurringInputSchema>;

export const RecurringPatchSchema = RecurringFieldsSchema.partial().refine(
  (v) => !v.endDate || !v.startDate || v.endDate >= v.startDate,
  { message: "o término não pode ser antes do início", path: ["endDate"] }
);

const EntryFieldsSchema = z
  .object({
    kind: z.enum(FINANCE_KINDS),
    description: z.string().trim().min(1).max(200),
    counterparty: NullableText(160),
    categoryId: z.uuid().nullable().optional(),
    amountCents: AmountSchema,
    currency: z.enum(CURRENCIES),
    /**
     * O câmbio usado. Só é aceito do cliente para lançamentos JÁ liquidados,
     * é o registro de quanto o dólar valia no dia. Para o resto, a rota o
     * ignora e a leitura converte com a cotação viva. Ver `lib/finance/money.ts`.
     */
    fxRate: z.number().positive().max(1000).nullable().optional(),
    paidCents: z.number().int().min(0).max(10_000_000_000).optional(),
    status: z.enum(ENTRY_STATUSES),
    competenceDate: IsoDateSchema,
    dueDate: IsoDateSchema.nullable().optional(),
    settledAt: IsoDateSchema.nullable().optional(),
    recurringId: z.uuid().nullable().optional(),
    notes: NullableText(2000),
  })
  .strict();

export const EntryInputSchema = EntryFieldsSchema.refine(
  (v) => (v.paidCents ?? 0) <= v.amountCents,
  { message: "o valor pago não pode superar o valor do lançamento", path: ["paidCents"] }
);
export type EntryInput = z.infer<typeof EntryInputSchema>;

/**
 * O PATCH só consegue comparar os dois valores quando ambos vêm no corpo. Um
 * PATCH que muda só `paidCents` escapa daqui, e é o CHECK
 * `finance_entries_paid_within_amount` da migração 0043 que o pega, porque ele
 * enxerga a linha inteira e nenhum caminho de código escapa dele.
 */
export const EntryPatchSchema = EntryFieldsSchema.partial().refine(
  (v) => v.paidCents === undefined || v.amountCents === undefined || v.paidCents <= v.amountCents,
  { message: "o valor pago não pode superar o valor do lançamento", path: ["paidCents"] }
);

export const ScenarioInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    growthBps: z.number().int().min(-10_000).max(100_000),
    churnBps: z.number().int().min(0).max(10_000),
    newCustomersPerMonth: z.number().int().min(0).max(1_000_000),
    ticketCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
    extraFixedCostCents: z.number().int().min(0).max(10_000_000_000).optional(),
    taxBps: z.number().int().min(0).max(10_000).nullable().optional(),
    horizonMonths: z.number().int().min(1).max(60),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();
export type ScenarioInput = z.infer<typeof ScenarioInputSchema>;

export const SettingsInputSchema = z
  .object({
    cashBalanceCents: z.number().int().min(-10_000_000_000).max(10_000_000_000).optional(),
    cashBalanceAt: IsoDateSchema.nullable().optional(),
    taxBps: z.number().int().min(0).max(10_000).optional(),
    projectionUsdBrl: z.number().positive().max(1000).nullable().optional(),
  })
  .strict();
export type SettingsInput = z.infer<typeof SettingsInputSchema>;

/** Filtros da tela de lançamentos. Espelhados na query string. */
export const EntryFiltersSchema = z
  .object({
    from: IsoDateSchema.optional(),
    to: IsoDateSchema.optional(),
    kind: z.enum(FINANCE_KINDS).optional(),
    status: z.enum(ENTRY_STATUSES).optional(),
    categoryId: z.uuid().optional(),
    currency: z.enum(CURRENCIES).optional(),
  })
  .strict();
export type EntryFilters = z.infer<typeof EntryFiltersSchema>;
