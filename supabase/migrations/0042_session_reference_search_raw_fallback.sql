-- A referência SEM capítulo volta a ser encontrável.
--
-- O QUE 0041 PERDIA. A peneira dos cards compara `session_feed_items.verse_book`,
-- a coluna que o gatilho de 0004 preenche a partir da referência. E o regexp de
-- lá exige um número: `'^(.+?)\s+\d+(?::\d+(?:-\d+)?)?\s*$'`. Um card cujo
-- `reference` é só o nome do livro, "Judas", que tem um capítulo só e por isso
-- é citado assim mesmo, sai do gatilho com `verse_book`, `verse_chapter`,
-- `verse_start` e `verse_end` TODOS nulos. A comparação por igualdade nunca o
-- alcança, e procurar "Judas" não devolvia a pregação que citou Judas.
--
-- Encontrado no banco de dev, não em raciocínio: dos dois cards `citedVerse`
-- que existem lá, um é exatamente esse. Numa base pequena a proporção não quer
-- dizer nada, mas o caso é estrutural, Judas, Filemom, 2 João, 3 João e
-- Obadias têm um capítulo só, e é natural citá-los sem número.
--
-- A CORREÇÃO é não depender de uma única forma de enxergar a referência: além
-- da coluna estruturada, compara também a referência CRUA por prefixo, que é o
-- que a metade do resumo já fazia. As duas vias sobrevivem porque falham em
-- lugares diferentes, a coluna some quando o regexp do gatilho não casa, e o
-- prefixo erra quando o modelo escreve algo na frente do livro ("Livro de
-- Jonas 1"). O peneiramento pode ser generoso: quem decide de verdade continua
-- sendo `referenceMatchesQuery`, do lado do TypeScript.

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
    and (
      public._ascii_lower(sfi.verse_book) = any (p_books)
      or public._ascii_lower(sfi.payload->>'reference') like any (p_prefixes)
    )

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

revoke all on function public.session_verse_references(text[], text[]) from public;
revoke all on function public.session_verse_references(text[], text[]) from anon;
grant execute on function public.session_verse_references(text[], text[]) to authenticated, service_role;
