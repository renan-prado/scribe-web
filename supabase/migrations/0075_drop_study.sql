-- O ESTUDO APROFUNDADO sai do banco. Última etapa de uma remoção em três.
--
-- A saída foi por partes, e cada uma tem o seu commit:
--
--   1. o ACESSO: o botão "Gerar estudo" do resumo, o item da gaveta, o atalho
--      do manifesto e o passo de tour que apontava para ele;
--   2. as ROTAS `/studies` e `/studies/[id]`, com `StudiesBrowser`,
--      `DeepenButton` e companhia, redirecionando link antigo para a sessão;
--   3. ESTA: a API (`/api/deepening`, `/api/deepening/reprocess`), o pipeline
--      de cinco etapas, os prompts, o entitlement `study_generation`, a linha
--      de preço no painel e, aqui, a tabela.
--
-- Entre a 2 e a 3 o produto ficou num estado que não se sustenta: uma rota
-- POST viva, cobrando 50 moedas e queimando quatro minutos de modelo de
-- raciocínio, sem NENHUM botão no produto que chegasse até ela — e, no painel,
-- um kill switch, uma exceção por pessoa e uma decisão de preço para uma coisa
-- que ninguém podia comprar. Controle sem produto atrás é pior que controle
-- nenhum: ele convida a girar um parâmetro que não governa coisa alguma.
--
-- =====================================================================
-- 1) a tabela
-- =====================================================================
-- `session_deepenings` guardava o estudo gerado (`payload`) e o registro do
-- pipeline (`plan`, migração 0033). Nada mais a lê: a leitura no painel
-- (`/admin/sessions/[id]`, aba "Estudo") saiu no mesmo commit, por decisão
-- explícita de quem mantém o produto.
--
-- Não há `on delete` de outra tabela apontando para cá — as FKs saem DAQUI
-- para `sessions` e `profiles`, não o contrário —, então o drop não arrasta
-- nada junto. As policies e o índice vão embora com a tabela.
drop table if exists public.session_deepenings;

-- =====================================================================
-- 2) a pesquisa de satisfação sobre o estudo
-- =====================================================================
-- `feedback_responses` guarda uma nota por (envio, tópico), e o tópico
-- `study` perguntava "o que você achou do estudo?". Ele saiu do vocabulário
-- em `lib/domain/feedback.ts`, e uma linha cujo tópico não existe mais é pior
-- que uma linha ausente: a agregação do painel a DESCARTA em silêncio
-- (`FEEDBACK_TOPICS.includes(topic)`), enquanto a lista de "últimas respostas"
-- continua desenhando-a — a mesma tela contando duas histórias sobre a mesma
-- linha.
--
-- ⚠️ Isto APAGA nota de gente. São poucas (3 no total entre dev e produção
-- no dia desta migração) e todas sobre um produto que não existe mais, mas a
-- decisão é essa e está escrita aqui: opinião sobre o estudo não fica.
delete from public.feedback_responses where topic = 'study' or surface = 'study';

-- As PERGUNTAS feitas sobre o estudo, que é o que impede a janela de voltar.
-- Sem a tabela `session_deepenings` nenhuma delas pode ser respondida, e o
-- servidor já recusa uma pergunta de `kind` diferente de 'recording'
-- (`lib/db/feedback.ts`). A linha só ocuparia espaço no livro-razão.
delete from public.feedback_prompts where kind = 'study';

-- O `check (kind in ('recording', 'study'))` de 0047 FICA como está, e isso é
-- deliberado: estreitá-lo agora não protege de nada (o único escritor é o
-- servidor, que só emite 'recording') e faria esta migração falhar em
-- qualquer ambiente onde reste uma linha que o delete acima não alcançou.
