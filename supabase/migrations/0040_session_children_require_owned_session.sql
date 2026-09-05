-- Uma linha filha de sessão passa a exigir que a SESSÃO também seja sua.
--
-- O BURACO. As seis tabelas filhas de sessão têm a policy de INSERT no molde
-- da casa, `with check (user_id = auth.uid())`. Ela garante que a linha é MINHA
-- — e não diz nada sobre o `session_id` que eu escrevo dentro dela. Qualquer
-- sessão logada podia inserir uma linha própria apontando para a sessão de
-- outra pessoa, bastando conhecer o uuid, que é o que aparece na URL de
-- `/recording/:id/*`.
--
-- Na maioria das tabelas isso é sujeira no feed de quem inseriu: a linha é do
-- atacante, o conteúdo é do atacante, e a RLS de `sessions` continua impedindo
-- de LER qualquer coisa da vítima (conferido: `select` da sessão alheia volta
-- `[]`).
--
-- Em `session_deepenings` é outra coisa, porque lá existe `unique (session_id)`
-- — uma sessão, um estudo. A sequência, reproduzida em dev em 2026-09-05:
--
--   1. B insere `{user_id: B, session_id: <sessão de A>, payload: {}}`  → 201
--   2. A pede o estudo. A rota chama `hasDeepening(sessionId)`, que roda com o
--      client de A: a linha de B está escondida pela RLS, então volta VAZIO e a
--      rota segue                                                      → []
--   3. A rota debita as moedas de A e roda o pipeline inteiro — três chamadas
--      a modelo de raciocínio, perto de quatro minutos
--   4. `createDeepening` esbarra na unique                             → 23505
--
-- Ou seja: A paga as moedas, nós pagamos a OpenAI, e o estudo não existe. É
-- negação de serviço com prejuízo dos dois lados, disparada por quem só sabe um
-- uuid. E a vítima não tem como se desentupir sozinha: a linha que bloqueia é
-- invisível para ela.
--
-- A CORREÇÃO é dizer no `with check` o que a policy sempre quis dizer: a linha
-- é minha E a sessão a que ela se refere é minha. A subconsulta em `sessions`
-- roda como o próprio usuário, então ela já é a RLS de `sessions` — não há
-- caminho por onde ela devolva o id de outra pessoa.
--
-- Vale para UPDATE também. Sem isso, uma linha legítima podia ser MOVIDA para a
-- sessão da vítima depois de criada, e o furo voltaria pela porta de trás.
--
-- `session_id` é nullable em algumas destas tabelas? Não: as seis o declaram
-- `not null` com FK para `public.sessions`. Ainda assim o predicado é escrito
-- para tolerar null (`session_id is null or ...`) — se um dia uma coluna dessas
-- afrouxar, o comportamento continua sendo "não bloqueia o que não aponta para
-- ninguém", nunca "aceita qualquer coisa".

-- Predicado repetido em vez de função: uma função `security definer` aqui
-- teria de ser revogada de anon/authenticated (ver 0038) e ainda assim rodaria
-- fora da RLS. A subconsulta inline roda COMO O USUÁRIO, que é exatamente o que
-- se quer.

-- ── session_deepenings ────────────────────────────────────────────────────
drop policy if exists session_deepenings_insert_own on public.session_deepenings;
create policy session_deepenings_insert_own on public.session_deepenings
  for insert with check (
    user_id = auth.uid()
    and (
      session_id is null
      or session_id in (select id from public.sessions where user_id = auth.uid())
    )
  );

drop policy if exists session_deepenings_update_own on public.session_deepenings;
create policy session_deepenings_update_own on public.session_deepenings
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      session_id is null
      or session_id in (select id from public.sessions where user_id = auth.uid())
    )
  );

-- ── session_practices ─────────────────────────────────────────────────────
drop policy if exists session_practices_insert_own on public.session_practices;
create policy session_practices_insert_own on public.session_practices
  for insert with check (
    user_id = auth.uid()
    and (
      session_id is null
      or session_id in (select id from public.sessions where user_id = auth.uid())
    )
  );

drop policy if exists session_practices_update_own on public.session_practices;
create policy session_practices_update_own on public.session_practices
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      session_id is null
      or session_id in (select id from public.sessions where user_id = auth.uid())
    )
  );

-- ── session_rereads ───────────────────────────────────────────────────────
drop policy if exists session_rereads_insert_own on public.session_rereads;
create policy session_rereads_insert_own on public.session_rereads
  for insert with check (
    user_id = auth.uid()
    and (
      session_id is null
      or session_id in (select id from public.sessions where user_id = auth.uid())
    )
  );

drop policy if exists session_rereads_update_own on public.session_rereads;
create policy session_rereads_update_own on public.session_rereads
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      session_id is null
      or session_id in (select id from public.sessions where user_id = auth.uid())
    )
  );

-- ── session_reminders ─────────────────────────────────────────────────────
drop policy if exists session_reminders_insert_own on public.session_reminders;
create policy session_reminders_insert_own on public.session_reminders
  for insert with check (
    user_id = auth.uid()
    and (
      session_id is null
      or session_id in (select id from public.sessions where user_id = auth.uid())
    )
  );

drop policy if exists session_reminders_update_own on public.session_reminders;
create policy session_reminders_update_own on public.session_reminders
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      session_id is null
      or session_id in (select id from public.sessions where user_id = auth.uid())
    )
  );

-- ── session_highlights ────────────────────────────────────────────────────
drop policy if exists session_highlights_insert_own on public.session_highlights;
create policy session_highlights_insert_own on public.session_highlights
  for insert with check (
    user_id = auth.uid()
    and (
      session_id is null
      or session_id in (select id from public.sessions where user_id = auth.uid())
    )
  );

drop policy if exists session_highlights_update_own on public.session_highlights;
create policy session_highlights_update_own on public.session_highlights
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      session_id is null
      or session_id in (select id from public.sessions where user_id = auth.uid())
    )
  );

-- ── hallucination_reports ─────────────────────────────────────────────────
-- Só INSERT: a tabela não tem policy de UPDATE, e é assim que se quer — um
-- relato de defeito não se reescreve depois de enviado.
drop policy if exists hallucination_reports_insert_own on public.hallucination_reports;
create policy hallucination_reports_insert_own on public.hallucination_reports
  for insert with check (
    user_id = auth.uid()
    and (
      session_id is null
      or session_id in (select id from public.sessions where user_id = auth.uid())
    )
  );
