-- As anotações que quem grava escreve DURANTE a pregação, guardadas na linha.
--
-- Elas já existiam: o bloco de notas do gravador (`recording-notes.ts`) as
-- manda no POST de `/api/final-summary`, onde entram no prompt marcadas como
-- "notas do ouvinte" e ajudam o modelo a acertar o nome próprio que o microfone
-- não entregou. O que não existia era ESTA coluna, e sem ela o texto morria no
-- fim da requisição: quem escreveu três parágrafos durante o sermão não tinha
-- onde relê-los depois, e nada na tela dizia que eles tinham sido usados.
--
-- Guardar não é só para mostrar. Duas coisas dependem disto:
--
--   1. o TERCEIRO slide de `/summary/:id`, ao lado do resumo e da transcrição;
--   2. o REPROCESSAMENTO, que refaz o resumo a partir da transcrição salva e
--      até aqui ia sem as notas, porque não tinha de onde tirá-las. Quem
--      reprocessava perdia em silêncio a correção de nome que tinha digitado.
--
-- `text` sem teto no banco, com o limite aplicado onde ele é cobrável: o campo
-- da tela (`RECORDING_NOTES_MAX_CHARS`, 4.000) e o schema da rota (8.000, folga
-- para caractere multibyte). Toda sessão anterior a esta migração fica `null`,
-- que é o mesmo que "não anotou nada" — e é por isso que a coluna é nullable em
-- vez de `default ''`: a tela precisa distinguir as duas para não abrir um
-- slide vazio em sessão nenhuma do passado.
alter table public.sessions
  add column if not exists notes text;

comment on column public.sessions.notes is
  'Anotações digitadas durante a gravação. Contexto do resumo e terceiro slide da leitura; null = não anotou.';
