/**
 * Placeholder strings used to display "unknown speaker / location" in the UI
 * when the session row has NULL / empty values in speaker_name /
 * speaker_location. Extracted so the edit dialog can detect them and open
 * with a blank input instead of the placeholder text.
 */
export const UNKNOWN_SPEAKER_LABEL = "Autor desconhecido";
export const UNKNOWN_LOCATION_LABEL = "Local desconhecido";

export function isUnknownSpeakerLabel(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return !v || v.toLowerCase() === UNKNOWN_SPEAKER_LABEL.toLowerCase();
}

export function isUnknownLocationLabel(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return !v || v.toLowerCase() === UNKNOWN_LOCATION_LABEL.toLowerCase();
}

/** Returns the value if it isn't a placeholder; otherwise empty string. */
export function normalizeSpeakerInput(value: string | null | undefined): string {
  return isUnknownSpeakerLabel(value) ? "" : (value ?? "").trim();
}

export function normalizeLocationInput(value: string | null | undefined): string {
  return isUnknownLocationLabel(value) ? "" : (value ?? "").trim();
}
