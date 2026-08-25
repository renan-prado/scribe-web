# Scriba RAG — TODOs futuros

> Lista viva de tudo que foi conscientemente adiado da POC (Fases A-C) mas precisa acontecer eventualmente. Cada item tem um GATILHO — o sinal que indica "hora de fazer".
>
> Referência: `scriba-rag-knowledge-architecture.md` (GPT) e `scriba-rag-proposta-claude.md` (Claude).
>
> Se este documento crescer demais, quebrar em `todos-futuros/*.md` por tema.

---

## Como usar

- **Não** implemente nada daqui sem checar o gatilho.
- Ao concluir um item, mover para uma seção "Feito" no final (com data + PR/commit) em vez de deletar.
- Ao descobrir um TODO novo durante a POC, **adicione aqui imediatamente** — não confie na memória.
- Ao decidir que um item nunca vai acontecer, mover para "Descartado" com justificativa.

---

## 1. Biblioteca pessoal (auto-indexação de sessões)

**O que é**: indexar automaticamente cada `final_summary`, `session_deepening` e `session_feed_items.speakerHighlight` como fontes RAG do próprio usuário.

**Por que adiado**: quer validar retrieval sobre conteúdo externo antes de ligar auto-indexação (custo + volume). Também: qualidade do conteúdo pessoal depende da qualidade teológica de quem o usuário ouve — precisa ser CONTRAPESO ao conteúdo curado, não substituto.

**Gatilho**: Fases A-C concluídas + eval do Aprofundar V2 mostrando ganho consistente.

**TODOs**:
- [ ] Adicionar `source_type IN ('session_summary', 'session_deepening', 'session_highlight')` já no CHECK de `knowledge_sources` no PR 1 (deixa infra pronta, sem indexar).
- [ ] Hook em `createDeepening()` que enfileira indexação (não bloqueia resposta).
- [ ] Hook em `finalizeSession()` idem para `final_summary`.
- [ ] Migration adicionando `knowledge_sources.owner_user_id` (nullable — global se null, do usuário se preenchido).
- [ ] Atualizar RLS para: user vê seus próprios chunks + globais; admin vê tudo.
- [ ] Filtro no `match_knowledge` para escopo (`only_global | only_mine | both`).
- [ ] UI no admin/usuário: pesquisar "meus sermões passados sobre X".
- [ ] **Contrapeso teológico obrigatório**: no Aprofundar V2, garantir mistura mínima (ex: ≥50% dos chunks retornados vêm de fontes editoriais curadas, não do próprio corpus do usuário). Evita amplificação de teologia problemática se o pastor do usuário for ruim.
- [ ] Tracking de custo — cada auto-indexação vira linha em `llm_usage_events` com `route='embedding_autoindex'`.

---

## 2. RAG no Ao Vivo (`/api/bible`)

**O que é**: quando `/api/bible` emite `citedVerse` com book/chapter/verse resolvidos, fazer lookup estruturado (SQL, sem embedding) na biblioteca por comentário/contexto sobre aquela passagem, e emitir um card enriquecido no chunk seguinte.

**Por que adiado**: Ao Vivo é território estável — mexer é onde mais dá pra estragar UX. E só faz sentido quando a biblioteca tem conteúdo relevante (comentários bíblicos indexados por metadata).

**Gatilho**: biblioteca tem ≥1 comentário bíblico completo indexado por metadata + evals mostram que Aprofundar V2 ganha.

**TODOs**:
- [ ] Nova rota `/api/bible/context` (ou modificação do `/api/bible`) que faz lookup `WHERE metadata->>'bibleBook' = $1 AND (metadata->>'chapter')::int = $2 LIMIT 3`.
- [ ] Novo `feedItemKind`: `verseContext` (ou expandir `context` existente com metadata de origem).
- [ ] Dispatch em background após `citedVerse` emit — não bloqueia o feed.
- [ ] Rate limit próprio (max 1 context card por citedVerse por 60s).
- [ ] Regra visual: card claramente marcado como "contexto adicional", não "o pregador disse".
- [ ] Toggle no user profile: "trazer contexto adicional durante o Ao Vivo" (default: off até estabilizar).
- [ ] Documentar no `AGENTS.md` seção do bible pipeline.

---

## 3. Hybrid search (semantic + FTS + metadata)

**O que é**: combinar busca vetorial com full-text search do Postgres e filtros de metadata, com fusão de rankings.

**Por que adiado**: em muitos casos semantic-only + filtros de metadata é suficiente. Custo de complexidade só vale se identificarmos queries onde semantic erra.

**Gatilho**: playground mostra queries reais onde semantic top-10 não traz o chunk óbvio, mas keyword traria.

**TODOs**:
- [ ] Migration `alter table knowledge_chunks add column fts tsvector generated always as (to_tsvector('portuguese', content)) stored;`
- [ ] Índice GIN sobre `fts`.
- [ ] Nova função `match_knowledge_hybrid(query_text, query_embedding, ...)` com Reciprocal Rank Fusion.
- [ ] Playground: adicionar toggle `search_mode: semantic | keyword | hybrid`.
- [ ] Comparar as 3 modos side-by-side nas mesmas 20 queries de eval.

---

## 4. Reranking

**O que é**: buscar 30-50 candidatos e reordenar com um modelo (cross-encoder ou LLM barato) antes de mandar top 8-15 ao Aprofundar.

**Por que adiado**: pode ser desnecessário se top-K vetorial já ordena bem. Adiciona latência + custo.

**Gatilho**: eval mostra que "chunks certos estavam no top-30 mas não no top-10".

**TODOs**:
- [ ] Escolher estratégia: LLM rerank (mandar 30 chunks pra gpt-4o-mini + query, pedir top 10) vs. cross-encoder hospedado (mais complexo, mais barato em escala).
- [ ] Nova função `rerankChunks(chunks, query)`.
- [ ] Adicionar rerank como layer entre `searchKnowledge` e `deepening/v2`.
- [ ] Medir delta de qualidade vs. custo/latência.
- [ ] Toggle no playground.

---

## 5. Diversidade forçada e prioridade editorial

**O que é**: evitar que top-10 seja 10 chunks quase iguais do mesmo capítulo; permitir que fontes marcadas como "prioridade editorial" ganhem boost.

**Por que adiado**: otimização prematura sem dados que justifiquem.

**Gatilho**: eval mostra "os 10 resultados são úteis mas 8 vêm da mesma fonte" ou "a fonte X é reconhecidamente melhor mas afunda no rank".

**TODOs**:
- [ ] Coluna `priority: int 1-5` em `knowledge_sources`.
- [ ] Post-processing: max N chunks por source no top-K final.
- [ ] Boost multiplicador na similarity por prioridade (ex: `score * (1 + 0.05 * priority)`).
- [ ] UI no admin: campo prioridade no formulário.
- [ ] Documentar critérios: o que ganha priority 5? Autor confiável? Densidade doutrinária? Não deixar arbitrário.

---

## 6. Query rewriting explícito

**O que é**: transformar a query do usuário/sermão numa versão melhor pra embedding antes de buscar (ex: "o que isso significa" → "aplicações práticas da doutrina da providência em Romanos 8").

**Por que adiado**: o `analyzeSermon` do Aprofundar V2 já faz parte disso implicitamente (extrai tese/temas/passagens).

**Gatilho**: se implementarmos uma feature "perguntar à biblioteca" para o usuário final (fora do fluxo Aprofundar), aí precisamos.

**TODOs**:
- [ ] Só relevante quando existir UI de pergunta livre à biblioteca.

---

## 7. Metadata sugerida automaticamente (revisável)

**O que é**: ao cadastrar uma fonte editorial, LLM sugere temas, passagens bíblicas mencionadas, tradição. Admin revisa checkboxes.

**Por que adiado**: no início a curadoria é single-user (Renan) — mais rápido preencher manualmente. Vale automatizar quando o volume de novas fontes por semana justificar.

**Gatilho**: ≥5 novas fontes cadastradas por semana durante 2+ semanas.

**TODOs**:
- [ ] Endpoint `POST /api/admin/knowledge/suggest-metadata` que roda gpt-4o-mini sobre o conteúdo e retorna JSON `{ topics[], bibleRefs[], suggestedTradition, suggestedTags[] }`.
- [ ] UI: após colar conteúdo, botão "Sugerir metadata".
- [ ] Regra clara: sugestões vêm PRÉ-desmarcadas, humano confirma cada uma.

---

## 8. Reindexação em massa (script CLI, não UI)

**O que é**: quando trocarmos embedding model, chunker version, ou algoritmo de limpeza — precisa reindexar toda biblioteca sem quebrar rate limit.

**Por que adiado**: só precisa quando pela primeira vez formos mudar algo global.

**Gatilho**: primeira migração de embedding model OU primeira mudança de chunker que exija reprocessar tudo.

**TODOs**:
- [ ] Script `scripts/reindex-knowledge.ts` — args: `--source-type`, `--dry-run`, `--batch-size` (default 20), `--concurrency` (default 3).
- [ ] Backoff exponencial em 429 da OpenAI.
- [ ] Progress bar + resumo final (indexed / failed / skipped).
- [ ] Prompt de confirmação com estimativa de custo (`chunks * tokens_médios * $/1M`).
- [ ] Logar cada batch em `llm_usage_events` com `route='embedding_reindex'`.
- [ ] Estratégia de rollback: `embedding_model_previous` na row do source pra saber pra onde voltar se der ruim.

---

## 9. Coexistência de múltiplos embedding models

**O que é**: se algum dia quisermos experimentar `text-embedding-3-large` (3072 dims) sem apagar o corpus atual.

**Por que adiado**: enquanto for 1 modelo só, coluna `embedding vector(512)` basta.

**Gatilho**: querer rodar A/B entre modelos de embedding.

**TODOs**:
- [ ] Decidir estratégia:
  - **Opção A**: colunas paralelas (`embedding_512`, `embedding_1536`, `embedding_3072`) — simples mas rígido.
  - **Opção B**: tabela separada `knowledge_chunk_embeddings(chunk_id, model, dimensions, embedding)` — flexível, +1 join.
- [ ] `match_knowledge` recebe param `model` e filtra apenas chunks daquele modelo.
- [ ] Playground: dropdown "modelo de embedding".
- [ ] Comparar recall/precision em queries idênticas.

---

## 10. Índices vetoriais (HNSW / IVFFlat)

**O que é**: acelerar `match_knowledge` quando o scan sequencial ficar lento.

**Por que adiado**: com <20k chunks, scan sequencial é rápido (<20ms). Tuning de HNSW (m, ef_construction) sem dados reais é chute.

**Gatilho**: `select count(*) from knowledge_chunks > 20000` OU latência de `match_knowledge` p95 > 100ms.

**TODOs**:
- [ ] Medir latência baseline sem índice.
- [ ] Escolher HNSW (melhor recall, build lento) vs. IVFFlat (build rápido, precisa `lists`).
- [ ] `create index knowledge_chunks_embedding_idx on knowledge_chunks using hnsw (embedding vector_cosine_ops);`
- [ ] Rodar `ANALYZE`, medir de novo.
- [ ] Documentar quando reconstruir índice (após reindex em massa).

---

## 11. Fine-tuning do modelo generativo

**O que é**: treinar um modelo específico pro Scriba (estilo, disciplina de citações, estrutura de aprofundamento).

**Por que adiado**: sem 100+ exemplos avaliados como "excelente", fine-tuning não tem sinal. Prompt engineering + RAG resolvem 90%.

**Gatilho**: ≥200 aprofundamentos avaliados com nota + evidência de que o modelo erra CONSISTENTEMENTE de forma que prompt não conserta.

**TODOs**:
- [ ] Criar tabela `deepening_evaluations` (sessionId, variant, rubrica, nota, notas texto).
- [ ] Só considerar quando N ≥ 200.

---

## 12. Tradition/stance-aware retrieval

**O que é**: filtros de busca que respeitem tradição/vertente teológica do usuário ou do query (ex: usuário reformado prefere fontes reformadas em tópicos controversos).

**Por que adiado**: taxonomia complexa e polêmica; sem dados reais de queries pra saber se importa.

**Gatilho**: usuários reclamando de resultados enviesados em tópicos específicos (eleição, batismo, escatologia, dons).

**TODOs**:
- [ ] `knowledge_chunks.stance` (nullable) — só preencher em chunks sobre tópicos genuinamente controversos.
- [ ] Vocabulário controlado: `reformed | arminian | dispensationalist | covenantal | continuationist | cessationist | ...`.
- [ ] `user.tradition_preferences` (opt-in, JSON de weights).
- [ ] Post-processing no rank: balancear stance vs. relevância.
- [ ] Sempre mostrar disclaimers em tópicos com stance filtrada.

---

## 13. Observabilidade de retrieval (`knowledge_search_runs`)

**O que é**: log persistente de cada busca — query, embedding, filtros, chunks retornados, scores.

**Por que adiado**: enquanto o volume de retrieval é baixo, `llm_usage_events` + logs devLog cobrem. Fazer isso desde já é overhead sem retorno.

**Gatilho**: ≥100 buscas RAG por dia OU incidente onde precisamos reconstruir "por que essa resposta ficou ruim?" e faltou dado.

**TODOs**:
- [ ] Migration `knowledge_search_runs(id, at, query, query_embedding, filters, top_chunk_ids, top_scores, latency_ms, called_from)`.
- [ ] Wrapper em `searchKnowledge()` que loga async.
- [ ] Retenção limitada (30-90 dias) — não guardar embeddings indefinidamente.
- [ ] Dashboard admin: top queries, taxa de "chunks retornados vs. usados".

---

## 14. Biblioteca licenciada / parcerias editoriais

**O que é**: contratos com editoras (Vida Nova, Fiel, Cultura Cristã, Mundo Cristão etc.) pra indexar comentários e teologia contemporânea.

**Por que adiado**: sem POC provando valor, não faz sentido negociar. E o corpus de domínio público (Calvino, Owen, Spurgeon, Bavinck em domínio público em breve, catecismos, confissões) já dá bastante.

**Gatilho**: POC validada + demanda real de usuários por autores específicos.

**TODOs**:
- [ ] Levantar lista de obras de domínio público em pt-BR + inglês (CCEL, Monergismo, projetos abertos).
- [ ] Framework de contrato: escopo (só indexação interna, não distribuição), custo, remoção sob demanda.
- [ ] `knowledge_sources.license_agreement_id` (fk para tabela `license_agreements` com PDF anexo).
- [ ] Auditoria: relatório periódico de fontes indexadas por licença.

---

## 15. Bibliotecas temáticas como produto

**O que é**: expor "biblioteca reformada", "biblioteca patrística", "biblioteca pentecostal" como coleções vendáveis/segmentadas.

**Por que adiado**: 5 fases à frente do que temos hoje. Muito produto pra construir antes.

**Gatilho**: já ter ≥1000 chunks de qualidade em ≥3 tradições distintas + demanda comercial evidente.

**TODOs**:
- [ ] Modelagem: coleção vs. tag — decidir.
- [ ] Billing: coleção como add-on de assinatura.
- [ ] UI: seletor "quais bibliotecas o Scriba pode consultar pra mim".

---

## 16. Contaminação do Resumo (guardrail)

**O que é**: garantir que `/api/final-summary` NUNCA receba `FONTES DE APOIO` — o resumo tem que ficar 100% fiel à transcrição, não pode ser enriquecido.

**Por que adiado**: não é adiado, é uma REGRA a preservar. Registrado aqui pra não esquecer de codificar quando o RAG começar a virar componente reutilizável.

**Gatilho**: quando `lib/knowledge/search.ts` for compartilhado entre múltiplas rotas.

**TODOs**:
- [ ] Adicionar linha explícita no `AGENTS.md` (seção "Behaviour-preservation guardrails") proibindo RAG no `/api/final-summary`.
- [ ] Se algum dia criarmos abstração compartilhada, deixar comentário obvio: `// DO NOT call from final-summary route`.
- [ ] Idealmente, teste automatizado que grep-eia a rota do final-summary por importação de `searchKnowledge`.

---

## 17. Cost tracking de embeddings

**O que é**: incluir embeddings no `llm_usage_events` + `/admin/usage`.

**Por que adiado**: parcialmente já no PR 1 (ingest inicial), mas versão completa vem quando auto-indexação ligar.

**Gatilho**: qualquer feature que gere embeddings em runtime da rota do usuário (não só script CLI).

**TODOs**:
- [ ] Migration: `alter table llm_usage_events add column event_kind text default 'chat' check (event_kind in ('chat','embedding','transcribe'));`
- [ ] Atualizar `recordChatUsage` para não hardcodar `event_kind`.
- [ ] Novo helper `recordEmbeddingUsage(...)`.
- [ ] Adicionar preço de embedding em `lib/llm/pricing.ts`.
- [ ] Admin: `/admin/usage` filtra por `event_kind`.

---

## 18. Latência do Aprofundar V2

**O que é**: v1 hoje é 1 chamada LLM pesada (~30-60s). v2 adiciona 1 analyze + N queries de embedding + retrieval + LLM final. Pode virar 60-120s.

**Por que adiado**: só vira problema quando V2 for promovido. Enquanto for shadow, latência não importa.

**Gatilho**: promoção do V2 pra produção.

**TODOs**:
- [ ] Medir latência p50/p95 no shadow mode.
- [ ] Considerar streaming (SSE) — mas isso conflita com "single-shot JSON" atual do Aprofundar. Reprojeto grande.
- [ ] Considerar UX: skeleton com "buscando fontes teológicas..." em vez de spinner mudo.
- [ ] Paralelizar `analyzeSermon` + primeira query de embedding (só primeiro passage já dispara embed enquanto analyze roda).

---

## 19. Evals fixas (20-30 casos)

**O que é**: conjunto congelado de queries com "verdade" esperada, rodado a cada mudança de embedding/chunker/prompt/model.

**Por que adiado**: dá pra escrever casos manualmente cedo, mas rodar automatizado é overhead que só vale depois de N mudanças.

**Gatilho**: 3ª mudança que "melhora ou piora tudo" sem forma de saber qual.

**TODOs**:
- [ ] `evals/rag/*.jsonl` com queries + expected_source_ids ou expected_bible_refs.
- [ ] Script `npm run eval:rag` que roda e printa scorecard (precision@k, MRR).
- [ ] Documentar processo: "antes de mergear mudança em `lib/knowledge/`, rode eval e cole resultado no PR".
- [ ] Eventual: eval de generation (dado sermão + fontes, avalia qualidade da resposta) — mais caro, provavelmente LLM-as-judge.

---

## 20. UX/UI adicional do Admin

Muitas coisas do §92 do doc do GPT que caem em polish depois de PR 2:

**Gatilho**: após uso real do admin, priorizar por atrito observado.

**TODOs**:
- [ ] Filtros: status, tipo, autor, tradição, licença, livro bíblico.
- [ ] Paginação/busca por título quando >50 fontes.
- [ ] Bulk edit de tags.
- [ ] Preview de conteúdo com highlighting nas passagens bíblicas detectadas.
- [ ] Estatísticas globais: total chunks, total tokens indexados, custo estimado, breakdown por tipo.
- [ ] Export de source pra backup (JSON).
- [ ] Import em lote (upload de CSV/JSON de sources).

---

## 21. Perícope segmentation vs. janela fixa

**O que é**: chunking bíblico melhor que "5-10 versos consecutivos" — respeitar unidades retóricas reais (perícopes).

**Por que adiado**: janela fixa funciona bem o suficiente pra POC.

**Gatilho**: eval mostra que respostas do V2 têm cross-refs fragmentadas ou incompletas.

**TODOs**:
- [ ] Investigar se algum JSON de Bíblia no `lib/bibles/` preserva quebras de parágrafo original.
- [ ] Se sim: usar como sinal de boundary.
- [ ] Se não: importar delimitação externa (SBL, BibleGateway) ou aceitar heurística.
- [ ] Reindexar com `chunker_version = 'v2'`, comparar recall no eval set.

---

## 22. Delimitadores de qualidade / trust score

**O que é**: cada fonte tem `trust_score` explícito (não é a mesma coisa que priority editorial) baseado em critérios documentados.

**Por que adiado**: sem critérios definidos, `trust_score` vira ficção.

**Gatilho**: começar a receber submissões de fontes de terceiros (não só Renan curator).

**TODOs**:
- [ ] Rubrica escrita: o que define uma fonte confiável? Autor com formação? Peer-reviewed? Editora tradicional?
- [ ] Coluna `trust_score` + `trust_notes`.
- [ ] Regra: `trust_score < 3` → não aparece por default no retrieval, precisa opt-in.

---

## Descartado (nunca implementar)

*(Vazio por enquanto — mover coisas pra cá quando decidirmos NÃO fazer.)*

---

## Feito

*(Vazio por enquanto — mover coisas pra cá quando concluídas, com data + PR.)*
