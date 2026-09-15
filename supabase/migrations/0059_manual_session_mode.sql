-- O modo `manual`: a sessão que a PESSOA escreveu.
--
-- Os dois modos de hoje nascem de uma captura: `audio` grava pelo microfone e
-- `youtube` pega a legenda pronta de um vídeo. Os dois terminam no mesmo
-- lugar, um `final_summary` com os blocos do sermão organizado, e o produto
-- inteiro (Biblioteca, busca por versículo, estudo, exclusão) é construído
-- sobre ESSE payload, não sobre o áudio.
--
-- `manual` é o mesmo destino sem a origem: a pessoa escreve os blocos à mão em
-- `/escrever`. É o mesmo argumento que trouxe o `youtube` para dentro de
-- `sessions` em 0048 — o que um texto escrito precisa SER (linha na
-- Biblioteca, título, autor, local, resumo, busca, estudo um dia) é
-- exatamente o que uma sessão já é, e um conceito novo ao lado dela duplicaria
-- as sete telas que já sabem ler isto.
--
-- O que uma linha `manual` NÃO tem, e não é defeito:
--
--   * `transcript` fica vazio. Não houve fala para transcrever, e é isso que
--     tira do menu "Ler transcrição" e mantém a sessão fora da busca por
--     conteúdo de transcrição (`searchSessionIdsByTranscript`), que é uma
--     busca no que o pregador DISSE.
--   * `duration_ms` fica nulo. Não há minuto de áudio a contar, e é por isso
--     que o modo custa ZERO moeda: não há STT nem chamada de LLM em lugar
--     nenhum do caminho. Ver `features/coins/pricing.ts`, que continua sem
--     uma linha para ele.
--   * `source_url` fica nulo. A origem é a pessoa.
--
-- `ended_at` é preenchido no PRIMEIRO salvamento, e não fica nulo esperando um
-- encerramento que nunca vem: sem ele todo texto escrito cairia na faixa
-- "Gravações em aberto" do `/home` (`listUnfinishedSessions`), que oferece
-- "continuar ou apagar" uma gravação que não existe.

alter table public.sessions
  drop constraint if exists sessions_capture_mode_check;

alter table public.sessions
  add constraint sessions_capture_mode_check
  check (capture_mode in ('audio', 'youtube', 'manual'));
