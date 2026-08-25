# Scriba — Arquitetura de Conhecimento, RAG, Retrieval e Admin

> Documento consolidado das decisões, ideias e recomendações discutidas sobre como aumentar a profundidade e o valor dos conteúdos gerados pelo Scriba.
>
> Objetivo principal: fazer o Scriba deixar de depender apenas do conhecimento genérico do modelo e passar a consultar uma base de conhecimento teológico controlada, rastreável e progressivamente mais rica.

---

# 1. Contexto

O Scriba já possui três experiências que estão funcionando bem:

1. **Ao vivo** — acompanha a reflexão enquanto o áudio é gravado, identifica informações relevantes, referências, frases importantes e gera contexto durante a mensagem.
2. **Resumo** — recebe a gravação/transcrição e produz um documento organizado do sermão.
3. **Aprofundar** — pega um sermão já processado e produz uma camada adicional de estudo, conexões, contexto e aplicação.

A sensação atual é que essas experiências estão **boas, mas ainda não excelentes**.

O principal problema não parece ser simplesmente “usar um modelo mais inteligente”. O problema é que, quando o modelo recebe apenas a transcrição e instruções como “aprofunde”, “gere insights” ou “traga contexto”, ele tende a responder usando seu conhecimento geral.

Isso produz alguns sintomas:

- respostas corretas, mas genéricas;
- aplicações previsvisíveis;
- pouca profundidade histórica ou teológica;
- conexões bíblicas que poderiam ser melhores;
- pouca diferenciação entre uma resposta do Scriba e uma resposta de um chatbot genérico;
- dificuldade de saber de onde determinada afirmação veio;
- pouca capacidade de controlar a linha editorial e a qualidade das fontes utilizadas.

A oportunidade é criar uma **camada de conhecimento própria do Scriba**.

Em vez de depender apenas de:

```text
sermão
  ↓
modelo
  ↓
conteúdo gerado
```

passamos a ter:

```text
sermão
  ↓
análise
  ↓
busca na base do Scriba
  ↓
fontes relevantes
  ↓
sermão + fontes
  ↓
modelo
  ↓
conteúdo mais profundo
```

Essa arquitetura é normalmente chamada de **RAG — Retrieval-Augmented Generation**.

---

# 2. Princípio central: não começar treinando um modelo com livros

Uma ideia inicial foi comprar bons livros e “treinar” um modelo com eles.

Essa não deve ser a primeira abordagem.

Existem dois problemas diferentes que às vezes são confundidos:

## 2.1. Ensinar comportamento ao modelo

Exemplos:

- sempre produzir determinado formato;
- identificar melhor tese e argumentação;
- escrever aplicações menos genéricas;
- obedecer uma estrutura editorial específica;
- classificar determinadas informações de uma forma consistente;
- responder em determinado estilo.

Aqui **fine-tuning** pode fazer sentido no futuro.

## 2.2. Dar conhecimento ao modelo

Exemplos:

- consultar um comentário de Romanos;
- trazer uma definição teológica específica;
- comparar diferentes interpretações;
- buscar contexto histórico;
- consultar um livro de teologia sistemática;
- recuperar o que uma igreja ensinou anteriormente sobre determinado assunto.

Aqui, normalmente, faz mais sentido usar **retrieval/RAG**.

A diferença é importante.

Com fine-tuning, você tenta alterar o comportamento aprendido do modelo.

Com RAG, o modelo continua sendo o mesmo, mas passa a receber as fontes necessárias antes de responder.

---

# 3. A ideia mais importante: “mais profundo” não significa necessariamente “modelo maior”

O salto de qualidade do Scriba provavelmente virá de uma combinação de:

```text
contexto melhor
+
fontes melhores
+
retrieval melhor
+
prompt melhor
+
processo de análise melhor
+
modelo adequado
```

Não apenas de:

```text
modelo mais caro
```

É perfeitamente possível que um modelo mais barato, recebendo excelentes fontes recuperadas pelo RAG, produza um resultado mais útil do que um modelo mais caro trabalhando apenas com a transcrição.

Uma divisão de esforço razoável neste estágio seria aproximadamente:

```text
70% — base de conhecimento + retrieval + organização
20% — prompts + pipeline + avaliações
10% — escolha e comparação de modelos
```

Esses percentuais não são regras rígidas. Eles representam a prioridade sugerida.

---

# 4. Como pensar no RAG de forma simples

RAG significa:

**Retrieval-Augmented Generation**

Em português:

**geração aumentada por recuperação de informação**.

Na prática, é muito menos misterioso do que parece.

O RAG pode ser entendido como:

```text
busca + prompt
```

Hoje o Scriba poderia fazer:

```text
TRANSCRIÇÃO
    ↓
   GPT
    ↓
APROFUNDAMENTO
```

Com RAG:

```text
TRANSCRIÇÃO
    ↓
identifica temas e passagens
    ↓
pesquisa a biblioteca
    ↓
encontra trechos relevantes
    ↓
TRANSCRIÇÃO + TRECHOS ENCONTRADOS
    ↓
modelo
    ↓
APROFUNDAMENTO
```

O modelo não “aprende permanentemente” os livros.

Antes de cada resposta, o backend encontra o material relevante e coloca esse conteúdo dentro do contexto enviado ao modelo.

---

# 5. O papel dos embeddings

Para construir uma busca semântica, precisamos representar o significado de um texto de uma forma pesquisável.

É aí que entram os **embeddings**.

Imagine três textos:

```text
A:
Deus governa soberanamente todas as coisas.

B:
A providência divina significa que Deus sustenta
e dirige sua criação.

C:
Paulo realizou grandes viagens missionárias.
```

Agora alguém pesquisa:

```text
soberania de Deus sobre os acontecimentos
```

Uma busca tradicional por palavras talvez encontre A, mas pode ter dificuldade com B, mesmo que B seja conceitualmente muito relacionado.

Um modelo de embeddings transforma um texto em uma lista de números:

```text
"A providência de Deus..."

↓

[
  0.0281,
  -0.0123,
  0.0944,
  -0.0321,
  ...
]
```

Esses números representam matematicamente aspectos do significado do texto.

Textos semanticamente parecidos tendem a ficar próximos no espaço vetorial.

Conceitualmente:

```text
                       C • viagens de Paulo


       A • soberania
        \
         • B providência
```

Assim, quando uma nova pergunta é transformada em embedding, podemos procurar os textos cujos embeddings estão mais próximos.

---

# 6. Embedding não é um modelo que responde perguntas

Essa distinção é importante.

Um modelo de embedding recebe:

```text
texto
```

E devolve:

```text
vetor de números
```

Ele não produz um parágrafo, resumo ou estudo.

Exemplo de modelo que pode ser utilizado:

```text
text-embedding-3-small
```

No momento em que este documento foi produzido, a documentação da OpenAI listava o `text-embedding-3-small` a US$ 0,02 por 1 milhão de tokens de entrada. Esse preço deve ser sempre conferido novamente antes de qualquer decisão financeira, porque preços de API podem mudar.

Os modelos `text-embedding-3` também permitem reduzir a quantidade de dimensões geradas. Para uma POC, **512 dimensões** é uma escolha simples e adequada.

---

# 7. Regra fundamental dos embeddings

Todos os conteúdos que serão comparados precisam utilizar o **mesmo modelo e a mesma configuração de embedding**.

Por exemplo:

```text
knowledge chunk
   ↓
text-embedding-3-small / 512 dimensões
```

E depois:

```text
query
   ↓
text-embedding-3-small / 512 dimensões
```

Não faz sentido gerar os conteúdos com um modelo e as consultas com outro modelo incompatível.

Embeddings produzidos por modelos diferentes não pertencem ao mesmo espaço vetorial e não devem ser comparados como se fossem equivalentes.

---

# 8. O papel do Supabase e do pgvector

O Scriba já usa Supabase, então não existe necessidade, neste momento, de introduzir outra infraestrutura como:

- Pinecone;
- Weaviate;
- Qdrant;
- Elasticsearch;
- LangChain;
- LlamaIndex.

Essas ferramentas podem ter utilidade futuramente, mas não são necessárias para provar a ideia.

O Supabase utiliza PostgreSQL e pode utilizar a extensão **pgvector**.

O pgvector permite:

- armazenar vetores;
- comparar vetores;
- pesquisar vetores semelhantes;
- criar índices vetoriais;
- combinar dados relacionais com busca semântica.

A stack inicial pode ser simplesmente:

```text
Next.js
   ↓
OpenAI Embeddings
   ↓
Supabase/PostgreSQL
   ↓
pgvector
   ↓
modelo generativo
```

---

# 9. Ativando o pgvector no Supabase

No SQL Editor do Supabase:

```sql
create extension if not exists vector
with schema extensions;
```

Depois disso, o PostgreSQL consegue utilizar colunas do tipo `vector`.

Exemplo:

```sql
embedding extensions.vector(512)
```

O tamanho precisa corresponder à quantidade de dimensões produzidas pelo modelo de embedding utilizado.

---

# 10. Não salvar um livro inteiro em uma única linha

Uma base de RAG não deve ter algo como:

```text
linha 1 = livro inteiro de 400 páginas
```

O documento precisa ser dividido em partes menores chamadas de **chunks**.

Imagine um material:

```text
Teologia Sistemática

Capítulo: Providência

1. Definição de providência
2. Preservação
3. Governo
4. O problema do mal
```

Ele poderia virar:

```text
CHUNK 1

Fonte: Teologia Sistemática
Capítulo: Providência
Seção: Definição

"A providência divina pode ser definida como..."
```

```text
CHUNK 2

Fonte: Teologia Sistemática
Capítulo: Providência
Seção: Preservação

"A preservação significa..."
```

```text
CHUNK 3

Fonte: Teologia Sistemática
Capítulo: Providência
Seção: Governo

"O governo de Deus significa..."
```

```text
CHUNK 4

Fonte: Teologia Sistemática
Capítulo: Providência
Seção: O problema do mal

"A relação entre soberania divina e o mal..."
```

Cada chunk recebe seu próprio embedding.

---

# 11. Não fazer chunking apenas por quantidade fixa de tokens

Uma primeira implementação poderia simplesmente quebrar conteúdos a cada 800 tokens com 100 tokens de sobreposição.

Isso funciona para uma POC.

Mas o Scriba pode fazer algo melhor por causa da natureza do conteúdo teológico.

Em vez de apenas:

```text
texto
↓
800 tokens
↓
800 tokens
↓
800 tokens
```

é melhor, quando possível, respeitar a estrutura do conteúdo:

```text
Obra
  ↓
Capítulo
  ↓
Seção
  ↓
Subseção
  ↓
Trecho
```

Por exemplo, em um comentário bíblico:

```text
Romanos
  ↓
Romanos 8
  ↓
Romanos 8:28-30
  ↓
Providência
Predestinação
Sofrimento
Soberania
```

Em teologia sistemática:

```text
Soteriologia
  ↓
Justificação
  ↓
Definição
Base bíblica
Controvérsias
Implicações
```

Esse tipo de chunking preserva melhor as unidades conceituais.

---

# 12. Separar documento original e chunks

A recomendação é não colocar tudo em uma única tabela.

Use pelo menos duas entidades principais:

```text
knowledge_sources
knowledge_chunks
```

## 12.1. knowledge_sources

Representa o conteúdo original gerenciado pelo admin.

Exemplo:

```ts
type KnowledgeSource = {
  id: string

  title: string
  author?: string
  publisher?: string

  type: KnowledgeSourceType

  content: string

  status:
    | 'draft'
    | 'processing'
    | 'indexed'
    | 'failed'

  createdAt: Date
  updatedAt: Date
}
```

## 12.2. knowledge_chunks

Representa as unidades utilizadas pelo retrieval.

Exemplo:

```ts
type KnowledgeChunk = {
  id: string
  sourceId: string

  content: string
  embedding: number[]

  metadata: {
    section?: string
    topics?: string[]

    bibleBook?: string
    chapter?: number
    verseStart?: number
    verseEnd?: number

    tradition?: string
  }
}
```

O administrador gerencia principalmente:

```text
knowledge_sources
```

Enquanto o RAG pesquisa principalmente:

```text
knowledge_chunks
```

---

# 13. Modelo de dados sugerido para uma primeira versão

Uma estrutura SQL possível:

```sql
create table knowledge_sources (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  author text,
  publisher text,
  source_type text not null,

  content text not null,

  tradition text,

  status text not null default 'draft',
  error_message text,

  embedding_model text,
  embedding_dimensions integer,

  indexed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Chunks:

```sql
create table knowledge_chunks (
  id bigint primary key generated always as identity,

  source_id uuid not null
    references knowledge_sources(id)
    on delete cascade,

  chunk_index integer not null,

  content text not null,

  section text,
  metadata jsonb not null default '{}'::jsonb,

  embedding extensions.vector(512),

  created_at timestamptz not null default now()
);
```

Para uma futura busca híbrida, também pode existir uma coluna de full-text search:

```sql
alter table knowledge_chunks
add column fts tsvector
generated always as (
  to_tsvector('portuguese', content)
) stored;
```

E um índice:

```sql
create index knowledge_chunks_fts_idx
on knowledge_chunks
using gin (fts);
```

---

# 14. Índice vetorial

Em uma POC pequena, até uma busca sequencial pode funcionar.

Quando a quantidade de chunks crescer, faz sentido criar um índice vetorial.

O Supabase atualmente recomenda HNSW como uma boa opção geral para pgvector.

Se a busca utilizar distância de cosseno:

```sql
create index knowledge_chunks_embedding_idx
on knowledge_chunks
using hnsw (embedding vector_cosine_ops);
```

O operador de distância precisa ser compatível com o tipo de índice criado.

---

# 15. O fluxo de indexação

Dentro do Scriba, indexar significa:

```text
conteúdo original
   ↓
salvar knowledge_source
   ↓
normalizar texto
   ↓
quebrar em chunks
   ↓
gerar embedding de cada chunk
   ↓
salvar knowledge_chunks
   ↓
status = indexed
```

Mais detalhadamente:

```text
Usuário salva conteúdo no Admin
        ↓
knowledge_sources.status = processing
        ↓
chunkKnowledgeSource()
        ↓
para cada chunk:
    gerar embedding
        ↓
inserir knowledge_chunks
        ↓
se tudo funcionar:
    status = indexed
    indexed_at = now()
        ↓
se algo falhar:
    status = failed
    error_message = ...
```

---

# 16. Exemplo de geração de embedding

No backend:

```ts
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function createEmbedding(input: string) {
  const result = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input,
    dimensions: 512
  })

  return result.data[0].embedding
}
```

Uso:

```ts
const embedding = await createEmbedding(chunk.content)
```

Depois:

```ts
await supabase
  .from('knowledge_chunks')
  .insert({
    source_id: source.id,
    chunk_index: index,
    content: chunk.content,
    section: chunk.section,
    metadata: chunk.metadata,
    embedding
  })
```

---

# 17. O retrieval na prática

Imagine que o Scriba precise investigar:

```text
relação entre sofrimento humano,
soberania de Deus e providência
```

Primeiro geramos o embedding da consulta:

```ts
const queryEmbedding = await createEmbedding(`
  relação entre sofrimento humano,
  soberania de Deus e providência
`)
```

Depois consultamos o PostgreSQL procurando os vetores mais próximos.

---

# 18. Função de busca semântica no PostgreSQL

Uma versão simples:

```sql
create or replace function match_knowledge(
  query_embedding extensions.vector(512),
  match_count int default 10
)
returns table (
  id bigint,
  source_id uuid,
  content text,
  section text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    kc.id,
    kc.source_id,
    kc.content,
    kc.section,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  where kc.embedding is not null
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;
```

O operador:

```text
<=>
```

representa distância de cosseno no pgvector.

Como estamos usando distância, valores menores representam itens mais próximos.

A expressão:

```sql
1 - distance
```

é uma forma conveniente de exibir algo que pode ser interpretado como um score de similaridade.

---

# 19. Chamando o retrieval pelo Supabase

No Next.js:

```ts
const { data, error } = await supabase.rpc('match_knowledge', {
  query_embedding: queryEmbedding,
  match_count: 10
})
```

Resultado conceitual:

```ts
[
  {
    section: 'Providência e sofrimento',
    similarity: 0.89,
    content: 'A providência de Deus não significa...'
  },
  {
    section: 'Soberania divina',
    similarity: 0.84,
    content: 'Quando falamos do governo soberano...'
  },
  {
    section: 'Romanos 8:28',
    similarity: 0.81,
    content: 'Paulo situa Romanos 8:28 dentro...'
  }
]
```

Isso já é **retrieval**.

Nenhum modelo generativo precisou responder ainda.

---

# 20. A etapa de geração: finalmente o RAG

Depois de recuperar os trechos relevantes, montamos o contexto.

```ts
const sources = matches
  .map((item, index) => `
FONTE ${index + 1}
${item.sourceTitle}
${item.section}

${item.content}
`)
  .join('\n\n')
```

E mandamos para o modelo junto com o sermão.

Conceitualmente:

```text
Você está aprofundando um sermão.

SERMÃO:
{transcrição}

FONTES DE APOIO:
{trechos recuperados}

Use o sermão como fonte do que foi efetivamente pregado.
Use as fontes de apoio para enriquecer o estudo.
Não atribua ao pregador ideias presentes apenas nas fontes externas.
Indique claramente quando uma informação vier das fontes de apoio.
```

Esse último ponto é fundamental para o Scriba.

O conteúdo externo **não pode alterar retroativamente o que o pregador disse**.

---

# 21. A transcrição continua sendo a fonte de verdade

Esse princípio já existe no manifesto original do Scriba e deve continuar valendo.

```text
Áudio
 ↓
Transcrição
 ↓
Conteúdos derivados
```

O resumo deve representar o sermão.

O RAG não deve “corrigir” o sermão silenciosamente ou fazer parecer que o pregador afirmou coisas que só estavam nas fontes externas.

Por isso é útil pensar em duas camadas:

```text
CAMADA 1
O que foi pregado

CAMADA 2
Conhecimento adicional do Scriba
```

Essa distinção protege a fidelidade do produto.

---

# 22. RAG diferente para cada experiência do Scriba

Não é recomendável que Ao vivo, Resumo e Aprofundar utilizem exatamente o mesmo pipeline.

Cada experiência possui objetivos, orçamento de latência e riscos diferentes.

---

# 23. Ao vivo

O Ao vivo precisa priorizar:

- velocidade;
- baixa latência;
- baixo custo;
- contextualização imediata;
- pouca distração;
- alta confiança nas informações apresentadas.

Aqui o RAG deve ser mais restrito.

Exemplo:

```text
chunk/transcrição recente
   ↓
detectar passagem bíblica
   ↓
buscar contexto bíblico estruturado
   ↓
gerar um pequeno insight
```

Se o pregador menciona:

```text
Romanos 8:28
```

pode fazer sentido recuperar:

- contexto de Romanos 8;
- posição do verso dentro do argumento;
- referências diretamente relacionadas;
- uma pequena nota editorial;
- materiais pré-selecionados.

Não faz sentido procurar dezenas de livros a cada poucos segundos.

O RAG do Ao vivo deve ser **rápido e limitado**.

---

# 24. Resumo

O Resumo deve continuar baseado quase totalmente no sermão.

Aqui existe um risco grande de o retrieval externo contaminar o resultado.

O objetivo do resumo é responder:

```text
O que foi ensinado neste sermão?
```

Não:

```text
O que uma biblioteca teológica inteira diria sobre o assunto?
```

Então, para o Resumo:

```text
transcrição
+
estrutura interna do sermão
+
validação de referências
```

já deve ser suficiente na maior parte dos casos.

O retrieval externo pode ser usado para pequenas verificações ou enriquecimentos explicitamente separados, mas não para reescrever o argumento do pregador.

---

# 25. Aprofundar

O **Aprofundar** é o lugar ideal para utilizar toda a potência do RAG.

A sequência pode ser algo como:

```text
sermão completo
   ↓
analisar tese central
   ↓
identificar principais movimentos
   ↓
identificar passagens fundamentais
   ↓
identificar temas teológicos
   ↓
gerar consultas de pesquisa
   ↓
retrieval
   ↓
30–50 chunks candidatos
   ↓
deduplicação
   ↓
reranking
   ↓
8–15 melhores fontes
   ↓
modelo generativo
   ↓
aprofundamento
   ↓
verificação final
```

Essa experiência pode se tornar uma das maiores diferenciações do produto.

O resultado deixa de parecer:

```text
ChatGPT resumindo o sermão
```

E passa a parecer:

```text
uma ferramenta de estudo construída em torno daquele sermão
```

---

# 26. Analisar o sermão antes de buscar

É melhor não jogar toda a transcrição diretamente em uma única consulta semântica.

Primeiro, um modelo pode produzir algo estruturado:

```json
{
  "thesis": "Deus utiliza o sofrimento para conformar o crente à imagem de Cristo",
  "passages": [
    "Romans 8:28-30"
  ],
  "topics": [
    "suffering",
    "providence",
    "sanctification",
    "conformity to Christ"
  ]
}
```

Depois podemos transformar isso em várias buscas:

```text
Romanos 8:28-30 sofrimento

providência de Deus no sofrimento

sofrimento e santificação

conformidade à imagem de Cristo
```

Cada query recupera candidatos diferentes.

Depois:

```text
resultados de query A
+
resultados de query B
+
resultados de query C
+
resultados de query D
   ↓
deduplicar
   ↓
rerankear
```

Isso tende a ser melhor do que fazer uma única busca genérica.

---

# 27. Reranking

O retrieval inicial serve para encontrar bons candidatos.

Mas o resultado vetorial nem sempre produz a ordem perfeita.

Por isso, em uma versão mais madura:

```text
busca vetorial
   ↓
30 candidatos
   ↓
reranker
   ↓
10 melhores
```

O reranking pode considerar:

- proximidade semântica;
- correspondência exata de passagem bíblica;
- correspondência de tema;
- tipo de fonte;
- prioridade editorial;
- qualidade da fonte;
- recência, quando relevante;
- diversidade de fontes;
- tradição teológica;
- duplicidade de conteúdo.

Na POC, isso pode esperar.

---

# 28. Busca semântica não deve ser a única busca

Para o Scriba, uma busca puramente vetorial provavelmente não será suficiente no longo prazo.

Existem dois tipos de consulta comuns.

## 28.1. Consulta conceitual

```text
graça e obras
```

```text
soberania de Deus no sofrimento
```

```text
união com Cristo
```

Aqui a busca semântica é excelente.

## 28.2. Consulta exata

```text
Romanos 8:28
```

```text
Efésios 2:8-10
```

```text
justificação
```

Aqui keyword search, filtros e metadados estruturados podem ser mais precisos.

---

# 29. Busca híbrida

A recomendação futura é combinar:

```text
semantic search
+
keyword search
+
metadados
+
reranking
```

O próprio Supabase possui documentação para **hybrid search**, combinando full-text search do PostgreSQL com pgvector.

Uma arquitetura possível:

```text
QUERY
   ↓
┌───────────────┬─────────────────┐
│               │                 │
▼               ▼                 ▼
semantic     keyword          metadata
search       search           filters
│               │                 │
└───────────────┴─────────────────┘
                ↓
             fusion
                ↓
            ranking
                ↓
             results
```

---

# 30. Metadados teológicos são uma vantagem do Scriba

Uma base genérica normalmente guarda apenas:

```text
texto
embedding
```

O Scriba pode fazer melhor.

Exemplo:

```ts
type KnowledgeChunk = {
  id: number

  content: string

  sourceTitle: string
  author?: string
  publisher?: string

  type:
    | 'bible'
    | 'commentary'
    | 'systematic_theology'
    | 'article'
    | 'book'
    | 'sermon'
    | 'editorial'

  bibleBook?: string
  chapter?: number
  verseStart?: number
  verseEnd?: number

  topics?: string[]

  tradition?: string

  embedding: number[]
}
```

Isso abre possibilidades muito superiores a uma busca vetorial pura.

---

# 31. Exemplo de retrieval usando passagem bíblica

Se o sermão está tratando de:

```text
Efésios 2:1-10
```

O sistema pode primeiro filtrar:

```text
book = Ephesians
chapter = 2
```

E depois calcular similaridade semântica dentro desse subconjunto.

Conceitualmente:

```text
filtro bíblico
+
semantic similarity
```

Isso tende a ser mais preciso que:

```text
semantic search("graça")
```

sozinho.

---

# 32. Tipos de conteúdo para a biblioteca do Scriba

A base pode ser dividida em camadas.

## 32.1. Bíblia

- texto bíblico;
- livros;
- capítulos;
- versículos;
- contexto imediato;
- referências cruzadas.

## 32.2. Referência bíblica

- autoria;
- datação;
- contexto histórico;
- gênero literário;
- estrutura do livro;
- contexto cultural;
- geografia quando relevante.

## 32.3. Teologia

- definições;
- doutrinas;
- distinções;
- posições;
- argumentos;
- controvérsias.

## 32.4. Comentários

- comentário por livro;
- capítulo;
- perícope;
- verso;
- análise exegética.

## 32.5. Obras

- livros licenciados;
- artigos;
- ensaios;
- materiais editoriais.

## 32.6. Sermões

- sermões do próprio usuário;
- sermões anteriores de uma igreja;
- séries;
- EBDs;
- congressos;
- conferências.

## 32.7. Editorial do Scriba

Conteúdo escrito ou revisado diretamente para o produto.

Essa camada pode ser especialmente útil no início porque permite controlar qualidade, linguagem e extensão.

---

# 33. Teologia exige consciência de tradição e divergência

Uma base teológica não deve apresentar todas as interpretações como se fossem consenso universal.

Por isso faz sentido ter metadados como:

```text
tradition: reformada
```

```text
tradition: arminiana
```

```text
tradition: batista
```

```text
tradition: pentecostal
```

ou categorias mais específicas conforme o produto evoluir.

O modelo pode receber instruções como:

```text
Quando houver posições teológicas distintas,
identifique a perspectiva da fonte em vez de
apresentá-la automaticamente como consenso.
```

Isso é especialmente importante para temas como:

- eleição;
- predestinação;
- dons espirituais;
- batismo;
- escatologia;
- sacramentos/ordenanças;
- governo da igreja;
- perseverança;
- liberdade humana.

---

# 34. Livros continuam sendo extremamente valiosos

A recomendação não é “não usar livros”.

É mudar a maneira de utilizá-los.

Em vez de:

```text
comprar livro
↓
treinar modelo
```

pensar em:

```text
obter conteúdo com direito de uso
↓
estruturar
↓
chunking
↓
metadata
↓
embedding
↓
indexar
↓
Scriba consulta quando necessário
```

Isso torna a fonte:

- atualizável;
- removível;
- rastreável;
- pesquisável;
- filtrável;
- citável;
- versionável.

---

# 35. Atenção a direitos autorais

Comprar um exemplar de um livro não significa automaticamente possuir o direito de:

- copiar todo o conteúdo para uma base comercial;
- distribuir o conteúdo;
- disponibilizá-lo para usuários;
- usar o texto de qualquer forma em um produto comercial.

Antes de utilizar obras modernas integralmente, o Scriba deve avaliar licenças e direitos de uso.

Uma estratégia inicial mais segura é utilizar:

- domínio público;
- conteúdo explicitamente licenciado;
- materiais próprios;
- conteúdo editorial criado para o Scriba;
- parcerias com autores/editoras;
- pequenos experimentos privados somente quando juridicamente adequados.

Esse assunto deve ser tratado seriamente antes de construir uma biblioteca comercial baseada em obras protegidas.

---

# 36. Possível oportunidade futura: bibliotecas teológicas

Essa arquitetura pode deixar de ser apenas infraestrutura interna e virar produto.

Exemplo:

```text
Biblioteca básica do Scriba
Bíblia + materiais públicos + conteúdo editorial
```

```text
Biblioteca de determinada tradição
```

```text
Biblioteca de comentários bíblicos
```

```text
Coleção licenciada da Editora X
```

Isso pode criar oportunidades de parceria com editoras e autores.

O usuário poderia saber claramente quais bibliotecas alimentaram uma resposta.

---

# 37. O `/admin` como CMS da inteligência do Scriba

Uma das melhores ideias discutidas foi aproveitar o `/admin` já existente no Scriba e criar ali uma área de gestão da base de conhecimento.

Isso transforma o admin em algo maior que apenas um painel administrativo.

Ele passa a ser o **CMS da inteligência do produto**.

Estrutura sugerida:

```text
/admin

Overview

Knowledge
  ├── Conteúdos
  ├── Novo conteúdo
  ├── Playground
  └── Configurações

Sermões
Usuários
Planos
...
```

---

# 38. `/admin/knowledge`

Essa tela lista as fontes cadastradas.

Exemplo:

```text
Conhecimento

[ + Novo conteúdo ]               [ Playground ]

Título                    Tipo          Status       Chunks
Providência de Deus       Teologia      Indexado     18
Romanos 8                 Comentário    Indexado     27
Justificação pela fé      Artigo        Processando  -
União com Cristo          Editorial     Rascunho      -
```

Filtros possíveis no futuro:

- status;
- tipo;
- autor;
- tradição;
- livro bíblico;
- tema;
- origem;
- licença.

---

# 39. Cadastro de conteúdo

Uma primeira versão pode ter:

```text
Título
Autor
Fonte/Editora
Tipo
Tradição

Conteúdo
[ textarea / markdown ]

Temas

Passagens relacionadas

[ Salvar rascunho ]
[ Salvar e indexar ]
```

Tipos:

```text
Comentário bíblico
Teologia sistemática
Artigo
Livro
Conteúdo editorial
Bíblia
Sermão
```

Ao clicar em:

```text
Salvar e indexar
```

acontece:

```text
salvar source
↓
status processing
↓
chunking
↓
embeddings
↓
salvar chunks
↓
status indexed
```

---

# 40. Status de indexação

É útil trabalhar com estados explícitos:

```ts
type KnowledgeStatus =
  | 'draft'
  | 'processing'
  | 'indexed'
  | 'failed'
```

Na interface:

```text
Romanos 8
✓ Indexado
```

```text
Providência
⟳ Processando
```

```text
Justificação
⚠ Falha ao gerar embeddings

[ Tentar novamente ]
```

---

# 41. Página de detalhes de uma fonte

Exemplo:

```text
/admin/knowledge/{id}
```

Tabs possíveis:

```text
Conteúdo | Chunks | Metadados | Indexação
```

## Conteúdo

Texto original.

## Chunks

Visualização de como o sistema dividiu o documento.

## Metadados

Temas, passagens, tradição, autor etc.

## Indexação

Modelo de embedding, dimensões, data de indexação, versão do chunker e possíveis erros.

---

# 42. Visualização dos chunks

Essa tela é importante para depuração.

Exemplo:

```text
Chunk 01
245 tokens

Seção: Definição

"A providência de Deus pode ser definida..."

Embedding
✓ Gerado
```

```text
Chunk 02
318 tokens

Seção: Preservação

"A preservação significa..."
```

```text
Chunk 03
276 tokens

Seção: Governo

"O governo divino..."
```

Não existe necessidade de exibir os 512 números do embedding no uso normal.

Basta mostrar informações como:

```text
Embedding
✓ Gerado

Modelo
text-embedding-3-small

Dimensões
512

Gerado em
25/08/2026 04:32
```

---

# 43. Reindexação

Essa funcionalidade deve ser planejada desde cedo.

Porque no futuro o Scriba pode mudar:

- estratégia de chunking;
- tamanho máximo de chunk;
- overlap;
- metadados;
- modelo de embeddings;
- quantidade de dimensões;
- algoritmo de limpeza de texto.

Então cada fonte deveria ter:

```text
[ Reindexar conteúdo ]
```

Fluxo:

```text
source
↓
status processing
↓
remover chunks antigos
↓
chunk novamente
↓
gerar novos embeddings
↓
salvar
↓
status indexed
```

Mais tarde pode existir:

```text
[ Reindexar toda a biblioteca ]
```

Isso deve exigir cuidado porque pode gerar custo e processamento significativo.

---

# 44. Versionar a estratégia de indexação

Uma melhoria útil é guardar algo como:

```text
embedding_model
embedding_dimensions
chunker_version
indexed_at
```

Assim fica possível saber:

```text
Este conteúdo foi indexado com qual configuração?
```

Exemplo:

```json
{
  "embedding_model": "text-embedding-3-small",
  "embedding_dimensions": 512,
  "chunker_version": "v1",
  "indexed_at": "2026-08-25T04:32:00-03:00"
}
```

---

# 45. Metadados automáticos, mas revisáveis

Não é recomendável automatizar tudo de uma vez.

Existe uma tentação de fazer:

```text
conteúdo
↓
modelo descobre autor
↓
modelo descobre temas
↓
modelo descobre passagens
↓
modelo classifica tradição
↓
modelo publica automaticamente
```

Isso pode gerar uma base silenciosamente errada.

Uma abordagem melhor é permitir sugestões automáticas revisáveis.

Exemplo:

```text
Temas sugeridos

[x] Providência
[x] Soberania
[x] Sofrimento
[ ] Santificação

[ Confirmar ]
```

Ou:

```text
Passagens detectadas

[x] Romanos 8:28-30
[x] Gênesis 50:20
[ ] Tiago 1:2-4
```

---

# 46. O playground de retrieval

Uma das partes mais importantes do `/admin` deve ser:

```text
/admin/knowledge/playground
```

Ele serve para testar o “cérebro” do Scriba sem envolver toda a experiência de um sermão.

Tela inicial:

```text
Testar retrieval

Consulta
┌──────────────────────────────────────────┐
│ sofrimento e soberania de Deus           │
└──────────────────────────────────────────┘

Resultados: 10

[ Buscar ]
```

---

# 47. Resultado do playground

```text
#1 Similaridade 0.87

Providência de Deus
Seção: Governo divino

"Embora criaturas ajam de acordo com..."

---------------------------------

#2 Similaridade 0.82

Romanos 8
Seção: Sofrimento e glória

"O contexto da afirmação de Paulo..."

---------------------------------

#3 Similaridade 0.79

O problema do mal
...
```

Informações úteis por resultado:

- posição;
- similarity score;
- título da fonte;
- autor;
- seção;
- conteúdo do chunk;
- metadados;
- passagem bíblica;
- temas;
- tradição;
- ID do chunk.

---

# 48. Por que o playground é essencial

Sem o playground, você olha apenas para a resposta final.

Se ela estiver ruim, não sabe se o problema foi:

```text
retrieval ruim
```

ou:

```text
fontes boas + geração ruim
```

Com o playground, você consegue separar as etapas.

Primeira pergunta:

```text
Minha biblioteca encontrou os trechos certos?
```

Segunda pergunta:

```text
Dado que os trechos estavam certos,
o modelo conseguiu usá-los bem?
```

Esse isolamento facilita muito a evolução do produto.

---

# 49. Botão “Gerar resposta com estes resultados”

Depois da busca, o playground pode ter:

```text
[ Gerar resposta com estes resultados ]
```

Fluxo:

```text
QUERY
↓
retrieval
↓
Fonte A
Fonte B
Fonte C
Fonte D
↓
[ Gerar resposta ]
↓
modelo
↓
resposta
```

Assim o admin vira uma verdadeira **bancada de testes da inteligência do Scriba**.

---

# 50. Configurações que o playground pode permitir no futuro

```text
Search mode
[ semantic ]
[ keyword ]
[ hybrid ]

Top K
10

Threshold
nenhum

Tipo de fonte
Todos

Tradição
Todas

Livro bíblico
Todos
```

Depois:

```text
Prompt
Modelo generativo
Quantidade de fontes enviadas
Reranking
```

Isso permite experimentar o pipeline sem alterar o produto principal.

---

# 51. Não começar com threshold fixo

É comum encontrar exemplos como:

```text
match_threshold = 0.8
```

Mas, no começo, não sabemos qual score representa um bom resultado para a biblioteca do Scriba.

Uma melhor estratégia inicial:

```text
retornar top 10
```

E inspecionar manualmente.

Talvez a experiência mostre algo como:

```text
> 0.84 excelente
0.75–0.84 útil
< 0.75 fraco
```

Mas isso é apenas um exemplo.

A régua real deve ser descoberta empiricamente no corpus do Scriba.

---

# 52. Primeira POC da biblioteca

Não começar com livros inteiros.

Uma POC muito melhor pode ter apenas **20–50 chunks de excelente qualidade**.

Por exemplo:

```text
knowledge/
  providencia.md
  justificacao.md
  santificacao.md
  romanos-8.md
  efesios-2.md
  uniao-com-cristo.md
```

Cada arquivo pode conter algumas seções boas.

Depois:

```text
arquivo
↓
chunk
↓
embedding
↓
Supabase
```

O objetivo inicial não é volume.

É descobrir se o retrieval melhora a qualidade do Scriba.

---

# 53. Primeiro teste: busca sem modelo generativo

Antes de integrar com o Aprofundar, crie apenas:

```text
campo de busca
↓
embedding da query
↓
match_knowledge()
↓
top 10
```

Pesquise coisas como:

```text
graça e obras
```

```text
sofrimento e soberania de Deus
```

```text
justificação pela fé
```

```text
Romanos 8 e sofrimento
```

Se os resultados retornados forem ruins, não adianta tentar “consertar” com prompt.

Primeiro o retrieval precisa encontrar boas fontes.

---

# 54. Segundo teste: geração usando resultados conhecidos

Depois que a busca estiver funcionando:

```text
query
↓
10 resultados
↓
selecionar manualmente 5 bons
↓
modelo
↓
resposta
```

Assim você consegue avaliar separadamente a geração.

---

# 55. Terceiro teste: Aprofundar com um sermão real

Escolha um sermão que você conhece muito bem.

Teste duas versões.

## Versão A — atual

```text
sermão
↓
modelo
↓
aprofundamento
```

## Versão B — RAG

```text
sermão
↓
análise
↓
retrieval
↓
fontes
↓
modelo
↓
aprofundamento
```

Compare.

---

# 56. Critérios de avaliação

Uma tabela simples:

| Critério | Atual | RAG |
|---|---:|---:|
| Fidelidade ao sermão | | |
| Profundidade | | |
| Conexões bíblicas | | |
| Contexto | | |
| Aplicação | | |
| Generalidades | | |
| Informação nova útil | | |
| Uso correto das fontes | | |
| Clareza | | |
| Confiança | | |

Também vale perguntar:

- trouxe algo que realmente acrescentou valor?
- repetiu o sermão com palavras diferentes?
- inventou uma interpretação?
- utilizou fontes irrelevantes?
- confundiu opinião de uma fonte com afirmação do pregador?
- apresentou uma posição teológica como consenso quando não era?

---

# 57. Criar um pequeno conjunto de evals

Em vez de testar aleatoriamente toda vez, monte cerca de 20–30 casos conhecidos.

Exemplo:

```text
Caso 01
Query: graça e obras
Resultado esperado: Efésios 2 + justificação + boas obras
```

```text
Caso 02
Query: soberania de Deus no sofrimento
Resultado esperado: providência + Romanos 8 + sofrimento
```

```text
Caso 03
Query: Romanos 8:28
Resultado esperado: conteúdo diretamente relacionado ao capítulo/verso
```

Sempre que mudar:

- embedding model;
- chunking;
- metadata;
- busca;
- ranking;
- prompt;

rode os mesmos casos novamente.

Assim você deixa de melhorar o RAG “no feeling”.

---

# 58. Avaliar retrieval separadamente da geração

Existem pelo menos duas avaliações diferentes.

## Retrieval

```text
A busca encontrou o material certo?
```

## Generation

```text
O modelo utilizou corretamente o material encontrado?
```

Essa separação é muito importante.

Um resultado final ruim não significa automaticamente que o modelo é ruim.

Talvez ele tenha recebido fontes ruins.

---

# 59. Estrutura de código sugerida

Uma organização possível no projeto:

```text
lib/
  ai/
    embeddings.ts

  knowledge/
    types.ts
    chunk.ts
    ingest.ts
    search.ts
    hybrid-search.ts
    rerank.ts

  sermon/
    analyze-sermon.ts
    generate-summary.ts
    generate-deep-dive.ts
```

Fluxo do Aprofundar:

```ts
const analysis = await analyzeSermon(transcript)

const sources = await searchKnowledge({
  topics: analysis.topics,
  passages: analysis.passages
})

const deepDive = await generateDeepDive({
  transcript,
  analysis,
  sources
})
```

Evitar uma função monolítica como:

```ts
generateEverything()
```

A camada de knowledge/retrieval merece ser um domínio próprio do Scriba.

---

# 60. Serviço de embeddings

Exemplo:

```ts
// lib/ai/embeddings.ts

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 512

export async function embedText(text: string) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    input: text
  })

  return response.data[0].embedding
}
```

Centralizar essa configuração evita gerar embeddings incompatíveis por acidente.

---

# 61. Serviço de retrieval

Exemplo conceitual:

```ts
// lib/knowledge/search.ts

import { embedText } from '@/lib/ai/embeddings'

export async function searchKnowledge({
  query,
  limit = 10
}: {
  query: string
  limit?: number
}) {
  const queryEmbedding = await embedText(query)

  const { data, error } = await supabase.rpc('match_knowledge', {
    query_embedding: queryEmbedding,
    match_count: limit
  })

  if (error) {
    throw error
  }

  return data
}
```

---

# 62. Serviço de indexação

```ts
// lib/knowledge/ingest.ts

export async function indexKnowledgeSource(sourceId: string) {
  const source = await getKnowledgeSource(sourceId)

  await setSourceStatus(sourceId, 'processing')

  try {
    const chunks = chunkKnowledgeSource(source)

    await deleteExistingChunks(sourceId)

    for (const [index, chunk] of chunks.entries()) {
      const embedding = await embedText(chunk.content)

      await insertChunk({
        sourceId,
        chunkIndex: index,
        content: chunk.content,
        section: chunk.section,
        metadata: chunk.metadata,
        embedding
      })
    }

    await markSourceIndexed(sourceId)
  } catch (error) {
    await markSourceFailed(sourceId, error)
    throw error
  }
}
```

Para volumes maiores, isso pode virar processamento em lote ou fila.

Na POC, não é necessário começar com uma infraestrutura sofisticada.

---

# 63. Indexação ao salvar no Admin

Uma experiência boa seria:

```text
Admin
↓
Novo conteúdo
↓
Salvar e indexar
↓
source criado
↓
indexKnowledgeSource(source.id)
↓
status atualizado
```

A interface pode fazer polling simples do status ou reagir a atualizações do backend.

---

# 64. Processamento em background — quando realmente necessário

Com poucos textos, a própria requisição pode funcionar.

Com livros inteiros ou centenas de chunks, a indexação pode levar mais tempo.

Nesse momento faz sentido ter:

```text
job de indexação
↓
chunks
↓
batches de embeddings
↓
status/progresso
```

Mas isso não precisa entrar na primeira POC.

---

# 65. Configurações do Admin

Uma futura tela:

```text
/admin/knowledge/settings
```

Pode mostrar:

```text
Retrieval

Embedding model
text-embedding-3-small

Dimensions
512

Chunk target
800 tokens

Chunk overlap
100 tokens

Results
10
```

No começo, é totalmente aceitável deixar essas opções hardcoded no código.

Transformar tudo em configuração cedo demais gera complexidade sem benefício.

---

# 66. Um possível “Knowledge Debugger” mais avançado

Mais tarde o playground pode mostrar três abas lado a lado.

## Semantic

```text
0.88 Providência
0.84 Sofrimento
0.79 Romanos 8
```

## Keyword

```text
Sofrimento — match forte
Providência — match médio
Romanos 8:28 — match exato
```

## Hybrid

```text
1. Romanos 8
2. Providência
3. O problema do mal
```

Isso permite literalmente observar como o Scriba chegou ao resultado.

---

# 67. Observabilidade do RAG

Quando o sistema começar a ser utilizado de verdade, vale guardar informações de cada busca.

Exemplo:

```text
query
embedding model
search mode
filters
top K
chunks recuperados
scores
chunks enviados ao modelo
modelo generativo
latência
```

Isso ajuda a responder:

```text
Por que essa resposta ficou ruim?
```

Uma tabela futura poderia ser:

```text
knowledge_search_runs
```

Não é necessária na primeira POC, mas é uma evolução natural do playground.

---

# 68. O que não fazer agora

Evitar começar com:

- milhares de páginas;
- múltiplos bancos vetoriais;
- LangChain apenas porque é popular;
- agentes complexos;
- pipelines com muitas etapas;
- fine-tuning;
- filtros teológicos extremamente sofisticados;
- taxonomia gigantesca;
- automação sem revisão;
- indexação de obras protegidas sem verificar direito de uso.

O objetivo inicial é provar:

```text
fontes melhores + retrieval
produzem um Aprofundar claramente melhor?
```

---

# 69. POC recomendada

A primeira versão pode ter exatamente:

```text
/admin/knowledge

CRUD de conteúdo
↓
salvar
↓
chunk
↓
embedding
↓
Supabase
```

E:

```text
/admin/knowledge/playground

query
↓
embedding
↓
match_knowledge()
↓
top 10
↓
mostrar similarity + conteúdo
```

Só depois conectar isso ao Aprofundar.

---

# 70. Roadmap sugerido

## Fase 0 — Preparação

- habilitar pgvector;
- criar `knowledge_sources`;
- criar `knowledge_chunks`;
- centralizar configuração do embedding;
- definir status de indexação.

## Fase 1 — Conteúdo manual

- criar `/admin/knowledge`;
- criar cadastro de texto/markdown;
- salvar source;
- chunking simples;
- gerar embeddings;
- exibir chunks.

## Fase 2 — Playground sem geração

- criar `/admin/knowledge/playground`;
- campo de query;
- gerar embedding;
- `match_knowledge()`;
- retornar top 10;
- mostrar score, fonte e conteúdo.

## Fase 3 — Playground com geração

- botão “Gerar resposta com estes resultados”;
- prompt controlado;
- mostrar exatamente quais chunks foram enviados;
- comparar respostas.

## Fase 4 — Aprofundar + RAG

- analisar tese;
- extrair passagens;
- extrair temas;
- gerar queries;
- recuperar candidatos;
- deduplicar;
- enviar melhores fontes;
- produzir aprofundamento.

## Fase 5 — Evals

- 20–30 casos fixos;
- avaliação de retrieval;
- avaliação de geração;
- comparação antes/depois.

## Fase 6 — Metadata estruturada

- livros bíblicos;
- capítulos;
- versículos;
- temas;
- tradição;
- tipo de fonte;
- prioridade editorial.

## Fase 7 — Hybrid search

- full-text search;
- semantic search;
- metadata filtering;
- fusion/ranking.

## Fase 8 — Reranking

- buscar muitos candidatos;
- rerankear;
- selecionar pequeno conjunto final.

## Fase 9 — Outras experiências

- pequenos usos no Ao vivo;
- contexto bíblico estruturado;
- possíveis enriquecimentos separados do Resumo.

## Fase 10 — Biblioteca avançada

- conteúdo licenciado;
- coleções editoriais;
- obras em domínio público;
- parcerias;
- bibliotecas temáticas.

---

# 71. Arquitetura conceitual completa

```text
                       ┌────────────────────┐
                       │      SERMÃO        │
                       └─────────┬──────────┘
                                 │
                                 ▼
                       ┌────────────────────┐
                       │    TRANSCRIÇÃO     │
                       └─────────┬──────────┘
                                 │
                                 ▼
                       ┌────────────────────┐
                       │ ANALISAR O SERMÃO  │
                       └─────────┬──────────┘
                                 │
                  ┌──────────────┼──────────────┐
                  │              │              │
                  ▼              ▼              ▼
              Passagens        Temas          Tese
                  │              │              │
                  └──────────────┼──────────────┘
                                 │
                                 ▼
                       ┌────────────────────┐
                       │  GERAR CONSULTAS   │
                       └─────────┬──────────┘
                                 │
                                 ▼
       ┌─────────────────────────────────────────────────┐
       │               KNOWLEDGE RETRIEVAL               │
       │                                                 │
       │  Semantic + Keyword + Metadata + Bible filters │
       └───────────────────────┬─────────────────────────┘
                               │
                               ▼
                       candidatos relevantes
                               │
                               ▼
                           deduplicação
                               │
                               ▼
                            reranking
                               │
                               ▼
                          melhores fontes
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
             Sermão                      Fontes
                 │                           │
                 └─────────────┬─────────────┘
                               │
                               ▼
                       ┌────────────────────┐
                       │ MODELO GENERATIVO │
                       └─────────┬──────────┘
                                 │
                                 ▼
                       ┌────────────────────┐
                       │   APROFUNDAMENTO   │
                       └─────────┬──────────┘
                                 │
                                 ▼
                       ┌────────────────────┐
                       │    VERIFICAÇÃO     │
                       └────────────────────┘
```

---

# 72. Arquitetura da biblioteca

```text
                        ADMIN
                          │
                          ▼
                ┌──────────────────┐
                │ knowledge_source │
                └────────┬─────────┘
                         │
                      chunking
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
      chunk 1          chunk 2          chunk 3
         │               │               │
      embedding        embedding        embedding
         │               │               │
         └───────────────┼───────────────┘
                         │
                         ▼
                ┌──────────────────┐
                │  Supabase        │
                │  PostgreSQL      │
                │  pgvector        │
                └────────┬─────────┘
                         │
                         ▼
                    retrieval
```

---

# 73. Arquitetura do Playground

```text
                     ADMIN PLAYGROUND
                            │
                            ▼
                         QUERY
                            │
                            ▼
                    gerar embedding
                            │
                            ▼
                    match_knowledge
                            │
                            ▼
                       TOP 10
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ▼                             ▼
      visualizar results            gerar resposta
                                             │
                                             ▼
                                     modelo generativo
                                             │
                                             ▼
                                        resposta
```

---

# 74. Como o Scriba pode se diferenciar

O diferencial não precisa ser:

```text
"tem IA"
```

Isso é copiável e genérico.

Uma diferenciação mais forte é:

```text
O Scriba entende sermões,
transforma-os em conhecimento estruturado
e consulta uma biblioteca teológica curada
para ajudar o usuário a continuar estudando.
```

A combinação começa a ficar difícil de reproduzir porque envolve:

- transcrição;
- detecção bíblica;
- estrutura do sermão;
- biblioteca do usuário;
- biblioteca teológica;
- metadados;
- retrieval;
- histórico;
- produto/editorial.

---

# 75. Relação com a visão de longo prazo do Scriba

Essa arquitetura combina diretamente com a visão maior do produto.

O Scriba começou conceitualmente como:

```text
áudio
↓
transcrição
↓
sermão organizado
```

Depois evolui para:

```text
sermão organizado
↓
biblioteca
↓
coleções
↓
busca
↓
IA sobre os sermões
↓
IA sobre séries e eventos
↓
memória do ensino
```

Adicionar uma camada de knowledge/RAG acelera essa transição.

O Scriba deixa de ser apenas um sistema que processa um sermão isoladamente.

Ele passa a ter uma **memória e uma biblioteca consultável**.

---

# 76. A biblioteca do próprio usuário também deve entrar no RAG

No futuro, a fonte não precisa ser apenas livros externos.

O retrieval também pode pesquisar:

```text
sermões do usuário
```

Por exemplo:

```text
O que já ouvi sobre santificação?
```

```text
Como esse sermão se conecta ao que ouvi há três meses?
```

```text
Quais sermões anteriores trataram de Romanos 8?
```

```text
Esse pregador já falou de providência antes?
```

Isso conecta diretamente o RAG à ideia de memória pessoal/institucional do Scriba.

---

# 77. Dois tipos de conhecimento

É útil pensar que o Scriba terá duas grandes bibliotecas.

## Biblioteca pessoal/institucional

```text
sermões
EBDs
congressos
séries
palestras
```

## Biblioteca de referência

```text
Bíblia
comentários
teologia
artigos
conteúdo editorial
obras licenciadas
```

O Aprofundar pode consultar as duas.

Exemplo:

```text
Este sermão fala sobre sofrimento.

O Scriba encontra:

- Romanos 8 em uma fonte de referência;
- uma nota sobre providência;
- um sermão ouvido há 4 meses sobre o mesmo tema.
```

Isso cria uma experiência muito mais própria do produto.

---

# 78. Proveniência: de onde veio cada informação?

Uma boa evolução é permitir que cada afirmação enriquecida tenha alguma relação com a fonte utilizada.

Não necessariamente mostrar notas acadêmicas em toda resposta, mas preservar internamente:

```text
resposta
↓
chunk IDs utilizados
↓
source IDs
```

Assim o Scriba pode, quando necessário, mostrar:

```text
Fontes consultadas

- Comentário X, Romanos 8
- Teologia Y, Providência
- Sermão Z, 12 de maio
```

Isso aumenta confiança e debuggabilidade.

---

# 79. Não enviar tudo para o modelo

Se a biblioteca tiver 100 mil chunks, não faz sentido enviar milhares de páginas para cada chamada.

O propósito do retrieval é justamente selecionar um contexto pequeno e relevante.

Exemplo:

```text
100.000 chunks disponíveis
        ↓
retrieval
        ↓
40 candidatos
        ↓
rerank
        ↓
10 fontes
        ↓
modelo
```

Esse é um dos motivos pelos quais RAG pode ser mais eficiente e controlável do que tentar colocar toda a biblioteca no contexto.

---

# 80. Chunk size é uma variável de produto

Não existe um número universal perfeito.

Se o chunk for pequeno demais:

- perde contexto;
- frases ficam isoladas;
- o modelo pode receber trechos fragmentados.

Se for grande demais:

- retrieval fica menos preciso;
- um chunk pode conter vários assuntos;
- aumenta o contexto enviado ao modelo.

Uma POC pode começar com algo próximo de:

```text
target: ~800 tokens
overlap: ~100 tokens
```

Mas deve ser tratado como hipótese a testar.

Para conteúdo estruturado, preferir divisões naturais por seção sempre que possível.

---

# 81. Melhorar a query antes do retrieval

A pergunta que o usuário faz nem sempre é a melhor consulta para o banco.

Exemplo:

```text
usuário:
"o que isso quer dizer na prática?"
```

Essa query sozinha não possui contexto.

O Scriba pode transformá-la em algo como:

```text
aplicações práticas da doutrina da providência
diante do sofrimento cristão em Romanos 8:28-30
```

Esse processo é chamado, em termos gerais, de **query rewriting/query expansion**.

No Aprofundar, isso pode acontecer automaticamente com base no sermão.

---

# 82. Diversidade das fontes

Uma busca puramente por similaridade pode retornar dez chunks quase iguais do mesmo capítulo.

Por isso, futuramente, o Scriba pode impor diversidade.

Exemplo:

```text
máximo 3 chunks da mesma fonte
```

Ou tentar obter:

```text
1 comentário bíblico
1 teologia sistemática
1 conteúdo editorial
1 sermão anterior
```

quando isso fizer sentido.

Não precisa entrar na POC.

---

# 83. Prioridade editorial

Nem toda fonte deve ter o mesmo peso.

O Scriba pode guardar:

```text
priority: 1-5
```

ou algo como:

```text
editorial_weight
```

Então uma fonte considerada especialmente confiável pode ganhar preferência no ranking.

Essa ideia também pode ser utilizada para conteúdos revisados manualmente pelo Scriba.

---

# 84. Uma possível pipeline de Aprofundar V2

```text
1. Receber sermão finalizado

2. Extrair:
   - tese
   - estrutura
   - passagens
   - temas
   - perguntas levantadas
   - aplicações propostas pelo pregador

3. Gerar queries específicas

4. Buscar por passagem bíblica

5. Buscar semanticamente por tema

6. Buscar por keyword quando necessário

7. Buscar sermões anteriores relacionados

8. Unificar candidatos

9. Deduplicar

10. Rerankear

11. Selecionar fontes

12. Gerar estudo

13. Verificar:
    - fidelidade ao sermão
    - uso correto das fontes
    - referências bíblicas
    - posições teológicas
    - generalidades

14. Salvar:
    - resultado
    - fontes utilizadas
    - versão do prompt
    - versão do retrieval
```

---

# 85. Exemplo de resultado mais valioso do Aprofundar

Em vez de apenas:

```text
O sermão fala sobre confiar em Deus durante o sofrimento.
Devemos lembrar que Deus está conosco e continuar firmes na fé.
```

A experiência ideal se aproxima de algo como:

```text
O argumento do sermão aproxima sofrimento e providência.
Essa conexão é particularmente importante em Romanos 8 porque
Paulo não apresenta o verso 28 isoladamente: ele o coloca entre
a esperança em meio aos gemidos da criação e o propósito de Deus
de conformar seu povo à imagem do Filho.

Isso amplia a aplicação feita no sermão: o “bem” prometido no texto
não precisa significar remoção imediata da circunstância difícil,
mas deve ser lido à luz do propósito descrito nos versos seguintes.
```

Esse tipo de conteúdo exige contexto melhor que uma simples instrução genérica.

---

# 86. Fine-tuning no futuro

Fine-tuning não está descartado.

Ele apenas não deve ser a primeira resposta para o problema atual.

Depois que o Scriba tiver centenas de exemplos avaliados, poderá existir um conjunto como:

```text
input: sermão + fontes
output: aprofundamento excelente
```

E também exemplos do que não é desejável.

Nesse momento, fine-tuning pode ajudar a ensinar:

- estrutura;
- estilo;
- disciplina de citações;
- comportamento editorial;
- tipo de aplicação;
- nível de profundidade;
- formas de distinguir sermão e fonte externa.

Isso é muito mais valioso do que tentar “ensinar livros” ao modelo via fine-tuning.

---

# 87. Modelo generativo deve ser configurável

Nos exemplos deste documento, o modelo generativo não deve ser tratado como parte rígida da arquitetura.

O Scriba deve poder comparar modelos diferentes.

Algo como:

```ts
const DEEP_DIVE_MODEL = process.env.DEEP_DIVE_MODEL
```

O retrieval e a biblioteca devem continuar funcionando mesmo que o modelo generativo seja trocado.

Essa separação reduz lock-in e facilita evals.

---

# 88. Embedding model também deve ser versionado

Trocar o modelo de embedding é mais sensível porque os vetores existentes precisam permanecer compatíveis.

Se mudar:

```text
text-embedding-X
↓
text-embedding-Y
```

é provável que seja necessário reindexar toda a biblioteca.

Por isso guardar o modelo utilizado é importante.

---

# 89. Estratégia recomendada para o momento atual

Não tentar construir a plataforma final.

Construir a menor versão capaz de responder:

> **Uma pequena biblioteca teológica bem indexada torna o Aprofundar claramente melhor?**

O experimento pode ser:

```text
5–10 fontes excelentes
↓
20–50 chunks
↓
Supabase pgvector
↓
playground
↓
10 queries conhecidas
↓
1 sermão conhecido
↓
comparação atual vs RAG
```

Se a resposta for “sim”, aí vale expandir.

---

# 90. Ordem de implementação recomendada

## 1.
Criar tabelas.

## 2.
Ativar pgvector.

## 3.
Criar função de embeddings.

## 4.
Criar cadastro manual de conteúdo no `/admin`.

## 5.
Criar chunking simples.

## 6.
Salvar embeddings.

## 7.
Criar `match_knowledge()`.

## 8.
Criar playground.

## 9.
Testar top 10 manualmente.

## 10.
Criar botão de geração usando resultados.

## 11.
Conectar ao Aprofundar.

## 12.
Criar evals.

## 13.
Adicionar metadados e busca híbrida.

## 14.
Pensar em escala.

Essa ordem reduz drasticamente a quantidade de coisas que podem dar errado ao mesmo tempo.

---

# 91. Critério de sucesso da POC

A POC não precisa provar que o sistema é perfeito.

Ela precisa mostrar que:

1. cadastrar um conteúdo é simples;
2. salvar gera chunks e embeddings corretamente;
3. uma consulta semântica retorna material relevante;
4. o administrador consegue entender por que algo foi retornado;
5. o modelo produz resposta melhor quando recebe esse contexto;
6. o Aprofundar ganha profundidade perceptível;
7. a arquitetura não compromete a fidelidade ao sermão.

---

# 92. Possível UX final do Admin

```text
Knowledge
────────────────────────────────────────

42 fontes
1.284 chunks

[ + Novo conteúdo ]   [ Testar busca ]

Recentes

✓ Providência de Deus
  Teologia sistemática
  18 chunks

✓ Romanos 8
  Comentário bíblico
  27 chunks

⟳ Justificação pela fé
  Processando...
```

Detalhe:

```text
Providência de Deus

[ Conteúdo ] [ Chunks ] [ Metadados ] [ Indexação ]

Status
✓ Indexado

Modelo
text-embedding-3-small

Dimensões
512

Chunks
18

Última indexação
25 ago 2026 04:32

[ Reindexar ]
```

---

# 93. Possível UX final do Playground

```text
Knowledge Playground
────────────────────────────────────────

Consulta
┌────────────────────────────────────────┐
│ sofrimento e soberania de Deus         │
└────────────────────────────────────────┘

Modo
Semantic

Resultados
10

[ Buscar ]

────────────────────────────────────────

#1   0.87
Providência de Deus
Governo divino

"..."

#2   0.84
Romanos 8
Sofrimento e glória

"..."

#3   0.81
O problema do mal

"..."

────────────────────────────────────────

[ Gerar resposta com estes resultados ]
```

---

# 94. Resumo das decisões principais

## Não fazer agora

```text
comprar livros
↓
treinar modelo
```

## Fazer

```text
conteúdo controlado
↓
chunks
↓
embeddings
↓
Supabase pgvector
↓
retrieval
↓
fontes relevantes
↓
modelo
```

## Admin

```text
/admin/knowledge
```

para gerenciar conteúdo.

## Playground

```text
/admin/knowledge/playground
```

para testar retrieval.

## Primeira integração

```text
Aprofundar
```

não Ao vivo nem Resumo.

## Busca futura

```text
semantic
+
keyword
+
metadata
+
reranking
```

## Fonte de verdade

```text
áudio/transcrição
```

As fontes externas enriquecem, mas não devem reescrever o que foi pregado.

---

# 95. Conclusão

A próxima grande evolução do Scriba não precisa ser um modelo próprio.

Ela pode ser uma **camada própria de conhecimento**.

Hoje:

```text
Scriba
=
sermão + modelo
```

A evolução proposta:

```text
Scriba
=
sermão
+
memória
+
biblioteca teológica
+
retrieval
+
modelo
+
produto/editorial
```

Isso cria uma vantagem muito mais interessante.

O modelo pode mudar.

A biblioteca permanece.

O provedor de IA pode mudar.

Os embeddings podem ser reindexados.

O prompt pode melhorar.

Mas o **conhecimento organizado do Scriba** cresce com o produto.

No longo prazo, isso se conecta diretamente à visão mais ampla:

```text
Gravação
   ↓
Transcrição
   ↓
Sermão organizado
   ↓
Biblioteca pessoal
   ↓
Biblioteca de referência
   ↓
Retrieval
   ↓
Conexões
   ↓
Aprofundamento
   ↓
Memória do ensino
```

O Scriba deixa de ser apenas uma ferramenta que gera textos a partir de áudio.

Ele passa a ser uma **camada de inteligência sobre o conhecimento bíblico que o usuário ouviu, estudou e acumulou ao longo do tempo**.

E o primeiro passo para chegar lá é surpreendentemente pequeno:

```text
30 bons chunks
+
pgvector
+
um playground de busca
```

Se isso já fizer o Aprofundar ficar claramente melhor, existe uma base sólida para construir todo o restante.

---

# 96. Checklist da primeira implementação

- [ ] Habilitar `vector`/pgvector no Supabase
- [ ] Criar `knowledge_sources`
- [ ] Criar `knowledge_chunks`
- [ ] Definir `text-embedding-3-small` como embedding inicial
- [ ] Definir 512 dimensões na POC
- [ ] Criar `lib/ai/embeddings.ts`
- [ ] Criar `lib/knowledge/chunk.ts`
- [ ] Criar `lib/knowledge/ingest.ts`
- [ ] Criar `lib/knowledge/search.ts`
- [ ] Criar função SQL `match_knowledge`
- [ ] Criar `/admin/knowledge`
- [ ] Criar formulário de novo conteúdo
- [ ] Criar status `draft/processing/indexed/failed`
- [ ] Salvar conteúdo original antes de indexar
- [ ] Gerar chunks ao indexar
- [ ] Gerar um embedding por chunk
- [ ] Salvar metadata por chunk
- [ ] Exibir quantidade de chunks por fonte
- [ ] Criar aba de visualização dos chunks
- [ ] Mostrar modelo/dimensões/data de indexação
- [ ] Criar botão de reindexação
- [ ] Criar `/admin/knowledge/playground`
- [ ] Criar campo de query
- [ ] Gerar embedding da query
- [ ] Buscar top 10
- [ ] Mostrar similarity score
- [ ] Mostrar fonte/seção/conteúdo
- [ ] Não usar threshold rígido inicialmente
- [ ] Cadastrar 5–10 fontes de teste
- [ ] Gerar aproximadamente 20–50 chunks
- [ ] Criar conjunto de queries conhecidas
- [ ] Avaliar retrieval manualmente
- [ ] Criar botão “Gerar resposta com estes resultados”
- [ ] Comparar geração com e sem RAG
- [ ] Escolher um sermão conhecido para teste
- [ ] Comparar Aprofundar atual vs Aprofundar RAG
- [ ] Avaliar fidelidade, profundidade e utilidade
- [ ] Só depois integrar o RAG ao Aprofundar de produção
- [ ] Manter Resumo prioritariamente fiel ao sermão
- [ ] Manter RAG do Ao vivo pequeno e rápido
- [ ] Planejar metadata bíblica estruturada
- [ ] Planejar busca híbrida
- [ ] Planejar reranking
- [ ] Planejar evals recorrentes
- [ ] Verificar direito de uso antes de indexar obras protegidas
- [ ] Preservar proveniência das fontes utilizadas

---

# 97. Referências técnicas consultadas para esta consolidação

As decisões deste documento são baseadas principalmente na arquitetura discutida para o Scriba. Para confirmar detalhes técnicos atuais, foram consultadas as documentações oficiais de:

- OpenAI — modelo `text-embedding-3-small` e API de embeddings;
- Supabase — AI & Vectors;
- Supabase — Semantic Search;
- Supabase — Hybrid Search;
- Supabase — pgvector;
- Supabase — Vector Indexes.

Como APIs, preços e recomendações de infraestrutura podem mudar, é recomendado revisar a documentação oficial antes de consolidar decisões que dependam de custo, limites ou APIs específicas.
