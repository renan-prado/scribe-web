-- As tabelas do que o produto deixou de fazer.
--
-- Cinco tabelas, uma coluna, um gatilho e duas funções que nenhum caminho de
-- código lê ou escreve desde que o Scriba virou "grava → resumo → estudo"
-- (migração 0057 e os commits em volta dela).
--
-- **Por que DROP e não deixar dormindo.** O `AGENTS.md` de `supabase/` dizia
-- para não dropar sem pedido, e o pedido veio: não há usuário real em produção,
-- então não há dado de ninguém aqui. Tabela morta que fica é tabela que o
-- próximo a ler o schema precisa investigar para descobrir que não serve, e o
-- `session_feed_items` ainda carregava um GATILHO em `sessions`, ou seja,
-- trabalho em toda escrita de sessão para alimentar uma projeção que ninguém
-- consulta mais.
--
-- O QUE SAI, e o que cada uma era:
--
--   session_practices    "Coloque em prática", card de acompanhamento
--   session_rereads      "Releia este texto"
--   session_reminders    "Lembra disso?"
--   session_highlights   frases marcantes
--   session_feed_items   projeção dos cards do feed AO VIVO, com o gatilho que
--                        a mantinha em sincronia com sessions.feed_items
--   sessions.feed_items  o jsonb de onde a projeção saía
--
-- Os quatro primeiros abasteciam um `/feed` que deixou de existir. O quinto
-- era metade da busca por versículo, e essa metade é reescrita abaixo.

-- ---------------------------------------------------------------------------
-- 1. A busca por versículo perde uma das duas fontes
-- ---------------------------------------------------------------------------
--
-- `session_verse_references` respondia "onde eu ouvi Jonas 1?" olhando em DOIS
-- lugares: os cards `citedVerse` da projeção e os blocos `bibleQuote` do resumo.
-- A primeira metade morre com a projeção; a segunda continua, e passa a ser a
-- única — que é o certo, porque hoje TODA sessão tem resumo e nenhuma tem card.
--
-- A assinatura fica a mesma, `(p_books text[], p_prefixes text[])`, e
-- `p_books` deixa de ser usado. Manter o parâmetro é deliberado: quem chama é
-- `lib/db/sessions.ts`, que monta os dois arrays a partir da mesma consulta, e
-- trocar a assinatura obrigaria a derrubar e recriar a função (o Postgres não
-- substitui uma função mudando parâmetros) por nenhum ganho de comportamento.
create or replace function public.session_verse_references(
  p_books text[],
  p_prefixes text[]
)
returns table (session_id uuid, reference text)
language sql
stable
security invoker
set search_path = public
as $$
  select s.id, block->>'reference'
  from public.sessions s
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(s.final_summary->'blocks') = 'array' then s.final_summary->'blocks'
      else '[]'::jsonb
    end
  ) as block
  where s.ended_at is not null
    and block->>'reference' is not null
    and public._ascii_lower(block->>'reference') like any (p_prefixes);
$$;

revoke all on function public.session_verse_references(text[], text[]) from public;
revoke all on function public.session_verse_references(text[], text[]) from anon;
grant execute on function public.session_verse_references(text[], text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. O gatilho ANTES da tabela
-- ---------------------------------------------------------------------------
--
-- Nesta ordem porque o gatilho escreve na tabela: derrubá-la primeiro deixaria
-- um gatilho apontando para o vazio até a linha seguinte rodar.
drop trigger if exists sync_session_feed_items_ins on public.sessions;
drop trigger if exists sync_session_feed_items_upd on public.sessions;
drop function if exists public.sync_session_feed_items();
drop function if exists public._explode_session_feed_items(uuid, jsonb);

-- ---------------------------------------------------------------------------
-- 3. As tabelas
-- ---------------------------------------------------------------------------
drop table if exists public.session_feed_items;
drop table if exists public.session_practices;
drop table if exists public.session_rereads;
drop table if exists public.session_reminders;
drop table if exists public.session_highlights;

-- ---------------------------------------------------------------------------
-- 4. A coluna que alimentava a projeção
-- ---------------------------------------------------------------------------
alter table public.sessions drop column if exists feed_items;

-- ---------------------------------------------------------------------------
-- 5. Um contador que só sabia contar zero
-- ---------------------------------------------------------------------------
--
-- `hallucination_reports.removed_count` guardava quantos cards a auditoria
-- removeu do feed ao vivo. Sem feed não há remoção automática, e a rota vinha
-- gravando 0 em toda linha nova: uma coluna que afirma ter medido algo e mede
-- sempre a mesma coisa é pior que coluna nenhuma.
alter table public.hallucination_reports drop column if exists removed_count;
