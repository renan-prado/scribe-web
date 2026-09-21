"use client";

import { Loader2, WifiOff } from "lucide-react";
import { memo, useState } from "react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { BibleReader } from "@/features/session/components/BibleReader";
import { BibloDrawer } from "@/features/session/components/BibloDrawer";
import { RECORDING_NOTES_MAX_CHARS, useRecordingNotes } from "./recording-notes";

/**
 * As três ferramentas que correm AO LADO da gravação: Notas, Biblo e Bíblia.
 *
 * ## O problema
 *
 * Uma pregação dura quarenta minutos e a tela de gravação passa os quarenta
 * mostrando treze barrinhas. Quem está ali com o aparelho na mão tem dúvidas
 * ("de onde é esse versículo?"), tem insights que não cabem na memória e tem o
 * nome do preletor que o microfone não vai entender. Tudo isso hoje acontece
 * fora do Scriba, em outro app, com o risco de o sistema matar a aba que está
 * gravando.
 *
 * ## A regra que governa este arquivo
 *
 * **Nada daqui pode repintar o gravador.** Todo o estado (a aba aberta, o
 * texto das notas, o caminho na Bíblia, a conversa) nasce e morre DENTRO deste
 * componente ou no store de notas, e as props que ele recebe são estáveis. Ele
 * é `memo` por causa disso: o `AudioStudio` repinta a cada troca de fase e a
 * cada segundo de saldo, e nenhuma dessas coisas tem o que dizer a uma
 * conversa em andamento.
 *
 * ## Abas, e não painéis lado a lado
 *
 * No celular não há largura para dois painéis, e no desktop a tela de gravação
 * já é uma coluna com a onda no meio: a divisão em duas colunas acontece um
 * nível acima (`AudioStudio`), entre o GRAVADOR e esta bancada. Aqui dentro,
 * três abas — as três coisas são alternativas uma da outra, ninguém escreve
 * uma nota enquanto lê um salmo.
 *
 * `keepMounted` está LIGADO, ao contrário do padrão do `Tabs`. É o que faz a
 * conversa com o Biblo sobreviver a uma passada pela Bíblia: sem ele o painel
 * sai do DOM, a gaveta remonta do zero e o rascunho que estava sendo digitado
 * some. Numa tela em que a pessoa alterna o tempo todo, desmontar é perder.
 */

type Props = {
  /**
   * A sessão que ancora a conversa. `null` enquanto ela não existe — a
   * gravação começa antes de qualquer ida ao servidor, e pode começar sem rede
   * nenhuma.
   */
  sessionId: string | null;
  /** Cria a sessão sob demanda e devolve o id. Ver `AudioStudio`. */
  ensureSession: () => Promise<string | null>;
};

function NotesPanel() {
  // A ÚNICA assinatura deste texto. O `AudioStudio` lê por `getState()`.
  const notes = useRecordingNotes((s) => s.notes);
  const setNotes = useRecordingNotes((s) => s.setNotes);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value.slice(0, RECORDING_NOTES_MAX_CHARS))}
        maxLength={RECORDING_NOTES_MAX_CHARS}
        placeholder="Nomes, referências, a frase que você não quer perder…"
        aria-label="Anotações desta gravação"
        className="min-h-40 flex-1 resize-none rounded-2xl bg-v2-card p-4 text-[14px] leading-relaxed text-v2-ink placeholder:text-v2-ink-mute focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
      />
      {/* A promessa, dita uma vez. Sem ela o campo parece um bloco de notas
          qualquer, e a pessoa não tem por que preferi-lo ao do sistema. */}
      <p className="shrink-0 px-1 text-[11px] font-light leading-snug text-v2-ink-mute">
        O Scriba lê estas notas junto com a transcrição ao escrever o resumo.
      </p>
    </div>
  );
}

function BibloPanel({ sessionId, ensureSession }: Props) {
  if (!sessionId) {
    return (
      <div className="flex min-h-40 flex-1 flex-col items-center justify-center gap-3 rounded-2xl bg-v2-card p-6 text-center">
        <WifiOff aria-hidden className="size-5 text-v2-ink-mute" strokeWidth={1.75} />
        <p className="text-[13px] font-light leading-snug text-v2-ink-mute">
          A conversa com o Biblo precisa de internet. Sua gravação continua, e ele volta assim que a
          conexão voltar.
        </p>
        <button
          type="button"
          onClick={() => void ensureSession()}
          className="inline-flex items-center gap-1.5 rounded-full bg-v2-card-hover px-4 py-2 text-[12px] font-semibold text-v2-ink transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
        >
          <Loader2 aria-hidden className="size-3.5" strokeWidth={2} />
          Tentar de novo
        </button>
      </div>
    );
  }

  // `layout="inline"` é o que tira da gaveta a moldura `fixed` e o fechar: aqui
  // ela é o conteúdo de uma aba, não um painel pousado sobre a tela. Sem
  // `onInsert`: durante a gravação não existe resumo em que inserir, e a
  // conversa funciona igual sem o "Adicionar" (é o mesmo caminho do
  // `/summary` antes de a leitura saber editar).
  return (
    <BibloDrawer
      layout="inline"
      sessionId={sessionId}
      ensureSession={ensureSession}
      onThinking={() => {}}
      className="min-h-[22rem] flex-1"
    />
  );
}

function Workbench({ sessionId, ensureSession }: Props) {
  const [tab, setTab] = useState("notas");

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(String(value))}
      className="flex min-h-0 flex-1 flex-col gap-3"
    >
      <TabsList className="shrink-0 self-center">
        <TabsTab value="notas">Notas</TabsTab>
        <TabsTab value="biblo">Biblo</TabsTab>
        <TabsTab value="biblia">Bíblia</TabsTab>
      </TabsList>

      <TabsPanel keepMounted value="notas" className="min-h-0 flex-1">
        <NotesPanel />
      </TabsPanel>
      <TabsPanel keepMounted value="biblo" className="min-h-0 flex-1">
        <BibloPanel sessionId={sessionId} ensureSession={ensureSession} />
      </TabsPanel>
      <TabsPanel keepMounted value="biblia" className="min-h-0 flex-1">
        <BibleReader className="flex-1 rounded-2xl bg-v2-card p-3" />
      </TabsPanel>
    </Tabs>
  );
}

export const RecordingWorkbench = memo(Workbench);
