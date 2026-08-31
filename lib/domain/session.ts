/**
 * Modo de captura de uma sessão. Client-safe (a camada de DB é server-only,
 * mas o diálogo de nova gravação e os helpers de rota rodam no browser).
 *
 * - `live`            — pipelines de enriquecimento ao vivo (bible/insights/echo)
 *                       + resumo final no stop.
 * - `audio_only`      — só transcreve em segundo plano; resumo final no stop.
 * - `transcript_only` — só transcreve, mostrando cada chunk na tela conforme
 *                       ele volta do /api/transcribe. NENHUMA chamada de LLM
 *                       além do transcribe: sem cards ao vivo e sem resumo.
 */
export const SESSION_MODES = ["live", "audio_only", "transcript_only"] as const;

export type SessionMode = (typeof SESSION_MODES)[number];

export function parseSessionMode(value: unknown): SessionMode {
  return (SESSION_MODES as readonly string[]).includes(value as string)
    ? (value as SessionMode)
    : "live";
}

/**
 * Segmento de rota da PÁGINA DE GRAVAÇÃO de cada modo — /recording/{id}/{seg}.
 * Cada página redireciona para cá quando o modo da sessão não bate com ela.
 */
export function recordingRouteFor(mode: SessionMode): "live" | "audio" | "transcribe" {
  if (mode === "audio_only") return "audio";
  if (mode === "transcript_only") return "transcribe";
  return "live";
}

/**
 * Segmento de rota da SESSÃO SALVA. Sessões transcript_only não têm resumo,
 * então moram numa página própria de leitura da transcrição.
 */
export function savedRouteFor(mode: SessionMode): "summary" | "transcript" {
  return mode === "transcript_only" ? "transcript" : "summary";
}
