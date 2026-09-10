-- Controle financeiro interno do Scriba: o que o painel NÃO consegue medir.
--
-- POR QUE ESTAS TABELAS SÃO PEQUENAS, e é de propósito. Metade da pergunta
-- "quanto ganhamos e quanto gastamos?" já tem resposta medida no banco:
--
--   receita recorrente  → `subscriptions` × `lib/billing/plans.ts`  (MRR)
--   custo de IA         → `llm_usage_events` × `lib/llm/pricing.ts` (o maior
--                          custo variável do produto, medido por chamada)
--   taxa de pagamento   → `lib/partners/economics.ts` (stripeFeeCents)
--   comissão de parceiro→ `partner_commissions` / `partner_payouts`
--
-- Digitar qualquer um desses à mão criaria uma SEGUNDA definição do mesmo
-- número, o erro que `lib/db/admin/metrics.ts` existe para não cometer. Estas
-- tabelas guardam só o que ninguém mede por nós: Vercel, Supabase, domínio,
-- ferramentas, impostos, dívidas com plataformas e receitas fora do Stripe.
--
-- CINCO TABELAS, E O CORTE ENTRE ELAS É CONCEITUAL, não de formulário:
--
--   finance_categories  o vocabulário. Também é ONDE mora "fixo × variável",
--                       a natureza é da categoria, não do lançamento, senão a
--                       mesma despesa vira fixa numa linha e variável na outra.
--   finance_recurring   o CONTRATO ("Vercel, R$ 200, todo mês"). É um plano de
--                       cobrança, não um fato: nada aconteceu ainda.
--   finance_entries     o FATO ou a OBRIGAÇÃO datada. É a única tabela que
--                       entra em fluxo de caixa.
--   finance_scenarios   as PREMISSAS de uma projeção. Nunca um resultado: o
--                       resultado é recalculado a cada leitura, porque a base
--                       dele (assinantes de hoje, custo por usuário medido)
--                       muda sozinha.
--   finance_settings    os fatos da empresa que não são lançamento: saldo em
--                       caixa, alíquota de imposto, câmbio das projeções.
--
-- POR QUE `finance_recurring` NÃO É UMA COLUNA DE `finance_entries`. Se a
-- recorrência fosse um campo do lançamento, "quanto gastamos em setembro"
-- precisaria expandir templates dentro da mesma tabela que já guarda fatos, e
-- não haveria como registrar "a fatura da Vercel veio R$ 213 este mês". Com as
-- duas separadas, o contrato PREVÊ e o lançamento REALIZA, e `recurring_id`
-- amarra os dois, de modo que um mês com lançamento real não conta o previsto
-- em dobro. É a distinção do §14 da especificação (realizado × previsto ×
-- projetado) virando estrutura em vez de convenção.
--
-- DÍVIDA NÃO É UM TIPO. Uma dívida é uma DESPESA com `status <> 'paid'` e
-- `due_date`; um valor a receber é uma RECEITA na mesma situação. Criar um
-- terceiro `kind` daria três somas para o mesmo dinheiro (a despesa, o
-- compromisso e o pagamento dele) e a primeira quitação faria as três
-- discordarem. `paid_cents` cobre o pagamento parcial, e o restante é
-- `amount_cents - paid_cents`, derivado, nunca digitado.
--
-- SUPERFÍCIE DE ATAQUE, o que este arquivo fecha. Estas cinco tabelas são o
-- interior da empresa: margem, dívida, saldo em caixa e o custo real de cada
-- fornecedor. Seguem o molde de `admin_insights` (0034), não o de
-- `feature_switches`: RLS ligada, NENHUMA policy e NENHUM grant para `anon`
-- nem para `authenticated`. Sem policy, a tabela é inalcançável pelo PostgREST
-- com a chave anon, só o `service_role`, atrás de `requireAdmin()`, lê e
-- escreve. Uma policy de SELECT para `authenticated` aqui publicaria o balanço
-- do Scriba para qualquer conta cadastrada.

-- ---------------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------------

create table if not exists public.finance_categories (
  id          uuid primary key default gen_random_uuid(),
  -- Estável, usado pelo código quando precisa apontar para uma categoria
  -- específica (o seed abaixo). O nome é editável; o slug não deveria ser.
  slug        text not null unique,
  name        text not null,
  -- Onde a categoria pode ser escolhida. 'both' existe para "Outros".
  kind        text not null check (kind in ('revenue', 'expense', 'both')),
  -- FIXO × VARIÁVEL mora aqui e em nenhum outro lugar. Fixo é o que não escala
  -- com uso (Vercel, domínio); variável é o que escala (IA, taxas, impostos).
  -- Na categoria e não no lançamento porque o par (categoria, natureza) é uma
  -- decisão contábil da empresa, permitir sobrescrever por linha produziria
  -- "custo fixo" somando duas coisas diferentes no mesmo mês.
  nature      text not null default 'variable' check (nature in ('fixed', 'variable')),
  sort_order  integer not null default 100,
  -- Arquivar em vez de apagar: uma categoria apagada levaria junto a leitura
  -- histórica dos lançamentos que apontavam para ela.
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Custos e receitas recorrentes (o contrato)
-- ---------------------------------------------------------------------------

create table if not exists public.finance_recurring (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('revenue', 'expense')),
  description   text not null,
  -- Quem cobra ou quem paga. Livre de propósito: virar tabela de fornecedores
  -- é trabalho para quando houver mais de vinte.
  counterparty  text,
  category_id   uuid references public.finance_categories(id) on delete set null,
  amount_cents  bigint not null check (amount_cents > 0),
  currency      text not null default 'BRL' check (currency in ('BRL', 'USD')),
  -- `cadence` e não `interval`: INTERVAL é nome de tipo no Postgres, e uma
  -- coluna com esse nome exige aspas em contextos que ninguém prevê.
  cadence       text not null check (cadence in ('monthly', 'quarterly', 'semiannual', 'annual')),
  -- Ancora as ocorrências: o dia do mês da cobrança sai daqui.
  start_date    date not null,
  end_date      date,
  status        text not null default 'active' check (status in ('active', 'cancelled')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  constraint finance_recurring_period check (end_date is null or end_date >= start_date)
);

create index if not exists finance_recurring_status_idx on public.finance_recurring (status);

-- ---------------------------------------------------------------------------
-- Lançamentos (o fato e a obrigação)
-- ---------------------------------------------------------------------------

create table if not exists public.finance_entries (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('revenue', 'expense')),
  description     text not null,
  counterparty    text,
  category_id     uuid references public.finance_categories(id) on delete set null,
  amount_cents    bigint not null check (amount_cents > 0),
  currency        text not null default 'BRL' check (currency in ('BRL', 'USD')),
  -- CÂMBIO CONGELADO NO ACERTO, flutuante enquanto pendente.
  --
  -- Uma despesa em dólar já paga custou o que custou: reconvertê-la com a
  -- cotação de hoje reescreve o passado, e o lucro de julho passa a mudar
  -- porque o dólar mexeu em setembro. Uma dívida ainda não paga é o oposto,
  -- ela vale a cotação de HOJE, porque é hoje que ela seria quitada.
  --
  -- Por isso a coluna é nula enquanto `status <> 'paid'`, e a camada de
  -- leitura (`lib/finance/money.ts`) converte pendentes com o câmbio vivo.
  fx_rate         numeric(12, 6) check (fx_rate is null or fx_rate > 0),
  -- Pagamento parcial. O que ainda se deve é `amount_cents - paid_cents`,
  -- derivado, nunca digitado, pela mesma razão de o saldo de moedas sair do
  -- ledger em vez de ser contado à mão.
  paid_cents      bigint not null default 0 check (paid_cents >= 0),
  -- 'paid'    = aconteceu (entra em fluxo de caixa)
  -- 'pending' = obrigação/direito conhecido e vencível (dívida, a receber)
  -- 'planned' = previsto, ainda sem compromisso firmado
  status          text not null check (status in ('paid', 'pending', 'planned')),
  -- COMPETÊNCIA × CAIXA, e as duas datas existem porque respondem perguntas
  -- diferentes. `competence_date` diz a que MÊS o valor pertence (o custo da
  -- Vercel de setembro é de setembro, mesmo cobrado em 3 de outubro) e é o
  -- eixo da visão mensal. `settled_at` diz quando o dinheiro se moveu, e é o
  -- eixo do fluxo de caixa.
  competence_date date not null,
  due_date        date,
  settled_at      date,
  -- Qual contrato gerou este lançamento. É o que impede a visão mensal de
  -- contar o previsto da recorrência E o realizado dela no mesmo mês.
  recurring_id    uuid references public.finance_recurring(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  constraint finance_entries_paid_within_amount check (paid_cents <= amount_cents),
  -- Quitado sem data de acerto sairia da visão de caixa sem sair da lista de
  -- pagos: o valor some do mês e ninguém percebe.
  constraint finance_entries_settled_when_paid
    check (status <> 'paid' or settled_at is not null)
);

create index if not exists finance_entries_competence_idx
  on public.finance_entries (competence_date desc);
create index if not exists finance_entries_status_idx on public.finance_entries (status);
create index if not exists finance_entries_category_idx on public.finance_entries (category_id);
create index if not exists finance_entries_recurring_idx
  on public.finance_entries (recurring_id, competence_date);

-- ---------------------------------------------------------------------------
-- Cenários de projeção (as premissas)
-- ---------------------------------------------------------------------------

create table if not exists public.finance_scenarios (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique,
  name                    text not null,
  -- Percentuais em BASIS POINTS, inteiros. Guardar "10%" como 0.1 em float e
  -- depois compor doze meses de crescimento acumula erro justamente na ponta
  -- longa da projeção, que é a que se olha.
  growth_bps              integer not null default 0
                            check (growth_bps between -10000 and 100000),
  churn_bps               integer not null default 0 check (churn_bps between 0 and 10000),
  -- Aquisição absoluta, somada à percentual. Existe porque nem todo crescimento
  -- é proporcional à base: uma campanha traz N clientes, não N%.
  new_customers_per_month integer not null default 0 check (new_customers_per_month >= 0),
  -- Nulo = usar o ARPU MEDIDO das assinaturas vivas. Preenchido = hipótese.
  ticket_cents            bigint check (ticket_cents is null or ticket_cents >= 0),
  -- Custo fixo extra que ainda não está em `finance_recurring` (uma contratação
  -- planejada, por exemplo). Soma ao fixo medido, não o substitui.
  extra_fixed_cost_cents  bigint not null default 0 check (extra_fixed_cost_cents >= 0),
  -- Nulo = herda `finance_settings.tax_bps`.
  tax_bps                 integer check (tax_bps is null or tax_bps between 0 and 10000),
  horizon_months          integer not null default 12 check (horizon_months between 1 and 60),
  sort_order              integer not null default 100,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Configurações (uma linha)
-- ---------------------------------------------------------------------------

create table if not exists public.finance_settings (
  -- Linha única. O CHECK é o que garante que ela continue única: sem ele, o
  -- primeiro insert distraído cria uma segunda configuração e metade do painel
  -- passa a ler a errada.
  id                 text primary key default 'default' check (id = 'default'),
  -- Saldo em caixa hoje. É o que transforma burn rate em RUNWAY, sem ele, o
  -- painel sabe quanto queima por mês e não sabe por quanto tempo aguenta.
  cash_balance_cents bigint not null default 0,
  cash_balance_at    date,
  -- Alíquota efetiva sobre a receita, em basis points. Usada nas projeções e
  -- na estimativa de lucro líquido.
  tax_bps            integer not null default 0 check (tax_bps between 0 and 10000),
  -- Câmbio das PROJEÇÕES. Separado do câmbio vivo de `lib/fx/usd-brl.ts` de
  -- propósito: uma projeção de doze meses não deve mudar de resultado porque o
  -- dólar mexeu enquanto a página carregava. Nulo = usar o câmbio vivo.
  projection_usd_brl numeric(12, 6)
                       check (projection_usd_brl is null or projection_usd_brl > 0),
  updated_at         timestamptz not null default now()
);

insert into public.finance_settings (id) values ('default') on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed do vocabulário
-- ---------------------------------------------------------------------------
--
-- As categorias nascem prontas porque um cadastro financeiro que começa vazio
-- obriga quem for lançar a primeira despesa a inventar a taxonomia inteira
-- antes, e a taxonomia inventada com pressa é a que depois não se consegue
-- comparar mês a mês. `nature` já vem decidido pelo mesmo motivo.

insert into public.finance_categories (slug, name, kind, nature, sort_order) values
  ('assinaturas',    'Assinaturas',        'revenue', 'variable',  10),
  ('outras-receitas','Outras receitas',    'revenue', 'variable',  20),
  ('ia',             'IA',                 'expense', 'variable',  30),
  ('infraestrutura', 'Infraestrutura',     'expense', 'fixed',     40),
  ('banco-de-dados', 'Banco de dados',     'expense', 'fixed',     50),
  ('storage',        'Storage',            'expense', 'variable',  60),
  ('saas',           'SaaS e ferramentas', 'expense', 'fixed',     70),
  ('dominios',       'Domínios',           'expense', 'fixed',     80),
  ('marketing',      'Marketing',          'expense', 'variable',  90),
  ('taxas',          'Taxas de pagamento', 'expense', 'variable', 100),
  ('impostos',       'Impostos',           'expense', 'variable', 110),
  ('desenvolvimento','Desenvolvimento',    'expense', 'fixed',    120),
  ('operacional',    'Operacional',        'expense', 'fixed',    130),
  ('outros',         'Outros',             'both',    'variable', 140)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Cenários iniciais
-- ---------------------------------------------------------------------------
--
-- Três cenários e não um: uma projeção única é lida como previsão, e é assim
-- que uma premissa vira promessa. Lado a lado, os três dizem sozinhos que o
-- número depende do que se supôs.

insert into public.finance_scenarios
  (slug, name, growth_bps, churn_bps, horizon_months, sort_order) values
  ('conservador', 'Conservador',  500, 800, 12, 10),
  ('base',        'Base',        1000, 500, 12, 20),
  ('otimista',    'Otimista',    1500, 300, 12, 30)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Fechamento
-- ---------------------------------------------------------------------------

alter table public.finance_categories enable row level security;
alter table public.finance_recurring  enable row level security;
alter table public.finance_entries    enable row level security;
alter table public.finance_scenarios  enable row level security;
alter table public.finance_settings   enable row level security;

-- Nenhuma policy, nenhum grant: só o service_role passa.
revoke all on public.finance_categories from anon, authenticated;
revoke all on public.finance_recurring  from anon, authenticated;
revoke all on public.finance_entries    from anon, authenticated;
revoke all on public.finance_scenarios  from anon, authenticated;
revoke all on public.finance_settings   from anon, authenticated;
