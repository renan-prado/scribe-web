/**
 * Como uma sessão nasceu. Client-safe.
 *
 * - `audio`: o microfone. Grava um arquivo só, transcreve no stop, resume.
 * - `youtube`: NÃO CAPTURA NADA. A transcrição vem pronta das legendas de um
 *   vídeo e o resumo roda sobre ela.
 * - `manual`: NÃO CAPTURA E NÃO GERA NADA. A pessoa escreve os blocos à mão em
 *   `/escrever`, e eles são gravados como `final_summary` direto.
 *
 * **Eram quatro, e a diferença entre três deles era o que rodava DURANTE a
 * pregação.** `live` mantinha três pipelines de enriquecimento alimentando um
 * feed ao vivo; `transcript_only` não gerava resumo; `audio_only` ficava no
 * meio. Os três foram removidos: o produto é gravar, resumir e, se a pessoa
 * quiser, aprofundar. Um modo de captura só.
 *
 * **`manual` é o modo sem NENHUMA das duas pontas**, e mora aqui pelo mesmo
 * motivo: o destino de tudo no Scriba é um `SummaryPayload` numa linha de
 * `sessions`, e escrevê-lo à mão não muda nada do que vem depois dele. Custa
 * ZERO moeda, porque não há STT nem chamada de modelo em lugar nenhum do
 * caminho — não existe um `COIN_COSTS` para ele, e isso é a regra, não um
 * esquecimento.
 *
 * **Uma sessão `manual` não tem transcrição**, e quem depende dela precisa
 * saber disso: o `/summary` não desenha o segundo slide, `/api/deepening` recusa
 * com `empty_transcript`, e a busca de CONTEÚDO (que varre o que o pregador
 * disse) não a encontra. A busca por REFERÊNCIA encontra, ela lê os blocos
 * `bibleQuote` do resumo, que o texto escrito tem como qualquer outro.
 *
 * **`youtube` é o modo que não grava, e mora aqui assim mesmo.** A alternativa
 * era um conceito novo ao lado de sessão, e o que uma importação precisa ser
 * (linha na Biblioteca, transcrição, resumo, estudo) é exatamente o que uma
 * sessão já é. O preço dele é o único que não é por minuto: um vídeo custa
 * `COIN_COSTS.youtubeImport`, cobrado uma vez, porque não há minuto de STT para
 * contar. Ver `lib/coins/pricing.ts`.
 */
export const SESSION_MODES = ["audio", "youtube", "manual"] as const;

export type SessionMode = (typeof SESSION_MODES)[number];

/**
 * Os três nomes antigos continuam existindo em linhas gravadas antes da
 * unificação (migração 0057) e em qualquer cliente que não recarregou.
 * Todos eles gravaram áudio pelo microfone, então todos são `audio` aqui.
 */
const LEGACY_MODES: Record<string, SessionMode> = {
  live: "audio",
  audio_only: "audio",
  transcript_only: "audio",
};

export function parseSessionMode(value: unknown): SessionMode {
  if ((SESSION_MODES as readonly string[]).includes(value as string)) {
    return value as SessionMode;
  }
  return LEGACY_MODES[value as string] ?? "audio";
}

/**
 * O cartão de uma sessão no MURAL da Biblioteca: o cabeçalho, sem nada pesado.
 *
 * Mora em `domain/` e não em `lib/db/sessions.ts`, onde nasceu, porque agora
 * ele atravessa a fronteira: a lista deixou de ser só um retorno de consulta do
 * servidor e virou o corpo de `GET /api/sessions` e o conteúdo do cache do
 * aparelho (ver `features/session/query.ts`). `lib/db/` leva `server-only`, e a
 * regra do repositório é que tipo compartilhado vive aqui.
 *
 * Não traz `finalSummary` nem `transcript` — o cartão mostra autor, título e
 * data, e as duas colunas pesadas têm rota própria.
 */
export type SessionListItem = {
  id: string;
  createdAt: string;
  durationMs: number | null;
  title: string | null;
  shortSummary: string | null;
  speakerId: string | null;
  locationId: string | null;
  speakerName: string | null;
  speakerLocation: string | null;
  mode: SessionMode;
  sourceUrl: string | null;
  /** A pasta da sessão, ou `null` para "sem pasta" (a raiz). Migração 0068,
   *  ver `src/lib/domain/folder.ts`. */
  folderId: string | null;
};
