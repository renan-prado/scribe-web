-- Pastas: organizar o acervo além da lista plana por mês.
--
-- Com o volume de resumos crescendo, o mural da Biblioteca (agrupado só por
-- mês) deixa de bastar para quem grava várias séries ao mesmo tempo. `folders`
-- é uma tabela de topo, dona do usuário como `speakers`/`locations`, e
-- `sessions.folder_id` é o vínculo opcional: uma sessão pertence a NO MÁXIMO
-- uma pasta, e sem pasta continua sendo o estado padrão (a "raiz").
--
-- `on delete set null` em `folder_id`: apagar uma pasta nunca apaga o
-- conteúdo por baixo dela por acidente. A decisão "apagar tudo ou mover para
-- a raiz" é da PESSOA, tomada na hora de excluir (ver
-- `src/lib/db/folders.ts` `deleteFolder`), não uma cascata do banco que não
-- pergunta nada.
--
-- `color` é texto livre (um token de cor com valor hex ou um nome curto,
-- decidido pelo cliente) — o banco não valida paleta, é o mesmo tratamento
-- que `lexicon_entries.image_path` dá a um caminho que a UI interpreta.

create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 80),
  color      text check (color is null or length(color) <= 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.folders is
  'Pastas do usuário para organizar sessões. Ver 0068.';

create index if not exists folders_user_id_idx on public.folders (user_id);

-- Duas pastas com o mesmo nome (ignorando maiúscula/acento de caixa) são
-- confusão, não recurso: o mesmo tratamento de `speakers_user_name_lower_unique`
-- (migração 0019).
create unique index if not exists folders_user_name_lower_unique
  on public.folders (user_id, lower(name));

create or replace function public.touch_folder()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists folders_touch on public.folders;
create trigger folders_touch
  before update on public.folders
  for each row execute function public.touch_folder();

alter table public.folders enable row level security;

drop policy if exists folders_select_own on public.folders;
drop policy if exists folders_insert_own on public.folders;
drop policy if exists folders_update_own on public.folders;
drop policy if exists folders_delete_own on public.folders;
create policy folders_select_own on public.folders
  for select using (user_id = auth.uid());
create policy folders_insert_own on public.folders
  for insert with check (user_id = auth.uid());
create policy folders_update_own on public.folders
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy folders_delete_own on public.folders
  for delete using (user_id = auth.uid());

-- sessions.folder_id ---------------------------------------------------------

alter table public.sessions
  add column if not exists folder_id uuid references public.folders(id) on delete set null;

create index if not exists sessions_folder_id_idx on public.sessions (folder_id);

-- `folder_id` aponta para outra tabela do próprio usuário, e o AGENTS.md desta
-- pasta é claro sobre o que isso exige: toda coluna assim entra no
-- `with check` de INSERT e de UPDATE, não só a que diz de quem é a linha.
-- Sem isto, `user_id = auth.uid()` continuaria protegendo a LINHA e nada
-- impediria gravar nela o `folder_id` de uma pasta de outra pessoa (invisível
-- para o dono, mas ainda assim ligada) — a mesma classe de furo fechada em
-- `session_deepenings` na migração 0040.
drop policy if exists sessions_insert_own on public.sessions;
drop policy if exists sessions_update_own on public.sessions;
create policy sessions_insert_own on public.sessions
  for insert with check (
    user_id = auth.uid()
    and (
      folder_id is null
      or exists (select 1 from public.folders f where f.id = folder_id and f.user_id = auth.uid())
    )
  );
create policy sessions_update_own on public.sessions
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (
      folder_id is null
      or exists (select 1 from public.folders f where f.id = folder_id and f.user_id = auth.uid())
    )
  );
