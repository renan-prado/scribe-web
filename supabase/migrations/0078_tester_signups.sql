-- Pré-cadastro do TESTE FECHADO da Play Store.
--
-- O teste fechado do Google Play não é um link que se abre: a pessoa só
-- enxerga a ficha do app depois que o e-mail da conta Google DELA entra na
-- lista de testadores do console. Ou seja, antes de qualquer download existe
-- uma etapa manual — alguém cola aquele endereço no console e espera algumas
-- horas até o Google propagar. Esta tabela é a fila dessa etapa.
--
-- POR QUE UMA TABELA, e não um e-mail para a caixa de entrada. A lista do
-- console é um CAMPO DE TEXTO com endereços separados por vírgula: o trabalho
-- de quem opera é copiar de lá para cá em lote, e um lote não se monta
-- garimpando uma caixa de entrada. Além disso, o WhatsApp é a única forma de
-- avisar "liberou" — o e-mail que a pessoa usa na Play Store quase nunca é o
-- que ela lê.
--
-- DUAS COLUNAS SÃO O PRODUTO INTEIRO: `play_email`, que é a chave que o
-- console consome, e `whatsapp`, que é por onde o link volta. `display_name`
-- é opcional de propósito — pedir nome num formulário de duas linhas é a
-- terceira pergunta que faz a pessoa desistir na segunda.
--
-- `play_email` é UNIQUE e guardado já em minúsculas (a rota normaliza), e é o
-- que torna o reenvio inofensivo: quem preenche duas vezes — porque trocou de
-- número, porque não teve certeza de que enviou — ATUALIZA a própria linha em
-- vez de criar uma segunda. Sem isso, a lista que se copia para o console
-- teria o mesmo endereço repetido e, pior, duas respostas diferentes sobre
-- para qual número mandar o link.
--
-- `invited_at` é o estado, e há só dois: nulo (ainda não entrou no console) e
-- preenchido (entrou). Uma coluna `status` com três valores seria inventar
-- degraus que a operação não tem.

create table if not exists public.tester_signups (
  id           uuid primary key default gen_random_uuid(),
  play_email   text not null unique check (char_length(play_email) between 5 and 254),
  whatsapp     text not null check (char_length(whatsapp) between 10 and 15),
  display_name text check (char_length(display_name) between 1 and 80),
  invited_at   timestamptz,
  note         text check (char_length(note) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.tester_signups is
  'Fila do teste fechado da Play Store: e-mail da conta Google + WhatsApp. Ver 0078.';

-- A consulta da operação é sempre a mesma: "quem ainda não foi convidado,
-- na ordem em que chegou".
create index if not exists tester_signups_pending_idx
  on public.tester_signups (created_at) where invited_at is null;

-- =====================================================================
-- RLS ligada, NENHUMA policy, e os GRANTs revogados
-- =====================================================================
-- Quem escreve é `/api/tester/signup`, com service-role, a partir de um
-- formulário PÚBLICO — quem o preenche, por definição, ainda não tem conta
-- aqui. Não há dono para uma policy escopar: `user_id` não existe nesta
-- tabela e não deveria existir.
--
-- E a linha é dado pessoal de terceiro (e-mail e telefone) numa tabela sem
-- dono. Com os grants de fábrica do Supabase e uma policy de select frouxa,
-- isso seria uma lista de contatos publicada em `GET /rest/v1/tester_signups`
-- para qualquer um com a chave anônima, que é pública. Mesma régua de
-- `signup_coupons` (0055): RLS ligada é o cinto, o revoke é o suspensório.
alter table public.tester_signups enable row level security;
revoke all on public.tester_signups from anon, authenticated;
