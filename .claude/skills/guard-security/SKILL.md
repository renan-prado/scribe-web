---
name: guard-security
description: "Roda cada tarefa de security/tasks/ contra este repositório, aplica as correções e atualiza security/CHECKLIST.md e o Status de cada tarefa até tudo virar check — ou ficar explicitamente bloqueado numa ação que só o usuário pode tomar."
argument-hint: "[números das tarefas, ex: 03 06 — opcional, roda todas as pendentes se omitido]"
---

<objective>
Fechar a auditoria de segurança do projeto (`security/`) tarefa por tarefa:
auditar de verdade (não "parece seguro"), corrigir o que for corrigível no
código/config/migração, reverificar, e só então marcar ✅. O que não pode ser
resolvido só editando o repositório (rotacionar uma chave, ligar um toggle no
painel do Supabase, mexer em Cloudflare/WAF, mudar visibilidade do
repositório no GitHub) fica marcado como bloqueado com o passo exato que
falta — nunca como ✅ por suposição.

Este skill assume que `security/README.md`, `security/CHECKLIST.md` e
`security/tasks/01..09-*.md` já existem (criados anteriormente). Se não
existirem, pare e avise — não recrie os templates a partir do zero aqui.
</objective>

<context>
Convenções do repositório que toda correção precisa respeitar (detalhes
completos em `AGENTS.md` na raiz e nos `AGENTS.md` de cada pasta — abra o da
área antes de editar):

- `lib/entitlements/` decide o que cada plano libera — nunca introduzir
  `plan === "..."` solto.
- Todo módulo com segredo/service-role/`serverEnv` começa com
  `import "server-only"`.
- Logs usam `createLogger` de `@/lib/log` — `console.*` é proibido em
  `app/`, `lib/`, `src/`.
- Mudança de schema/policy vira arquivo novo em `supabase/migrations/`,
  seguido de `npm run db:push` — permissão permanente já concedida pelo
  usuário para dev, não precisa confirmar. `npm run db:push:prod -- --yes`
  é a única exceção: SEMPRE confirmar com o usuário antes.
- `npm run typecheck` depois de qualquer edição de código, antes de
  considerar a correção pronta.
- Cliente nunca importa de `app/api/*/route.ts`; tipo compartilhado vai em
  `lib/domain/`.
- Nada de cor literal em `className` — token de `app/globals.css`.
</context>

<process>
1. Leia `security/README.md` e `security/CHECKLIST.md` para saber o status
   atual das 9 tarefas.

2. Defina o escopo: se `$ARGUMENTS` citar números de tarefa, processe só
   essas (na ordem dada); senão, processe todas as que não estiverem
   `✅ Concluído`, em ordem (01 → 09).

3. Processe uma tarefa por vez, sequencialmente — nunca em paralelo. Tarefas
   diferentes frequentemente tocam os mesmos arquivos (ex.: 02, 04 e 06
   mexem em rotas de auth; 03 e 05 mexem em `lib/db/coins.ts`), e correções
   paralelas conflitam. Para uma tarefa grande (03, 04 ou 05 costumam
   tocar mais arquivo), pode delegar a auditoria+correção daquela tarefa
   a um subagent `fork` para não encher seu próprio contexto com
   grep/read — mas espere ele terminar antes de começar a próxima tarefa.

   Para cada tarefa pendente:

   a. Leia o arquivo inteiro em `security/tasks/NN-*.md`.

   b. Rode a auditoria descrita em "Prompt para a IA" de verdade contra
      este código — leia/grep exatamente os arquivos listados em "Áreas do
      repositório a inspecionar", mais qualquer coisa que a checklist da
      própria tarefa aponte. Quando a checklist pedir verificação em
      tempo de execução (bater numa rota, checar header de resposta,
      testar uma policy de RLS com uma query real, tentar login em
      sequência), FAÇA isso — suba o dev server se precisar, use Bash/curl
      ou o client do Supabase, e mostre o resultado real. "Parece
      correto" não é resposta aceitável; reproduza a query de ataque, o
      payload, ou o passo a passo que o prompt da tarefa pede, e mostre o
      que aconteceu.

   c. Monte a tabela de saída que o prompt da tarefa pede (arquivo/linha,
      o que vazou ou falhou, severidade, correção exata).

   d. Corrija tudo que for corrigível nesta sessão, seguindo as convenções
      do `<context>` acima. Migração nova → `npm run db:push` (dev, sem
      pedir confirmação). Depois de editar código, rode
      `npm run typecheck`.

   e. Reverifique — repita o passo (b) especificamente para o que foi
      corrigido — antes de considerar fechado. Uma correção sem
      reverificação não vira check.

   f. Qualquer achado que dependa de ação fora do repositório (rotacionar
      uma chave, ligar proteção de senha vazada/CAPTCHA no painel do
      Supabase Auth, regra de WAF/Cloudflare, visibilidade do repositório
      no GitHub, configuração de deployment protection na Vercel) fica
      **bloqueado**: liste o passo exato que o usuário precisa tomar. Não
      marque ✅ — pergunte ao usuário (ou espere ele confirmar) que a ação
      foi feita antes de fechar.

   g. Atualize o `**Status:**` no topo do arquivo da tarefa: `✅ Concluído`
      ou `⚠️ Bloqueado — aguardando <o quê>` com uma linha dizendo o
      motivo.

   h. Acrescente uma linha na tabela "Registro de execução" de
      `security/CHECKLIST.md` (data de hoje, tarefa, resultado, achados
      abertos). Se algo continuar aberto, registre/atualize a linha
      correspondente em "Achados abertos".

4. Atualize a coluna de status na tabela de tarefas de `security/README.md`
   para refletir o estado final de cada uma.

5. Ao terminar todas as tarefas do escopo, produza um resumo final: a
   tabela das 9 tarefas com status atual, e — separado claramente — a
   lista exata do que falta o usuário fazer para cada item `⚠️` (qual
   chave rotacionar, qual toggle no painel, etc.), já que isso não fecha
   só editando código.

6. Nunca marque uma tarefa ✅ por "deve estar bom" — todo item da própria
   "Checklist de validação" do arquivo da tarefa precisa estar verificado
   de verdade antes do Status virar ✅.
</process>

<guardrails>
- Sequencial, uma tarefa de cada vez — ver passo 3.
- Nunca rotacionar, revogar ou gerar uma chave sozinho; nunca rodar
  `db:push:prod` sem confirmação explícita; nunca force-push; nunca
  descartar trabalho não commitado sem checar primeiro. Ver "Executando
  ações com cuidado" no prompt de sistema — vale integralmente aqui.
- Não commite as correções a menos que o usuário peça — este skill corrige
  e verifica; commit é um passo separado e explícito.
- Se uma correção depende de uma decisão de produto (ex.: "deepening
  realmente não deveria permitir reprocessar mais de uma vez?"), pare e
  pergunte com AskUserQuestion em vez de assumir.
- Se `security/tasks/` tiver menos ou mais arquivos do que 9, ou a
  numeração não bater, avise o usuário em vez de inventar uma tarefa que
  não existe.
</guardrails>
