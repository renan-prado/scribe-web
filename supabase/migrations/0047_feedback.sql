-- Feedback dos primeiros usuários: a nota que eles dão para cada parte do
-- produto, colhida no instante em que acabaram de usá-la.
--
-- POR QUE ISTO NÃO É `hallucination_reports` (0024). Aquela tabela guarda o
-- relato de um DEFEITO — o usuário viu algo errado e escreveu para consertar.
-- Esta guarda a IMPRESSÃO de quem não tem defeito nenhum a relatar, que é
-- justamente quem nunca escreve espontaneamente. Uma pergunta feita na hora
-- certa é o único jeito de ouvir essa maioria silenciosa.
--
-- O MOMENTO é a decisão de produto inteira. Perguntamos na 1ª, na 3ª e na 8ª
-- gravação, e na 1ª, 3ª e 8ª geração de estudo:
--
--   * a 1ª é a primeira impressão, que nunca mais existe;
--   * a 3ª é depois de o encanto passar e o hábito não ter se formado — a
--     janela em que a pessoa desiste;
--   * a 8ª é a opinião de quem já é usuário e sabe do que está falando.
--
-- Perguntar em TODA gravação treinaria a pessoa a fechar o diálogo sem ler, e
-- a partir daí não há mais como perguntar nada.
--
-- =====================================================================
-- 1) `profiles.feedback_started_at` — de onde a contagem começa
-- =====================================================================
-- "1ª gravação" precisa de uma origem, e a origem NÃO pode ser a primeira
-- gravação da vida da pessoa: no dia em que isto sobe, quem já tem quarenta
-- sessões passou dos três marcos sem nunca ter sido perguntado, e nunca mais
-- seria. A contagem começa AGORA para quem já existe, e no cadastro para quem
-- chegar depois.
--
-- Uma coluna `not null default now()` faz as duas coisas de uma vez, e é por
-- isso que ela é uma coluna e não uma constante no código: o `ALTER` avalia o
-- `now()` UMA vez e carimba nele todas as linhas existentes — o instante do
-- deploy —, enquanto cada perfil novo recebe o `now()` do próprio insert.
-- Nenhum backfill, nenhuma data mágica em TypeScript que alguém teria de
-- lembrar de apagar um ano depois.
--
-- Ela fica FORA do alcance do cliente pela regra de 0026: `update` em
-- `profiles` é concedido coluna a coluna, e esta não entra no grant. Quem
-- pudesse reescrevê-la escolheria quantas vezes é perguntado.

alter table public.profiles
  add column if not exists feedback_started_at timestamptz not null default now();

-- =====================================================================
-- 2) `feedback_prompts` — o livro-razão das PERGUNTAS
-- =====================================================================
-- Uma linha por vez que o diálogo foi ABERTO, respondido ou não. Ela existe
-- por três razões, e nenhuma delas é decoração:
--
--   1. `unique (user_id, kind, session_id)` é a única coisa que impede a
--      mesma pergunta de voltar. Sem ela, reabrir a página do resumo — que é
--      exatamente o que alguém faz ao reler a própria pregação — traria o
--      diálogo de novo, e uma pergunta que insiste depois de fechada é a
--      forma mais rápida de ensinar o usuário a ignorá-la para sempre.
--   2. `ordinal` congela QUAL marco aquela pergunta foi. O ordinal é derivado
--      (a enésima sessão desde `feedback_started_at`), e derivar de novo mais
--      tarde dá outro número assim que uma sessão do meio é apagada.
--   3. `answered_at` nulo é a taxa de resposta. Sem as perguntas ignoradas na
--      tabela, as notas que sobram são as de quem se dispôs a responder —
--      e essa amostra é sistematicamente mais gentil do que a realidade.
--
-- `kind` é 'recording' | 'study', e `session_id` identifica os dois: um
-- estudo é de uma sessão, e há no máximo um por sessão (0009). Não há coluna
-- `deepening_id` porque não haveria o que ela distinguisse.

create table if not exists public.feedback_prompts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('recording', 'study')),
  session_id   uuid not null references public.sessions(id) on delete cascade,
  ordinal      int  not null check (ordinal > 0),
  answered_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint feedback_prompts_once unique (user_id, kind, session_id)
);

create index if not exists feedback_prompts_user_idx
  on public.feedback_prompts (user_id, created_at desc);

-- =====================================================================
-- 3) `feedback_responses` — a nota, uma linha por NOTA
-- =====================================================================
-- O átomo é (tópico, nota), não (diálogo). O modo Ao Vivo pergunta DUAS
-- coisas na mesma janela — as sugestões durante a pregação e o resumo do fim
-- —, e elas são produtos diferentes com consertos diferentes: um pipeline ao
-- vivo ruim e um resumo ruim não se corrigem no mesmo lugar. Guardá-las numa
-- linha só (duas colunas de nota, ou um jsonb) faria a pergunta do painel —
-- "qual é a nota de cada coisa?" — virar um `case` em vez de um `group by`.
--
-- `submission_id` é o que reagrupa as linhas de um mesmo envio. O COMENTÁRIO
-- é do envio, não do tópico (a pessoa escreve um texto só), e por isso ele se
-- REPETE nas duas linhas do modo Ao Vivo. É denormalização deliberada, e o
-- preço dela está pago em uma frase: **quem lista comentários agrupa por
-- `submission_id`**, ou lê o mesmo texto duas vezes e conclui que dois
-- usuários disseram a mesma coisa.
--
-- `session_id` é nulo no feedback geral do /profile, que não fala de sessão
-- nenhuma. `app_version` carimba a versão pelo mesmo motivo de
-- `llm_usage_events` (0044): "o resumo melhorou depois daquela mudança?" é a
-- pergunta que esta tabela existe para responder, e sem o carimbo ela vira
-- uma média única que dilui toda melhoria em todo histórico.
--
-- A nota é TEXTO, não um 1..4. O número mora em `lib/domain/feedback.ts`,
-- junto do rótulo que a tela desenha; gravar os dois deixaria a escala com
-- duas definições, e o dia em que alguém acrescentar um degrau no meio a
-- escala antiga vira ruído silencioso.

create table if not exists public.feedback_responses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  -- Agrupa as notas de um mesmo envio. Não é chave: dois tópicos, duas linhas.
  submission_id  uuid not null,
  surface        text not null check (surface in ('live', 'audio', 'transcript', 'study', 'general')),
  topic          text not null check (topic in ('live_suggestions', 'summary', 'transcript', 'study', 'overall')),
  rating         text not null check (rating in ('ruim', 'razoavel', 'boa', 'excelente')),
  -- Repetido em cada linha do envio. Ver acima.
  comment        text check (comment is null or char_length(comment) <= 300),
  session_id     uuid references public.sessions(id) on delete set null,
  app_version    text,
  created_at     timestamptz not null default now(),
  constraint feedback_responses_one_per_topic unique (submission_id, topic)
);

create index if not exists feedback_responses_topic_idx
  on public.feedback_responses (topic, created_at desc);
create index if not exists feedback_responses_created_idx
  on public.feedback_responses (created_at desc);

-- `on delete set null` em `session_id`, e não `cascade`: apagar a gravação
-- apaga o conteúdo dela, não a opinião que a pessoa teve sobre o produto. A
-- nota continua valendo para a média; só perde o ponteiro para o que a
-- originou.

-- =====================================================================
-- 4) RLS ligada, NENHUMA policy
-- =====================================================================
-- As duas tabelas são escritas com service-role, a partir de rotas que já
-- passaram por `requireAuth()` e que derivam o `user_id` da sessão — nunca do
-- corpo. É a regra que a migração 0039 escreveu com sangue:
--
--   > Telemetria, contabilidade e qualquer número que a EMPRESA lê são
--   > escrita de service-role. Policy de INSERT para `authenticated` só onde
--   > a linha é conteúdo do próprio usuário.
--
-- Aqui a linha é os DOIS: o comentário é conteúdo da pessoa, e a nota é o
-- número que decide o que consertamos em seguida. Com uma policy de INSERT,
-- o anon key aceitaria mil linhas "excelente" — ou mil "ruim" — direto na
-- tabela que orienta o roadmap, sem passar por rota nenhuma. Não há leitura
-- pelo cliente porque não há tela em que o usuário releia o próprio feedback:
-- ele responde e a janela fecha.
--
-- O ordinal e o marco também não são do cliente. Se o navegador dissesse
-- "esta é a minha 1ª gravação", o diálogo apareceria quando ele quisesse — e
-- a amostra deixaria de ser a que escolhemos medir.

alter table public.feedback_prompts   enable row level security;
alter table public.feedback_responses enable row level security;
