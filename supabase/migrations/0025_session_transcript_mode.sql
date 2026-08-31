-- Modo de gravação "transcript_only": só transcreve, mostrando cada chunk na
-- tela durante a captura. Sem pipelines ao vivo e sem resumo final — a sessão
-- salva fica com final_summary null e feed_items vazio.
--
-- Preço: 1 moeda por minuto iniciado (reason 'transcript_minute'), contra 2 do
-- audio_only e 5 do live. A tabela de custos é derivada do reason em
-- @/lib/coins/pricing.ts — o SQL não precisa saber o valor.

alter table public.sessions drop constraint if exists sessions_capture_mode_check;
alter table public.sessions
  add constraint sessions_capture_mode_check
  check (capture_mode in ('live', 'audio_only', 'transcript_only'));
