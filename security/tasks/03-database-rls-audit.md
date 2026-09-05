# 03 — Interrogatório do banco de dados

**Status:** ⚠️ Bloqueado — corrigido e reverificado em **dev**; 0038 e 0040 já
aplicadas em **produção**. Falta só a **0039**, que depende do deploy do código
novo de `lib/db/usage.ts`. Ver "Rodada 2026-09-05".

## Objetivo

Auditar RLS tabela por tabela — e provar cada policy com a query real que um
atacante rodaria, não com "parece correta".

## Prompt para a IA

```
Audit my database access rules table by table (Supabase RLS or equivalent).

1. List every table and whether RLS is enabled. Any table reachable with the

public key and no RLS is CRITICAL.

2. For each policy, write the exact query user A runs to read or edit user B's

rows, and tell me whether it works.

3. Flag policies that filter on values the client sends instead of auth.uid().

4. Check INSERT and UPDATE policies, not just SELECT: can I insert rows pointed

at another user, or update columns I shouldn't own, like role or credits?

5. Apply the same checks to storage buckets.

Output: table | policy state | the attack query | what leaks | severity |

corrected policy as real SQL.

Don't accept "the policy looks correct" as an answer. Make it write the

attacker's query and run it. A policy that reads right and filters wrong is

the most common way a users table ends up on the internet.
```

## Checklist de validação

- [x] Toda tabela em `supabase/migrations/` tem RLS habilitado — nenhuma
      tabela nova entra sem `ENABLE ROW LEVEL SECURITY` no mesmo commit
      (ver `supabase/AGENTS.md` para a convenção do projeto).
      **22 de 22.** Nenhuma delas devolve linha para a anon key.
- [x] Policies de leitura filtram por `auth.uid()` (ou join até lá), nunca
      por um campo que o client controla (ex.: um `user_id` mandado no
      corpo da requisição em vez de derivado da sessão).
- [x] Policies de INSERT/UPDATE testadas explicitamente — não só SELECT.
      Em particular: colunas de saldo/moedas (`lib/db/coins.ts`) e de conta
      (`lib/db/account.ts`) só mudam via `service_role` ou via policy que
      não permite o usuário se autoatribuir crédito. A migração
      `0037_charge_coins_service_role.sql` moveu a cobrança de moedas para
      service role — confirmar que TODA escrita de saldo segue esse
      padrão, sem uma rota alternativa que ainda escreve como usuário
      autenticado.
      **Confirmado:** `coin_balance` e `role` estão fora do GRANT de coluna
      (42501), o ledger é imutável pelo cliente (DELETE/UPDATE casam zero
      linhas, INSERT recusado) e as quatro RPC de dinheiro só têm EXECUTE para
      `service_role`.
- [x] Tabelas de sessão de gravação, cards do feed e resultados de
      pipeline (`bible`, `insights`, `sermon-echo`, `deepening`,
      `final-summary`) — usuário A não consegue ler ou modificar sessão de
      usuário B trocando o `session_id`/`id` na query.
      **Achou DOIS furos aqui** (0038 e 0040), corrigidos e reverificados.
- [x] Storage buckets (áudio dos chunks, se armazenado) seguem a mesma
      regra: policy de bucket usa `auth.uid()`, não caminho previsível
      controlado pelo client.
      **N/A:** `GET /storage/v1/bucket` com service-role devolve `[]` nos dois
      projetos — não existe bucket nenhum. O áudio dos chunks nunca sobe: ele
      vive no IndexedDB do navegador (`lib/chunk-store.ts`) até virar texto.
- [x] Toda correção proposta vem como SQL de migração real (arquivo novo em
      `supabase/migrations/`), não como sugestão em prosa.

## Áreas do repositório a inspecionar

- `supabase/migrations/**` (histórico completo — a policy atual é a soma de
  todas as migrações, não só a mais recente)
- `lib/db/account.ts`, `lib/db/coins.ts`
- `supabase/AGENTS.md`

## Critério de aceite

Para cada tabela e bucket, a "attack query" documentada no prompt retorna
vazio ou erro de permissão depois da correção — não just "a policy parece
certa agora".

---

## Rodada 2026-09-05

Toda linha abaixo é uma resposta HTTP real do PostgREST do projeto de **dev**,
com as duas contas de teste da tarefa 02 (A e B) e com a anon key crua.

### 1. RLS por tabela — 22 de 22

`ENABLE ROW LEVEL SECURITY` presente em todas. `select=*&limit=5` com a anon
key devolveu **zero linha em todas as 22** (`feature_switches`,
`feature_overrides` e `admin_insights` nem chegam a responder: 401/403). Como
usuário B, só `profiles` devolveu linha — a dele. A leitura dirigida
(`?user_id=eq.<id de A>`) voltou vazia nas nove tabelas com coluna de dono.

### 2. Achados

| Tabela / objeto | Estado | Query do atacante | O que vaza | Sev. | Correção |
|---|---|---|---|---|---|
| `_explode_session_feed_items(uuid, jsonb)` | `security definer` **sem revoke** — EXECUTE é de PUBLIC por padrão no Postgres | `POST /rest/v1/rpc/_explode_session_feed_items` com `apikey: <anon>` e **nenhuma sessão**, `{"p_session_id":"<sessão da vítima>","p_items":[{"kind":"speakerHighlight","text":"PWNED"}]}` → **HTTP 204** | O feed da vítima é APAGADO e substituído pelo texto do atacante. A função faz `delete`+`insert` sobre um id que vem do chamador, como definer (sem RLS), e nunca confere dono | **CRITICAL** | ✅ migração **0038**: revoke em `_explode_session_feed_items`, `sync_session_feed_items` e `handle_new_auth_user` |
| `session_deepenings` (+ as outras 5 filhas) | `with check (user_id = auth.uid())` — diz de quem é a LINHA, não para onde ela APONTA | B insere `{user_id: B, session_id: <sessão de A>}` → 201. A pede o estudo: `hasDeepening` roda sob a RLS de A, não vê a linha de B, devolve `[]` → a rota **debita as moedas de A**, roda ~4 min de modelo de raciocínio, e `createDeepening` morre em **23505** na `unique (session_id)` | Negação de serviço com prejuízo dos dois lados: a vítima perde as moedas, nós pagamos a OpenAI, o estudo não existe — e a linha que bloqueia é invisível para ela | **HIGH** | ✅ migração **0040**: `session_id in (select id from sessions where user_id = auth.uid())` no `with check` de INSERT **e** UPDATE das seis tabelas |
| `llm_usage_events` | `for insert with check (user_id = auth.uid())` | B: `POST /rest/v1/llm_usage_events {"user_id":"<o meu>","route":"transcribe","model":"gpt-5.1","prompt_tokens":99999999,"total_cost_usd":12345.67}` → **HTTP 201** | Contabilidade, não dado de usuário: a linha forjada entra em `/admin/usage` e `/admin/precificacao` — os números que definem o preço da moeda e que conciliamos com a fatura da OpenAI — indistinguível de uma medição legítima | **MEDIUM** | ✅ migração **0039** derruba a policy + `lib/db/usage.ts` passa a escrever com service-role recebendo `userId` de quem chama (14 pontos de chamada) |

### 3. O que foi atacado e resistiu

Todas recusadas, com o código de erro entre parênteses:

| Query do atacante | Resultado |
|---|---|
| `insert into sessions (user_id: <A>, …)` como B | 42501, violação de RLS |
| `update profiles set role='admin'` (na própria linha e na de A) | 42501 — GRANT por coluna |
| `update profiles set coin_balance=999999` na própria linha | 42501 |
| `update profiles set is_active=true` (fugir do banimento) | 42501 |
| `insert into coin_transactions (amount: 5000)` para si | 42501 |
| `delete`/`update` na própria linha do ledger (semeada de verdade) | zero linhas — o ledger não tem policy de escrita; a linha sobreviveu intacta |
| `insert into partners`, `partner_commissions`, `stripe_events`, `admin_insights`, `feature_switches`, `feature_overrides` | 42501 |
| `insert into subscriptions (plan:'estudioso', status:'active')` para si | 42501 |
| `rpc/charge_coins` (as duas assinaturas) como `authenticated` | 404/PGRST202 — a de 3 args foi derrubada, a de 4 só tem EXECUTE para `service_role` |
| Ler a sessão de A depois de sujar as tabelas filhas dela | `[]` — em nenhum momento houve leitura de dado da vítima |

Nenhuma policy filtra por valor que o cliente manda: todas são `auth.uid()`
direto ou um `in (select … where user_id = auth.uid())`. `profiles_update_own`
(0007) ainda fixa `role` no próprio `with check`.

### 4. Reverificação

- **0038:** o mesmo `curl` do ataque agora devolve **42501 "permission denied
  for function"** como anônimo e como autenticado, e o feed da vítima segue
  intacto. Sem regressão: um `update sessions set feed_items = …` feito pelo
  DONO continua disparando o gatilho e populando `session_feed_items`.
- **0039:** o INSERT forjado devolve **42501**; o `select` do próprio consumo
  segue 200; e uma chamada real a `/api/format-paragraphs` gravou a linha certa
  (`format-paragraphs`, `gpt-4o-mini`, `0.000054`).
- **0040:** as seis inserções apontando para a sessão alheia devolvem **403**;
  as seis na própria sessão devolvem **201**.

### 5. O que falta (produção)

- **0038** e **0040** já foram aplicadas em produção nesta rodada.
- **0039** ficou de fora de propósito: aplicada antes do deploy do
  `lib/db/usage.ts` novo, a produção para de gravar telemetria em silêncio (o
  insert é fire-and-forget — o log registra, o usuário não vê nada) e o custo
  do período fica sem registro.

  Como a 0040 entrou primeiro, a 0039 agora é **fora de ordem** para o CLI. O
  comando, depois que o deploy sair:

  ```
  npm run db:push:prod -- --yes --include-all
  ```

  Sem o `--include-all` o push falha com `LegacyDbPushMissingRemoteError`, que
  é o CLI protegendo justamente contra o que fizemos de propósito aqui.
