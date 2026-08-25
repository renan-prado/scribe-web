# Scriba RAG — proposta e comentários (Claude)

> Documento-resposta ao `scriba-rag-knowledge-architecture.md` (GPT).
>
> Objetivo: filtrar a proposta do GPT pelo que o código do Scriba **de fato já é hoje**, apontar onde ele acerta, onde erra por falta de contexto, e propor uma primeira encarnação executável em 2–3 PRs.

---

## Decisões travadas (após feedback do usuário)

Registrado no topo pra evitar reabrir debate depois. Coisas adiadas estão em `docs/scriba-rag-todos-futuros.md`.

- **Admin CRUD de conteúdo é first-class, não Fase D.** Motivação: indexar a Bíblia é pré-requisito, não o produto — o valor real vem do controle editorial de conteúdo externo confiável. Admin entra junto do Playground no PR 2.
- **Biblioteca pessoal (sessões passadas)**: importante, mas *não* pode ser a única fonte. Se o usuário está numa igreja com teologia ruim, indexar só o que ele ouve amplifica o problema. Conteúdo externo curado é contrapeso obrigatório.
- **Bíblias iniciais**: NAA + ARA + NVI (3 sources com metadata `translation`).
- **Embedding**: `text-embedding-3-small@512`.
- **Auto-indexação de sessões**: adiada — infra pronta, ligada em fase posterior.
- **RAG no Ao Vivo**: adiado.
- **Curadoria**: o próprio usuário (Renan) por enquanto — sem multi-tenant admin.
- **Escala**: moderada (planejar pra ~50k chunks, não pra 1M).

---

## 0. TL;DR

**A tese central do GPT está certa**: retrieval > fine-tuning, começar pelo Aprofundar, playground é infraestrutura de produto (não luxo). Aceito essas três premissas quase integralmente.

**Mas o documento foi escrito sem conhecer o repositório**, então três coisas grandes precisam ser corrigidas antes de virar plano:

1. **O Aprofundar já existe** (`app/api/deepening/route.ts`, prompt em `lib/prompts/deepening.ts`, schema, tabela `session_deepenings`, custo já rastreado). Não é feature a construir; é rota a modificar. Isso encurta drasticamente a "Fase 4" do roadmap dele.
2. **11 traduções da Bíblia já estão no repo** (`lib/bibles/*.json` — ACF, ARA, ARC, KJA, KJF, NAA, NBV, NTLH, NVI, NVT, OL). O "conteúdo bíblico" da biblioteca é grátis, licenciado, e já foi versificado. O GPT tratou como algo a indexar do zero.
3. **O guard bíblico do live já extrai referência estruturada** (`book + chapter + verse`) via `lib/bible/guard.ts` + `lib/domain/feed.ts::parseVerseReference`. Isso é matéria-prima direta para o retrieval híbrido (metadata-first) que o GPT descreve como "futuro". Não é futuro — o pipeline live já produz o sinal.

Além disso, **discordo em um ponto de método**: o GPT sugere começar CRUD editorial (20–50 chunks à mão). Eu sugiro começar indexando a **Bíblia** (que já temos, direito resolvido), porque isso valida a stack pgvector end-to-end sem depender de você digitar conteúdo. O CRUD editorial vira o segundo passo, não o primeiro.

**Roadmap que eu proponho** (detalhado na §5, atualizado após decisões travadas):

| Fase | Entrega | Esforço |
|---|---|---|
| A | pgvector + tabelas + `embed()` + script para indexar NAA + ARA + NVI | 1 PR pequeno-médio |
| B | `/admin/knowledge` (CRUD editorial) + `/admin/knowledge/playground` | 1 PR médio-grande (ou split B.1/B.2) |
| C | Deepening V2 shadow — roda paralelo, salva com `variant='v2'`, compara no admin | 1 PR médio |
| D | Hybrid search + evals fixas + promoção do V2 pra produção | contínuo |

---

## 1. O que o GPT não sabia sobre o código

Contexto factual que muda o plano. Nada aqui é opinião — é o que está no repo hoje.

### 1.1 O Aprofundar já é rota, prompt, schema, tabela

- `app/api/deepening/route.ts` — rota `POST` autenticada, único por sessão (unique constraint), modelo default `gpt-4o`, `maxTokens: 16000`, responseFormat JSON.
- `lib/prompts/deepening.ts` — 65 linhas de prompt teológico já com regras de voz, regra-de-ouro para bibleQuote, tipos de bloco.
- `lib/domain/deepening.ts` — reusa `SummaryPayload` (mesmo renderer).
- `lib/db/deepenings.ts` — persistência.
- Migration `0009_session_deepenings.sql`.
- Custo já rastreado via `recordChatUsage({ route: "deepening", ... })` e visível em `/admin/usage`.

**Consequência**: a "integração ao Aprofundar" do GPT (Fase 4 do dele) é substituir o `userMessage` da rota — adicionar um bloco `FONTES DE APOIO` antes da chamada `callChat`. Não é feature nova.

### 1.2 Bíblia inteira já está no filesystem

- `lib/bibles/loader.ts` expõe 11 traduções em pt-BR e inglês, com cache em memória, indexadas por `book.abbrev + chapter[] + verse[]`.
- `lib/bibles/chapter-lengths.ts` e `books.ts` dão a estrutura canônica.
- Isso substitui integralmente as §32.1 e §32.2 do GPT ("Bíblia" e "Referência bíblica") como fonte livre. Direito autoral já foi resolvido antes de entrar no repo.

**Consequência**: a POC pode ter **31.000 versículos + estrutura hierárquica** disponíveis para chunking teológico *desde o dia 1*, sem digitar nada. O medo do GPT de "não começar com muito conteúdo" faz sentido para livros protegidos; não faz sentido pra Bíblia.

### 1.3 O guard do live já produz metadata estruturada

- `lib/bible/guard.ts` extrai `{ book, bookDisplay, chapter, verse }` com signals ponderados e mantém `currentReading` com TTL.
- `lib/domain/feed.ts::parseVerseReference` normaliza referências.
- Cada `citedVerse` que aparece no feed carrega `book/chapter/verseStart/verseEnd`.

**Consequência**: no Ao Vivo, quando o pregador cita "Romanos 8:28", o Scriba **já sabe** disso de forma estruturada. Não precisa de embedding para achar "Romanos 8" na biblioteca — SQL `WHERE book='Romans' AND chapter=8` resolve. Embedding entra só para busca *conceitual* ("sofrimento e providência"), não para busca *referencial* ("Rm 8:28"). Isso é uma distinção que o GPT trata bem na §28, mas não conecta ao fato de que o Scriba já produz o dado.

### 1.4 Admin já é infra viva

- `/admin`, `/admin/users`, `/admin/usage` existem, com layout, `AdminPageHeader`, role check.
- Migration `0007_admin_role.sql` estabelece o modelo de permissão.
- Custo por rota + FX BRL já é renderizado (`/admin/usage`).
- Adicionar `/admin/knowledge` é uma extensão natural — não é criar o admin.

### 1.5 Ainda não existe — o que o GPT propõe é genuinamente novo

- Nenhuma extensão `vector` habilitada; nenhuma migration usa `pgvector`.
- Nenhum código em `lib/` chama embeddings da OpenAI hoje.
- `serverEnv` (Zod estrito) precisará de novos campos (`OPENAI_EMBEDDING_MODEL`, `OPENAI_EMBEDDING_DIMENSIONS`).
- Não há tabela `knowledge_*`.
- Não há RAG em nenhuma rota (deepening, insights, bible, sermon-echo, final-summary — todas puramente prompt+transcript).

---

## 2. Onde concordo com o GPT (registrado para não repetir)

Marcado por §-do-documento-dele:

- **§2** distinção fine-tuning vs. RAG — correta e importante.
- **§3** 70/20/10 esforço em base+retrieval / prompt / modelo — pareto realista.
- **§7** regra do "mesmo modelo de embedding pra query e chunk" — inegociável.
- **§8** Supabase + pgvector sem introduzir Pinecone/Weaviate/LangChain — endosso total. O stack já é Supabase, `callChat` já é wrapper próprio, adicionar orquestrador de terceiro seria over-engineering.
- **§11** chunking hierárquico (obra → capítulo → seção) em vez de janela fixa — sim, especialmente para comentários bíblicos.
- **§20-21** transcrição continua sendo fonte de verdade; RAG enriquece mas não reescreve — isso já é filosofia declarada no `AGENTS.md` e no prompt do deepening.
- **§23-25** RAG diferente por experiência (Ao Vivo restrito, Resumo quase-nada, Aprofundar total) — correto.
- **§46-50** playground como bancada de testes separada — provavelmente a ideia mais valiosa do documento inteiro. Retomarei na §5.
- **§51** não fixar threshold cedo, retornar top-K e calibrar empiricamente — sim.
- **§57-58** avaliar retrieval e geração *separadamente* — isso muda a natureza das evals.
- **§68** lista do "não fazer agora" (fine-tuning, LangChain, milhares de páginas, taxonomia gigante) — assino embaixo.
- **§76-77** biblioteca pessoal do usuário como corpus RAG — na §4 desse documento eu argumento que esse é o diferencial *mais defensável* do Scriba.

---

## 3. Onde discordo, matizo, ou o GPT falhou

### 3.1 "Não começar com livros" — matizar

O GPT recomenda começar com 20–50 chunks editoriais escritos à mão (§52). O raciocínio (evitar dependência de licença, controlar qualidade) é válido para **livros protegidos**. Mas:

- **Bíblia** já está no repo. Não indexar imediatamente é desperdiçar assets.
- **Domínio público teológico** existe e é substancial em pt/en: Calvino (Institutas, comentários), Spurgeon, Owen, Wesley, catecismos (Heidelberg, Westminster), confissões (Belga, Nicena, Calcedônia), Agostinho, Crisóstomo, escritos patrísticos. Fontes: CCEL.org, Monergismo, Projeto Spurgeon.
- Isso permite chegar em **500–2.000 chunks** de qualidade em semanas sem depender de você digitar conteúdo original.

**Contra-proposta**: POC começa com Bíblia (uma tradução, ARA ou NAA, 31k versos → ~5-8k chunks por perícope). Segundo passo: 1-2 catecismos + 1 comentário de domínio público sobre um livro (ex: Romanos, para casar com a §55 de "sermão conhecido para testar").

Editorial próprio entra na **fase D**, quando você já sabe que a stack funciona.

### 3.2 Chunking bíblico — perícope, não versículo

O GPT sugere hierarquia (§11). Correto. Mas para Bíblia especificamente:

- **Versículo isolado** perde contexto (Jr 29:11 fora do exílio vira coach).
- **Capítulo inteiro** engole tudo — Rm 8 tem 4-5 unidades argumentativas distintas.
- **Perícope** (unidade retórica: 3-15 versos) é a granularidade certa para busca semântica.

Pt-BR: perícopes já vêm segmentadas em várias edições impressas. Se não quisermos importar delimitações externas, uma heurística simples: **chunk = 5-10 versos consecutivos com overlap de 2**, começando em versículos onde a NVI/ARA quebra parágrafo (podemos derivar do próprio JSON se ele preserva parágrafos; senão, começar com janela fixa por perícope aproximada).

Metadata obrigatória por chunk bíblico: `{ translation, book, chapter, verseStart, verseEnd, testament }`.

### 3.3 "Tradition" como enum — cuidado com taxonomia enganosa

§33 sugere `tradition: reformada | arminiana | batista | pentecostal`. Isso é um pântano:

- Um autor batista reformado é as duas coisas.
- Um comentário exegético de autor arminiano sobre justificação por fé continua útil para leitor reformado — a diferença aparece em *alguns* tópicos, não em tudo.
- Marcar a *fonte* com tradition esconde que a *afirmação* é o que tem posição.

**Contra-proposta**: usar `tags: string[]` (array, não enum) para tradição/vertente na fonte, e opcionalmente `stance: string` por chunk para tópicos onde há divergência clara (eleição, batismo, escatologia). O default (`stance: null`) cobre 90% do conteúdo, que é exegese/definição/história neutra. Isso adiciona complexidade, mas o GPT deixaria você criar um filtro binário enganoso.

### 3.4 Reindexação via botão no admin — perigoso, não fazer

§43-44 propõe botão "Reindexar toda a biblioteca". Concordo que reindexação é necessária. Discordo do *lugar*:

- Reindexar Bíblia (5k chunks) x embedding 3-small ~ $0.10, aceitável.
- Reindexar Bíblia + 3 comentários + editorial (20k chunks) ~ $0.40, ainda ok.
- Um clique acidental em "reindexar" na produção pode disparar milhares de chamadas em paralelo, quebrar rate limit da OpenAI, e você fica sem embeddings por horas.

**Contra-proposta**: reindex via **script CLI/npm** (`scripts/reindex-knowledge.ts`), com confirmação, batch size (10-50 por lote), backoff. UI mostra "última indexação: X, modelo: Y" mas só disparar reindex de UM source por vez. Reindex em massa é operação de manutenção, não feature de admin.

### 3.5 RAG no Ao Vivo — proposta concreta que o GPT não deu

§23 diz "RAG do Ao Vivo deve ser rápido e limitado". Ok, mas *como*?

**Contra-proposta concreta**:

- Quando `/api/bible` emite `citedVerse` com `book/chapter/verse` resolvidos, dispara **em background** (fire-and-forget, sem bloquear o feed) uma query estruturada:

  ```sql
  select content, metadata
  from knowledge_chunks
  where metadata->>'bibleBook' = $1
    and (metadata->>'chapter')::int = $2
    and source_id in (select id from knowledge_sources where type in ('commentary','systematic_theology'))
  limit 3
  ```
  Zero embedding, zero latência de LLM. É lookup indexado.

- O resultado vira um card `context` (ou novo `speakerCitationContext`) que aparece **no próximo chunk transcrito** — 30s depois, aceitável, porque o pregador continua falando sobre o mesmo texto.

- Esse padrão só vira embedding-based no **fim** — quando o retrieval hit rate por metadata cair abaixo de X (métrica a definir).

Isso preserva a regra do §23 (barato, rápido, previsível) *e* usa a metadata estruturada que o guard já produz.

### 3.6 O que o GPT NÃO mencionou e é crítico

#### (a) A biblioteca pessoal é o diferencial defensável, não a biblioteca de referência

§76-77 tocam nisso mas subestimam. Reformulando:

- **Biblioteca de referência** (Bíblia + comentários + editorial): qualquer competidor com $X e 6 meses replica.
- **Biblioteca pessoal** (todos os sermões que ESSE usuário ou ESSA igreja gravou no Scriba): não-replicável por definição.

Cada `session_deepenings`, cada `session_feed_items.speakerHighlight`, cada `final_summary` do usuário é conteúdo já estruturado, já em português, já teologicamente relevante. O RAG que responde *"o que meu pastor já ensinou sobre santificação?"* é conteúdo que só o Scriba pode entregar.

**Implicação prática**: `knowledge_chunks.source_type` deve incluir `session_deepening`, `session_summary`, `session_highlight` desde o início. Auto-indexar essas fontes quando são criadas. É "de graça" (você já paga a chamada LLM que produz o conteúdo).

#### (b) Custo de embedding + tokenização

`text-embedding-3-small` a $0.02/M tokens é barato mas não zero. Auto-indexar cada `final_summary` da produção sem medir vai virar linha no `llm_usage_events` que ninguém previu.

**Sugestão**: nova migration `llm_embedding_usage_events` (ou coluna `event_kind='embedding'` em `llm_usage_events`), integrar com `lib/llm/pricing.ts` que já existe. O admin `/admin/usage` já mostra por rota; adicionar "embeddings" como rota é 1 linha.

#### (c) Shadow mode antes de rewrite

O GPT sugere ligar RAG direto no Aprofundar depois da POC. Perigoso — o usuário pode achar que ficou pior. Melhor:

- Nova rota `POST /api/deepening/v2` que produz o mesmo schema mas com RAG.
- Nova tabela `session_deepenings_v2` (ou coluna `variant text` em `session_deepenings`).
- `/admin/knowledge/eval` mostra sessões que têm ambos, lado a lado.
- Só quando o v2 vence consistentemente em N sessões, promover.

Isso é a versão empírica da §55-56 do GPT.

#### (d) Direito autoral operacional, não só principiológico

§35 diz "avalie licenças". Traduzindo em código:

- `knowledge_sources.license` obrigatório, enum: `public_domain | cc_by | cc_by_sa | editorial_original | licensed_agreement | user_content`.
- Sources com `license IS NULL` **não indexam** (constraint no ingest).
- `license_notes` texto livre para caso a caso.
- Admin mostra chip de licença ao lado de cada source.

Zero código extra, protege de erro no futuro.

#### (e) HNSW vs. IVFFlat vs. sequential

GPT recomenda HNSW (§14). Para POC com <10k chunks, **scan sequencial é suficiente** (query <20ms). HNSW ganha em >50k. IVFFlat tem tempo de build menor mas exige `lists` calibrado à cardinalidade.

**Sugestão**: POC sem índice. Adicionar índice quando `count(*) from knowledge_chunks > 20000`. Não perder tempo com tuning agora.

---

## 4. Resposta ao roadmap do GPT (§70)

Mapeando o roadmap dele → o meu.

| GPT (dele) | O que já existe | O que eu proponho |
|---|---|---|
| **Fase 0** (pgvector + tabelas) | Nada | **Fase A** — igual, mas adicionar `license`, `chunker_version`, `embedding_model` em `knowledge_sources` |
| **Fase 1** (admin CRUD manual) | Admin base existe; knowledge não | **Fase B** — first-class, entra junto do playground. Motivo: Bíblia é pré-requisito, não diferencial; o valor real está no controle editorial |
| **Fase 2** (playground sem geração) | Nada | **Fase B** — junto do CRUD, mesmo PR (ou split B.1/B.2) |
| **Fase 3** (playground com geração) | Nada | **Fase B** — mesmo PR |
| **Fase 4** (integrar Aprofundar) | **Aprofundar existe** | **Fase C** — via shadow mode (nova rota v2, comparação side-by-side) |
| **Fase 5** (evals) | Nada | **Fase E** — 20 casos fixos, rodados a cada mudança de embedding/chunking/prompt |
| **Fase 6-8** (metadata, hybrid, rerank) | Metadata bíblica parcialmente já vem do guard | **Fase D+** — hybrid vem quando keyword-only falhar em queries específicas medidas |
| **Fase 9** (ao vivo) | Bible guard entrega refs estruturadas | **Fase F** — lookup por metadata (não embedding) disparado no `/api/bible` |
| **Fase 10** (biblioteca avançada) | — | Só depois de licenciamento formalizado |

---

## 5. Proposta concreta de primeiros PRs

Cada item aqui é dimensionado para caber em um PR revisável.

### PR 1 — Fundação (Fase A)

**Título**: `feat(knowledge): pgvector + knowledge_sources/chunks + embedText`

Arquivos novos:
```
supabase/migrations/0012_pgvector.sql
supabase/migrations/0013_knowledge_sources.sql
supabase/migrations/0014_knowledge_chunks.sql
supabase/migrations/0015_match_knowledge_fn.sql
lib/ai/embeddings.ts           — embedText() centralizado
lib/knowledge/types.ts
lib/knowledge/chunk.ts         — chunker por tipo de fonte
lib/knowledge/ingest.ts        — indexKnowledgeSource()
lib/knowledge/search.ts        — searchKnowledge()
lib/env/server.ts              — add OPENAI_EMBEDDING_MODEL/DIMENSIONS
scripts/index-bible.ts         — indexa 1 tradução como POC
```

DDL essencial:
```sql
-- 0012
create extension if not exists vector with schema extensions;

-- 0013
create table knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  publisher text,
  source_type text not null check (source_type in (
    'bible','commentary','systematic_theology','article','book',
    'sermon','editorial','session_summary','session_deepening'
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 0014
create table knowledge_chunks (
  id bigint primary key generated always as identity,
  source_id uuid not null references knowledge_sources(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  section text,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(512),
  created_at timestamptz not null default now(),
  unique (source_id, chunk_index)
);

-- 0015
create or replace function match_knowledge(
  query_embedding extensions.vector(512),
  match_count int default 10,
  filter_source_types text[] default null
) returns table (...)
language sql stable as $$ ... $$;
```

Script `scripts/index-bible.ts` (aceita arg `--translation NAA|ARA|NVI`, roda 3x — uma por tradução): lê o JSON correspondente em `lib/bibles/`, agrupa em perícopes de 5-10 versos, insere em `knowledge_sources` (1 fonte por livro × tradução = 66 × 3 = 198 sources, `license='public_domain'`) + chunks com metadata `{ translation, book, chapter, verseStart, verseEnd }`.

**Success criteria**: `select count(*) from knowledge_chunks` retorna ~15-24k (3 traduções × 5-8k). `select match_knowledge(embedText('soberania e sofrimento'), 5)` retorna passagens plausíveis.

### PR 2 — Admin de conteúdo + Playground (Fase B)

**Título**: `feat(admin): knowledge CRUD + retrieval playground`

Escopo (pode split em B.1 CRUD e B.2 Playground, mas ambos entram antes do PR 3).

Arquivos novos:
```
app/admin/knowledge/page.tsx                    — lista sources com filtros/status
app/admin/knowledge/new/page.tsx                — form de cadastro (título/autor/tipo/licença/tags/conteúdo)
app/admin/knowledge/[id]/page.tsx               — detalhes: abas Conteúdo | Chunks | Metadados | Indexação
app/admin/knowledge/playground/page.tsx         — form + resultados + botão gerar
app/api/admin/knowledge/route.ts                — GET (listar) / POST (criar source)
app/api/admin/knowledge/[id]/route.ts           — GET / PATCH / DELETE
app/api/admin/knowledge/[id]/index/route.ts     — POST: dispara indexKnowledgeSource
app/api/admin/knowledge/search/route.ts         — RPC match_knowledge
app/api/admin/knowledge/generate/route.ts       — top-K + prompt experimental
```

**CRUD (B.1)** — formulário mínimo:
- Título, Autor (opcional), Editora (opcional).
- Tipo de fonte: `commentary | systematic_theology | article | book | editorial`.
- Licença (obrigatório): `public_domain | cc_by | cc_by_sa | editorial_original | licensed_agreement`. Sem licença = não salva.
- Tags (array de strings, ex: `["reformada", "puritano"]`).
- Conteúdo (markdown/texto).
- Botões: `[Salvar rascunho]` e `[Salvar e indexar]`.
- Detalhes: aba Chunks mostra como o chunker segmentou; aba Indexação mostra `embedding_model`, `dimensions`, `indexed_at`, botão `[Reindexar este source]` (nunca "reindexar tudo").

**Playground (B.2)** — interface mínima:
- Query textarea + slider Top-K + filtros (source_type, tags).
- Lista: `#rank | score | source.title | section | content (expandível) | metadata`.
- Botão `[Gerar resposta com estes resultados]` — chama modelo com prompt configurável no próprio playground (system prompt editável textarea).

**Success criteria**:
- Você cadastra 3-5 fontes editoriais reais (ex: um trecho de Bavinck sobre providência, um verbete de teologia sistemática, uma nota histórica sobre Romanos) e todas indexam.
- Você roda 10 queries conhecidas no playground e classifica cada resultado como bom/útil/ruim. Isso vira baseline pra Fase D (evals).

### PR 3 — Shadow Aprofundar (Fase C)

**Título**: `feat(deepening): v2 shadow route with RAG context`

Modificações:
```
app/api/deepening/v2/route.ts                   — nova rota
lib/prompts/deepening-v2.ts                     — v1 + bloco "FONTES DE APOIO"
lib/knowledge/queries-from-sermon.ts            — extrai passagens/temas
supabase/migrations/0016_session_deepenings_variant.sql
                                                — add coluna variant
app/admin/knowledge/eval/[sessionId]/page.tsx   — side-by-side v1 vs v2
```

Fluxo v2:
1. Recebe `sessionId`.
2. Roda `analyzeSermon(transcript)` → `{ passages: string[], topics: string[] }` (chamada LLM barata, gpt-4o-mini, JSON mode).
3. Para cada passage: `match_knowledge` filtrando por metadata bíblica.
4. Para cada topic: `match_knowledge` semantic sobre `commentary + systematic_theology`.
5. Deduplica por `chunk.id`, limita a 8-15 chunks totais, formata como bloco `FONTES DE APOIO` no user message.
6. Chama `callChat` com o prompt v2 (v1 + regras de citação de fontes).
7. Salva em `session_deepenings` com `variant='v2'`.

**Success criteria**: 5 sessões existentes com v1 + v2, revisão manual, tabela §56 do GPT preenchida.

---

## 6. Riscos e itens críticos que o GPT passou de leve

Ordenados por criticidade:

1. **Custo de embedding em auto-indexação de sessões** — se cada `final_summary` for auto-indexado, isso vira linha de custo silenciosa. Precisa entrar no cost tracking existente (`lib/llm/pricing.ts`) *antes* de ligar.
2. **Rate limit da OpenAI em reindexação em massa** — 3k RPM no tier 1. Reindexar Bíblia com paralelismo ingênuo bate no teto. Batch + backoff obrigatórios no ingest.
3. **Divergência de embedding models entre chunks** — se metade dos chunks foi indexada com `text-embedding-3-small@512` e outra metade com `@1536`, o `match_knowledge` retorna lixo. Solução: coluna `embedding_model` no chunk row + função de match refuse mistura. Simpler: 1 tabela por modelo se algum dia precisar coexistir.
4. **RLS nas novas tabelas** — `knowledge_sources` é *global* (nem por usuário nem por sessão). Precisa policy admin-only para write, read livre pra service_role. Não copiar padrão de `sessions`.
5. **RAG contaminando o Resumo** — o Resumo tem prompt claro de "só use a transcrição". Se um dia alguém sem contexto adicionar `FONTES DE APOIO` ao `final-summary` também, a fidelidade quebra silenciosamente. Documentar isso no `AGENTS.md` na mesma seção do "Do not merge bible back into insights".
6. **Latência do Aprofundar V2** — v1 é 1 chamada LLM. v2 é 1 analyze + N queries + 1 chamada LLM final. Tempo total pode dobrar. Precisa medir e decidir se paga o custo em UX.
7. **Direito autoral em obras não-domínio-público** — o GPT alerta em §35. Reforço: **antes** de indexar qualquer obra ainda protegida, contrato escrito. `license IS NULL` = bloqueio no código, não no processo.

---

## 7. Perguntas em aberto (RESOLVIDAS)

Registrado pra referência histórica. Ver "Decisões travadas" no topo.

1. ~~Modelo de embedding~~ → **`text-embedding-3-small@512`**.
2. ~~Qual tradução indexar primeiro~~ → **NAA + ARA + NVI** (as 3 no PR 1).
3. ~~Auto-indexação de sessões~~ → **Espera**.
4. ~~RAG no Ao Vivo~~ → **Espera**.
5. ~~Curadoria externa~~ → **Renan curates**. Admin é single-user por enquanto.
6. ~~Escala esperada~~ → **Moderada** (~50k chunks). Sem HNSW no início; adicionar em Fase D se `count(*) > 20k`.

---

## 8. O que eu deliberadamente NÃO propus

Coisas do documento do GPT que eu deixaria pra depois de a POC provar valor:

- Reranking (§27) — sem sinal ainda de que top-10 vetorial ordena mal.
- Hybrid search com FTS (§29) — só depois de identificar queries que semantic-only erra.
- Diversidade forçada nas fontes (§82) — otimização prematura.
- Prioridade editorial numérica (§83) — humanamente inviável de calibrar cedo.
- Query rewriting (§81) — o GPT já cobre isso implicitamente em "analisar sermão antes de buscar"; não precisa ser layer separada.
- Fine-tuning (§86) — ele mesmo diz "depois".
- Vector search de tradition/stance filtering — precisa de dados antes.
- `knowledge_search_runs` (§67, observabilidade) — se auto-indexar sessão, os próprios usage_events já cobrem 80%.

Cortando essas coisas, a POC completa (Fases A-C) cabe em ~2 semanas de trabalho focado.

---

## 9. Comparação final: o Scriba pós-PR3 vs. hoje

| Dimensão | Hoje | Pós-PR3 (Fases A+B+C) |
|---|---|---|
| Aprofundar tem contexto bíblico expandido | Só o que o modelo memorizou | Recupera versos/comentários por passagem citada |
| Você consegue debugar "por que essa resposta ficou ruim?" | Não — abre prompt, chuta | Sim — playground mostra chunks recuperados |
| Bíblia é consultável por SQL estruturado | Só via lookup em JSON | Sim, + embedding conceitual |
| Sessões passadas do usuário viram memória | Não | (fase seguinte) — infra pronta |
| Custo por Aprofundar | 1 chamada LLM | 1 analyze + 1 embed + 1 chamada LLM (dobra latência, ~+10-20% custo) |
| Risco de degradação em produção | — | Zero (shadow mode) |

---

## 10. Uma coisa que eu manteria da poesia do GPT

§95 do documento dele:

> O modelo pode mudar. A biblioteca permanece.

Isso está exatamente certo. A infraestrutura de knowledge + retrieval é o único ativo que **não fica obsoleto** quando OpenAI lança GPT-6 ou quando você troca de provedor. Todo prompt, todo tuning, todo model choice de hoje vira legado. Uma biblioteca teológica bem curada e bem indexada segue valendo por anos.

Por isso vale começar. Só que começa pequeno, começa com o que já temos (Bíblia), e começa em shadow — não substituindo o que já funciona.
