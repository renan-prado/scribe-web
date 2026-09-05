# supabase/ — migrações, RLS e GRANT

Uma migração por arquivo, numerada e imutável depois de aplicada. Os números
0012–0016 não existem: não procure, não renumere.

## Como aplicar

```
npm run db:push               → projeto de DEV  (ref lido de .env.dev)
npm run db:push:prod -- --yes → projeto de PROD (ref lido de .env.prod)
```

**Permissão permanente do usuário:** depois de criar um arquivo em
`supabase/migrations/`, rode `npm run db:push` sem pedir confirmação. O
`db:push:prod` é a única exceção — sempre confirme antes.

O `--yes` é obrigatório em produção de propósito: migração em banco com dados
de gente de verdade não deve caber num erro de digitação.

O CLI do Supabase guarda UM projeto vinculado por pasta (`supabase/.temp/`), e
com dois ambientes esse estado invisível vira risco — você roda `db push`
achando que está no dev e estava no prod. Por isso `scripts/db-push.mjs`
deriva o vínculo do arquivo de ambiente e o reajusta a cada execução: quem
manda é o script npm que você digitou, não um `supabase link` que alguém rodou
semana passada.

## Escreva o porquê no arquivo

As migrações deste repositório abrem com um cabeçalho explicando a decisão, não
o DDL. Siga isso — o DDL o `psql` já mostra; o raciocínio some. Compare
`0005_auth_ownership_rls.sql`, `0026_billing_stripe.sql` e
`0029_partners.sql`: cada um começa dizendo qual ataque ou qual bug a migração
fecha.

## RLS: a policy diz QUAIS LINHAS

Toda tabela de domínio tem `user_id` referenciando `auth.users(id)` com
`on delete cascade`, RLS ligada e policies auto-escopadas por `auth.uid()`.
Tabela nova segue o mesmo molde, e o padrão vale também para as tabelas
filhas de sessão (`session_practices`, `session_rereads`, `session_reminders`,
`session_highlights`, `session_deepenings`), que é o que permite ao
`lib/db/feed-entries.ts` emitir os selects e cruzar em memória sem filtrar dono
na mão.

`session_practices` é a exceção viva: o "Coloque em prática" saiu do produto e
nada mais lê nem escreve nessa tabela. Ela e os payloads antigos ficaram de
propósito — o recurso foi retirado da tela para ser repensado, não descartado.
Não crie migração para dropá-la sem pedido.

**Numa tabela filha, `user_id = auth.uid()` não basta — o `session_id` também
precisa ser seu** (migração 0040). A policy antiga garantia que a LINHA era
minha e não dizia nada sobre para onde ela apontava: dava para inserir uma
linha própria carimbada com a sessão de outra pessoa, sabendo só o uuid que
aparece na URL de `/recording/:id/*`. Em cinco das seis tabelas o efeito era
sujeira no feed de quem inseriu. Em `session_deepenings` era negação de
serviço com prejuízo: lá existe `unique (session_id)`, a linha do atacante é
invisível para a vítima sob RLS, e o resultado é a rota conferir "já existe
estudo?" → não, debitar as moedas, rodar quatro minutos de modelo caro e
morrer em 23505 na hora de gravar.

> **Toda coluna que APONTA para outra tabela do usuário entra no `with check`,
> não só a que diz de quem a linha é.** E entra no de UPDATE junto — senão a
> linha nasce certa e é movida depois.

## GRANT: o grant diz QUAIS COLUNAS

**RLS não restringe coluna. GRANT sim, e os dois se somam.** É o mecanismo que
protege dinheiro:

```sql
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, email) on public.profiles to authenticated;
```

`coin_balance`, `stripe_customer_id`, `role`, `is_active` e as três colunas de
atribuição de parceiro ficam fora do alcance do cliente. Antes disso, um
usuário com o anon key podia dar
`update profiles set coin_balance = 999999 where id = auth.uid()`.

Coluna nova em `profiles` que o usuário PODE editar precisa entrar
explicitamente nesse `grant`. Coluna que ele não pode, não.

## RPC: EXECUTE revogado

`grant_coins`, `clawback_coins`, `attach_partner` e — desde a migração 0037 —
`charge_coins` são `SECURITY DEFINER` com EXECUTE revogado de `anon` e
`authenticated`. Só `service_role` chama. Verificado: com o anon key a RPC
devolve 42501.

`charge_coins` entrou nessa lista tarde, e a lição vale mais que a correção. A
versão de 0017 tinha `grant execute ... to authenticated` e recebia `p_amount`
por parâmetro. O cuidado todo estava na ROTA — que deriva o preço de
`COIN_COST_BY_REASON` e nunca aceita um valor do corpo — e a rota nunca foi o
único caminho: o anon key é público, e função concedida a `authenticated` está
publicada em `POST /rest/v1/rpc/`. Dava para debitar 1 moeda por um minuto de 7
e deixar no ledger uma linha com cara de legítima.

> **A regra na rota não vale nada enquanto a função aceitar quem a rota
> protege.** Ao escrever um gate em TypeScript, pergunte quem mais alcança o
> que ele guarda.

Função nova que escreve saldo, comissão ou qualquer coisa que vire dinheiro
segue o mesmo padrão:

```sql
revoke all on function public.minha_funcao(...) from public;
revoke all on function public.minha_funcao(...) from anon, authenticated;
grant execute on function public.minha_funcao(...) to service_role;
```

**E vale para função de GATILHO também** (migração 0038). No Postgres, EXECUTE
numa função nova é concedido a PUBLIC por padrão: *não conceder não é o mesmo
que negar*. `_explode_session_feed_items(uuid, jsonb)` é `security definer`,
nunca foi revogada, e por isso estava publicada em `POST /rest/v1/rpc/`. Ela
faz um `delete` seguido de um `insert` em `session_feed_items` a partir de um
`p_session_id` que VEM DO CHAMADOR, sem RLS porque é definer, e sem conferir
dono — o `select user_id from sessions` lá dentro serve para carimbar a linha
nova, não para autorizar. Resultado, reproduzido: com o anon key e **nenhuma
sessão**, HTTP 204 e o feed da vítima substituído pelo texto do atacante.

> Ao escrever `security definer`, a pergunta não é "quem eu concedi?" e sim
> "quem eu NÃO revoguei?".

## Policy de INSERT é porta aberta, não conferência

`llm_usage_events` tinha `for insert with check (user_id = auth.uid())` e o
cabeçalho de 0006 dizia que bastava, porque "a rota chama depois do
requireAuth()". A policy autoriza a ESCRITA; ela não olha o conteúdo. Com o
anon key, qualquer sessão logada mandava uma linha de custo inventada
(`total_cost_usd: 12345.67`) direto para a tabela que alimenta
`/admin/usage` e `/admin/precificacao` — os números que decidem o preço da
moeda e que conciliamos com a fatura da OpenAI. Migração 0039 derruba a policy;
`lib/db/usage.ts` passou a escrever com service-role, recebendo `userId` de
quem chama.

**Telemetria, contabilidade e qualquer número que a EMPRESA lê são escrita de
service-role.** Policy de INSERT para `authenticated` só onde a linha é
conteúdo do próprio usuário.

## Constraint no lugar de `if`

As regras que não podem falhar são estruturais, não condicionais no servidor —
uma constraint vale para caminhos de código que ainda não existem:

| Constraint | O que ela garante |
|---|---|
| `coin_transactions.external_ref` UNIQUE | crédito idempotente pelos quatro caminhos de fulfill |
| `stripe_events` PK = id do evento | reentrega do Stripe é descartada |
| `partner_commissions.referred_user_id` UNIQUE | uma comissão por pessoa na vida |
| `session_deepenings` unique(session_id) | um aprofundamento por sessão |
| CHECK https em `partner_payouts.receipt_url` | comprovante é link, não recado |

O contexto de negócio de cada uma está em `lib/billing/AGENTS.md` e
`src/features/partners/AGENTS.md`.
