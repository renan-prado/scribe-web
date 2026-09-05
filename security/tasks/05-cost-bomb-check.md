# 05 — Checagem de bomba de custo

**Status:** ✅ Concluído — 1 HIGH e 2 MEDIUM corrigidos e reverificados. Uma pergunta de produto em aberto (rota `/api/format-paragraphs` sem chamador). Ver "Rodada 2026-09-05".

## Objetivo

Encontrar todo endpoint que custa dinheiro/recurso por chamada e confirmar
que ele não pode ser abusado.

## Prompt para a IA

```
Find every endpoint in this app that costs me money or resources when called,

and check its protection:

1. Routes that trigger AI or LLM API calls: what stops a script from calling

each one 100,000 times tonight? Check auth, per-user limits, per-IP limits.

2. Login, signup, and password reset: rate limits, bot protection, and whether

response differences let someone enumerate valid emails

3. Email or SMS sending routes someone can spam through

4. Expensive queries or exports with no caps or pagination

5. Usage metering: is it enforced server-side, and does it fail closed?

Output: endpoint | what one call costs me | the abuse scenario | projected

damage from one night | severity | the exact limiter to add.
```

## Checklist de validação

- [x] Toda rota que chama a OpenAI — `app/api/transcribe`, `app/api/bible`,
      `app/api/insights`, `app/api/sermon-echo`, `app/api/deepening` (+
      `reprocess`), `app/api/final-summary` (+ `reprocess`),
      `app/api/hallucination-report`, `app/api/format-paragraphs` — exige
      sessão válida antes de processar.
- [x] Cobrança de moedas (`lib/coins/pricing.ts`, `app/api/coins/charge`,
      `lib/db/coins.ts`) acontece **antes** de disparar a chamada cara à
      OpenAI, ou existe reconciliação que impede terminar com saldo
      negativo indefinidamente — conferir se falha fechado (nega a
      chamada) quando o saldo é insuficiente, em vez de deixar passar e
      cobrar depois.
- [x] `deepening` roda no máximo uma vez por sessão (conforme
      `AGENTS.md`) — confirmar que essa regra é aplicada no servidor
      (constraint de banco ou checagem na rota), não só na UI.
- [x] Existe algum limite por usuário/IP nas rotas de IA independente de
      moedas — ou seja, mesmo com saldo, um script não consegue disparar
      volume anormal de chamadas em curto intervalo.
- [x] `app/api/billing/sweep` (cron, só roda em produção) não é acionável
      diretamente por um usuário sem autenticação de cron/admin.
- [x] `app/api/billing/checkout`, `app/api/billing/portal`,
      `app/api/billing/reconcile` não podem ser chamados em loop para gerar
      sessões de Stripe sem limite.
- [~] Login, cadastro e reset de senha (ver tarefa 06 para o detalhe de
      rate limit) não permitem enumerar e-mails por diferença de resposta
      ou tempo.
- [x] Nenhuma rota de exportação/listagem (ex.: `app/api/sessions`,
      `app/api/admin/users`) devolve resultado sem paginação/limite de
      tamanho.

## Áreas do repositório a inspecionar

- `lib/coins/pricing.ts`, `lib/db/coins.ts`, `app/api/coins/**`
- Todas as rotas de pipeline de IA listadas acima
- `app/api/billing/**`
- `lib/domain/session.ts` (os três modos de captura e seus preços)

## Critério de aceite

Para cada rota cara, existe um mecanismo concreto (autenticação + saldo
verificado no servidor + algum limite de taxa) que impede um script de
gerar dano financeiro em uma única noite sem intervenção manual.

---

## Rodada 2026-09-05

### 1. O que uma chamada custa, e o que segurava cada rota

Modelos e preços de `lib/env/server.ts` + `lib/llm/pricing.ts`. Teto por
usuário calculado sobre `RATE_LIMITS` — e valendo lembrar que o balde é **em
memória, por instância**: em serverless o limite efetivo é
`limite × instâncias ativas`, então todo número abaixo é um PISO do dano.

| Rota | Modelo | Custo de UMA chamada | Teto/hora (antes) | Uma noite (8h, uma conta) |
|---|---|---|---|---|
| `transcribe` | `gpt-4o-mini-transcribe`, $0,003/min de ÁUDIO | até **$0,42** (25 MB de opus ≈ 2h de som) | 40/min = 2.400 | **~$8.000** |
| `format-paragraphs` | `gpt-4o-mini` | ~$0,056 (300k chars entram e saem) | 30/min = 1.800 | **~$800** |
| `final-summary` | `gpt-4o` | ~$0,31 (75k tokens in + 12k out) | 20/hora | ~$50 |
| `bible` / `insights` | `gpt-4.1-mini`, entrada de 12k chars | ~$0,002 | 60 e 30/min | ~$3 |
| `sermon-echo` | `gpt-4o-mini` | ~$0,0006 | 30/min | ~$1 |
| `hallucination-report` | `gpt-4o` | ~$0,015 | 10/hora | ~$1 |
| `deepening` (+reprocess) | pipeline de 5 etapas | a mais cara do produto | 30 e 10/hora | **$0 de exposição** — `chargeCoins` roda ANTES e devolve 402 |
| `verse` | nenhum (lê a NVI do disco) | $0 | 60/min | $0 |

### 2. Achados

| Endpoint | Cenário de abuso | Sev. | Limitador adicionado |
|---|---|---|---|
| `POST /api/transcribe` | O limitador conta REQUISIÇÕES; a OpenAI cobra MINUTOS de áudio. Duas requisições idênticas para o balde podiam valer 20 segundos e duas horas de som. `MAX_FILE_BYTES` era 25 MB — o limite da OpenAI copiado para cá, 300× o tamanho de um chunk real de 15-20s. Uma conta com **uma moeda** de saldo bombeava áudio a noite inteira | **HIGH** | ✅ `MAX_FILE_BYTES` para **8 MB** (cobre 5 min a 200 kbps, que é o teto que `MAX_DURATION_MS` já declarava esperar) + **orçamento de bytes por usuário**: `enforceAudioBudget`, 240 MiB/hora, com `checkRateLimit` ganhando um parâmetro `cost` para contar grandeza em vez de eventos. Uma hora de gravação real são ~16 MB — o teto é 15× isso |
| `POST /api/format-paragraphs` | Cadência de rota de pipeline ao vivo (30/min) numa rota que reformata uma transcrição INTEIRA por chamada, aceitando 300 mil caracteres. **E nenhum código de cliente a chama** — a busca por `formatParagraphs`, `/api/format` e `format.?paragraph` em `src/` e `app/` não encontra chamador nenhum | **MEDIUM** | ✅ 20/**hora** (mesmo balde de `sessions-transcript`, que é a cadência de uma ação de fim de sessão). 90× menos. A pergunta de produto — apagar a rota ou ligá-la — fica para o usuário; enquanto ela existir, o limite é o de uma ação por sessão |
| `listUsers()` (`/api/admin/users`) | `select` sem `limit` — quem cortava era o `max-rows` que o Supabase configura por padrão no PostgREST. Default de plataforma no lugar de decisão nossa, e discordando do `perPage: 1000` do enriquecimento logo abaixo: passando de mil contas, a lista traria perfis com "último acesso" sempre vazio e nada na tela explicando | **MEDIUM** | ✅ `ADMIN_USERS_PAGE_SIZE = 1000` explícito, usado nos dois lados |

**Depois da correção, `transcribe` cai de ~$1.000/hora para ~$4/hora por
conta** — 240 MiB de opus são ~23 horas de áudio, e a mesma noite de 8 horas
sai por volta de $34 em vez de $8.000.

### 3. Reverificação

```
arquivo de 9 MB                            → 413 file too large
35 uploads de 7 MB (245 MB, sob o teto)    → passam
o 36º (252 MB, acima)                      → 429, x-ratelimit-limit: 251658240
                                             (é o balde de BYTES, não o de chamadas)
usuário B, chunk de 80 KB (tamanho real)   → passa por todos os gates
format-paragraphs, 21ª chamada na hora     → 429
billing/checkout, 13ª chamada em 10 min    → 429
billing/sweep, 11º chute no CRON_SECRET    → 429  (e os dez primeiros, 401)
```

### 4. Falha fechado, conferido de verdade

Com `coin_balance = 0` na conta de teste:

```
POST /api/bible             → 402 insufficient_balance
POST /api/insights          → 402
POST /api/sermon-echo       → 402
POST /api/format-paragraphs → 402
POST /api/coins/charge      → 402
```

E com saldo 50 a mesma chamada devolve 200 com o versículo detectado. O
`deepening` cobra ANTES do pipeline (`chargeCoins` → 402 se não dá), então a
rota mais cara do produto é a única com exposição zero. `deepening` uma vez por
sessão é garantido por `unique (session_id)` no banco — e a checagem prévia só
passou a ser confiável com a migração 0040 desta rodada.

### 5. O que sobra, medido e aceito

- **A medição continua sendo do cliente.** `requireBalance` recusa quem está
  zerado; ele não impede gravar 50 minutos pagando 10. Fechar isso exigiria
  contar segundos de áudio no servidor por sessão — mudança de produto, não de
  segurança. Está escrito no cabeçalho de `lib/coins/require-balance.ts`.
- **O balde é por instância.** Todo teto acima vale `× instâncias ativas`. Se
  um dia isso precisar ser estrito, o caminho é Upstash — já anotado em
  `lib/AGENTS.md`.
- **`final-summary` a ~$50/noite por conta** é o maior resíduo. Não mexi: 20
  por hora já é generoso para uma ação de fim de sessão, e a entrada de 300 mil
  caracteres existe para o sermão de 12 horas que o schema declara aceitar.

### 6. Pergunta em aberto para o usuário

`/api/format-paragraphs` não tem chamador. Ela existe, autentica, cobra piso de
saldo e gasta na OpenAI. Apagar a rota (e o prompt, e a entrada em
`UsageRoute`) ou ligá-la de volta em algum lugar é decisão de produto — o
limite apertado é uma contenção, não a resposta.
