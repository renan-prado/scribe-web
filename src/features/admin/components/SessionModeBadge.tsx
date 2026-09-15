import type { SessionMode } from "@/lib/domain/session";

/**
 * A pílula do modo de captura, a mesma em toda tela do painel que lista
 * sessões (`/admin/custos` e `/admin/sessions`).
 *
 * Nasceu dentro de `/admin/custos` e saiu de lá quando a segunda tela precisou
 * dela. Duas cópias divergem no primeiro modo novo, e foi o que aconteceu:
 * `youtube` entrou em `SESSION_MODES` e a cópia de lá continuou desenhando "-"
 * para ele, o que se lê como "sessão sem modo", não como "importada".
 */
const STYLES: Record<SessionMode, { label: string; className: string }> = {
  audio: { label: "Gravação", className: "bg-scriba-cream text-scriba-cream-accent" },
  youtube: { label: "YouTube", className: "bg-scriba-mint text-scriba-mint-dark" },
  // O texto escrito à mão. A pílula existe aqui apesar de ele não gerar custo
  // nenhum: as duas telas que a usam listam SESSÕES, não chamadas, e uma
  // sessão sem pílula se lê como "sem modo", que é o erro que este componente
  // nasceu para corrigir.
  manual: { label: "Escrito", className: "bg-scriba-lilac text-scriba-lilac-ink" },
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
