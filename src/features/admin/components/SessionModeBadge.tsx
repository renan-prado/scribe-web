import type { SessionMode } from "@/lib/domain/session";

/**
 * A pílula do modo de captura, a mesma em toda tela do painel que lista
 * sessões (`/admin/usage` e `/admin/sessions`).
 *
 * Nasceu dentro de `/admin/usage` e saiu de lá quando a segunda tela precisou
 * dela. Duas cópias divergem no primeiro modo novo, e foi o que aconteceu:
 * `youtube` entrou em `SESSION_MODES` e a cópia de lá continuou desenhando "-"
 * para ele, o que se lê como "sessão sem modo", não como "importada".
 */
const STYLES: Record<SessionMode, { label: string; className: string }> = {
  live: { label: "Com live", className: "bg-scriba-mint text-scriba-mint-accent" },
  audio_only: { label: "Sem live", className: "bg-scriba-cream text-scriba-cream-accent" },
  transcript_only: {
    label: "Transcrição",
    className: "bg-scriba-hairline-soft text-scriba-ink-soft",
  },
  youtube: { label: "YouTube", className: "bg-scriba-rose text-scriba-rose-accent" },
};

export function SessionModeBadge({ mode }: { mode: SessionMode | null }) {
  const style = mode ? STYLES[mode] : undefined;
  if (!style) return <span className="text-[10px] text-muted-foreground">-</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${style.className}`}
    >
      {style.label}
    </span>
  );
}
