import type { Metadata } from "next";
import Link from "next/link";
import {
  ADMIN_AUDIENCE_LABEL,
  ADMIN_AUDIENCE_NOTE,
  ADMIN_AUDIENCES,
  type AdminAudience,
  parseAdminAudience,
} from "@/features/admin/audience";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminTabs } from "@/features/admin/components/AdminTabs";
import { CoinEconomicsForm } from "@/features/admin/components/CoinEconomicsForm";
import { UnpricedNote, VersionWindowNote } from "@/features/admin/components/costs/notices";
import { PrecosTab } from "@/features/admin/components/costs/PrecosTab";
import { RotasTab } from "@/features/admin/components/costs/RotasTab";
import { SessoesTab } from "@/features/admin/components/costs/SessoesTab";
import { VersoesTab } from "@/features/admin/components/costs/VersoesTab";
import { FxRateBadge } from "@/features/admin/components/FxRateBadge";
import { SessionRunLookup } from "@/features/admin/components/SessionRunLookup";
import { SessionRunPanel } from "@/features/admin/components/SessionRunPanel";
import { UsageFilters } from "@/features/admin/components/UsageFilters";
import { VersionPicker } from "@/features/admin/components/VersionPicker";
import { loadSessionRuns } from "@/features/admin/server/db/session-runs";
import {
  listUsersForFilter,
  loadAdminUsageSummary,
  type UsageFilters as UsageFiltersType,
} from "@/features/admin/server/db/usage";
import { getCoinEconomics, hasCustomCoinEconomics } from "@/features/coins/server/settings";
import { SESSION_MODES, type SessionMode } from "@/lib/domain/session";
import { makeCostPerThousandCoinsFormatter, makeMoneyFormatter } from "@/lib/fx/format";
import { getUsdToBrl } from "@/lib/fx/usd-brl";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Custos" };
export const dynamic = "force-dynamic";

/**
 * Tudo o que a OpenAI cobra do Scriba, em quatro cortes da MESMA passada de
 * `llm_usage_events`.
 *
 * Eram duas telas, "Uso & custos" e "Precificação", e a divisão não era de
 * assunto, era de recorte: as duas chamavam `loadAdminUsageSummary`, as duas
 * tinham pílulas de período, seletor de versão, aviso de modelo sem preço,
 * selo de câmbio e uma fileira de KPI que só diferia pela margem no fim. Quem
 * chegava com uma pergunta de dinheiro tinha de saber de cor em qual das duas
 * estava a coluna, e quem trocava de tela recomeçava os filtros do zero.
 *
 * As quatro abas são as quatro perguntas, e a ordem é a da decisão:
 *
 *   - **Preços & margem** — o preço de cada AÇÃO ainda fecha? (a decisão)
 *   - **Rotas & usuários** — de onde vem o custo? (o diagnóstico)
 *   - **Versões** — depois daquela mudança, ficou melhor ou pior? (o tempo)
 *   - **Sessões** — quanto custou esta sessão, execução por execução?
 *
 * **Os filtros finos não atravessam para a aba de preços**, e isso é regra, não
 * descuido: uma margem por AÇÃO recortada por uma rota é custo de uma fatia
 * contra a moeda inteira, um número sempre bom que ninguém investiga (a mesma
 * armadilha que `coinsScoped` documenta em `server/db/usage.ts`). Período e
 * versão atravessam, porque os dois recortam os dois lados da conta.
 */

const TABS = ["prices", "routes", "versions", "sessions"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  prices: "Preços & margem",
  routes: "Rotas & usuários",
  versions: "Versões",
  sessions: "Sessões",
};

const TAB_SUBTITLES: Record<Tab, string> = {
  prices: "O que cada ação cobra, o que ela custa de verdade, e a margem que sobra.",
  routes: "De onde vem o custo: cada rota de LLM e cada pessoa que a disparou.",
  versions: "Custo e latência de um deploy para o outro, uma rota de cada vez.",
  sessions: "O custo de cada sessão, e uma delas aberta execução por execução.",
};

const RANGES = [
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "90d", label: "90 dias", days: 90 },
  { key: "all", label: "Tudo", days: null },
] as const;

function rangeToFrom(range: string): string | undefined {
  const found = RANGES.find((r) => r.key === range) ?? RANGES[1];
  if (!found.days) return undefined;
  return new Date(Date.now() - found.days * 24 * 60 * 60 * 1000).toISOString();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseModeFilter(value: string | undefined): SessionMode | undefined {
  return (SESSION_MODES as readonly string[]).includes(value ?? "")
    ? (value as SessionMode)
    : undefined;
}

type SearchParams = {
  tab?: string;
  range?: string;
  audience?: string;
  userId?: string;
  route?: string;
  sessionId?: string;
  mode?: string;
  version?: string;
};

/**
 * O link de uma aba, ou de uma pílula de período.
 *
 * Período e versão sobrevivem a qualquer troca; os filtros finos só existem
 * nas abas que os usam, e são DESCARTADOS ao entrar em "Preços & margem" pela
 * razão do cabeçalho do arquivo. O `sessionId` é de uma aba só.
 */
function hrefFor(tab: Tab, sp: SearchParams, overrides: Partial<SearchParams> = {}): string {
  const merged = { ...sp, ...overrides };
  const params = new URLSearchParams();
  if (tab !== "prices") params.set("tab", tab);
  if (merged.range && merged.range !== "30d") params.set("range", merged.range);
  if (merged.version) params.set("version", merged.version);
  // Como período e versão: atravessa as quatro abas, inclusive a de preços.
  // É o recorte mais grosso que existe nesta tela — ele decide DE QUEM é o
  // custo —, e perdê-lo ao trocar de aba devolveria em silêncio uma margem
  // medida sobre outra população.
  if (merged.audience && merged.audience !== "clients") params.set("audience", merged.audience);
  if (tab !== "prices") {
    if (merged.userId) params.set("userId", merged.userId);
    if (merged.route) params.set("route", merged.route);
    if (merged.mode) params.set("mode", merged.mode);
  }
  if (tab === "sessions" && merged.sessionId) params.set("sessionId", merged.sessionId);
  const qs = params.toString();
  return qs ? `/admin/costs?${qs}` : "/admin/costs";
}

export default async function AdminCostsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "prices";
  const range = RANGES.some((r) => r.key === sp.range) ? (sp.range as string) : "30d";
  const version = sp.version?.trim() ?? "";
  const audience = parseAdminAudience(sp.audience);
  // Validado aqui e não no componente: um `sessionId` malformado viraria uma
  // consulta ao Postgres que estoura em vez de devolver vazio.
  const sessionId =
    tab === "sessions" && UUID.test(sp.sessionId?.trim() ?? "")
      ? (sp.sessionId as string).trim()
      : "";

  const fine = tab !== "prices";
  const filters: UsageFiltersType = {
    from: rangeToFrom(range),
    version: version || undefined,
    audience,
    userId: fine ? sp.userId || undefined : undefined,
    route: fine ? sp.route || undefined : undefined,
    mode: fine ? parseModeFilter(sp.mode) : undefined,
    sessionId: sessionId || undefined,
  };

  const [summary, rate, settings, isCustom, users, sessionRuns] = await Promise.all([
    loadAdminUsageSummary(filters),
    getUsdToBrl(),
    getCoinEconomics(),
    hasCustomCoinEconomics(),
    fine ? listUsersForFilter() : Promise.resolve([]),
    // Melhor-esforço: um id que não existe não pode derrubar a tela inteira,
    // que é a razão de alguém ter chegado aqui.
    sessionId ? loadSessionRuns(sessionId).catch(() => null) : Promise.resolve(null),
  ]);

  const money = makeMoneyFormatter(rate);
  const costPerThousandCoins = makeCostPerThousandCoinsFormatter(rate);
  const routeUniverse: string[] =
    summary.routes.length > 0
      ? summary.routes
      : // Só quando o período não tem evento nenhum: um `Select` vazio não abre,
        // e o filtro pareceria quebrado em vez de vazio. Espelha as rotas vivas
        // de `UsageRoute`; as legadas aparecem sozinhas quando houver linha delas.
        ["transcribe", "final-summary", "study-answers", "study-write"];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Custos"
        subtitle={TAB_SUBTITLES[tab]}
        actions={
          <>
            <AudiencePills tab={tab} sp={sp} current={audience} />
            <VersionPicker versions={summary.versions} current={version} />
            <RangePills tab={tab} sp={sp} current={range} />
          </>
        }
      />

      <AdminTabs
        tabs={TABS.map((key) => ({
          href: hrefFor(key, sp),
          label: TAB_LABELS[key],
          active: key === tab,
        }))}
      />

      {/* Os dois avisos valem para os quatro cortes, então vivem acima das
          abas: custo subestimado contamina margem, rota, versão e sessão, e
          quem abriu direto numa delas não passa pelas outras para ser
          avisado. */}
      {/* O recorte de audiência DIZ o que ficou de fora quando não é o padrão.
          Um total recortado é indistinguível de um total inteiro olhando para
          o número: sem esta linha, "custo de IA R$ 12,40" é a mesma tela nos
          três casos. */}
      {ADMIN_AUDIENCE_NOTE[audience] ? (
        <p className="rounded-xl border border-scriba-hairline bg-scriba-paper px-4 py-3 text-[13px] font-light text-scriba-ink-mute">
          {ADMIN_AUDIENCE_NOTE[audience]}
        </p>
      ) : null}

      <UnpricedNote summary={summary} />
      <VersionWindowNote summary={summary} />

      {fine ? (
        <UsageFilters
          users={users}
          routes={routeUniverse}
          current={{ userId: sp.userId ?? "", route: sp.route ?? "", mode: sp.mode ?? "" }}
        />
      ) : null}

      {tab === "prices" ? (
        <>
          {/* A régua fica na aba que ela governa. Nada do que se digita aqui
              cobra coisa alguma: quem cobra é o Price do Stripe. O custo ao
              lado é MEDIDO; este número é simulação, e a tela precisa dizer
              qual é qual. */}
          <CoinEconomicsForm settings={settings} isCustom={isCustom} />
          <PrecosTab summary={summary} rate={rate} settings={settings} />
        </>
      ) : null}

      {tab === "routes" ? <RotasTab summary={summary} money={money} /> : null}

      {tab === "versions" ? (
        <VersoesTab summary={summary} money={money} filteredRoute={sp.route ?? ""} />
      ) : null}

      {tab === "sessions" ? (
        <>
          <SessionRunLookup current={sessionId} />
          {sessionId && !sessionRuns ? (
            <p className="rounded-xl border border-scriba-hairline bg-scriba-paper p-5 text-[13px] font-light text-scriba-ink-mute">
              Nenhuma sessão com o id <span className="font-mono">{sessionId}</span> neste ambiente.
            </p>
          ) : null}
          {sessionRuns ? (
            <SessionRunPanel
              report={sessionRuns}
              usdToBrl={rate?.rate ?? null}
              settings={settings}
              money={money}
            />
          ) : null}
          <SessoesTab
            summary={summary}
            money={money}
            costPerThousandCoins={costPerThousandCoins}
            sessionHref={(id) => hrefFor("sessions", sp, { sessionId: id })}
          />
        </>
      ) : null}

      <FxRateBadge rate={rate} />
    </div>
  );
}

/**
 * Quem entra na conta. Fica ao lado do período e da versão porque é da mesma
 * natureza dos dois: vale para as quatro abas e recorta os DOIS lados da
 * margem (o custo e a moeda). Ver `features/admin/audience.ts`.
 */
function AudiencePills({
  tab,
  sp,
  current,
}: {
  tab: Tab;
  sp: SearchParams;
  current: AdminAudience;
}) {
  return (
    <nav
      aria-label="Contas"
      className="flex flex-wrap items-center gap-1 rounded-full border border-scriba-hairline-soft bg-scriba-paper p-1"
    >
      {ADMIN_AUDIENCES.map((key) => (
        <Link
          key={key}
          href={hrefFor(tab, sp, { audience: key })}
          aria-current={key === current ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
            key === current
              ? "bg-scriba-blue-soft text-scriba-blue-ink"
              : "text-scriba-ink-mute hover:text-scriba-ink"
          )}
        >
          {ADMIN_AUDIENCE_LABEL[key]}
        </Link>
      ))}
    </nav>
  );
}

function RangePills({ tab, sp, current }: { tab: Tab; sp: SearchParams; current: string }) {
  return (
    <nav
      aria-label="Período"
      className="flex flex-wrap items-center gap-1 rounded-full border border-scriba-hairline-soft bg-scriba-paper p-1"
    >
      {RANGES.map((r) => (
        <Link
          key={r.key}
          href={hrefFor(tab, sp, { range: r.key })}
          aria-current={r.key === current ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
            r.key === current
              ? "bg-scriba-blue-soft text-scriba-blue-ink"
              : "text-scriba-ink-mute hover:text-scriba-ink"
          )}
        >
          {r.label}
        </Link>
      ))}
    </nav>
  );
}
