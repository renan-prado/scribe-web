-- O câmbio USD→BRL guardado no banco, um registro por dia.
--
-- POR QUE ISTO EXISTE. Todo número em real do painel é `custo em dólar ×
-- câmbio`: custo por rota, custo por 1.000 moedas, margem por ação, passivo de
-- moedas, custo de IA do financeiro. O dólar vinha de UMA fonte viva
-- (AwesomeAPI, `lib/fx/usd-brl.ts`) e tinha UM plano B: um valor digitado à mão
-- que ficava num COOKIE do navegador do admin.
--
-- Os dois falham juntos com facilidade, e falham em SILÊNCIO: quando a
-- AwesomeAPI não responde (ela limita por IP, e o IP de saída da Vercel é
-- compartilhado) e nenhum cookie foi digitado naquele navegador, `getUsdToBrl()`
-- devolve `null`, e a regra "valor em dólar sem cotação é null, jamais 0"
-- (lib/AGENTS.md) faz o resto do painel apagar CADA campo em real. Foi o que
-- aconteceu: 328 chamadas medidas, custo em dólar gravado direito, e a tela
-- inteira exibindo "sem câmbio". Nenhum erro, nenhum alerta, só o painel cego
-- justamente na pergunta que ele existe para responder ("os preços em moedas se
-- pagam?").
--
-- O cookie é um plano B ruim por desenho: ele vale por NAVEGADOR, some com a
-- limpeza de dados, não existe na primeira visita de uma máquina nova e nunca
-- foi digitado por ninguém. Uma linha no banco vale para o painel inteiro,
-- sobrevive a deploy e é escrita SOZINHA, toda vez que a cotação viva chega, o
-- valor dela fica guardado. Depois da primeira leitura bem-sucedida, o painel
-- nunca mais fica sem câmbio: no máximo fica com o de ontem, dito na tela.
--
-- UMA LINHA POR DIA, e a PK é o dia. A cotação varia dentro do dia e não nos
-- interessa o intradiário: o que o painel converte é o custo agregado de uma
-- janela de dias. Guardar a série diária, em vez de só "o último valor", é o
-- que abre a porta para converter cada mês pela cotação DA ÉPOCA em vez de pela
-- de hoje, hoje `lib/finance/measured.ts` usa uma cotação só para toda a série
-- porque histórico nenhum existia, e o cabeçalho de `aggregateAiCostByMonth`
-- diz isso. Esta tabela é o começo desse histórico; ela nasce vazia, e o dia
-- em que houver meses inteiros aqui a conversão pode passar a ser por mês.
--
-- SUPERFÍCIE DE ATAQUE, o que este arquivo fecha. O câmbio é MULTIPLICADOR de
-- todo número em real do painel: quem escrevesse uma linha aqui decidiria a
-- margem que o admin lê, e portanto o preço que ele vai fixar. Mesmo molde de
-- `admin_insights` (0034): RLS ligada, NENHUMA policy e nenhum grant, a tabela
-- é inalcançável pelo PostgREST com a chave anon, e só o service_role escreve
-- (de `lib/fx/usd-brl.ts`, no caminho que já roda atrás de `requireAdmin()`).

create table if not exists public.usd_brl_rates (
  -- O dia da cotação, em UTC, como a rota o viu. PK: a segunda leitura do
  -- mesmo dia sobrescreve a primeira, e é isso que se quer, a mais recente é
  -- a melhor estimativa do dia, e não há intradiário a preservar.
  day        date primary key,
  -- 4 casas: é a precisão que a AwesomeAPI devolve em `bid` ("5.1305").
  rate       numeric(10, 4) not null check (rate > 0),
  -- Quem disse. Hoje só "awesomeapi" grava aqui, o valor manual continua no
  -- cookie, porque ele é a opinião de UMA pessoa sobre um número e não deve
  -- virar histórico medido. Sem CHECK, pela mesma razão de `admin_insights.scope`.
  source     text not null,
  fetched_at timestamptz not null default now()
);

alter table public.usd_brl_rates enable row level security;

-- Nenhuma policy, nenhum grant: só o service_role passa.
revoke all on public.usd_brl_rates from anon, authenticated;
