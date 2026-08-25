/**
 * pt-BR display labels + tone tokens for knowledge enums. Keep aligned
 * with the enum lists in `./types.ts` and with the CHECK constraints
 * in supabase/migrations/0013_knowledge_sources.sql.
 *
 * Tone tokens (bg/fg pairs) are hex-only so callers can drop them into
 * inline styles without importing tailwind arbitrary classes.
 */

import type { License, SourceStatus, SourceType } from "./types";

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  bible: "Bíblia",
  commentary: "Comentário",
  systematic_theology: "Teologia sistemática",
  article: "Artigo",
  book: "Livro",
  sermon: "Sermão",
  editorial: "Editorial próprio",
  session_summary: "Resumo de sessão",
  session_deepening: "Aprofundamento de sessão",
  session_highlight: "Destaque de sessão",
};

export const SOURCE_TYPE_TONE: Record<SourceType, { bg: string; fg: string }> = {
  bible: { bg: "#EAF4FE", fg: "#3E86C4" },
  commentary: { bg: "#F0EAFE", fg: "#6E4EC0" },
  systematic_theology: { bg: "#E4EFEA", fg: "#4E8570" },
  article: { bg: "#F5F1E6", fg: "#8B7038" },
  book: { bg: "#FDF3DD", fg: "#C79B2A" },
  sermon: { bg: "#FAEAE5", fg: "#A8715C" },
  editorial: { bg: "#F0E9F5", fg: "#7A4E90" },
  session_summary: { bg: "#EAF3F6", fg: "#3E7A88" },
  session_deepening: { bg: "#E9F1EA", fg: "#4A7A56" },
  session_highlight: { bg: "#F6EFEA", fg: "#8B5B3D" },
};

export const LICENSE_LABEL: Record<License, string> = {
  public_domain: "Domínio público",
  cc_by: "CC BY",
  cc_by_sa: "CC BY-SA",
  editorial_original: "Editorial próprio",
  licensed_agreement: "Licenciado (contrato)",
  user_content: "Conteúdo do usuário",
};

export const LICENSE_TONE: Record<License, { bg: string; fg: string }> = {
  public_domain: { bg: "#E4EFEA", fg: "#4E8570" },
  cc_by: { bg: "#EAF4FE", fg: "#3E86C4" },
  cc_by_sa: { bg: "#EAF3F6", fg: "#3E7A88" },
  editorial_original: { bg: "#F0E9F5", fg: "#7A4E90" },
  licensed_agreement: { bg: "#FDF3DD", fg: "#C79B2A" },
  user_content: { bg: "#F4F1EA", fg: "#7B6748" },
};

export const STATUS_LABEL: Record<SourceStatus, string> = {
  draft: "Rascunho",
  processing: "Indexando…",
  indexed: "Indexado",
  failed: "Falhou",
};

export const STATUS_TONE: Record<SourceStatus, { bg: string; fg: string }> = {
  draft: { bg: "#F4F1EA", fg: "#7B6748" },
  processing: { bg: "#FDF3DD", fg: "#C79B2A" },
  indexed: { bg: "#E4EFEA", fg: "#4E8570" },
  failed: { bg: "#FAEAE5", fg: "#A8715C" },
};

/** Types editorial-CRUD-eligible (Bible + session-derived types are excluded). */
export const EDITORIAL_SOURCE_TYPES: SourceType[] = [
  "commentary",
  "systematic_theology",
  "article",
  "book",
  "sermon",
  "editorial",
];

/** Licenses selectable in the editorial form (user_content is DB-internal). */
export const SELECTABLE_LICENSES: License[] = [
  "public_domain",
  "cc_by",
  "cc_by_sa",
  "editorial_original",
  "licensed_agreement",
];
