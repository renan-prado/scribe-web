import {
  LICENSE_LABEL,
  LICENSE_TONE,
  SOURCE_TYPE_LABEL,
  SOURCE_TYPE_TONE,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/lib/knowledge/labels";
import type { License, SourceStatus, SourceType } from "@/lib/knowledge/types";

type PillProps = { label: string; tone: { bg: string; fg: string } };

function Pill({ label, tone }: PillProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {label}
    </span>
  );
}

export function SourceTypeBadge({ type }: { type: SourceType | string }) {
  const key = type as SourceType;
  const tone = SOURCE_TYPE_TONE[key] ?? { bg: "#F4F1EA", fg: "#7B6748" };
  return <Pill label={SOURCE_TYPE_LABEL[key] ?? type} tone={tone} />;
}

export function LicenseBadge({ license }: { license: License | string }) {
  const key = license as License;
  const tone = LICENSE_TONE[key] ?? { bg: "#F4F1EA", fg: "#7B6748" };
  return <Pill label={LICENSE_LABEL[key] ?? license} tone={tone} />;
}

export function StatusBadge({ status }: { status: SourceStatus | string }) {
  const key = status as SourceStatus;
  const tone = STATUS_TONE[key] ?? { bg: "#F4F1EA", fg: "#7B6748" };
  return <Pill label={STATUS_LABEL[key] ?? status} tone={tone} />;
}
