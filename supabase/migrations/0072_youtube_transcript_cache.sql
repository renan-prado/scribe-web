-- O cache de legenda do YouTube, uma linha por VÍDEO.
--
-- POR QUE ISTO EXISTE. Cada importação do modo `youtube` gasta 1 crédito de
-- provedor (Supadata, ~R$ 0,03) e 1-3s de espera para buscar uma legenda que
-- já é PÚBLICA e que não muda. O mesmo vídeo é buscado de novo em três
-- situações rotineiras, e nenhuma delas é abuso:
--
--   1. O link de um sermão circula no grupo da igreja e cinco pessoas o
--      importam. São cinco chamadas idênticas ao provedor.
--   2. A mesma pessoa reimporta OUTRO TRECHO do mesmo culto ("peguei do 12 ao
--      45, mas a pregação começava no 10"). O recorte é um filtro sobre os
--      segmentos, então a segunda importação paga de novo pela mesma legenda
--      inteira que a primeira já tinha em mãos.
--   3. A sessão foi apagada e o link importado de novo.
--
-- O QUE FICA GUARDADO SÃO OS SEGMENTOS, não o texto corrido, e é isso que faz
-- o caso 2 funcionar. O recorte precisa de `offset`/`duration` por segmento, e
-- a duração do vídeo sai do último deles; guardar só o texto resolveria uma
-- reimportação idêntica e nenhuma outra. Ver `youtube/segments.ts` para o
-- formato compacto `[offsetMs, durationMs, texto]`, que existe porque repetir
-- três nomes de chave por segmento em milhares de segmentos é o grosso do
-- tamanho da linha.
--
-- A CHAVE É O `video_id`, não a URL. `youtu.be/x`, `watch?v=x&t=930` e
-- `/live/x` são o mesmo vídeo, e a mesma legenda; chavear pela URL daria três
-- linhas e três chamadas ao provedor. O id de 11 caracteres é o que
-- `parseYoutubeUrl` já extrai de todas as formas de link.
--
-- NÃO É CACHE DE RECUSA. Vídeo sem legenda, privado ou inexistente não escreve
-- linha nenhuma: o YouTube publica legenda automática minutos ou horas depois
-- do upload, e um "não tem legenda" guardado transformaria uma espera de
-- minutos numa recusa que dura o TTL inteiro.
--
-- O QUE ISTO NÃO MUDA: o preço. `COIN_COSTS.youtubeImport` continua 30 moedas
-- por importação, porque o que ele paga é o RESUMO, e o resumo roda de novo a
-- cada importação. O crédito de provedor economizado é ~R$ 0,03 de margem; o
-- ganho visível para quem usa é o segundo caso acima ficar instantâneo.
--
-- SUPERFÍCIE DE ATAQUE. A legenda é pública, então não há segredo aqui. Ainda
-- assim a tabela é service-role só, no molde de `usd_brl_rates` (0049): quem
-- pudesse escrever uma linha aqui escolheria o TEXTO que vira o sermão de
-- outra pessoa, e o resumo pago sairia de um conteúdo plantado. Escrever é
-- privilégio do caminho que acabou de falar com o provedor.

create table if not exists public.youtube_transcripts (
  -- Os 11 caracteres do id de vídeo, a forma canônica do link.
  video_id         text primary key check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  -- `[[offsetMs, durationMs, texto], ...]`, ver `youtube/segments.ts`.
  segments         jsonb not null,
  -- Idioma que o provedor devolveu (ISO 639-1). Vai para o log da importação.
  lang             text  not null default 'pt',
  -- O vídeo inteiro em ms, medido pelo último segmento. Redundante com
  -- `segments` de propósito: responde "cabe no teto?" sem desempacotar o jsonb.
  full_duration_ms integer not null check (full_duration_ms >= 0),
  -- Quem serviu. Existe para o dia em que o provedor for trocado (a indireção
  -- de `transcript.ts` prevê isso): uma linha escrita pelo provedor antigo
  -- continua válida, e saber de quem ela veio é o que permite invalidar um
  -- fornecedor inteiro sem apagar a tabela.
  provider         text  not null,
  -- O TTL é aplicado na LEITURA, contra esta coluna, e não por um expurgo:
  -- ver `YOUTUBE_TRANSCRIPT_TTL_MS`. Uma linha vencida é sobrescrita pela
  -- próxima importação do mesmo vídeo, que é quando ela volta a importar.
  fetched_at       timestamptz not null default now()
);

alter table public.youtube_transcripts enable row level security;

-- Nenhuma policy, nenhum grant: só o service_role passa.
revoke all on public.youtube_transcripts from anon, authenticated;
