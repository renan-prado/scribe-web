# Registro de execução

Uma linha por rodada. Não apague rodadas antigas — o histórico mostra se um
achado voltou depois de "corrigido".

| Data | Tarefa | Rodado por | Resultado | Achados abertos |
|---|---|---|---|---|
| 2026-09-05 | 01 — Secrets | — | ✅ Sem achado crítico pendente | — |
| 2026-09-05 | 02 — Autenticação | Claude Code | ✅ 2 achados LOW de código fechados; o MEDIUM foi refutado pela tarefa 06 | — |
| 2026-09-05 | 03 — RLS | Claude Code | ⚠️ 1 CRITICAL, 1 HIGH e 1 MEDIUM achados, corrigidos e reverificados em dev (0038/0039/0040). 0038 e 0040 aplicadas em produção | 0039 aguarda o deploy do código |
| 2026-09-05 | 04 — Input | Claude Code | ✅ 3 achados LOW/INFORMATIONAL, corrigidos e reverificados | — |
| 2026-09-05 | 05 — Bomba de custo | Claude Code | ✅ 1 HIGH e 2 MEDIUM corrigidos e reverificados (exposição do transcribe cai ~240×) | Decisão de produto: apagar ou ligar `/api/format-paragraphs` |
| 2026-09-05 | 06 — Rate limit / brute force | Claude Code | ✅ Sem achado de código; refutou o MEDIUM da 02 (fluxos de e-mail desligados nos dois ambientes) | Flag `email:true` do settings de prod, cosmético (INFORMATIONAL) |
| 2026-09-05 | 07 — Security headers | Claude Code | ✅ HSTS + X-Powered-By corrigidos; CSP já existia e foi conferida (não quebra gravação nem checkout) | preload do HSTS e Cloudflare são opt-in de infra |
| 2026-09-05 | 08 — Superfície de ataque | Claude Code | ⚠️ Repositório GitHub PÚBLICO (HIGH); resto auditado e OK | Visibilidade do repo — só o usuário muda |
| 2026-09-05 | 09 — Vazão de dados | Claude Code | ✅ Nenhuma correção necessária; 1 achado categoria B (Informational) aceito | — |

## Achados abertos (fora deste diretório)

Nada registrado ainda. Quando uma tarefa encontrar algo que não foi corrigido
na hora, adicione uma linha aqui com: tarefa de origem, severidade, arquivo
afetado, e por que ficou pendente (ex.: depende de decisão do usuário, depende
de mudança em outro sistema).

| Tarefa | Severidade | Onde | Por que está pendente |
|---|---|---|---|
| 02/06 | INFORMATIONAL | Supabase Auth de **produção** | `/auth/v1/settings` reporta `email:true`, mas os endpoints de e-mail recusam com `email_provider_disabled`. Cosmético — vale alinhar o flag no painel; não é vulnerabilidade |
| 03 | MEDIUM | Supabase de **produção** — migração `0039` | Depende do DEPLOY do `lib/db/usage.ts` novo. Aplicar antes derruba a telemetria de custo em silêncio. Depois do deploy: `npm run db:push:prod -- --yes --include-all` (fora de ordem, porque a 0040 entrou antes) |
| 08 | HIGH | GitHub `renan-prado/scribe-web` | Repositório PÚBLICO. Settings → General → Danger Zone → Change visibility → Private. Sem segredo vivo no histórico (tarefa 01), mas expõe schema, RLS e a lógica de billing de um SaaS pago |
| 05 | — | `app/api/format-paragraphs/route.ts` | Rota sem NENHUM chamador no cliente, mas viva e cara. Limite apertado para 20/hora como contenção; apagar ou ligar é decisão do usuário |
| — | — | Deploy pendente | `develop` tem o commit `c4289b2` (charge_coins service-role) que produção PRECISA para voltar a cobrar moedas — a migração 0037 já está aplicada lá |
