-- "Algo está errado" no cartão de um nome do léxico.
--
-- POR QUE ELE NÃO É O ALERTA DE ALUCINAÇÃO, apesar do mesmo rótulo na tela.
-- `hallucination_reports` existe para auditar o que a IA escreveu: a nota do
-- usuário é cruzada com a TRANSCRIÇÃO por um modelo, que responde na própria
-- janela removendo o que não tem apoio no que foi dito. Aqui não há nada disso
-- para fazer — o conteúdo do léxico foi escrito à mão no painel, não há IA para
-- auditar nem transcrição contra a qual conferir, e a única resposta possível é
-- uma pessoa ler e corrigir. Então esta tabela é um RECADO, não uma auditoria:
-- ela não chama modelo nenhum e não custa moeda.
--
-- E é por isso que ela é uma tabela, e não um campo em `lexicon_entries`. O
-- alerta é sobre a entrada, mas pertence a QUEM ALERTOU: duas pessoas podem
-- apontar coisas diferentes na mesma entrada, e um campo só guardaria a última.
--
-- SEM CHAVE ESTRANGEIRA para `lexicon_entries`, pela mesma razão da 0065: o
-- alerta continua valendo depois de a entrada ser apagada — na verdade é aí que
-- ele mais vale, porque "apaguei a entrada errada" é exatamente o tipo de coisa
-- que alguém reporta. O slug fica gravado como texto.

create table if not exists public.lexicon_reports (
  id         uuid primary key default gen_random_uuid(),
  -- O slug do cartão, como texto. Ver o cabeçalho sobre a ausência de FK.
  slug       text not null,
  -- Quem alertou. `set null` e não `cascade`: a conta some, o alerta fica, e a
  -- correção que ele pede continua sendo necessária.
  user_id    uuid references auth.users(id) on delete set null,
  -- O que está errado, nas palavras de quem viu. Teto pequeno de propósito: é
  -- um recado, e o que não couber em 600 caracteres é uma conversa.
  note       text not null check (length(btrim(note)) between 3 and 600),
  -- Já foi lido e resolvido? É o que tira a linha da fila do painel sem apagar
  -- o registro do que foi apontado.
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.lexicon_reports is
  'Alertas de usuarios sobre o conteudo de um cartao do lexico. Recado, nao auditoria. Ver 0066.';

-- A fila do painel: o que não foi resolvido, mais novo primeiro.
create index if not exists lexicon_reports_open_idx
  on public.lexicon_reports (created_at desc)
  where not resolved;

-- RLS -------------------------------------------------------------------------
-- Ligada e SEM POLICY NENHUMA, como `feedback_responses` (0047) e
-- `referral_rewards`. É a forma mais forte de dizer que nada aqui é alcançável
-- pelo anon key.
--
-- Uma policy de INSERT para `authenticated` seria o erro fácil: ela autoriza a
-- ESCRITA e não olha o conteúdo, então qualquer sessão logada despejaria mil
-- linhas direto no PostgREST, sem passar por rota nenhuma — e esta tabela é uma
-- FILA DE TRABALHO, então enchê-la de lixo é enterrar os alertas de verdade.
-- Quem escreve é a rota, com service_role, depois de ter afirmado a sessão.
alter table public.lexicon_reports enable row level security;

revoke all on public.lexicon_reports from anon, authenticated;
