import { MapPin, User } from "lucide-react";

// Placeholder identity/venue until we wire this to real recording metadata.
const AUTHOR_PLACEHOLDER = "José Leante";
const LOCATION_PLACEHOLDER = "Assembleia de Deus • Ipiranga • Vila Marcondes";

const MONTHS_PT = [
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

function defaultRecordingTitle(date: Date): string {
  return `Gravação dia ${date.getDate()} de ${MONTHS_PT[date.getMonth()]}.`;
}

export function RecordingHeader({
  title,
  startedAt,
  menu,
}: {
  title: string;
  startedAt: Date | null;
  menu: React.ReactNode;
}) {
  const displayTitle =
    title.trim() || (startedAt ? defaultRecordingTitle(startedAt) : "Nova gravação.");
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm leading-none text-muted-foreground">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border">
            <User className="size-3" />
          </span>
          <span className="font-medium leading-none text-foreground">{AUTHOR_PLACEHOLDER}</span>
        </div>
        {menu}
      </div>

      <h1
        key={displayTitle}
        className="animate-content-fade font-heading text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl"
        suppressHydrationWarning
      >
        {displayTitle}
      </h1>

      <p className="mt-4 flex items-center gap-1.5 text-xs leading-none text-muted-foreground">
        <MapPin className="size-3 shrink-0" />
        <span className="leading-none">{LOCATION_PLACEHOLDER}</span>
      </p>
    </header>
  );
}
