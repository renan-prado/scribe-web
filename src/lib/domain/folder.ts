import { z } from "zod";

/**
 * A paleta de cores de pasta. Fechada de propósito — cor livre (um color
 * picker) é uma tela a mais, e "nada de cor literal em `className`" (ver
 * `src/shared/AGENTS.md`) exige que toda cor venha de um token declarado. Os
 * quatro valores SÃO os tokens dos post-its sorteados (`--v2-note-*`, ver
 * `PostItNote`), então uma pasta nunca introduz uma cor que o mural ainda não
 * usava — ela pinta com a MESMA paleta, só que ESCOLHIDA em vez de sorteada.
 */
export const FOLDER_COLORS = ["mist", "sage", "slate", "lemon"] as const;

export type FolderColor = (typeof FOLDER_COLORS)[number];

export function parseFolderColor(value: unknown): FolderColor {
  if ((FOLDER_COLORS as readonly string[]).includes(value as string)) {
    return value as FolderColor;
  }
  return FOLDER_COLORS[0];
}

/**
 * A classe do PONTINHO de cada cor (`FolderChips`, `MoveToFolderDialog`, a
 * marcação de pasta no `SavedSessionView`). Literal, não montada por
 * template: o Tailwind só gera a regra de uma classe que ele consegue ler
 * como string inteira em algum lugar do código, `` `bg-v2-note-${color}` ``
 * não geraria nada.
 */
export const FOLDER_SWATCH_BG: Record<FolderColor, string> = {
  mist: "bg-v2-note-mist",
  sage: "bg-v2-note-sage",
  slate: "bg-v2-note-slate",
  lemon: "bg-v2-note-lemon",
};

/**
 * Uma pasta do usuário. Client-safe: atravessa a fronteira do mesmo jeito que
 * `SessionListItem` (ver `domain/session.ts`) — é o corpo de `GET /api/folders`
 * e o conteúdo do cache do aparelho (`features/session/folders-query.ts`).
 */
const FolderSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.enum(FOLDER_COLORS).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Folder = z.infer<typeof FolderSchema>;
