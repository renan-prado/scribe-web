-- Insights financeiros do painel: a leitura de UM modelo sobre os números que
-- /admin/precificacao, /admin/usage e /admin/metricas já publicam.
--
-- POR QUE UMA TABELA, e não um cookie como a régua de `lib/coins/settings.ts`:
-- a régua é preferência de quem está olhando, e vale por navegador. Isto é o
-- contrário — é uma leitura CARA (um modelo de raciocínio sobre o agregado
-- inteiro) que precisa valer uma vez por dia para o painel todo, não uma vez
-- por dia por navegador. Guardada em cookie, trocar de máquina refaria a
-- chamada, e o "uma vez por dia" viraria "quantas vezes alguém abrir".
--
-- UMA LINHA POR ESCOPO, e a PK é o escopo. Não guardamos histórico de
-- propósito: o insight é uma leitura do agregado de HOJE, e o agregado dos
-- últimos 30 dias muda todo dia. Uma série de insights velhos convidaria a
-- comparar afirmações que foram feitas sobre janelas diferentes — que é
-- exatamente o erro que a tela existe para não induzir. O que se compara são
-- os NÚMEROS, e esses já estão em `llm_usage_events` e `coin_transactions`.
--
-- SUPERFÍCIE DE ATAQUE — o que este arquivo fecha:
--   * Leitura por usuário comum. `payload` carrega margem por ação, receita
--     implícita, MRR e o custo real de cada pipeline: é o interior da conta.
--     Ao contrário de `feature_switches`, aqui NÃO há GRANT de select para
--     `authenticated` — nem para `anon`. RLS ligada e nenhuma policy: a
--     tabela é inalcançável pelo PostgREST com a chave anon, e só o
--     service_role (atrás de `requireAdmin()`) a lê e escreve.
--   * Escrita de conteúdo. O texto vem de um LLM e é renderizado no painel;
--     sem GRANT de insert ninguém de fora consegue plantar linha nenhuma.

create table if not exists public.admin_insights (
  -- "pricing" | "usage" | "metrics". Sem CHECK: as chaves moram em
  -- `lib/domain/admin-insights.ts`, e a rota valida com `isAdminInsightScope`
  -- antes de escrever — mesma decisão de `feature_switches.feature`.
  scope         text primary key,
  -- `AdminInsightsPayload` já validado por Zod na escrita. O parser roda de
  -- novo na leitura: o que entrou ontem pode não casar com o tipo de hoje.
  payload       jsonb not null,
  -- Que modelo escreveu e sobre quantos dias. Os dois vão para a tela: um
  -- insight sem janela declarada é uma afirmação sem escopo.
  model         text not null,
  window_days   integer not null,
  -- Custo desta chamada, medido. Ela também aparece em `llm_usage_events`
  -- (rota `admin-insights`); aqui fica à mão para a própria tela dizer quanto
  -- custou o parágrafo que o admin está lendo.
  cost_usd      numeric(12, 6) not null default 0,
  generated_at  timestamptz not null default now(),
  generated_by  uuid references auth.users(id) on delete set null
);

alter table public.admin_insights enable row level security;

-- Nenhuma policy, nenhum grant: só o service_role passa.
revoke all on public.admin_insights from anon, authenticated;
