-- Pastas DENTRO de pastas, até três níveis.
--
-- A 0068 entregou uma fileira plana, e ela não organiza o acervo de quem grava
-- por SÉRIE: "Romanos" e "Gálatas" dentro de "2026" é a forma natural do
-- material, e com um nível só as duas viram irmãs de "2026" numa fileira que
-- cresce para o lado até ninguém mais achar nada.
--
-- **Três níveis, e o teto é do BANCO.** Ele não é estético: uma árvore sem
-- limite precisa de uma tela que navegue árvore (recolher, expandir, arrastar
-- para dentro de um nó fechado), e o produto tem um mural de cartões. Com três
-- níveis o caminho inteiro cabe numa migalha de pão de uma linha
-- ("Biblioteca › 2026 › Romanos"), que é o que a tela já desenha. Escrito em
-- `if` no TypeScript o teto valeria para o caminho que alguém lembrou de
-- proteger; aqui ele vale para todos.
--
-- São TRÊS invariantes, e cada uma já seria um jeito diferente de a árvore
-- ficar inconsistente sem erro nenhum na tela:
--
--   1. **profundidade ≤ 3**, contada subindo a corrente de pais;
--   2. **nenhum ciclo** — uma pasta não é sua própria ancestral (o que
--      desapareceria da tela inteira, sem raiz por onde chegar nela);
--   3. **o pai é do MESMO dono** — a mesma classe de furo que o `with check`
--      de `sessions.folder_id` fechou na 0068.
--
-- A (1) tem uma metade que não é óbvia: mover uma pasta move as FILHAS com
-- ela. Uma pasta de nível 2 com uma neta não cabe debaixo de outra raiz, mesmo
-- que ela própria fosse caber. Por isso o gatilho mede as duas direções — sobe
-- contando degraus e desce medindo a altura da subárvore.

alter table public.folders
  add column if not exists parent_id uuid references public.folders(id) on delete cascade;

comment on column public.folders.parent_id is
  'Pasta mãe, ou null para uma pasta de raiz. Profundidade máxima 3, garantida pelo gatilho folders_tree. Ver 0069.';

create index if not exists folders_parent_id_idx on public.folders (parent_id);

-- O nome é único DENTRO DA MÃE, não no acervo inteiro: "Romanos" dentro de
-- "2025" e "Romanos" dentro de "2026" são duas pastas legítimas, e o índice da
-- 0068 recusava a segunda. O `coalesce` existe porque, num índice único, dois
-- `null` são valores DISTINTOS — sem ele as pastas de raiz (parent_id null)
-- deixariam de ser comparadas entre si e voltaria a dar para criar duas
-- "2026" na raiz.
drop index if exists public.folders_user_name_lower_unique;
create unique index if not exists folders_user_parent_name_lower_unique
  on public.folders (
    user_id,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

-- A altura da subárvore de uma pasta: 1 = sem filhas, 2 = tem filha, 3 = tem
-- neta. O teto de 4 no `where` é a guarda contra um ciclo que já estivesse
-- gravado — sem ele uma árvore corrompida faria esta função recursar para
-- sempre.
create or replace function public.folder_subtree_height(target uuid)
returns int
language sql
stable
security definer
set search_path = public
as $fn$
  with recursive down as (
    select f.id, 1 as h
      from public.folders f
     where f.id = target
    union all
    select f.id, d.h + 1
      from public.folders f
      join down d on f.parent_id = d.id
     where d.h < 4
  )
  select coalesce(max(h), 1) from down;
$fn$;

-- EXECUTE nasce concedido a PUBLIC no Postgres, e não conceder não é o mesmo
-- que negar (ver `supabase/AGENTS.md`). Esta é `security definer` e lê linhas
-- de `folders` sem RLS; ninguém a chama pela API, só o gatilho abaixo.
revoke all on function public.folder_subtree_height(uuid) from public;
revoke all on function public.folder_subtree_height(uuid) from anon, authenticated;

create or replace function public.folders_enforce_tree()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  walker       uuid := new.parent_id;
  depth        int  := 1;   -- o nível que ESTA pasta passa a ocupar (1 = raiz)
  height       int;
  parent_owner uuid;
begin
  -- Ir para a raiz só ENCURTA o caminho de toda descendente, então não há o
  -- que conferir.
  if walker is null then
    return new;
  end if;

  select user_id into parent_owner from public.folders where id = walker;
  if parent_owner is null or parent_owner <> new.user_id then
    raise exception 'parent_not_found' using errcode = '23514';
  end if;

  -- Sobe a corrente de pais. O `depth > 3` também é o que impede o laço de
  -- girar para sempre sobre um ciclo já gravado.
  while walker is not null loop
    if walker = new.id then
      raise exception 'folder_cycle' using errcode = '23514';
    end if;
    depth := depth + 1;
    if depth > 3 then
      raise exception 'folder_too_deep' using errcode = '23514';
    end if;
    select parent_id into walker from public.folders where id = walker;
  end loop;

  height := public.folder_subtree_height(new.id);
  if height + depth - 1 > 3 then
    raise exception 'folder_too_deep' using errcode = '23514';
  end if;

  return new;
end;
$fn$;

revoke all on function public.folders_enforce_tree() from public;
revoke all on function public.folders_enforce_tree() from anon, authenticated;

drop trigger if exists folders_tree on public.folders;
create trigger folders_tree
  before insert or update of parent_id on public.folders
  for each row execute function public.folders_enforce_tree();

-- RLS: `parent_id` aponta para outra tabela do próprio usuário, e a regra desta
-- pasta vale para ela como valeu para `sessions.folder_id` na 0068 — toda
-- coluna assim entra no `with check` de INSERT **e** de UPDATE, senão a linha
-- nasce certa e é movida depois. O gatilho acima já recusaria, mas ele é a
-- regra da ÁRVORE; esta é a regra do DONO, e ela mora onde o resto das regras
-- de dono deste banco mora.
--
-- **A forma é `parent_id in (select p.id ...)`, e NÃO o
-- `exists (... where p.id = parent_id)` que a 0068 usou para `sessions`.** A
-- diferença é que ali a subconsulta lê OUTRA tabela e aqui ela lê a MESMA:
-- dentro do `exists`, um `parent_id` sem qualificação é resolvido no escopo
-- mais interno primeiro, então ele vira `p.parent_id` e a condição passa a
-- ser `p.id = p.parent_id`, que nunca é verdadeira. O efeito medido em dev foi
-- "new row violates row-level security policy for table folders" em TODA
-- subpasta, inclusive as legítimas — a policy recusava exatamente o que ela
-- existe para permitir. Com `in`, a coluna da linha nova é lida fora do escopo
-- da subconsulta e não há nome para colidir.
drop policy if exists folders_insert_own on public.folders;
drop policy if exists folders_update_own on public.folders;
create policy folders_insert_own on public.folders
  for insert with check (
    user_id = auth.uid()
    and (
      parent_id is null
      or parent_id in (select p.id from public.folders p where p.user_id = auth.uid())
    )
  );
create policy folders_update_own on public.folders
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (
      parent_id is null
      or parent_id in (select p.id from public.folders p where p.user_id = auth.uid())
    )
  );
