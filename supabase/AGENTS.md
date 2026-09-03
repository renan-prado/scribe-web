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
`lib/db/feed-entries.ts` emitir três selects e cruzar em memória sem filtrar
dono na mão.

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

`grant_coins` e `clawback_coins` são `SECURITY DEFINER` com EXECUTE revogado
de `anon` e `authenticated` — só `service_role` chama. Verificado: com o anon
key a RPC devolve 42501.

Função nova que escreve saldo, comissão ou qualquer coisa que vire dinheiro
segue o mesmo padrão:

```sql
revoke all on function public.minha_funcao(...) from public;
revoke all on function public.minha_funcao(...) from anon, authenticated;
grant execute on function public.minha_funcao(...) to service_role;
```

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
