-- Quantas contas usaram o Scriba hoje, e quantas estão com o app aberto
-- agora. O painel sabia dizer QUANTAS contas existem e QUANDO cada uma
-- assinou, mas não tinha como responder "quantas pessoas estão de fato
-- usando isto", nem hoje nem num dia qualquer do passado.
--
-- `auth.users.last_sign_in_at` (já lido em `db/admin/users.ts`) não serve
-- para isto: ele é UM valor por conta, sobrescrito a cada login, então não dá
-- história ("quantas contas diferentes acessaram terça-feira passada?") e não
-- diz nada sobre quem ainda está com o app aberto duas horas depois de logar.
--
-- =====================================================================
-- 1) uma linha por (conta, dia), e por que não um evento por acesso
-- =====================================================================
-- A pergunta do painel é "quantas CONTAS DIFERENTES", não "quantos toques". Um
-- evento por acesso exigiria `count(distinct user_id)` a cada leitura, sobre
-- uma tabela que cresce sem teto (o app é usado o dia inteiro, em cada
-- navegação). Com uma linha por dia por conta, `count(*)` já É a contagem de
-- contas distintas, e a tabela cresce no máximo `usuários × dias`, não
-- `usuários × navegações`.
--
-- `last_seen_at` é atualizado a cada pulso (`upsert`) e é o que sustenta
-- "online agora": uma conta cuja última batida foi há menos de 5 minutos.
-- Cinco minutos é a folga do pulso do cliente, que bate a cada ~60s enquanto o
-- app está aberto — três batidas perdidas (troca de rede, aba em segundo
-- plano) ainda contam como presente, e uma aba fechada há mais tempo que isso
-- já não é "agora" por nenhuma definição razoável.
--
-- =====================================================================
-- 2) a chave é (day, user_id), NÃO (user_id, day)
-- =====================================================================
-- As duas leituras do painel são "quantas contas HOJE" e "por DIA, quantas
-- contas" — as duas filtram ou agrupam por `day` primeiro. Com `day` como
-- coluna líder da chave primária, o índice que a sustenta já responde às duas
-- sem varrer a tabela inteira; com `user_id` na frente, toda leitura por dia
-- precisaria de um índice separado.
--
-- =====================================================================
-- 3) RLS ligada, NENHUMA policy, mesmo motivo de `user_tours` (0051)
-- =====================================================================
-- Quem escreve é a rota `/api/presence/heartbeat`, com service-role e o
-- `user_id` tirado da SESSÃO (`auth.user.id`), nunca do corpo — ver
-- `src/lib/db/presence.ts`. "Quantas contas acessaram" é um número que o
-- PAINEL lê para decidir coisa, igual à taxa de conclusão de um tour; com uma
-- policy de INSERT para `authenticated`, o anon key bastaria para inflar a
-- contagem de acessos de qualquer dia, sem precisar de sessão nenhuma de
-- verdade por trás.

create table if not exists public.user_daily_access (
  user_id      uuid not null references auth.users(id) on delete cascade,
  day          date not null,
  last_seen_at timestamptz not null default now(),
  primary key (day, user_id)
);

alter table public.user_daily_access enable row level security;
