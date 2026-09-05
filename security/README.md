# Auditoria de segurança — índice

Este diretório guarda **templates de tarefas de segurança** para rodar com a
IA (Claude Code ou equivalente) contra este repositório. Cada arquivo em
`tasks/` é um prompt pronto — cole o conteúdo da seção "Prompt para a IA" numa
sessão nova (contexto limpo ajuda: menos viés do que já foi discutido) e
valide a resposta contra a checklist do próprio arquivo antes de aceitar
qualquer achado como resolvido.

Não é malha de CI. É um roteiro para rodar manualmente, com um humano lendo
o resultado — a IA que audita não é a mesma que corrige, e quem aceita a
correção não é a IA.

## Como usar

1. Abra o arquivo da tarefa em `tasks/`.
2. Rode o prompt numa sessão com acesso de leitura ao repositório (e, quando
   fizer sentido, ao painel do Supabase/Stripe/Vercel — a maioria dos
   achados reais está em RLS e variáveis de ambiente, não só no código).
3. Confira a saída contra "Checklist de validação" — não aceite "parece
   seguro" como resposta; exija a query, o payload ou o passo a passo do
   ataque, como os prompts pedem.
4. Corrija. Depois rode o MESMO prompt de novo — um achado só fecha quando a
   segunda rodada não o reproduz.
5. Atualize o `Status` no topo do arquivo da tarefa e a linha correspondente
   em `CHECKLIST.md`.

## Severidade

| Nível | Critério |
|---|---|
| CRITICAL | Dado de outro usuário, credencial ou dinheiro comprometido sem interação da vítima |
| HIGH | Requer alguma condição (conta específica, timing) mas ainda assim explorável remotamente |
| MEDIUM | Vazamento de informação ou fricção reduzida para um ataque, não o ataque em si |
| LOW / INFORMATIONAL | Boa prática ausente, sem exploração direta demonstrada |

"Esconder a rota", "renomear o endpoint" ou "tirar do robots.txt" nunca é
correção — isso vale para toda tarefa deste diretório, não só para a de
exposição de dados.

## Especificidades deste repositório

Vale ler antes de rodar qualquer tarefa (contexto completo em `AGENTS.md` na
raiz):

- **Dois ambientes isolados** (dev/prod) com Supabase, Stripe e domínio
  próprios — `scripts/with-env.mjs` injeta as variáveis; nunca existe
  `.env.local`. Achados de secrets devem checar os dois `.env.dev` /
  `.env.prod` (fora do git, mas presentes na máquina de quem audita).
- **RLS é a linha de defesa principal** para dados de usuário — não há uma
  camada de autorização própria além disso e de `lib/entitlements/`.
  `supabase/migrations/` tem o histórico completo, incluindo migrações que
  já moveram operações sensíveis para `service_role` (ex.:
  `0037_charge_coins_service_role.sql`) — checar se esse padrão está sendo
  seguido em todo lugar que mexe em moedas/crédito.
- **Custo real por chamada de IA**: cada chunk de áudio em `/api/transcribe`
  e cada pipeline de enriquecimento (`bible`, `insights`, `sermon-echo`,
  `deepening`, `final-summary`) chama a OpenAI. `lib/coins/pricing.ts`
  define o preço por minuto; a tarefa 05 existe por causa disso.
- **Cron de billing só roda em produção** (`/api/billing/sweep` — Vercel
  Cron não existe em dev), então testes de rate limit/abuso nesse endpoint
  precisam considerar que ele não é acionável fora de prod.
- **Sem CSP nem HSTS configurados hoje** — `next.config.ts` define
  `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` e
  `Permissions-Policy`, mas não Strict-Transport-Security nem
  Content-Security-Policy. A tarefa 07 nasce sabendo disso — não é uma
  descoberta, é o ponto de partida.
- **Áreas administrativas**: `app/admin` (UI) e `app/api/admin/*` (features,
  insights, partners, users) — confira autenticação E autorização (admin de
  verdade, não só "logado") nas duas camadas.

## Tarefas

| # | Tarefa | Foco | Status |
|---|---|---|---|
| 01 | [Varredura de secrets](tasks/01-secrets-scan.md) | chaves, tokens, .env, histórico do git | ✅ Concluído |
| 02 | [Teste de autenticação](tasks/02-auth-test.md) | sessão, senha, reset, verificação de e-mail | ✅ Concluído |
| 03 | [Interrogatório do banco de dados](tasks/03-database-rls-audit.md) | RLS tabela a tabela, storage buckets | ⚠️ Bloqueado — 0039 aguarda deploy |
| 04 | [Auditoria de input](tasks/04-input-validation-audit.md) | injeção, upload, HTML não escapado | ✅ Concluído |
| 05 | [Bomba de custo](tasks/05-cost-bomb-check.md) | chamadas de IA, limites por usuário/IP | ✅ Concluído |
| 06 | [Rate limit e força bruta](tasks/06-rate-limit-bruteforce.md) | login, CAPTCHA, enumeração de contas | ✅ Concluído |
| 07 | [Security headers](tasks/07-security-headers.md) | HSTS, CSP, cookies, X-Frame-Options | ✅ Concluído |
| 08 | [Superfície de ataque](tasks/08-attack-surface-exposure.md) | repositório, infraestrutura, WAF | ⚠️ Bloqueado — repo público |
| 09 | [Vazão de dados](tasks/09-data-exposure-discovery.md) | robots.txt, sitemap, rotas administrativas | ✅ Concluído |

Ver `CHECKLIST.md` para o registro de execução (data da última rodada,
quem rodou, achados abertos).
