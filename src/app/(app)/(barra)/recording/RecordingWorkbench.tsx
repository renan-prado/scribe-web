"use client";

import { memo } from "react";
import { BibleDock } from "@/features/session/components/BibleDock";
import { BibloDock } from "@/features/session/components/BibloDock";
import { RecordingNotesDock } from "./RecordingNotesDock";

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
 * ## Três CAMADAS, não mais um painel de abas
 *
 * Isto já foi uma bancada: três abas dentro de um painel que tomava metade da
 * tela, ao lado da onda. O problema era exatamente esse — "tomava metade da
 * tela" é o oposto de "a tela fica limpa enquanto grava", e uma pregação passa
 * a maior parte do tempo sem que ninguém esteja escrevendo nota, conversando
 * com o Biblo ou lendo um capítulo. Hoje as três são camadas flutuantes,
 * fechadas por padrão, sobre uma tela que volta a ser só a onda:
 *
 * - **Biblo** é o `BibloDock` de sempre — o mesmo disco de vidro no canto de
 *   baixo à direita que existe em `/summary` e `/escrever`. Sem `onInsert`:
 *   durante a gravação não há resumo em que inserir, e a conversa funciona
 *   igual sem o "Adicionar" (o mesmo caminho de antes desta tela virar
 *   `BibloPanel`).
 * - **Bíblia** é o `BibleDock` de sempre — a aba colada na borda direita, na
 *   altura do olho, que abre o leitor como gaveta (celular) ou painel
 *   (desktop).
 * - **Notas** é a única sem gêmea em outra tela — `RecordingNotesDock`, um
 *   widget no canto de baixo à ESQUERDA, porque só aqui há o que anotar
 *   enquanto se grava. Ver o cabeçalho de lá.
 *
 * Reusar os dois primeiros TAL COMO já existem, em vez de uma terceira
 * gramática de painel dentro do gravador, é o que garante que abrir a
 * conversa ou a Bíblia durante a pregação pareça a MESMA coisa que abri-las
 * lendo um resumo — o canto de baixo à direita e a borda direita já são
 * lugares conhecidos.
 *
 * ## Nada daqui pode repintar o gravador
 *
 * `BibloDock`, `BibleDock` e `RecordingNotesDock` guardam o próprio estado
 * (aberto/fechado, a conversa, o capítulo, o texto das notas) dentro de si
 * mesmos ou num store — nenhum deles sobe estado para o `AudioStudio`. Ele é
 * `memo` por causa disso: o `AudioStudio` repinta a cada troca de fase e a
 * cada segundo de saldo, e nenhuma dessas coisas tem o que dizer às três
 * ferramentas. O `MediaRecorder` mora em refs dentro do `useAudioCapture`, e
 * é por isso que abrir, fechar e interagir com qualquer uma delas nunca o
 * interrompe: elas nunca chegam perto do que o controla.
 */

type Props = {
  /**
   * A sessão que ancora a conversa. `null` enquanto ela não existe — a
   * gravação começa antes de qualquer ida ao servidor, e pode começar sem
   * rede nenhuma. Nesse instante o `BibloDock` simplesmente não é montado: o
   * mesmo vazio já cobre o Biblo, ver `AudioStudio`.
   */
  sessionId: string | null;
  /** Cria a sessão sob demanda e devolve o id. Ver `AudioStudio`. */
  ensureSession: () => Promise<string | null>;
};

function Tools({ sessionId, ensureSession }: Props) {
  return (
    <>
      <RecordingNotesDock />
      <BibleDock />
      {sessionId ? <BibloDock sessionId={sessionId} ensureSession={ensureSession} /> : null}
    </>
  );
}

export const RecordingWorkbench = memo(Tools);
