-- As funções de gatilho saem do alcance do cliente.
--
-- O BURACO, e ele é o mesmo de 0037 numa função que ninguém pensou em olhar
-- porque não mexe em dinheiro. `_explode_session_feed_items(uuid, jsonb)` é
-- SECURITY DEFINER — precisa ser, para o gatilho escrever em
-- `session_feed_items` sem depender da RLS de quem disparou — e NUNCA teve o
-- EXECUTE revogado. No Postgres, EXECUTE numa função nova é concedido a PUBLIC
-- por padrão: não conceder não é o mesmo que negar. Ou seja, ela estava
-- publicada em `POST /rest/v1/rpc/_explode_session_feed_items`.
--
-- O que a função faz, lida com olhos de atacante:
--
--   delete from public.session_feed_items where session_id = p_session_id;
--   insert into public.session_feed_items (...) select ... from p_items;
--
-- Um DELETE e um INSERT em cima de um id que VEM DO CHAMADOR, executados como
-- o dono da função, portanto sem RLS nenhuma. O dono da sessão nunca é
-- conferido — o `select user_id from sessions` que existe lá dentro serve para
-- CARIMBAR as linhas novas, não para autorizar coisa alguma.
--
-- Reproduzido no projeto de dev em 2026-09-05, contra uma sessão com dois
-- cards:
--
--   curl -X POST "$SUPABASE_URL/rest/v1/rpc/_explode_session_feed_items" \
--     -H "apikey: $ANON_KEY" \
--     -d '{"p_session_id":"<sessão de outra pessoa>",
--          "p_items":[{"kind":"speakerHighlight","text":"PWNED"}]}'
--   → HTTP 204, e o feed da vítima passa a ter um card só, o do atacante.
--
-- **Sem sessão nenhuma.** Só o anon key, que é público por definição — vai no
-- bundle do navegador. Basta conhecer o uuid da sessão, que é o que aparece na
-- URL de `/recording/:id/*`: qualquer print, link compartilhado, histórico de
-- navegador ou Referer entrega o alvo. O estrago é destruição e falsificação de
-- dado de outra pessoa: o feed some e é substituído pelo texto que o atacante
-- escolher, que a vítima lê como se fosse a pregação dela.
--
-- A CORREÇÃO é a de sempre, e a regra que supabase/AGENTS.md já enuncia para
-- dinheiro vale para QUALQUER função definer: EXECUTE revogado de anon e
-- authenticated. Aqui não há `grant execute ... to service_role` porque
-- ninguém chama estas funções pela API — quem as chama é o gatilho, e gatilho
-- não confere EXECUTE do usuário que disparou o comando (a permissão é
-- conferida quando o gatilho é CRIADO). A escrita de feed que o app faz
-- continua saindo do `update sessions set feed_items = ...`, como sempre saiu.
--
-- `handle_new_auth_user` e `sync_session_feed_items` entram junto por higiene:
-- as duas são `returns trigger`, que o PostgREST não expõe, mas as duas são
-- definer e as duas estavam com EXECUTE para PUBLIC. Revogar as três de uma vez
-- é o que impede a próxima função de gatilho de nascer com o mesmo defeito por
-- imitação.

revoke all on function public._explode_session_feed_items(uuid, jsonb) from public;
revoke all on function public._explode_session_feed_items(uuid, jsonb) from anon, authenticated;

revoke all on function public.sync_session_feed_items() from public;
revoke all on function public.sync_session_feed_items() from anon, authenticated;

revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.handle_new_auth_user() from anon, authenticated;
