"use client";

import type { BibloAction } from "@/lib/domain/biblo";
import type { SummaryBlock } from "@/lib/domain/summary";
import { createLogger } from "@/lib/log";

const log = createLogger("biblo-workspace");

/**
 * A bancada da conversa da BIBLIOTECA: onde ela mora e o que ela produz.
 *
 * ## Duas coisas diferentes, e confundi-las seria o defeito
 *
 * **A ÂNCORA** é uma sessão vazia que existe só para a conversa ter a que se
 * prender. Toda mensagem do Biblo é gravada sob um `session_id` (migração
 * 0062), e na Biblioteca não há sessão nenhuma na tela. Ela nasce no primeiro
 * "enviar", fica com `ended_at` nulo para sempre, e por isso **não aparece no
 * acervo**: `listSessions` filtra `ended_at is not null`. É o mesmo desenho do
 * `/escrever`, onde o id nasce no aparelho e a linha só existe quando há o que
 * guardar.
 *
 * **O DOCUMENTO** é o que o Biblo CRIA quando a pessoa pede um texto. Ele é uma
 * sessão de verdade, modo `manual`, escrita por `/api/sessions/written` — a
 * mesma rota do editor —, e aparece no acervo como qualquer resumo escrito à
 * mão. Ele é separado da âncora de propósito: se a conversa virasse o
 * documento, a segunda pergunta da pessoa estaria acontecendo dentro do texto
 * que ela acabou de mandar criar, e a terceira criaria um documento dentro de
 * outro.
 *
 * ## Por que no `localStorage`
 *
 * Porque a âncora e o documento em edição precisam sobreviver a recarregar a
 * página, e nenhum dos dois é conteúdo: são o ENDEREÇO do que é conteúdo. Uma
 * coluna no banco daria o mesmo, com uma migração e uma ida ao servidor para
 * guardar dois uuids. O pior caso de perder isto é a conversa seguinte começar
 * limpa, com o documento anterior intacto no acervo.
 *
 * ## Quem executa as ferramentas é o CLIENTE
 *
 * O servidor decide o que o Biblo QUER fazer (ver `BibloAction`); quem escreve
 * é daqui, por `/api/sessions/written`, que confere dono e passa pela RLS.
 * Duas consequências boas: nenhuma rota nova nasce com permissão de escrever no
 * acervo de alguém, e uma ação inventada por um modelo alucinado esbarra no
 * mesmo schema que o editor esbarra.
 */

const STORAGE_KEY = "scriba:biblo-home";

export type BibloDoc = {
  id: string;
  title: string;
  shortSummary: string;
  blocks: SummaryBlock[];
};

export type BibloWorkspace = {
  /** A sessão que ancora a conversa. Nunca é o documento. */
  sessionId: string | null;
  /** A linha já foi criada no banco. Antes disso o id existe só aqui. */
  created: boolean;
  /** O documento desta conversa, quando já existe um. */
  doc: BibloDoc | null;
};

export const EMPTY_WORKSPACE: BibloWorkspace = { sessionId: null, created: false, doc: null };

/**
 * A bancada guardada, com o id da âncora JÁ SORTEADO se ele faltava.
 *
 * **O id nasce no aparelho, e a linha só depois**, exatamente como no
 * `/escrever`. A razão aqui é outra e mais direta: a gaveta precisa de um
 * `sessionId` para LER a conversa, e o `GET /api/biblo` responde sem exigir que
 * a sessão exista (está escrito no cabeçalho daquela rota). Com o id local, a
 * primeira abertura da gaveta é instantânea e não custa linha nenhuma no banco
 * a quem só abriu para ver o que é. A linha nasce na primeira PERGUNTA, que é
 * quando ela passa a ter o que guardar.
 */
export function readWorkspace(): BibloWorkspace {
  let saved: Partial<BibloWorkspace> = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw) as Partial<BibloWorkspace>;
  } catch {
    // Aba anônima, cota, JSON corrompido. Começar limpo é a resposta certa.
  }
  const workspace: BibloWorkspace = {
    sessionId: typeof saved.sessionId === "string" ? saved.sessionId : crypto.randomUUID(),
    created: saved.created === true,
    doc: saved.doc && typeof saved.doc.id === "string" ? (saved.doc as BibloDoc) : null,
  };
  if (workspace.sessionId !== saved.sessionId) writeWorkspace(workspace);
  return workspace;
}

export function writeWorkspace(workspace: BibloWorkspace): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // A conversa vale para esta sessão de tela mesmo sem poder ser guardada.
  }
}

/**
 * Cria a âncora, se ela ainda não existe, e devolve o id.
 *
 * `mode: "manual"` e não `"audio"`: não há microfone nenhum aqui, e o modo é o
 * que decide o que a tela da sessão oferece caso alguém chegue nela por um
 * endereço direto. Ela nunca é encerrada, então nunca entra no acervo.
 */
export async function ensureWorkspaceSession(): Promise<string | null> {
  const workspace = readWorkspace();
  const id = workspace.sessionId;
  if (!id) return null;
  if (workspace.created) return id;
  try {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, mode: "manual" }),
    });
    if (!res.ok) return null;
    writeWorkspace({ ...workspace, created: true });
    return id;
  } catch {
    return null;
  }
}

/** O rótulo do que está acontecendo, para a gaveta dizer em vez de só girar. */
export const ACTION_LABELS: Record<BibloAction["tool"], string> = {
  criarDocumento: "O Biblo está criando o documento…",
  editarTitulo: "O Biblo está mudando o título…",
  adicionarBlocoDeConteudo: "O Biblo está acrescentando o conteúdo…",
  iniciarGravacao: "Redirecionando para a gravação…",
  importarVideoDoYoutube: "Abrindo a importação do vídeo…",
  navegarPara: "Redirecionando…",
};

async function save(doc: BibloDoc): Promise<boolean> {
  const res = await fetch("/api/sessions/written", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: doc.id,
      summary: { title: doc.title, shortSummary: doc.shortSummary, blocks: doc.blocks },
    }),
  });
  return res.ok;
}

/** Um título de emergência, para o caso de acrescentar conteúdo sem documento. */
function titleFrom(blocks: SummaryBlock[]): string {
  const heading = blocks.find((b) => b.type === "h1" || b.type === "h2");
  return heading?.text.trim() || "Documento do Biblo";
}

/**
 * Para as TRÊS ações que só navegam: a URL de destino, ou `null` quando a
 * ação é uma das de documento. Pura e sem `fetch` — o `router.push` mora no
 * componente, que é quem TEM um router; este arquivo não tem.
 *
 * `iniciarGravacao` usa o MESMO `?auto=1` do "Gravar" do `CreateDock`, e
 * `importarVideoDoYoutube` o MESMO `?url=` do compartilhar-com-o-Scriba —
 * ver `docs/youtube.md` §9. Duas gramáticas para "abrir esta tela já
 * preenchida" seriam duas para aprender e duas para manter iguais.
 */
export function navigationTargetFor(action: BibloAction): string | null {
  switch (action.tool) {
    case "iniciarGravacao":
      return "/recording?auto=1";
    case "importarVideoDoYoutube":
      return action.url ? `/importar?url=${encodeURIComponent(action.url)}` : "/importar";
    case "navegarPara":
      return action.destino === "perfil" ? "/profile" : "/home";
    default:
      return null;
  }
}

export type ActionOutcome =
  | { ok: true; doc: BibloDoc; created: boolean }
  | { ok: false; reason: "save_failed" };

/**
 * Executa UMA ferramenta e devolve o documento resultante.
 *
 * **`adicionarBlocoDeConteudo` sem documento CRIA um**, em vez de falhar. O
 * prompt manda criar primeiro, e o modelo quase sempre manda as duas ações
 * juntas; mas a conversa pode ter sido recomeçada noutro aparelho, e recusar
 * ali devolveria "não deu" para um pedido perfeitamente claro. O título sai do
 * primeiro cabeçalho dos blocos.
 *
 * **`editarTitulo` sem documento é a única que não tem para onde ir** e é
 * descartada com uma linha no log: renomear o que não existe não tem leitura
 * razoável nenhuma.
 *
 * **As três de NAVEGAÇÃO não passam por aqui.** Esta função só sabe salvar
 * documento; `iniciarGravacao`, `importarVideoDoYoutube` e `navegarPara` são
 * um `router.push`, e quem tem o router é o componente (ver
 * `navigationTargetFor` e `BibloHomeDock`). Chamada com uma delas por engano,
 * ela devolve `null` em vez de acessar um campo que não existe.
 */
export async function runBibloAction(
  action: BibloAction,
  current: BibloDoc | null
): Promise<ActionOutcome | null> {
  if (action.tool === "criarDocumento") {
    const doc: BibloDoc = {
      id: crypto.randomUUID(),
      title: action.title,
      shortSummary: action.shortSummary ?? "",
      blocks: action.blocks,
    };
    if (!(await save(doc))) return { ok: false, reason: "save_failed" };
    return { ok: true, doc, created: true };
  }

  if (action.tool === "editarTitulo") {
    if (!current) {
      log.warn("editarTitulo sem documento", {});
      return null;
    }
    const doc = { ...current, title: action.title };
    if (!(await save(doc))) return { ok: false, reason: "save_failed" };
    return { ok: true, doc, created: false };
  }

  if (action.tool !== "adicionarBlocoDeConteudo") return null;

  const base: BibloDoc = current ?? {
    id: crypto.randomUUID(),
    title: titleFrom(action.blocks),
    shortSummary: "",
    blocks: [],
  };
  const doc = { ...base, blocks: [...base.blocks, ...action.blocks] };
  if (!(await save(doc))) return { ok: false, reason: "save_failed" };
  return { ok: true, doc, created: current === null };
}
