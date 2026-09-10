-- Procurar por VERSÍCULO nas listas: "Jonas 1" tem de achar a pregação que
-- citou Jonas 1:1-17.
--
-- O QUE FALTAVA. A busca de `/list` e `/studies` casa texto, título, resumo
-- curto, autor, local (no cliente) e a transcrição (`/api/sessions/search`).
-- Um versículo citado não está em nenhum desses lugares: ele é um card
-- `citedVerse`, e o que o pregador FALOU na hora ("no primeiro capítulo de
-- Jonas") quase nunca é a string "Jonas 1". Procurar a referência não achava
-- nada, e não achar é indistinguível de não ter.
--
-- POR QUE UMA FUNÇÃO, e não um filtro do PostgREST. Duas razões que o cliente
-- não resolve:
--
--   1. As duas fontes. Sessão do modo `live` tem os cards em
--      `session_feed_items` (projeção de 0004, com verse_book/chapter/start/end
--      já separados e indexados). Sessão `audio_only` NÃO TEM CARDS, nela o
--      pipeline bíblico não roda, e os versículos existem só como blocos
--      `bibleQuote` dentro de `final_summary`. Procurar só na primeira perderia
--      um modo inteiro do produto, e ninguém desconfiaria: a lista responderia
--      normalmente, só que sem metade das gravações.
--   2. O acento. `verse_book` guarda a grafia do modelo, "gênesis", "joão",
--      "coríntios", e quem digita numa busca escreve "genesis", "joao",
--      "corintios". `translate()` resolve isso sem depender da extensão
--      `unaccent`, que é um pedido de infraestrutura para um problema de vinte
--      e quatro letras.
--
-- O CASAMENTO FINO NÃO ESTÁ AQUI. Esta função é o PENEIRAMENTO por livro: ela
-- devolve as referências daquele livro e mais nada. Quem decide se "Jonas 1:3"
-- responde a "Jonas 1" é `referenceMatchesQuery` em
-- `lib/domain/reference-query.ts`, do lado do TypeScript, junto de
-- `parseVerseReference`, a mesma regra de faixa que o feed já usa para
-- deduplicar card. Reescrevê-la em SQL seria uma segunda implementação da
-- coisa mais fácil de discordar em silêncio.
--
-- SEGURANÇA. `security invoker`: a função lê como quem chamou, então a RLS de
-- `sessions` e de `session_feed_items` é a mesma de sempre e não há aqui o
-- buraco que 0037 e 0038 fecharam, não existe caminho por onde ela devolva
-- linha de outra pessoa. Ela também não escreve nada.
--
-- ÍNDICE. `sfi_verse_lookup_idx (verse_book, verse_chapter) where kind =
-- 'citedVerse'` não é usado, porque o `translate()` do lado da coluna impede.
-- É aceito: a varredura já vem recortada pela RLS (as linhas de UM usuário), e
-- a alternativa, coluna gerada sem acento mais índice, é peso que só se paga
-- quando alguém tiver dezenas de milhares de cards. Se um dia doer, o lugar é
-- `verse_book_ascii` gerada, e esta função passa a comparar com ela.

-- Sem acento e em minúsculas, sem extensão. Os pares estão na ordem: cada
-- letra da primeira string vira a da mesma posição na segunda.
create or replace function public._ascii_lower(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(
    lower(coalesce(p_text, '')),
    'áàâãäéèêëíìîïóòôõöúùûüñç',
    'aaaaaeeeeiiiiooooouuuunc'
  );
$$;

-- p_books    → igualdade contra `session_feed_items.verse_book`, que já vem
--              normalizado pelo gatilho (minúsculo, sem pontuação).
-- p_prefixes → LIKE contra a referência CRUA dos blocos do resumo, onde não há
--              coluna separada: "jonas 1:1-17" começa com "jonas".
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
  select sfi.session_id, sfi.payload->>'reference'
  from public.session_feed_items sfi
  where sfi.kind = 'citedVerse'
    and sfi.payload->>'reference' is not null
    and public._ascii_lower(sfi.verse_book) = any (p_books)

  union

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

-- Leitura pura e `security invoker`: quem chama é o usuário logado, e a RLS
-- já é o gate. O `revoke` de `public`/`anon` é a higiene de 0038, EXECUTE
-- nasce concedido a PUBLIC, e não conceder não é o mesmo que negar.
revoke all on function public._ascii_lower(text) from public;
revoke all on function public._ascii_lower(text) from anon;
grant execute on function public._ascii_lower(text) to authenticated, service_role;

revoke all on function public.session_verse_references(text[], text[]) from public;
revoke all on function public.session_verse_references(text[], text[]) from anon;
grant execute on function public.session_verse_references(text[], text[]) to authenticated, service_role;
