-- UM modo de captura.
--
-- O produto tinha quatro `capture_mode`, e três deles gravavam pelo microfone:
-- `live` (com os pipelines de bíblia/insights/eco alimentando um feed durante
-- a pregação), `audio_only` (transcrever e resumir) e `transcript_only` (só
-- transcrever, sem resumo). Os três foram removidos do código e substituídos
-- por um: `audio`, que é o que `audio_only` já fazia. `youtube` continua, e
-- continua não gravando nada.
--
-- POR QUE UM UPDATE E NÃO UM MAPEAMENTO EM LEITURA. `parseSessionMode` traduz
-- os nomes antigos (é o que impede uma linha não migrada de quebrar a tela),
-- mas deixar o banco com quatro valores significaria que todo filtro do
-- `/admin` teria de conhecer os quatro para sempre, e que o `check` mentiria
-- sobre o que o produto é. O nome antigo não carrega informação que valha
-- guardar: os três gravaram áudio, e o que os separava era o que rodava
-- DURANTE a gravação, que já não roda para ninguém.
--
-- O QUE NÃO SAI DAQUI, e é deliberado:
--
--   * `sessions.feed_items` e a projeção `public.session_feed_items` (0004)
--     FICAM. Nada mais as escreve, mas `search_sessions_by_verse` (0041) lê a
--     segunda para responder "onde eu ouvi Jonas 1?" nas sessões gravadas
--     antes desta migração. Apagá-las tiraria dessas sessões uma busca que
--     hoje funciona, para economizar espaço que ninguém está pedindo.
--   * `coin_transactions.reason` FICA como está. `live_minute`,
--     `audio_only_minute`, `transcript_minute` e `summary_from_transcript` não
--     são mais emitidos, e as linhas antigas continuam somando na mesma ação do
--     painel (ver `lib/coins/billable.ts`). Reescrever motivo em ledger de
--     dinheiro é apagar o que de fato aconteceu.
--   * `session_rereads`, `session_reminders` e `session_highlights` FICAM, e a
--     remoção delas, se vier, é outra migração: o código parou de gerar releia
--     / lembra / frase marcante junto com o resumo, mas apagar a tabela é
--     irreversível e não precisa acontecer no mesmo commit que o código.

-- 1. O `check` sai PRIMEIRO. Fora de ordem, o UPDATE abaixo escreveria 'audio'
--    sob a restrição antiga, que não conhece esse valor, e a migração inteira
--    falharia na primeira linha.
alter table public.sessions
  drop constraint if exists sessions_capture_mode_check;

-- 2. Os três modos de microfone viram um. `is null` entra junto: linha sem
--    modo é de antes de 0010, e todas elas gravaram áudio.
update public.sessions
   set capture_mode = 'audio'
 where capture_mode is null
    or capture_mode in ('live', 'audio_only', 'transcript_only');

-- 3. O `check` volta, agora dizendo a verdade.
alter table public.sessions
  add constraint sessions_capture_mode_check
  check (capture_mode in ('audio', 'youtube'));

-- 4. O default acompanha: uma linha criada sem modo é uma gravação.
alter table public.sessions
  alter column capture_mode set default 'audio';
