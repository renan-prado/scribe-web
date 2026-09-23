-- O RECORTE de um vídeo: importar só um trecho.
--
-- A transmissão de um culto inteiro tem duas horas e a pregação tem trinta
-- minutos no meio. Até aqui a resposta do produto era recusar o vídeo e pedir
-- "procure o corte só da pregação" — um corte que o canal pode nunca ter
-- publicado. Estas duas colunas são a pergunta "do minuto tal ao tal?"
-- respondida onde ela precisa sobreviver: no banco.
--
-- **Por que não só no cliente.** A linha da sessão nasce ANTES da importação
-- (o formulário cria, `/import/:id` dispara), e essa página é recarregável,
-- compartilhável e sobrevive a um "atrás" do navegador. Um recorte que morasse
-- no estado do React viraria, num reload, uma importação do vídeo inteiro
-- cobrada pelo mesmo preço — e o pior é que ninguém perceberia até o resumo
-- pronto falar de outra coisa.
--
-- **`null` nos dois é o caso normal**, o vídeo inteiro. Um `source_start_ms`
-- sozinho quer dizer "daqui até o fim". Só o modo `youtube` preenche; gravação
-- pelo microfone e texto escrito à mão não têm origem a recortar.
--
-- O teto de 2h (`YOUTUBE_MAX_DURATION_MS`) passa a medir o TRECHO, não o
-- vídeo. Não é afrouxamento: o teto existe porque o custo do resumo cresce com
-- a transcrição na entrada, e a legenda custa 1 crédito por vídeo, fixo,
-- independente da duração. Ver `docs/youtube.md` §5.

alter table public.sessions
  add column if not exists source_start_ms integer,
  add column if not exists source_end_ms integer;

alter table public.sessions
  drop constraint if exists sessions_source_clip_check;

alter table public.sessions
  add constraint sessions_source_clip_check
  check (
    (source_start_ms is null or source_start_ms >= 0)
    and (source_end_ms is null or source_end_ms > 0)
    and (
      source_end_ms is null
      or source_start_ms is null
      or source_end_ms > source_start_ms
    )
  );

comment on column public.sessions.source_start_ms is
  'Modo youtube: início do trecho importado, em ms. Null = do começo.';
comment on column public.sessions.source_end_ms is
  'Modo youtube: fim do trecho importado, em ms. Null = até o fim.';
