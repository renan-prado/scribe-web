-- Procurar uma PESSOA sem carregar todas elas.
--
-- O PROBLEMA. Os dois filtros por pessoa do painel (`/admin/costs` e
-- `/admin/sessions`) eram um `<select>`: o servidor lia `profiles` inteira,
-- sem teto declarado, e mandava a lista toda para o navegador só para o
-- gatilho mostrar um nome. Isso tem três vidas úteis muito diferentes:
--
--   * com dezenas de contas, funciona e é o mais simples que existe;
--   * com mil, o PostgREST corta no `max-rows` dele e a lista fica INCOMPLETA
--     sem nada na tela dizendo isso — a pessoa procurada simplesmente não está
--     no select, e quem olha conclui que ela não tem sessão nenhuma;
--   * com um milhão, nem chega lá: a consulta ordena a tabela inteira e o
--     payload do RSC leva megabytes de nome e e-mail para uma tela que vai
--     usar UM deles.
--
-- A troca é buscar por TERMO, no banco, devolvendo no máximo 20 linhas. É o
-- que `features/admin/server/db/user-search.ts` faz, e é o que esta migração
-- sustenta.
--
-- =====================================================================
-- 1) trigramas, porque a busca é por PEDAÇO do nome
-- =====================================================================
-- Quem procura digita "joao" ou "@gmail", não o prefixo exato do registro. Um
-- `ilike '%joao%'` não usa índice B-tree nenhum (o curinga na frente mata a
-- ordenação), então a única saída é varrer a tabela — aceitável com mil
-- linhas, não com um milhão, e menos ainda num filtro que dispara a cada
-- tecla digitada.
--
-- `pg_trgm` quebra cada texto em trigramas e um índice GIN sobre eles responde
-- ao `%pedaço%` sem varredura. A contrapartida conhecida: termos de MENOS de
-- três caracteres não formam trigrama e caem na varredura de novo — por isso
-- a busca da aplicação só chama o banco a partir de dois caracteres, e mesmo
-- assim com teto de 20 linhas.
create extension if not exists pg_trgm with schema extensions;

-- O `set local` vale só por esta transação e existe para que `gin_trgm_ops`
-- seja encontrado independentemente do schema em que a extensão pousou: em
-- projeto Supabase ela vai para `extensions`, num Postgres limpo vai para
-- `public`, e o nome do operador não é qualificado abaixo.
set local search_path = public, extensions;

create index if not exists profiles_display_name_trgm_idx
  on public.profiles using gin (display_name gin_trgm_ops);

create index if not exists profiles_email_trgm_idx
  on public.profiles using gin (email gin_trgm_ops);

-- =====================================================================
-- 2) e um índice por data, para a lista que aparece ANTES de digitar
-- =====================================================================
-- O campo abre mostrando as contas mais novas, porque é quase sempre uma
-- delas que se quer olhar (quem acabou de entrar é quem se está investigando).
-- Sem índice, "as 20 mais novas" ordena a tabela inteira para jogar fora tudo
-- menos vinte linhas. É também a ordenação de `listUsers` (/admin/users).
create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc);
