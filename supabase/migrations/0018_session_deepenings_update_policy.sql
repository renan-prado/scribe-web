-- session_deepenings ganhou a rota /api/deepening/reprocess, que faz UPDATE
-- no payload. A migração original (0009) só criou policies para SELECT,
-- INSERT e DELETE — sem UPDATE, o Supabase silenciosamente retornava 0
-- linhas afetadas, sem erro, e o reprocess parecia funcionar mas nunca
-- persistia nada.
--
-- Esta migration só adiciona a policy que faltou. Mantém o mesmo escopo
-- das demais: o dono da linha (user_id = auth.uid()) pode reescrever o
-- próprio estudo. O with-check impede que a linha seja "mudada de dono".

drop policy if exists session_deepenings_update_own on public.session_deepenings;

create policy session_deepenings_update_own on public.session_deepenings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
