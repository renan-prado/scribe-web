import type { Metadata } from "next";
import { NavLink } from "@/components/NavLink";
import { DeepenButton } from "@/features/session/components/DeepenButton";
import { NewRecordingDialog } from "@/features/session/components/NewRecordingDialog";
import { hasDeepening } from "@/lib/db/deepenings";
import { getCurrentProfile } from "@/lib/db/profiles";
import { listSessions } from "@/lib/db/sessions";

export const metadata: Metadata = { title: "Início" };

const MONTHS_PT_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const MONTHS_PT_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function todayLabel(now: Date): string {
  return `Hoje, ${now.getDate()} de ${MONTHS_PT_LONG[now.getMonth()]}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_PT_SHORT[d.getMonth()]}`;
}

function firstNameOf(fullName: string | null | undefined): string {
  if (!fullName) return "amigo";
  const trimmed = fullName.trim();
  if (!trimmed) return "amigo";
  return trimmed.split(/\s+/)[0];
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Boa noite";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

// 1-indexed: index 0 unused, indices 1–31 map to day-of-month
const DAILY_PROMPTS = [
  "",
  "Vamos relembrar algo importante?", // 1
  "Que tal recordar algo especial?", // 2
  "Vamos revisitar uma mensagem importante?", // 3
  "Que tal relembrar o que você ouviu?", // 4
  "Vamos recordar um ensinamento marcante?", // 5
  "Que tal revisitar uma reflexão?", // 6
  "Vamos trazer uma mensagem de volta à memória?", // 7
  "Que tal recordar algo que marcou você?", // 8
  "Vamos relembrar uma verdade importante?", // 9
  "Que tal revisitar um sermão especial?", // 10
  "Vamos recordar algo que vale guardar?", // 11
  "Que tal relembrar uma mensagem marcante?", // 12
  "Vamos revisitar algo que você aprendeu?", // 13
  "Que tal trazer um ensinamento à memória?", // 14
  "Vamos recordar uma reflexão importante?", // 15
  "Que tal relembrar algo que falou com você?", // 16
  "Vamos revisitar uma mensagem que marcou você?", // 17
  "Que tal recordar uma verdade que você ouviu?", // 18
  "Vamos relembrar um momento especial?", // 19
  "Que tal revisitar algo que vale a pena lembrar?", // 20
  "Vamos recordar um ensinamento importante?", // 21
  "Que tal trazer uma mensagem de volta?", // 22
  "Vamos relembrar algo que não pode ser esquecido?", // 23
  "Que tal revisitar uma palavra marcante?", // 24
  "Vamos recordar algo que fez sentido para você?", // 25
  "Que tal relembrar uma reflexão especial?", // 26
  "Vamos revisitar algo que merece atenção?", // 27
  "Que tal recordar uma mensagem que ficou com você?", // 28
  "Vamos relembrar algo que vale levar adiante?", // 29
  "Que tal revisitar um ensinamento especial?", // 30
  "Vamos recordar algo importante deste mês?", // 31
];

function dailyPrompt(day: number): string {
  return DAILY_PROMPTS[day] ?? DAILY_PROMPTS[1];
}

export default async function HomePage() {
  const [profile, sessions] = await Promise.all([
    getCurrentProfile().catch(() => null),
    listSessions().catch(() => [] as Awaited<ReturnType<typeof listSessions>>),
  ]);

  const now = new Date();
  const firstName = firstNameOf(profile?.displayName);
  const greeting = greetingFor(now.getHours());

  const latest = sessions[0] ?? null;
  const older = sessions[3] ?? null;
  const latestHasDeepening = latest ? await hasDeepening(latest.id).catch(() => false) : false;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-[color:var(--scriba-ink-soft)]">{todayLabel(now)}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-[color:var(--scriba-ink-strong)] sm:text-3xl">
          {greeting}, {firstName}!
        </h1>
        <p className="text-sm font-light text-[color:var(--scriba-ink-soft)]">
          {dailyPrompt(now.getDate())}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-3xl border border-dashed border-[color:var(--scriba-hairline-soft)] bg-white p-6 shadow-[0_6px_22px_rgba(79,168,240,0.08)]">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-6 rounded-full bg-[color:var(--scriba-yellow)]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--scriba-yellow-hover)]">
                Comece por aqui
              </span>
            </div>
            <p className="text-pretty text-lg leading-snug text-[color:var(--scriba-ink-strong)]">
              Nenhum sermão gravado ainda. Comece pela primeira gravação e o Scriba passa a montar
              seu feed a partir do que você ouvir.
            </p>
            <NewRecordingDialog />
          </div>
        ) : latest ? (
          <ReflectionCard
            sessionId={latest.id}
            title={latest.title ?? "Sessão sem título"}
            speaker={latest.speakerName}
            date={shortDate(latest.createdAt)}
            shortSummary={latest.shortSummary}
            href={`/recording/${latest.id}/summary`}
            hasDeepening={latestHasDeepening}
          />
        ) : null}

        <PracticeCard sourceTitle={sessions[1]?.title ?? undefined} />

        <div className="grid gap-4 sm:grid-cols-2">
          <ConnectionCard sessions={sessions} />
          <MemoryCard oldest={older} />
        </div>

        <BibleReadCard />
        <EditorialCard />
      </div>
    </main>
  );
}

function ReflectionCard({
  sessionId,
  title,
  speaker,
  date,
  shortSummary,
  href,
  hasDeepening,
}: {
  sessionId: string;
  title: string;
  speaker: string | null;
  date: string;
  shortSummary: string | null;
  href: string;
  hasDeepening: boolean;
}) {
  const quote =
    shortSummary?.trim() ||
    "“A nossa confiança em Deus não nasce da ausência de incertezas, mas de saber quem Ele é.”";
  const speakerLine = [speaker, date].filter(Boolean).join(" · ");
  return (
    <article className="flex flex-col gap-4 rounded-[24px] border border-[color:var(--scriba-hairline-soft)] bg-white p-6 shadow-[0_6px_22px_rgba(79,168,240,0.13)]">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-6 rounded-full bg-[color:var(--scriba-hairline)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--scriba-ink-mute)]">
          Sobre a última gravação
        </span>
      </div>
      <p className="max-w-[500px] text-pretty text-lg font-medium leading-snug text-[color:var(--scriba-ink-strong)] sm:text-xl">
        {quote}
      </p>
      <div className="flex flex-col gap-0.5 border-t border-[color:var(--scriba-hairline)] pt-3">
        <span className="text-sm font-semibold text-[color:var(--scriba-ink)]">{title}</span>
        {speakerLine ? (
          <span className="text-xs font-light text-[color:var(--scriba-ink-mute)]">
            {speakerLine}
          </span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <DeepenButton sessionId={sessionId} hasDeepening={hasDeepening} variant="feed-card" />
        <NavLink
          href={href}
          contentClassName="inline-flex items-center justify-center gap-1.5"
          className="inline-flex flex-1 items-center justify-center rounded-full bg-[color:var(--scriba-blue-soft)]/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--scriba-ink-soft)] transition-colors hover:bg-[color:var(--scriba-blue-soft)]"
        >
          Relembrar
        </NavLink>
      </div>
    </article>
  );
}

function PracticeCard({ sourceTitle }: { sourceTitle?: string }) {
  return (
    <article className="flex flex-col gap-3.5 rounded-[24px] bg-[color:var(--scriba-mint)] p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--scriba-mint-accent)]">
          Coloque em prática
        </span>
        <span className="rounded-full bg-white/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--scriba-mint-accent)]">
          Prática de hoje
        </span>
      </div>
      <p className="max-w-[500px] text-pretty text-base leading-snug text-[color:var(--scriba-mint-ink)]">
        Pense em três coisas pelas quais você pode agradecer a Deus hoje e reserve alguns minutos
        para orar por elas.
      </p>
      <div className="h-px w-full bg-[color:var(--scriba-mint-accent)]/25" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-light leading-snug text-[color:var(--scriba-mint-accent)]">
          Você ouviu sobre gratidão em
          <br />
          <span className="font-medium text-[color:var(--scriba-mint-accent)]">
            {sourceTitle?.trim() || "Um coração grato"}
          </span>
        </p>
      </div>
    </article>
  );
}

function ConnectionCard({ sessions }: { sessions: Awaited<ReturnType<typeof listSessions>> }) {
  const picks = sessions.slice(1, 3);
  return (
    <article className="flex flex-col gap-3.5 rounded-[24px] bg-[color:var(--scriba-blue)] p-5 text-white shadow-[0_10px_26px_rgba(79,168,240,0.3)]">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
        Uma conexão interessante
      </span>
      <p className="text-pretty text-lg font-medium leading-snug">
        Dois sermões que você ouviu falam sobre{" "}
        <span className="text-[color:var(--scriba-yellow)]">ansiedade e confiança em Deus</span>.
      </p>
      <div className="flex flex-col gap-2">
        {(picks.length === 2
          ? picks
          : [
              { id: "mock-1", title: "Quando o medo chega", speakerName: "Pr. Daniel Souza" },
              { id: "mock-2", title: "Descansando na providência", speakerName: "Pr. João Silva" },
            ]
        ).map((s) => (
          <div key={s.id} className="flex flex-col gap-0.5 rounded-2xl bg-white/15 px-4 py-3">
            <span className="text-sm font-semibold">{s.title ?? "Sermão"}</span>
            <span className="text-[11px] font-light text-white/80">
              {s.speakerName ?? "Autor desconhecido"}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs font-light leading-snug text-white/80">
        Os dois abordam maneiras diferentes de responder à incerteza.
      </p>
      <button
        type="button"
        className="rounded-full bg-[color:var(--scriba-yellow)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#5A4409] transition-colors hover:bg-[color:var(--scriba-yellow-hover)]"
      >
        Explorar conexão
      </button>
    </article>
  );
}

function MemoryCard({
  oldest,
}: {
  oldest: Awaited<ReturnType<typeof listSessions>>[number] | null;
}) {
  const title = oldest?.title?.trim() || "O perigo de uma fé superficial";
  const speaker = oldest?.speakerName?.trim() || "Pr. Marcos Almeida";
  const location = oldest?.speakerLocation?.trim() || "Igreja Batista Central";
  const summary =
    oldest?.shortSummary?.trim() ||
    "“Raízes profundas não aparecem no dia da tempestade — elas crescem em silêncio, muito antes.”";
  return (
    <article className="flex flex-col gap-2 rounded-[24px] bg-[color:var(--scriba-cream)] p-5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--scriba-cream-accent)]">
        Há algum tempo você ouviu
      </span>
      <h3 className="text-lg font-semibold leading-tight tracking-tight text-[color:var(--scriba-cream-ink)]">
        {title}
      </h3>
      <p className="text-[11px] font-light text-[#9C8A55]">
        {speaker} · {location}
      </p>
      <p className="text-pretty text-sm font-light leading-snug text-[#7A6836]">{summary}</p>
      <button
        type="button"
        className="mt-1 self-start rounded-full bg-white px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--scriba-cream-accent)]"
      >
        Relembrar
      </button>
    </article>
  );
}

function BibleReadCard() {
  return (
    <article className="flex flex-col gap-2 rounded-[24px] bg-[color:var(--scriba-rose)] p-5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--scriba-rose-accent)]">
        Releia este texto
      </span>
      <p className="text-sm font-semibold text-[color:var(--scriba-rose-ink)]">Romanos 8:28</p>
      <p className="max-w-[500px] text-pretty text-[15px] font-light italic leading-snug text-[#83604F]">
        Sabemos que Deus age em todas as coisas para o bem daqueles que o amam…
      </p>
      <p className="pt-1 text-[11px] font-light leading-snug text-[#A08373]">
        Mencionado em{" "}
        <span className="font-medium text-[color:var(--scriba-rose-ink)]">
          Providência em meio ao sofrimento
        </span>
      </p>
      <button
        type="button"
        className="mt-2 self-start rounded-full bg-white px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--scriba-rose-accent)]"
      >
        Revisitar sermão
      </button>
    </article>
  );
}

function EditorialCard() {
  return (
    <article className="flex flex-col gap-2 rounded-[24px] bg-[color:var(--scriba-lilac)] p-5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-4 items-center justify-center rounded-md bg-[color:var(--scriba-blue)] text-[10px] font-bold text-white"
        >
          S
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--scriba-lilac-accent)]">
          Do Scriba
        </span>
      </div>
      <h3 className="text-lg font-semibold leading-tight tracking-tight text-[color:var(--scriba-lilac-ink)]">
        O que significa meditar na Palavra?
      </h3>
      <p className="max-w-[500px] text-pretty text-[13px] font-light leading-snug text-[#77869F]">
        Uma introdução curta a uma prática antiga — e por que ela não tem nada a ver com esvaziar a
        mente.
      </p>
      <button
        type="button"
        className="mt-2 self-start rounded-full bg-[color:var(--scriba-blue)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white shadow-[0_5px_12px_rgba(79,168,240,0.26)] transition-colors hover:bg-[color:var(--scriba-blue-hover)]"
      >
        Ler · 4 min
      </button>
    </article>
  );
}
