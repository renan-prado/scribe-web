-- Os tours das telas logadas: a apresentação guiada que cada pessoa vê UMA
-- vez, por tela.
--
-- POR QUE ISTO É UMA TABELA E NÃO `localStorage`. Um tour guardado no
-- navegador volta a aparecer no celular de quem se cadastrou no computador, e
-- some para sempre de quem limpou os dados do site. As duas falhas são
-- invisíveis para nós e as duas doem no mesmo lugar: a primeira interrompe
-- quem já aprendeu, a segunda esconde a explicação de quem ainda não. A
-- pergunta "esta pessoa já viu isto?" é sobre a PESSOA, não sobre o aparelho,
-- e por isso ela é respondida onde a pessoa mora.
--
-- POR QUE UMA LINHA POR (PESSOA, TOUR) E NÃO UMA FLAG "já fez o onboarding".
-- Não existe "o" tour: a biblioteca, o resumo salvo, o estudo e cada tela de
-- captura ensinam coisas diferentes, e quem chega pelo link de um resumo pode
-- levar semanas até abrir a Biblioteca. Uma flag única gastaria a explicação
-- de cinco telas na primeira delas. A chave primária é literalmente a regra do
-- produto: **uma vez por pessoa, por tipo de tour.**
--
-- =====================================================================
-- 1) `tour` é texto SEM check de valores, e isso é deliberado
-- =====================================================================
-- O vocabulário das chaves ('feed', 'recordings', 'summary', …) mora em
-- `lib/domain/tour.ts`, client-safe, porque é o mesmo módulo que desenha os
-- passos na tela. Um `check (tour in (...))` aqui obrigaria uma migração para
-- cada tela nova que ganhasse explicação, e o custo de errar é baixo: uma
-- chave desconhecida é uma linha órfã que ninguém lê, não um dado errado num
-- número que a empresa usa. O limite de tamanho fica, ele existe contra
-- entrada gigante, não contra entrada inesperada.
--
-- =====================================================================
-- 2) `version`: a única maneira de um tour voltar a aparecer
-- =====================================================================
-- A linha guarda QUAL versão dos passos a pessoa viu, e não um booleano. No
-- dia em que uma tela ganhar algo que precise ser ensinado, subir a `version`
-- em `lib/domain/tour.ts` faz o tour rodar de novo para todo mundo, e a linha
-- é reescrita com o número novo.
--
-- É por isso que subir a versão é um ato DELIBERADO, e não um detalhe de
-- refatoração: ela reinterrompe a base inteira. Corrigir uma vírgula num passo
-- não sobe versão; acrescentar um passo sobre um botão novo sobe.
--
-- =====================================================================
-- 3) `completed_at` × `dismissed_at`: quem chegou ao fim e quem fugiu
-- =====================================================================
-- Os dois marcam o mesmo desfecho para o produto, o tour não volta, e
-- respondem perguntas opostas para nós. Um tour que quase todo mundo
-- ABANDONA no passo 2 não é um tour que precisa de mais um passo: é um passo
-- que está no lugar errado, ou uma tela que não precisava de tour nenhum.
-- Sem as duas colunas e sem `last_step`, essa diferença não existe, e a única
-- coisa que sobra é "todo mundo viu", que é verdade e não serve para nada.
--
-- `started_at` sem nenhum dos dois é o terceiro desfecho, e o mais comum de
-- se esquecer: a pessoa fechou a aba no meio. A linha existir já basta para o
-- tour não voltar, e essa escolha tem preço, quem recarregou a página no
-- passo 1 não vê o resto. O troco está no /profile: "Rever os tours" apaga
-- estas linhas e devolve todas as explicações de uma vez.

create table if not exists public.user_tours (
  user_id      uuid not null references auth.users(id) on delete cascade,
  tour         text not null check (char_length(tour) between 1 and 40),
  -- A versão dos passos que ESTA pessoa viu. Ver o bloco 2 acima.
  version      int  not null default 1 check (version > 0),
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  dismissed_at timestamptz,
  -- Índice do último passo exibido, 0-based. É o que transforma "abandonou"
  -- em "abandonou ONDE".
  last_step    int  not null default 0 check (last_step >= 0),
  primary key (user_id, tour)
);

-- "Quantos começaram e quantos terminaram, por tour, nesta semana?" é a única
-- pergunta que se faz desta tabela fora do caminho de um usuário só, e ela
-- varre por data. A PK já cobre a leitura por pessoa.
create index if not exists user_tours_started_idx
  on public.user_tours (tour, started_at desc);

-- =====================================================================
-- 4) RLS ligada, NENHUMA policy, pelo mesmo motivo de 0047
-- =====================================================================
-- Tudo é escrito e lido com service-role, a partir de rotas que passaram por
-- `requireAuth()` e derivam o `user_id` da sessão, nunca do corpo.
--
-- A tentação aqui é conceder INSERT ao dono, afinal a linha só atrapalha a
-- própria pessoa. Duas coisas dizem não. A primeira é que a taxa de conclusão
-- por tour é um número que a EMPRESA lê para decidir o que reescrever, e a
-- regra de 0039 vale inteira: número que orienta o roadmap é escrita de
-- service-role. A segunda é `version`: com UPDATE concedido, dava para
-- carimbar uma versão futura numa linha e nunca mais receber tour nenhum, o
-- que é inofensivo para quem faz e indistinguível, para nós, de um tour que
-- ninguém abre.

alter table public.user_tours enable row level security;
