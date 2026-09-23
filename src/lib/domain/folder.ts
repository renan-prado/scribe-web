import { z } from "zod";

/**
 * A paleta de cores de pasta, e **ela não é mais escolhível**: o seletor de
 * quatro faces saiu do `FolderDialog` (ver o cabeçalho de lá), toda pasta nova
 * nasce sem cor, e `FOLDER_COLORS[0]` é o padrão de leitura de todas elas.
 *
 * O vocabulário fica porque a coluna `folders.color` fica (migração 0068) e a
 * API continua aceitando o campo: quem lê uma linha antiga precisa saber
 * traduzir o valor que está lá. Os quatro valores SÃO os tokens dos post-its
 * sorteados (`--v2-note-*`, ver `PostItNote`), então uma pasta nunca
 * introduziu uma cor que o mural não usava.
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
 * A TINTA do ícone de pasta (`FolderGrid`, `MoveToFolderDialog`, a marcação de
 * pasta no `SavedSessionView`). O cartão da pasta é cinza como o da grade de
 * sessões (`--v2-card`), e a cor entra só no ícone — então o token precisa ser
 * legível SOBRE aquele cinza.
 *
 * Classes LITERAIS, não montadas por template: o Tailwind só gera a regra de
 * uma classe que ele consegue ler como string inteira em algum lugar do
 * código, `` `text-v2-note-${color}` `` não geraria nada.
 *
 * Com o seletor fora, o caminho normal é `color === null` e a leitura cai em
 * `mist` para todas. `slate` aponta para `--v2-note-slate-mute` e não para
 * `--v2-note-slate` porque o segundo É o cinza do cartão, e o ícone de uma
 * pasta antiga gravada assim simplesmente não apareceria.
 */
/**
 * A cor do ícone de pasta, e ela sai do `-mute` de cada post-it, NUNCA da
 * superfície dele.
 *
 * Três dos quatro apontavam para a superfície (`text-v2-note-mist`), e
 * funcionava enquanto aquelas eram pastéis CLAROS: um glifo azul-claro tinha
 * contraste de sobra no cartão escuro do app. Com os post-its virando cinzas
 * nos dois temas, a superfície deles passou a ser quase a mesma do cartão em
 * que o ícone pousa — no claro ele saía quase branco sobre cinza-claro, e no
 * escuro sairia escuro sobre escuro. O mesmo erro, espelhado.
 *
 * O `-mute` é a tinta já calibrada de cada família (~5:1 sobre o próprio
 * cartão), e como post-it e cartão do app estão no mesmo degrau em cada tema,
 * ela vale nos dois. A pasta continua colorida — o matiz é o mesmo —, só deixa
 * de ser pintada com uma cor de FUNDO.
 */
export const FOLDER_ICON_INK: Record<FolderColor, string> = {
  mist: "text-v2-note-mist-mute",
  sage: "text-v2-note-sage-mute",
  slate: "text-v2-note-slate-mute",
  lemon: "text-v2-note-lemon-mute",
};

/**
 * Quantos níveis de pasta o produto aceita, e o número é o MESMO do gatilho
 * `folders_tree` da migração 0069 — o banco é quem recusa, isto aqui é só
 * para a tela poder esconder "Nova pasta" antes de o gesto falhar.
 */
export const MAX_FOLDER_DEPTH = 3;

/**
 * Uma pasta do usuário. Client-safe: atravessa a fronteira do mesmo jeito que
 * `SessionListItem` (ver `domain/session.ts`) — é o corpo de `GET /api/folders`
 * e o conteúdo do cache do aparelho (`features/session/folders-query.ts`).
 *
 * `parentId` é a pasta MÃE, ou `null` para uma pasta de raiz (migração 0069).
 * A árvore vem no fio como uma lista plana, e é montada na tela pelos
 * helpers abaixo: uma dúzia de pastas não justifica um formato aninhado, que
 * custaria um segundo caminho de parse nas duas pontas.
 */
const FolderSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.enum(FOLDER_COLORS).nullable(),
  parentId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Folder = z.infer<typeof FolderSchema>;

/** As pastas filhas diretas de `parentId` (ou as de raiz, com `null`). */
export function folderChildren(folders: Folder[], parentId: string | null): Folder[] {
  return folders.filter((f) => f.parentId === parentId);
}

/**
 * O caminho da raiz até `id`, inclusive — é a migalha de pão
 * ("Biblioteca › 2026 › Romanos"). Devolve `[]` para um id que não está na
 * lista, que é o caso normal enquanto o cache do aparelho ainda não
 * revalidou.
 *
 * O teto de `MAX_FOLDER_DEPTH` iterações não é só otimização: ele é o que
 * impede esta função de girar para sempre se uma árvore com ciclo chegar aqui
 * (o banco recusa um, mas quem desenha a tela não confia nisso para não
 * travar a aba).
 */
export function folderPath(folders: Folder[], id: string | null): Folder[] {
  if (!id) return [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  const out: Folder[] = [];
  let cursor: string | null = id;
  while (cursor && out.length < MAX_FOLDER_DEPTH) {
    const folder: Folder | undefined = byId.get(cursor);
    if (!folder) break;
    out.unshift(folder);
    cursor = folder.parentId;
  }
  return out;
}

/** Em que nível uma pasta está: 1 para uma de raiz, 3 no máximo. */
export function folderDepth(folders: Folder[], id: string | null): number {
  return folderPath(folders, id).length;
}

/**
 * A árvore achatada em ordem de LEITURA (mãe, depois as filhas dela, depois a
 * irmã seguinte), com o nível de cada uma. É o que uma LISTA precisa para
 * mostrar hierarquia — o `MoveToFolderDialog` recua cada linha por este
 * número.
 *
 * Ele não substitui `folderChildren`: a GRADE da Biblioteca desenha um nível
 * por vez e navega para dentro, a lista mostra a árvore inteira de uma vez
 * porque ali a pessoa está escolhendo um destino e precisa ver todos.
 */
export function flattenFolderTree(folders: Folder[]): { folder: Folder; depth: number }[] {
  const out: { folder: Folder; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    if (depth > MAX_FOLDER_DEPTH) return;
    for (const folder of folderChildren(folders, parentId)) {
      out.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 1);
  return out;
}

/**
 * "2 pastas · 3 resumos", e "Vazia" quando não há nem uma coisa nem outra.
 * Mora aqui porque DUAS telas a escrevem — o cartão da grade e o título da
 * pasta aberta —, e duas cópias divergiriam no primeiro ajuste de plural.
 */
export function folderCountLabel(subfolders: number, sessions: number): string {
  const parts: string[] = [];
  if (subfolders > 0) parts.push(`${subfolders} ${subfolders === 1 ? "pasta" : "pastas"}`);
  if (sessions > 0) parts.push(`${sessions} ${sessions === 1 ? "resumo" : "resumos"}`);
  return parts.length > 0 ? parts.join(" · ") : "Vazia";
}

/** `id` e toda a descendência dela. É o alcance de "excluir também as
 *  sessões": apagar uma pasta apaga as filhas por cascata no banco (0069), e
 *  as sessões que estavam nelas não podem ficar de fora da conta. */
export function folderSubtreeIds(folders: Folder[], id: string): string[] {
  const seen = new Set([id]);
  const out = [id];
  for (let i = 0; i < out.length; i += 1) {
    for (const child of folders) {
      if (child.parentId === out[i] && !seen.has(child.id)) {
        seen.add(child.id);
        out.push(child.id);
      }
    }
  }
  return out;
}
