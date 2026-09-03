-- Feature entitlements: quais funcionalidades cada plano libera.
--
-- A REGRA NÃO MORA AQUI. O mapa `feature → plano mínimo` vive em
-- `lib/entitlements/features.ts`, em código, pelo mesmo motivo que
-- `lib/billing/catalog.ts` guarda o mapa `Price ID → moedas`: uma linha
-- errada numa tabela não pode virar acesso grátis a uma funcionalidade paga.
-- Um `UPDATE` desastrado aqui pode DESLIGAR uma feature ou abrir exceção
-- para uma pessoa; nunca pode reescrever quanto o plano Estudioso vale.
--
-- Esta migração cria só as duas coisas que precisam mudar em runtime:
--
--   1. `feature_switches` — o kill switch. Uma linha por feature que
--      alguém desligou. AUSÊNCIA DE LINHA SIGNIFICA LIGADA: assim, uma
--      feature nova nasce funcionando e a tabela só cresce quando há
--      incidente. O inverso (linha obrigatória por feature) faria toda
--      feature nova depender de um INSERT para existir — e um deploy que
--      esquecesse o INSERT sairia com a feature morta em produção.
--
--   2. `feature_overrides` — a exceção por pessoa. `granted = true` libera
--      para um beta tester abaixo do plano mínimo; `granted = false` revoga
--      de um abusador que paga. Sem linha = decide o plano.
--
-- PRECEDÊNCIA (implementada em `evaluateFeature`, não no banco):
--   kill switch desligado  →  nega, inclusive para quem tem override true
--   override               →  decide, ignorando o plano
--   plano                  →  o caso normal
--
-- O kill switch vencer o override é deliberado: ele existe para incidente,
-- e um incidente não abre exceção para ninguém.
--
-- SUPERFÍCIE DE ATAQUE — o que este arquivo fecha:
--   * Auto-concessão via PostgREST. `authenticated` recebe SELECT e nada
--     mais nas duas tabelas. Sem GRANT de INSERT/UPDATE/DELETE, nem uma
--     policy permissiva devolveria escrita — RLS filtra linha, GRANT decide
--     se o verbo existe. Toda escrita passa pelo service_role, a partir de
--     `/api/admin/features`, que já roda atrás de `requireAdmin()`.
--   * Leitura do override alheio. A policy escopa por `auth.uid()`: o
--     usuário vê a própria exceção, nunca a de outro.
--   * `feature_switches` é legível por qualquer autenticado de propósito —
--     é configuração global, não segredo, e o cliente já saberia que a
--     feature está fora no instante em que o botão sumisse.

-- 1) Kill switch global -------------------------------------------------------

create table if not exists public.feature_switches (
  -- Sem FK possível: as chaves de feature moram em TypeScript. O CHECK
  -- ficaria desatualizado a cada feature nova, então a validação é do
  -- lado do servidor (`isFeatureKey`) antes do upsert.
  feature     text primary key,
  enabled     boolean not null,
  note        text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

-- 2) Exceção por pessoa -------------------------------------------------------

create table if not exists public.feature_overrides (
  user_id     uuid not null references auth.users(id) on delete cascade,
  feature     text not null,
  granted     boolean not null,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  primary key (user_id, feature)
);

create index if not exists feature_overrides_feature_idx
  on public.feature_overrides (feature);

-- 3) RLS + GRANT --------------------------------------------------------------

alter table public.feature_switches  enable row level security;
alter table public.feature_overrides enable row level security;

drop policy if exists feature_switches_select_all on public.feature_switches;
create policy feature_switches_select_all on public.feature_switches
  for select to authenticated using (true);

drop policy if exists feature_overrides_select_own on public.feature_overrides;
create policy feature_overrides_select_own on public.feature_overrides
  for select using (user_id = auth.uid());

-- O GRANT é a linha de defesa que RLS não dá: sem ele, uma policy futura
-- escrita com pressa não tem como abrir escrita por acidente.
revoke all on public.feature_switches  from anon, authenticated;
revoke all on public.feature_overrides from anon, authenticated;
grant select on public.feature_switches  to authenticated;
grant select on public.feature_overrides to authenticated;
