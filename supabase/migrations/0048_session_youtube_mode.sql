-- Modo "youtube": a sessão que NÃO grava nada.
--
-- A transcrição vem pronta das legendas de um vídeo do YouTube e o resumo roda
-- sobre ela — o mesmo `generateFinalSummary` de /api/final-summary/from-transcript,
-- mais releia / lembra / frases marcantes. Sem áudio, sem chunks, sem STT.
--
-- Preço: FIXO por vídeo (reason 'youtube_import'), e não por minuto como os
-- três modos de captura — não há minuto de transcrição para contar, e o único
-- custo que escala com a duração é a transcrição na entrada do resumo. A tabela
-- de custos continua derivada do reason em @/lib/coins/pricing.ts; o SQL não
-- precisa saber o valor. O teto de duração que protege esse preço fixo mora em
-- @/lib/domain/youtube.ts (YOUTUBE_MAX_DURATION_MS).

alter table public.sessions drop constraint if exists sessions_capture_mode_check;
alter table public.sessions
  add constraint sessions_capture_mode_check
  check (capture_mode in ('live', 'audio_only', 'transcript_only', 'youtube'));

-- De ONDE veio a transcrição, quando não veio do microfone.
--
-- Null para os três modos de captura, e é assim que fica: a coluna responde
-- "qual é a origem externa desta sessão?", e uma gravação não tem uma. Para o
-- modo youtube guarda a URL canônica (https://www.youtube.com/watch?v=<id>),
-- que a tela salva usa para linkar de volta ao vídeo.
--
-- Texto livre e não um id de vídeo: no dia em que entrar uma segunda origem
-- (um arquivo de áudio enviado, um link de podcast), ela cabe aqui sem
-- migração. O parse de volta para id é de @/lib/domain/youtube.ts.
alter table public.sessions add column if not exists source_url text;

comment on column public.sessions.source_url is
  'Origem externa da transcrição (URL do vídeo, no modo youtube). Null em sessões gravadas pelo microfone.';
