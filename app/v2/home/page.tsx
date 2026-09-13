import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { listDeepenedSessionIds } from "@/lib/db/deepenings";
import {
  deleteSession,
  listSessionIdsWithSummary,
  listSessions,
  type SessionListItem,
} from "@/lib/db/sessions";
import { TopBar } from "../components/TopBar";
import { LibraryBrowser } from "./LibraryBrowser";
import { RecordDock } from "./RecordDock";
import { SearchScope, SearchToggle } from "./SearchScope";

export const metadata: Metadata = { title: "Biblioteca" };

/**
 * Server Action é um endpoint POST próprio, chamável por quem souber o id dela.
 * A autorização aqui é o RLS: `deleteSession` usa o client do USUÁRIO, e a
 * policy de `sessions` escopa o delete ao dono, então um id forjado só apaga o
 * que já era de quem chamou. Mesma decisão (e mesmo aviso) do `/recordings`:
 * trocar por `createAdminClient()` transforma isto num IDOR sem nenhum sinal no
 * diff.
 */
async function deleteSessionAction(formData: FormData): Promise<void> {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  await deleteSession(id);
  revalidatePath("/v2/home");
}

/**
 * O Início do v2: a lista de tudo que a pessoa gravou ou importou, agrupada por
 * mês, com busca atrás da lupa, e o botão de gravar no rodapé.
 *
 * O layout segue o gravador nativo do Android (`public/prints/new-release/`):
 * barra do topo, blocos por mês, botão flutuante. O CARTÃO, não: é o
 * `SessionCard` da Biblioteca, o mesmo componente, com resumo curto, orador,
 * local e as pastilhas de modo e estudo. A troca que a tela propõe é de ORDEM,
 * o acervo vira a primeira tela e gravar vira o botão que flutua sobre ele, não
 * de conteúdo do cartão.
 *
 * As três consultas são as mesmas do `/recordings`: a lista (sem as colunas
 * pesadas) e dois conjuntos de CHAVE, quais sessões já têm estudo e quais têm
 * resumo. A segunda existe porque uma sessão do modo transcrição pode ter
 * ganhado um resumo depois (ver `/api/final-summary/from-transcript`) e o
 * cartão precisa abrir na página certa.
 *
 * A busca inteira mora no cliente (`LibraryBrowser`), como no `/recordings`: a
 * página continua sendo só quem BUSCA no banco. O `SearchScope` envolve o
 * cabeçalho e a lista porque o botão está num e o estado no outro; a `TopBar`
 * segue renderizada no servidor mesmo passando por dentro dele.
 *
 * A largura trava em 640px: a tela nasceu de um print de celular, e esticada
 * num monitor viram cartões de 1400px com três palavras em cada.
 */
export default async function V2HomePage() {
  const sessions = await listSessions().catch((): SessionListItem[] => []);
  const ids = sessions.map((s) => s.id);
  const [deepenedIds, summarizedIds] = await Promise.all([
    listDeepenedSessionIds(ids).catch(() => new Set<string>()),
    listSessionIdsWithSummary(ids).catch(() => new Set<string>()),
  ]);

  return (
    <SearchScope>
      {/* A folga de baixo é a altura da barra de gravar mais o inset do iPhone:
          sem ela o último cartão da lista para debaixo dela e não há rolagem
          que o traga inteiro para a luz. Ver `RecordDock`. */}
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-4 pt-2 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <TopBar title="Biblioteca" trailing={<SearchToggle />} />
        <LibraryBrowser
          sessions={sessions}
          deepenedIds={[...deepenedIds]}
          summarizedIds={[...summarizedIds]}
          nowIso={new Date().toISOString()}
          deleteAction={deleteSessionAction}
        />
      </main>
      <RecordDock />
    </SearchScope>
  );
}
