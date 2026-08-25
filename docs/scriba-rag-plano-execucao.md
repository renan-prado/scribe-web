# Scriba RAG — plano de execução

> Documento tático. Assume que você já leu:
> - `docs/scriba-rag-knowledge-architecture.md` (GPT — visão macro)
> - `docs/scriba-rag-proposta-claude.md` (Claude — reconciliação com o código)
> - `docs/scriba-rag-todos-futuros.md` (o que fica pra depois da POC)
>
> Este arquivo NÃO reabre debate. Ele quebra Fases A → B → C em tasks executáveis, com DDL exato, assinaturas de função, critério de "pronto" e plano de rollback por PR.
>
> **Branch de trabalho**: `rag/develop`. Cada PR abre da `rag/develop` contra `rag/develop` (integração incremental); ao fim da Fase C, `rag/develop` → `redesign` ou `master`.
>
> **Editar este doc é parte do trabalho.** Ao completar uma task, marcar `[x]`. Ao descobrir sub-task não prevista, adicionar imediatamente à lista da PR correspondente. Ao mudar escopo, atualizar aqui *antes* de mexer no código.

---

## 0. Precondições (uma vez, antes da PR 1)

Antes de qualquer código do RAG:

- [ ] Confirmar que Supabase local roda migrations (`npx supabase db reset` ou equivalente do projeto). Se a versão do Supabase local não suporta pgvector, atualizar imagem antes de começar.
- [ ] Verificar se a extensão `vector` está disponível no plano Supabase de produção (Free tier suporta desde 2023, mas confirmar via dashboard).
- [ ] Levantar tier atual da OpenAI (`OPENAI_API_KEY`) — precisa de headroom pra ~5k requests de embedding no bootstrap da Bíblia sem estourar RPM.
- [ ] Snapshot da última migration existente em `supabase/migrations/` — usar como base pra numeração das novas (0012+).
- [ ] Criar variáveis em `.env.local` (só locais por enquanto, produção vem depois):
  - `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`
  - `OPENAI_EMBEDDING_DIMENSIONS=512`

---

## PR 1 — Fase A: fundação pgvector + indexação da Bíblia

**Título do PR**: `feat(knowledge): pgvector foundation + bible indexing script`

**Branch**: `rag/pr1-foundation` (feature branch a partir de `rag/develop`).

**Objetivo mensurável**: rodar `npm run index:bible -- --translation NAA` e ver `select count(*) from knowledge_chunks where metadata->>'translation' = 'NAA'` retornar ~5-8k. Repetir com ARA e NVI. Rodar `select * from match_knowledge((select embedding from knowledge_chunks limit 1), 5)` e obter 5 resultados coerentes.

### 1.1 Migrations (ordem importa — cada uma um commit)

- [ ] **0012_pgvector.sql** — habilita extensão.
  ```sql
  create extension if not exists vector with schema extensions;
  ```
  Nota: schema `extensions` é o padrão Supabase. Se o projeto usa outro, alinhar.

- [ ] **0013_knowledge_sources.sql** — tabela de fontes.
  ```sql
  create table public.knowledge_sources (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    author text,
    publisher text,
    source_type text not null check (source_type in (
      'bible','commentary','systematic_theology','article','book',
      'sermon','editorial','session_summary','session_deepening','session_highlight'
    )),
    license text not null check (license in (
      'public_domain','cc_by','cc_by_sa','editorial_original',
      'licensed_agreement','user_content'
    )),
    license_notes text,
    tags text[] not null default '{}',
    content_summary text,
    status text not null default 'draft'
      check (status in ('draft','processing','indexed','failed')),
    error_message text,
    embedding_model text,
    embedding_dimensions integer,
    chunker_version text,
    indexed_at timestamptz,
    owner_user_id uuid references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index knowledge_sources_source_type_idx on public.knowledge_sources (source_type);
  create index knowledge_sources_status_idx on public.knowledge_sources (status);
  create index knowledge_sources_tags_gin on public.knowledge_sources using gin (tags);
  create index knowledge_sources_owner_idx on public.knowledge_sources (owner_user_id);
  ```
  Nota `owner_user_id` já entra nullable — permite Bíblia (global) hoje e sessões pessoais amanhã sem migration extra (TODO #1).

- [ ] **0014_knowledge_chunks.sql** — chunks + embedding vector(512).
  ```sql
  create table public.knowledge_chunks (
    id bigint primary key generated always as identity,
    source_id uuid not null references public.knowledge_sources(id) on delete cascade,
    chunk_index integer not null,
    content text not null,
    section text,
    metadata jsonb not null default '{}'::jsonb,
    embedding extensions.vector(512),
    embedding_model text,
    embedding_dimensions integer,
    tokens_estimated integer,
    created_at timestamptz not null default now(),
    unique (source_id, chunk_index)
  );

  create index knowledge_chunks_source_idx on public.knowledge_chunks (source_id);
  create index knowledge_chunks_metadata_gin on public.knowledge_chunks using gin (metadata jsonb_path_ops);
  ```
  Sem índice vetorial na PR 1 (< 20k chunks, sequential scan é OK). Índice HNSW é TODO #10.

- [ ] **0015_match_knowledge_fn.sql** — função de match.
  ```sql
  create or replace function public.match_knowledge(
    query_embedding extensions.vector(512),
    match_count integer default 10,
    filter_source_types text[] default null,
    filter_metadata jsonb default null
  )
  returns table (
    chunk_id bigint,
    source_id uuid,
    source_title text,
    source_type text,
    section text,
    content text,
    metadata jsonb,
    similarity float
  )
  language sql
  stable
  as $$
    select
      c.id,
      c.source_id,
      s.title,
      s.source_type,
      c.section,
      c.content,
      c.metadata,
      1 - (c.embedding <=> query_embedding) as similarity
    from public.knowledge_chunks c
    join public.knowledge_sources s on s.id = c.source_id
    where c.embedding is not null
      and s.status = 'indexed'
      and (filter_source_types is null or s.source_type = any(filter_source_types))
      and (filter_metadata is null or c.metadata @> filter_metadata)
    order by c.embedding <=> query_embedding
    limit match_count;
  $$;
  ```

- [ ] **0016_knowledge_rls.sql** — políticas RLS.
  ```sql
  alter table public.knowledge_sources enable row level security;
  alter table public.knowledge_chunks enable row level security;

  -- leitura: global (owner null) livre para autenticados; próprio user vê o dele
  create policy "knowledge_sources_read_global_and_own"
    on public.knowledge_sources for select
    using (owner_user_id is null or owner_user_id = auth.uid());

  create policy "knowledge_chunks_read_via_source"
    on public.knowledge_chunks for select
    using (exists (
      select 1 from public.knowledge_sources s
      where s.id = source_id
        and (s.owner_user_id is null or s.owner_user_id = auth.uid())
    ));

  -- escrita: só admin (via app_metadata role='admin')
  create policy "knowledge_sources_admin_write"
    on public.knowledge_sources for all
    using ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin')
    with check ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');

  create policy "knowledge_chunks_admin_write"
    on public.knowledge_chunks for all
    using ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin')
    with check ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');
  ```
  Verificar padrão real de role check já usado em `0007_admin_role.sql` — se diferir, alinhar (não copiar cegamente o `app_metadata` acima).

### 1.2 Env vars

- [ ] Editar `lib/env/server.ts` — adicionar ao schema Zod:
  ```ts
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  OPENAI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(512),
  ```
- [ ] Editar `.env.example` (se existir) espelhando essas duas.

### 1.3 Módulo `lib/ai/embeddings.ts`

- [ ] Criar arquivo com assinatura:
  ```ts
  export type EmbedResult =
    | { ok: true; embedding: number[]; model: string; dimensions: number; tokens: number }
    | { ok: false; error: string };

  export async function embedText(input: string, opts?: { signal?: AbortSignal }): Promise<EmbedResult>;
  export async function embedTexts(inputs: string[], opts?: { signal?: AbortSignal }): Promise<EmbedResult[]>;
  ```
  - Usa `serverEnv.OPENAI_EMBEDDING_MODEL` + `OPENAI_EMBEDDING_DIMENSIONS`.
  - `AbortController` com timeout (mirror do padrão em `lib/llm/openai.ts`).
  - Batch size máximo 100 inputs por request na OpenAI (validado no doc dela). Se `embedTexts` receber >100, fatiar e concatenar.
  - Log padrão `[embeddings] ok { count, tokens, latencyMs }` e `[embeddings] upstream ...` em erro (mirror do padrão dos logs de `callChat`).

### 1.4 Módulos `lib/knowledge/*`

- [ ] `lib/knowledge/types.ts` — tipos compartilhados:
  ```ts
  export type SourceType = 'bible' | 'commentary' | 'systematic_theology' | ...;
  export type License = 'public_domain' | ...;
  export interface KnowledgeChunkRow { ... }
  export interface KnowledgeSourceRow { ... }
  export interface BibleChunkMetadata {
    kind: 'bible';
    translation: string;
    book: string;         // abbrev canônica (ex: 'rm')
    bookDisplay: string;  // 'Romanos'
    chapter: number;
    verseStart: number;
    verseEnd: number;
    testament: 'OT' | 'NT';
  }
  ```

- [ ] `lib/knowledge/chunk.ts` — chunker por tipo:
  ```ts
  export function chunkBibleChapter(
    translation: string,
    book: BibleBook,
    chapter: number,
    verses: string[],
    opts?: { verseWindow?: number; overlap?: number }
  ): Array<{ content: string; metadata: BibleChunkMetadata; section: string }>;
  ```
  Regra POC: janela de 8 versos, overlap de 2. Sem tentar detectar perícope real (TODO #21). `section` = `"cap. X (vv. Y-Z)"`.

- [ ] `lib/knowledge/ingest.ts` — persistência transacional:
  ```ts
  export async function indexKnowledgeSource(input: {
    title: string;
    author?: string;
    sourceType: SourceType;
    license: License;
    tags?: string[];
    chunks: Array<{ content: string; section?: string; metadata?: Record<string, unknown> }>;
    ownerUserId?: string | null;
  }): Promise<{ sourceId: string; chunkCount: number }>;
  ```
  Fluxo:
  1. Insere `knowledge_sources` com `status='processing'`.
  2. Embeda chunks em batches de 50 (config).
  3. Upsert de chunks (`insert ... on conflict (source_id, chunk_index) do update`).
  4. Atualiza source: `status='indexed'`, `indexed_at=now()`, `embedding_model`, `embedding_dimensions`, `chunker_version='v1'`.
  5. Em erro: `status='failed'`, `error_message=...`. Não fazer delete parcial.

- [ ] `lib/knowledge/search.ts`:
  ```ts
  export interface SearchOpts {
    topK?: number;                   // default 10
    sourceTypes?: SourceType[];
    metadataFilter?: Record<string, unknown>;
    signal?: AbortSignal;
  }
  export async function searchKnowledge(
    query: string,
    opts?: SearchOpts
  ): Promise<Array<{ chunkId: number; sourceTitle: string; sourceType: SourceType; section: string | null; content: string; metadata: Record<string, unknown>; similarity: number }>>;
  ```
  Embeda a query, chama RPC `match_knowledge`, retorna resultados normalizados. Log padrão.

### 1.5 Script `scripts/index-bible.ts`

- [ ] Aceita CLI args: `--translation NAA|ARA|NVI` (obrigatório), `--dry-run`, `--only-book gn|ex|...` (para debug).
- [ ] Lê `lib/bibles/{translation}.json` via loader existente.
- [ ] Para cada livro:
  - Cria 1 `knowledge_source` `source_type='bible'`, `license='public_domain'`, `title = '{translation} — {bookName}'`, `tags = ['bible', translation.toLowerCase(), testament]`.
  - Chunk-a por capítulo via `chunkBibleChapter`.
  - Chama `indexKnowledgeSource` (bypass RLS via service_role client — precisará de novo helper em `lib/supabase/service.ts` se ainda não houver).
- [ ] Emit progress (log a cada livro): `[index-bible] Salmos 150/150 chapters → 412 chunks`.
- [ ] Ao final: `[index-bible] done { translation, books, chapters, chunks, tokens, costEstimateUSD }`.
- [ ] Registrar no `package.json`:
  ```json
  "scripts": {
    "index:bible": "tsx scripts/index-bible.ts"
  }
  ```
  (usar `tsx` se já for dev-dep; se for `ts-node`, alinhar).

### 1.6 Custo & rate limit — proteção mínima

- [ ] No `embedTexts`: batch de 50 inputs por call, `p-limit` (ou implementação manual) para concurrency 3.
- [ ] Backoff exponencial em erro 429 (min 2s, dobra até 30s, max 5 retries).
- [ ] Estimar antes de rodar: `--dry-run` calcula tokens totais e imprime custo estimado a $0.02/M (para `text-embedding-3-small`) — abortar se >$5 sem confirmação (var env `INDEX_BIBLE_MAX_COST_USD=5`).

### 1.7 Testes de fumaça (manual — sem test runner ainda)

- [ ] `npm run index:bible -- --translation NAA --dry-run` imprime custo estimado plausível (~$0.05-0.15 para uma Bíblia).
- [ ] `npm run index:bible -- --translation NAA --only-book jo` cria 21 sources (João tem 21 capítulos? confirmar), ~50-80 chunks.
- [ ] Query direto no psql:
  ```sql
  select count(*) from knowledge_sources where source_type='bible';
  select count(*), avg(length(content)) from knowledge_chunks;
  select source_title, similarity, left(content, 120)
    from match_knowledge(
      (select embedding from knowledge_chunks where content ilike '%amor%' limit 1),
      5
    );
  ```
- [ ] `npm run typecheck` limpo.
- [ ] `npm run check` limpo.

### 1.8 Definition of Done (PR 1)

- [ ] Migrations 0012-0016 aplicadas em local, sem erro.
- [ ] `npm run index:bible -- --translation NAA` completo. Repetir com ARA e NVI.
- [ ] `select count(*) from knowledge_chunks group by (metadata->>'translation')` retorna 3 traduções, cada uma entre 5k-8k chunks.
- [ ] Uma query semântica ("soberania e sofrimento") retorna passagens plausíveis (Rm 8, Jó, Sl 46, etc.).
- [ ] Nenhuma rota `/api/*` alterada. Fluxo do usuário final intocado.
- [ ] `AGENTS.md` atualizado com nova seção "Knowledge base" apontando pros módulos criados. Sem prosa longa — 8-15 linhas.

### 1.9 Rollback plan (PR 1)

- Reverter é simples: `drop function match_knowledge; drop table knowledge_chunks; drop table knowledge_sources; drop extension vector;`. Nenhuma rota depende ainda.
- Manter um script `scripts/reset-knowledge.ts` (opcional, útil em dev) que faz `truncate knowledge_chunks, knowledge_sources restart identity cascade`.

### 1.10 Riscos específicos da PR 1

| Risco | Mitigação |
|---|---|
| Supabase local não suporta pgvector | Verificar imagem em §0. Se não suportar, atualizar antes. |
| JSON de Bíblia não segue formato esperado | Ler `lib/bibles/loader.ts` e 1 JSON de exemplo ANTES de escrever `chunkBibleChapter`. |
| OpenAI 429 no bootstrap | Concurrency 3, batch 50, backoff. Se estourar, rodar 1 tradução por vez com pausa. |
| Custo estourar | Guard de `INDEX_BIBLE_MAX_COST_USD`. `--dry-run` mostra estimativa. |
| `service_role` key vazando | `scripts/index-bible.ts` só lê de `SUPABASE_SERVICE_ROLE_KEY` no `serverEnv`. Nunca importar em código client. |

---

## PR 2 — Fase B: admin CRUD + playground

**Título do PR**: `feat(admin): knowledge CRUD and retrieval playground`

**Branch**: `rag/pr2-admin-crud`. Se necessário, split B.1 (CRUD) e B.2 (Playground) em dois PRs; senão, um só.

**Objetivo mensurável**: cadastrar 5 fontes editoriais reais (ex: trecho de Bavinck, verbete de Sistemática, nota histórica sobre Romanos, catecismo Heidelberg pergunta 1, confissão Belga art. 1). Todas indexam. Playground responde 10 queries e você classifica cada resultado como bom/útil/ruim — vira baseline de eval.

### 2.1 Rotas admin (server-side)

- [ ] `app/api/admin/knowledge/route.ts`
  - `GET` — lista sources com filtros (?status=&sourceType=&search=). Paginação simples (limit/offset, 50 default).
  - `POST` — cria source (status='draft'). Body: `{ title, author?, sourceType, license, tags?, content }`. Retorna `{ sourceId }`.
- [ ] `app/api/admin/knowledge/[id]/route.ts`
  - `GET` — source + count(chunks).
  - `PATCH` — atualiza campos editáveis (não permite mudar `source_type` se já indexado).
  - `DELETE` — cascade em chunks.
- [ ] `app/api/admin/knowledge/[id]/index/route.ts`
  - `POST` — dispara `indexKnowledgeSource` a partir do `content` bruto salvo. Suporta idempotência (se já `status='indexed'` e conteúdo não mudou, no-op).
- [ ] `app/api/admin/knowledge/search/route.ts`
  - `POST` — body `{ query, topK, sourceTypes?, metadataFilter? }`. Retorna array cru do `searchKnowledge`.
- [ ] `app/api/admin/knowledge/generate/route.ts`
  - `POST` — body `{ query, topK, systemPrompt, model? }`. Faz `searchKnowledge` + `callChat` com prompt configurável. Retorna `{ chunks, answer, usage }`.

Todas as rotas: guard admin via padrão existente (`requireAdmin` ou equivalente). Se não existir helper, criar em `lib/auth/admin.ts` refatorando do que já roda em `/admin/*`.

### 2.2 Chunker genérico para conteúdo editorial

- [ ] Adicionar em `lib/knowledge/chunk.ts`:
  ```ts
  export function chunkEditorialText(
    text: string,
    opts?: { targetChars?: number; overlapChars?: number }
  ): Array<{ content: string; section?: string; metadata?: Record<string, unknown> }>;
  ```
  Regra POC: split em parágrafos (blank-line), agrupar até `targetChars=1200`, overlap de `overlapChars=200`. `section` = `"§ N"` ou heading detectado (regex de linhas começando com `#` markdown se houver).

### 2.3 UI admin — listagem e cadastro

- [ ] `app/admin/knowledge/page.tsx` — lista.
  - Colunas: título, tipo, licença, tags, status, chunks, indexado em, ações.
  - Filtros topo: search, status, source_type.
  - Botão `[+ Nova fonte]`.
- [ ] `app/admin/knowledge/new/page.tsx` — form.
  - Campos: título (obrigatório), autor, editora, source_type (select), license (select, obrigatório), tags (input estilo tag), conteúdo (textarea markdown, altura generosa).
  - Botões: `[Salvar rascunho]` (POST `/api/admin/knowledge`) e `[Salvar e indexar]` (POST + POST /index).
  - Validação: título e license obrigatórios. Conteúdo não vazio para "Salvar e indexar".
- [ ] `app/admin/knowledge/[id]/page.tsx` — detalhes.
  - Abas: Conteúdo | Chunks | Metadados | Indexação.
  - Aba Chunks: tabela com `#`, `section`, `content` (truncado, expandível), `metadata`, `similarity col vazia`.
  - Aba Indexação: `embedding_model`, `dimensions`, `chunker_version`, `indexed_at`, botão `[Reindexar este source]` (nunca "reindexar tudo" — TODO #8 é CLI).
  - Aba Metadados: JSON pretty do `metadata` do source.

### 2.4 UI admin — playground

- [ ] `app/admin/knowledge/playground/page.tsx`.
  - Coluna esquerda:
    - `<textarea>` da query.
    - Slider top-K (1-30, default 10).
    - Multi-select `source_types` (default: todos).
    - Filtros de metadata livre (JSON textarea, opcional — validação Zod client-side).
    - Botão `[Buscar]`.
    - Divider.
    - `<textarea>` do system prompt (com prompt default rebatível — texto tipo "Você é um teólogo. Use APENAS as FONTES DE APOIO abaixo."). Salvar no localStorage.
    - Select do model (`gpt-4o-mini` default, `gpt-4o` opção).
    - Botão `[Gerar resposta]` (só habilita se busca já rodou).
  - Coluna direita (ou aba):
    - Resultado da busca: lista rankeada com `#`, `similarity`, `source.title`, `section`, `content` (expandível), `metadata` (JSON collapsed).
    - Resultado da geração: `answer`, `usage` (tokens/custo), lista dos chunks efetivamente usados no prompt.

### 2.5 Componentes reutilizáveis

- [ ] Se ainda não houver, `components/admin/DataTable.tsx` mínimo (colunas + rows + paginação) usando o padrão shadcn já no repo.
- [ ] `components/admin/LicenseBadge.tsx` — chip colorido por licença.
- [ ] `components/admin/SourceStatusChip.tsx` — draft/processing/indexed/failed.
- [ ] Tags input: usar componente existente ou implementar minimalista (`Enter` adiciona, `Backspace` no vazio remove último).

### 2.6 Logging & telemetria

- [ ] Cada rota admin: log padrão `[admin/knowledge] ...`.
- [ ] Rota `/generate` grava `llm_usage_events` com `route='admin_knowledge_generate'` (via helper existente).
- [ ] Rota `/index` grava (a partir do ingest): tokens de embedding NÃO entram em `llm_usage_events` ainda — TODO #17. Só logar em console por agora.

### 2.7 Testes de fumaça

- [ ] Cadastrar via UI 5 fontes reais listadas no objetivo.
- [ ] Todas viram `status='indexed'` com chunk count coerente.
- [ ] Playground:
  - Query "graça comum" retorna trechos de Bavinck (ou similar) no top-5.
  - Query "Romanos 5" retorna chunks bíblicos + comentário (via metadata filter `{"bibleBook": "rm", "chapter": 5}` em busca combinada).
  - Query com filtro `sourceTypes=['systematic_theology']` só retorna teologia sistemática, zero Bíblia.
- [ ] Rodar `[Gerar resposta]` em 3 queries; validar que resposta cita as fontes retornadas (não inventa).
- [ ] `npm run typecheck` + `npm run check` limpos.

### 2.8 Definition of Done (PR 2)

- [ ] CRUD funcional end-to-end: criar, listar, editar, deletar, reindexar.
- [ ] Playground pesquisa e gera com prompt configurável.
- [ ] 5 fontes reais indexadas (não mock).
- [ ] Prompt default do playground salvo em `lib/prompts/knowledge-playground.ts` (não inline).
- [ ] Nenhuma rota do usuário final tocada.
- [ ] `AGENTS.md` atualizado: seção "Admin knowledge" com fluxo curto.

### 2.9 Rollback plan (PR 2)

- Rotas admin: revert do PR remove tudo. Zero impacto em `/api/*` do usuário.
- Fontes editoriais cadastradas: `delete from knowledge_sources where source_type != 'bible'` limpa sem afetar Bíblia.

### 2.10 Riscos específicos da PR 2

| Risco | Mitigação |
|---|---|
| Prompt do playground esconde regressão do LLM | Salvar prompt version em `llm_usage_events.meta`. |
| Admin sem role check acessível | Reusar helper de admin; NUNCA importar rotas novas sem passar por ele. |
| Textarea de conteúdo travando em fontes gigantes (>500KB) | Limite hard de 500KB no POST. Fontes gigantes viram TODO #20 (import CSV). |
| Chunker editorial engolir markdown ruim | Testar com 1 fonte real ANTES de escalar. |

---

## PR 3 — Fase C: Deepening V2 em shadow

**Título do PR**: `feat(deepening): v2 shadow route with RAG context`

**Branch**: `rag/pr3-deepening-v2`.

**Objetivo mensurável**: para 5 sessões existentes com Aprofundar v1, gerar v2 e comparar side-by-side. Preencher tabela de eval na UI (v1 melhor / v2 melhor / empate) por rubrica.

### 3.1 Migration

- [ ] **0017_session_deepenings_variant.sql**:
  ```sql
  alter table public.session_deepenings
    add column variant text not null default 'v1'
      check (variant in ('v1','v2'));

  alter table public.session_deepenings
    drop constraint if exists session_deepenings_session_id_key;

  create unique index if not exists session_deepenings_session_variant_uidx
    on public.session_deepenings (session_id, variant);
  ```
  Se o unique constraint atual for outro nome, ajustar. **Backfill não é necessário** — a default `'v1'` já cobre rows existentes.

### 3.2 Prompt e domain

- [ ] `lib/prompts/deepening-v2.ts` — copiar v1, adicionar bloco final:
  ```
  ## FONTES DE APOIO

  Você recebeu abaixo um conjunto de trechos recuperados de uma biblioteca
  teológica confiável. Use-os para:
  - fundamentar afirmações doutrinárias com citação da fonte;
  - trazer contexto histórico/exegético que o pregador não desenvolveu;
  - complementar (nunca substituir) o argumento do sermão.

  Regras:
  - NUNCA cite uma fonte que não esteja na lista abaixo.
  - Se as fontes não sustentarem um ponto, omita-o em vez de inventar apoio.
  - Prefira sempre a Bíblia sobre comentários; comentários sobre teologia sistemática.

  FONTES:
  {{FONTES_PLACEHOLDER}}
  ```
  Preservar TODA a estrutura do v1 (blocos, voz, regra-de-ouro do bibleQuote) — v2 é aditivo.

- [ ] `lib/knowledge/queries-from-sermon.ts`:
  ```ts
  export interface SermonAnalysis {
    passages: Array<{ book: string; chapter: number; verseStart?: number; verseEnd?: number }>;
    topics: string[];   // frases curtas
  }
  export async function analyzeSermonForRag(
    transcript: string,
    feedItems: FeedItem[]
  ): Promise<SermonAnalysis>;
  ```
  - Chama `gpt-4o-mini` com prompt dedicado, JSON mode.
  - **Reaproveitar** as `citedVerse` do `feedItems` como seed — não descobrir do zero o que o guard já achou.
  - Zod schema pra parse defensivo.

- [ ] `lib/knowledge/build-fontes-block.ts`:
  ```ts
  export function buildFontesBlock(chunks: SearchResult[], opts?: { maxChars?: number }): string;
  ```
  Formata como texto pronto pro prompt:
  ```
  [1] {source.title} ({source.author}) — {section}
  {content}

  [2] ...
  ```
  Truncar por `maxChars=8000` (proteção do context window). Retornar sempre limitado.

### 3.3 Rota V2

- [ ] `app/api/deepening/v2/route.ts`:
  1. Auth via `requireAuth` (mesmo padrão de v1).
  2. Carrega sessão (transcript + feedItems).
  3. `analyzeSermonForRag(transcript, feedItems)` → `{ passages, topics }`.
  4. Para cada passage: `searchKnowledge(bookName + " " + chapter, { topK: 3, metadataFilter: { kind: 'bible', bibleBook, chapter } })` + `searchKnowledge(topic, { topK: 3, sourceTypes: ['commentary','systematic_theology'] })`. **Paralelizar** com `Promise.all`.
  5. Deduplica por `chunkId`, limita a 15 chunks totais (top overall).
  6. `buildFontesBlock(chunks)`.
  7. `callChat` com `DEEPENING_V2_SYSTEM_PROMPT` + userMessage contendo o bloco fontes concatenado com o mesmo userMessage do v1.
  8. Persiste com `variant='v2'`.
  9. Log `[deepening-v2] ok { latencyMs, analyzeMs, retrievalMs, chatMs, chunksUsed, promptTokens, completionTokens }`.

### 3.4 UI de eval no admin

- [ ] `app/admin/knowledge/eval/page.tsx` — lista sessões que têm ambos v1 e v2 (`select session_id, count(distinct variant) as v from session_deepenings group by session_id having count(distinct variant) = 2`).
- [ ] `app/admin/knowledge/eval/[sessionId]/page.tsx` — side-by-side.
  - 2 colunas renderizando `SummaryView` de v1 e v2.
  - Botão `[Gerar V2]` se ainda não existe.
  - Formulário de rubrica (checkbox por dimensão):
    - Fidelidade ao sermão
    - Profundidade teológica
    - Uso apropriado de citações
    - Ausência de invenção
    - Fluidez / voz consistente
  - Cada dimensão: v1 melhor / empate / v2 melhor. Comentário livre.
  - Persistir em nova tabela `deepening_evaluations` (migration inclusa no PR 3 se decidirmos, ou apenas localStorage por enquanto).

### 3.5 Guardrail no `AGENTS.md`

- [ ] Adicionar na seção "Behaviour-preservation guardrails":
  > **Do not mount RAG on `/api/final-summary`.** The summary is a fidelity contract to the transcript. RAG lives on `/api/deepening/v2` and any future deepening routes. If you extract a shared helper from `lib/knowledge/`, tag it explicitly `// DO NOT call from final-summary`.
- [ ] TODO #16 — riscar quando esta linha entrar.

### 3.6 Testes de fumaça

- [ ] Rodar v2 em 1 sessão local. Verificar que resposta cita fontes reais da biblioteca (não inventa).
- [ ] Comparar v1 e v2 na UI de eval — visualmente aceitável (mesma estrutura, mesmas seções).
- [ ] Latência total < 90s p50 (v1 é ~30-60s, v2 é ~+30s aceitável em shadow).
- [ ] `select variant, count(*) from session_deepenings group by variant` mostra ambas variantes.
- [ ] `npm run typecheck` + `npm run check` limpos.

### 3.7 Definition of Done (PR 3)

- [ ] Rota `/api/deepening/v2` funcional e autenticada.
- [ ] 5 sessões existentes têm v2 gerada.
- [ ] UI de eval renderiza side-by-side.
- [ ] V1 permanece rota default do usuário — v2 é opt-in via admin.
- [ ] Guardrail contra `final-summary` documentado.

### 3.8 Rollback plan (PR 3)

- Reverter PR remove rota v2, migration reversível (`alter table drop column variant`).
- V1 nunca foi tocada — impossível regressão no fluxo principal.

### 3.9 Riscos específicos da PR 3

| Risco | Mitigação |
|---|---|
| Bloco FONTES estourar context window | `buildFontesBlock` trunca em 8000 chars; se `gpt-4o` tem 128k, é folgado, mas manter guarda. |
| Analyze LLM alucinar passagens que não estão no sermão | Regra: só considerar passagens que aparecem também nos `feedItems` OU no `transcript` via string match. |
| Alguém migrar V2 pra produção sem eval | V1 default está hardcoded no client; V2 só é chamada via admin. Documentar. |
| Custo dobrar em shadow | Shadow roda só sob demanda (admin gera), não automaticamente. Não é loop. |

---

## Convenções compartilhadas (todas as PRs)

### Logging

Todos os módulos do RAG usam `console.log(JSON.stringify({ tag, ...fields }))` no padrão dos routes atuais. Tags:

- `[embeddings]`
- `[knowledge/ingest]`
- `[knowledge/search]`
- `[admin/knowledge]`
- `[deepening-v2]`

Nunca logar embeddings inteiros (spam). Logar `dimensions` e `similarity` bastam.

### Error handling

Nada de `throw` cru dentro de rotas — sempre `Result<T>` pattern do `lib/llm/openai.ts`, ou `NextResponse.json({ error }, { status: N })`. Retornar 500 apenas em bug interno; 400 em input inválido; 502 em upstream (OpenAI/Supabase).

### Testing manual

Sem test runner (`AGENTS.md` §"What is deliberately NOT here yet"). Antes de cada PR: rodar checklist "Testes de fumaça" da seção + `npm run typecheck` + `npm run check` limpos. Screenshot da UI se mexer em UI. Comentar no PR quais queries de playground foram testadas.

### Nomes de branch e commit

- Branches: `rag/pr1-foundation`, `rag/pr2-admin-crud`, `rag/pr3-deepening-v2`.
- Commits scoped: `feat(knowledge): ...`, `feat(admin/knowledge): ...`, `feat(deepening-v2): ...`, `chore(knowledge/migrations): ...`.
- Cada PR entra em `rag/develop`. Só ao fim da Fase C, merge de `rag/develop` para branch de release.

---

## Cronograma estimado

Estimativas em dias de trabalho focado (não corrido). Assumindo Renan solo, com Claude assistindo.

| PR | Otimista | Realista | Pessimista |
|---|---|---|---|
| PR 1 | 2 dias | 4 dias | 7 dias (se pgvector no Supabase local der problema) |
| PR 2 | 4 dias | 7 dias | 12 dias (UI admin é sempre maior que parece) |
| PR 3 | 3 dias | 5 dias | 8 dias (eval UI + calibrar prompt) |
| **Total** | **9 dias** | **16 dias** | **27 dias** |

Realista ~3 semanas de trabalho focado. Coisas que empurram pra pessimista: descobrir necessidade de refatorar `requireAdmin`, pgvector requer upgrade do Supabase local, chunker editorial exigir mais heurística, prompt V2 exigir 3-4 iterações.

---

## Sinais de sucesso da POC completa (fim da PR 3)

Ordem de crescente ambição:

1. **Técnico**: 3 traduções bíblicas + 5 fontes editoriais indexadas, playground funciona, v2 gera respostas coerentes.
2. **Empírico**: em 5 sessões, v2 vence v1 em ≥3 das 5 rubricas em ≥60% dos casos.
3. **Editorial**: você (Renan) sente que a v2 traz coisa que a v1 não trazia, e sabe *por que* (chunks visíveis no admin).
4. **Estrutural**: infraestrutura pronta para (a) auto-indexar sessões, (b) ligar RAG no Ao Vivo, (c) escalar biblioteca — sem retrabalho.

Se 1+2+3 ok → promover v2 para produção (Fase D, fora do escopo deste plano).
Se 1 ok, 2/3 não → iterar prompt/chunker/retrieval ANTES de promover. Nunca ligar em prod só porque "compilou".

---

## Anexos

### A. Comandos npm que devem existir ao fim da PR 3

```json
{
  "scripts": {
    "index:bible": "tsx scripts/index-bible.ts",
    "knowledge:reset": "tsx scripts/reset-knowledge.ts"
  }
}
```

TODOs futuros adicionarão `knowledge:reindex` (TODO #8) e `eval:rag` (TODO #19).

### B. Workflow de dev na branch `rag/develop`

```
rag/develop  ← integração
  ├── rag/pr1-foundation      → PR → merge → rag/develop
  ├── rag/pr2-admin-crud      → PR → merge → rag/develop
  └── rag/pr3-deepening-v2    → PR → merge → rag/develop
```

Enquanto RAG está em `rag/develop`, outras features do produto continuam em `redesign`. Rebase de `rag/develop` sobre `redesign` regularmente pra não divergir demais.

### C. Referências a este plano em outros lugares

Adicionar link para este arquivo em:
- [ ] `AGENTS.md` seção nova "Knowledge base"
- [ ] Descrição do primeiro PR (`rag/pr1-foundation`)
- [ ] `docs/scriba-rag-proposta-claude.md` no topo (linha "plano de execução em ...")

---

## Log de mudanças deste plano

- **2026-08-25** — versão inicial (Claude, na branch `rag/develop`).
