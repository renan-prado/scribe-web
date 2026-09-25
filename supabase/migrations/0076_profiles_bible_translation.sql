-- A tradução da Bíblia que a pessoa prefere ler.
--
-- O PROBLEMA. O produto lia UMA tradução, a NVI, escolhida no código
-- (`src/lib/bibles/loader.ts`). Ela é proprietária, e isso não era detalhe de
-- metadado: o texto bíblico aparece no resumo, e o resumo é a coisa que se
-- compartilha por link. Entraram duas traduções redistribuíveis — Almeida 1911
-- (domínio público) e Bíblia Livre (CC BY 4.0 Brasil) —, a segunda virou o
-- padrão, e a pergunta "qual delas?" passou a ter três respostas possíveis por
-- passagem: a escolha da citação, a preferência de quem lê, e o padrão.
--
-- Esta coluna é a do MEIO. As outras duas não precisam de banco novo: a da
-- citação mora no bloco, dentro do `final_summary` (jsonb), e o padrão é uma
-- constante client-safe.
--
-- POR QUE uma coluna em `profiles`, e não localStorage. A preferência é da
-- PESSOA e não do aparelho — quem lê no celular e no computador espera a mesma
-- Bíblia nos dois —, e ela precisa ser conhecida no SERVIDOR: o resumo semeia
-- o texto das passagens no HTML (`features/session/server/passages.ts`), e uma
-- preferência que só existisse no navegador faria o servidor semear sempre a
-- tradução errada, com a tela corrigindo depois num piscar em cada versículo.
--
-- Ela viaja na linha que `lib/db/account.ts` já lê em todo carregamento, então
-- não custa consulta nenhuma.
alter table public.profiles
  add column if not exists bible_translation text;

-- NULL é "não escolheu", e é o padrão de toda linha existente: quem nunca
-- entrou nesta tela recebe o padrão do produto, que pode mudar sem um UPDATE
-- em tabela de usuário. Gravar o padrão aqui na criação da conta congelaria a
-- escolha de hoje em cada linha nova.
--
-- O CHECK não lista a NVI de propósito: ela está no registro do código porque
-- o arquivo dela continua em disco, e não porque alguém possa escolhê-la. Uma
-- linha com 'NVI' aqui seria licença proprietária servida por preferência de
-- usuário, que é exatamente o que as duas traduções novas existem para evitar.
-- Tradução nova entra nesta lista junto com o `selectable: true` de
-- `src/lib/bibles/translations.ts`.
alter table public.profiles
  drop constraint if exists profiles_bible_translation_check;

alter table public.profiles
  add constraint profiles_bible_translation_check
  check (bible_translation is null or bible_translation in ('BLIVRE', 'ALM1911'));

-- Sem índice: a coluna nunca é filtro nem ordenação, ela é lida junto da linha
-- própria da pessoa, pela chave primária.
comment on column public.profiles.bible_translation is
  'Tradução bíblica preferida (BLIVRE | ALM1911). NULL = padrão do produto.';
