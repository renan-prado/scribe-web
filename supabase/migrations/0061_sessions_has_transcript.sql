-- A transcrição saiu do payload do resumo, e esta coluna é o que sobrou dela
-- na listagem.
--
-- `/summary/:id` mandava a transcrição INTEIRA para o navegador em toda
-- abertura — dezenas de KB para um sermão de quarenta minutos — e lá dentro ela
-- tinha três usos: dois perguntavam só se ela EXISTE (para acender o item
-- "Transcrição" no menu e o aviso do resumo) e o terceiro a desenhava dentro de
-- um dialog que só abre pelo menu de três pontinhos.
--
-- Agora a página manda o booleano e o texto vai buscar-se sozinho quando o
-- dialog abre (`GET /api/sessions/:id/transcript`). Só que "existe?" não se
-- responde sem ler a coluna: o PostgREST não tem `length()` no `select`, e
-- pedir `transcript` para descobrir que ele não está vazio traria de volta
-- exatamente o que estamos tirando do fio.
--
-- Daí a coluna GERADA: o Postgres a mantém em dia sozinho a cada escrita, ela
-- é sempre verdadeira por construção (não há como esquecer de atualizá-la) e
-- cabe num bit. STORED porque o PostgREST só enxerga coluna materializada.
--
-- Sessão do modo `manual` nasce com transcript '' e portanto `false`, que é o
-- certo: quem digitou o resumo não tem transcrição nenhuma a mostrar.
alter table public.sessions
  add column if not exists has_transcript boolean
  generated always as (transcript is not null and transcript <> '') stored;

comment on column public.sessions.has_transcript is
  'Derivada de transcript. Existe para a tela saber se há transcrição sem baixá-la.';
