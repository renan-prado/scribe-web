-- O Biblo passa a mostrar a IMAGEM do léxico junto de uma resposta.
--
-- O QUE ESTA COLUNA GUARDA: o slug da entrada de `lexicon_entries` sobre a qual
-- a pergunta foi feita, quando foi UMA só e quando ela tem imagem. É o que faz
-- o retrato continuar lá depois de fechar e reabrir a gaveta; sem a coluna, ele
-- apareceria na resposta que acabou de chegar e sumiria no próximo carregamento
-- da conversa, que é o tipo de inconsistência que se lê como defeito.
--
-- POR QUE O SERVIDOR DECIDE, E NÃO O MODELO. A tentação era um campo `entity`
-- no JSON da resposta, irmão de `passage` e `offer`. Ele custaria um campo no
-- contrato, um parágrafo no prompt, tokens de saída e uma conferência contra a
-- tabela para o caso de o modelo inventar um slug. E resolveria um problema que
-- o anotador já resolve: as menções da PERGUNTA são as mesmas que o `RichText`
-- marca na tela, achadas por regex, sem custo e sem chance de invenção. Ver
-- `entityForAnswer` em `biblo/answer.ts`.
--
-- UMA SÓ, e nunca "a primeira de três": com dois nomes na mesma pergunta não há
-- resposta certa sobre qual ilustrar, e escolher uma é acertar metade das vezes
-- num lugar em que não errar custa não desenhar nada.
--
-- SEM CHAVE ESTRANGEIRA para `lexicon_entries`, de propósito. Apagar uma entrada
-- do léxico não pode apagar (nem travar) mensagens de conversa: o que acontece
-- com um slug órfão é o retrato não aparecer, que é exatamente o que deve
-- acontecer com uma entrada que deixou de existir. Um `on delete cascade` aqui
-- faria uma faxina no cadastro derrubar conversa de gente.

alter table public.biblo_messages
  add column if not exists entity_slug text;

comment on column public.biblo_messages.entity_slug is
  'Slug de lexicon_entries ilustrando esta resposta. So em linhas do assistente. Ver 0065.';

-- O `grant select` da 0062 é de TABELA, não de coluna, então a nova já está
-- coberta e não há grant a escrever aqui. A escrita continua sendo só do
-- service_role, como toda linha desta tabela.
