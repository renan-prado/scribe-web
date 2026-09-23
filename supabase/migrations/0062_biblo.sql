-- O Biblo: a conversa que acontece DENTRO de uma sessão.
--
-- A pessoa acabou de resumir uma pregação (ou está escrevendo uma em
-- `/summary/new`) e conversa sobre aquele texto: contexto da passagem, quem foi
-- o personagem, outras passagens sobre o tema, uma provocação. O que presta
-- volta para o resumo como bloco. O desenho inteiro está em
-- `docs/biblo-implementacao.md`; aqui mora só o que o banco precisa saber.
--
-- =====================================================================
-- POR QUE NÃO EXISTE UMA TABELA DE CONVERSA
-- =====================================================================
-- É UMA conversa por sessão, e isso quer dizer que `session_id` já É a
-- conversa. Uma `biblo_conversations` com uma linha por sessão seria uma
-- chave estrangeira para guardar nada, e mais uma junção em toda leitura.
--
-- =====================================================================
-- `billing`: COMO cada mensagem foi paga, na própria linha
-- =====================================================================
-- Ela é o que torna as contas possíveis sem nenhum contador paralelo:
--
--   * presente usado pela conta = as linhas 'gift' daquele user_id;
--   * mensagens pagas          = as linhas 'coins', que batem uma a uma com
--     `coin_transactions.reason = 'biblo_message'`.
--
-- Nenhuma coluna de contador em `profiles`, nada que possa divergir do
-- ledger, e a conferência dos dois lados é uma query: se o número de linhas
-- 'coins' de uma conta não bate com o número de débitos `biblo_message` dela,
-- alguma mensagem foi respondida sem ser cobrada (ou cobrada sem ser
-- respondida).
--
-- Só a linha do USUÁRIO carrega `billing` — a resposta do modelo não é paga,
-- ela é o que a pergunta comprou. O `check` no fim garante a
-- correspondência nos dois sentidos, para a coluna não virar opcional na
-- prática.
--
-- =====================================================================
-- ESCRITA SÓ POR service_role
-- =====================================================================
-- `select` para o dono, e mais nada. Sem `insert`, sem `update`, sem
-- `delete` para `authenticated`: toda escrita passa pelo cliente de
-- service-role dentro de `/api/biblo`, como já acontece com `charge_coins`
-- (0037) e `llm_usage_events` (0039).
--
-- O motivo é direto: quem pudesse inserir escolheria o próprio `billing`, e
-- 'gift' é o valor que não custa nada. Também poderia forjar uma linha
-- `role = 'assistant'` — ou seja, pôr palavras na boca do Biblo dentro do
-- próprio app.

create table if not exists public.biblo_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  -- Só em linhas do assistente. `chips` são as próximas sugestões de pergunta,
  -- `suggestion` é um bloco do resumo pronto para ser inserido (o mesmo
  -- vocabulário de `SummaryBlockSchema`, nunca um formato novo), e `thread` é
  -- o fio: o resumo curto do que já foi conversado além da janela que vai ao
  -- modelo. Os três saem da MESMA chamada que escreveu a resposta.
  chips       jsonb,
  suggestion  jsonb,
  thread      text,
  billing     text check (billing in ('gift', 'coins')),
  created_at  timestamptz not null default now(),
  constraint biblo_messages_billing_only_on_user
    check ((role = 'user') = (billing is not null))
);

-- A leitura de sempre: a conversa de uma sessão, em ordem.
create index if not exists biblo_messages_session_idx
  on public.biblo_messages (session_id, created_at);

-- Índice PARCIAL: a única pergunta feita fora do escopo de uma sessão é
-- "quanto do presente desta conta já foi usado?". Um índice cheio em
-- `user_id` pagaria por todas as outras linhas para responder essa.
create index if not exists biblo_messages_gift_idx
  on public.biblo_messages (user_id) where billing = 'gift';

alter table public.biblo_messages enable row level security;

drop policy if exists biblo_messages_select_own on public.biblo_messages;
create policy biblo_messages_select_own on public.biblo_messages
  for select to authenticated using (user_id = auth.uid());

grant select on public.biblo_messages to authenticated;
revoke insert, update, delete on public.biblo_messages from authenticated;
