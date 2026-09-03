# Estudo V2 — diagnóstico e nova arquitetura de geração

> Resposta à task `tasks/001-modo-gerar-estudo`. Este documento é a análise que
> precede a implementação. O que já está decidido sobre a camada de
> conhecimento (RAG) está em `docs/scriba-rag-proposta-claude.md` e não é
> reaberto aqui — os dois planos são ortogonais, e o ponto de encontro está
> marcado na §3.

## O que existe hoje

```
POST /api/deepening            cobra 5 moedas → generateDeepening() → session_deepenings
POST /api/deepening/reprocess  cobra 5 moedas → generateDeepening() → overwrite
lib/deepening/generate.ts      2 chamadas: draft (t=0.6) + auditor (t=0.15)
lib/prompts/deepening.ts       193 linhas de prompt
lib/prompts/deepening-audit.ts 108 linhas de prompt
lib/domain/deepening.ts        DeepeningPayload = SummaryPayload (alias)
```

Entrada do draft: `finalSummary` + `feedItems` + `transcript` inteiro.
Entrada do auditor: `finalSummary` + `draft`. **A transcrição não chega ao
auditor.**

---

# 1. Diagnóstico — por que o estudo entrega pouco

Sete causas. Nenhuma se resolve reescrevendo o prompt, e é por isso que as
rodadas anteriores de ajuste de prompt não moveram a agulha.

## 1.1 O prompt é majoritariamente negativo

Das ~193 linhas do `DEEPENING_SYSTEM_PROMPT`, a esmagadora maioria diz o que
**não** fazer: anti-template, anti-repetição, lista de sujeitos proibidos,
blocklist de aforismos, self-check de 9 itens com "regra dura". Sobra pouco
espaço dizendo o que **é** um bom estudo.

Um modelo otimizando para não violar quarenta proibições escreve
defensivamente: frases curtas, afirmações hedged, escolhas seguras. O resultado
tem exatamente a textura que a task descreve — "texto teológico genérico". As
proibições foram acrescentadas uma a uma para matar sintomas (h1 genérico,
palavra grega reciclada, autoexame vazado), e cada uma cobrou seu preço em
ambição.

## 1.2 As cotas mínimas são uma máquina de alucinação

`REGRA #2` exige, por estudo: ≥2 citações de teólogo, ≥1 palavra original, ≥3
versículos novos, ≥2 distinções doutrinárias, ≥1 autoexame, ≥2 highlights.

O prompt tenta desarmar isso com "se não consegue, não invente". Mas a
instrução de cota e a instrução de abstenção competem, e cota vence — cota é
concreta e verificável, abstenção é vaga. Pior: **o auditor reimpõe as mesmas
cotas** (`Passo C — VERIFICAÇÃO DE COTAS`). O segundo passe, que existe para
reduzir invenção, adiciona pressão para inventar.

É o mecanismo pelo qual sermões pobres em material recebem estudos ricos em
material fabricado — o que a task chama de "preencher lacunas artificialmente".

## 1.3 A whitelist de autores restringe o nome, não a afirmação

Quarenta e oito nomes, sem obra, sem tema, sem século, sem posição. O modelo
escolhe qualquer um por qualquer motivo, e a única verificação possível é
`author ∈ whitelist` — justamente o campo que quase nunca está errado. O erro
mora no `text`: a formulação atribuída.

Consequência prática: a whitelist garante que a citação inventada será
atribuída a um autor real. É o pior dos mundos — empresta credibilidade a uma
afirmação não verificada. E é exatamente o sintoma "nomes jogados no texto"
que a task descreve.

## 1.4 O texto bíblico é confiado ao modelo, tendo o repositório a NVI local

`lib/bibles/lookup.ts::lookupVerse` resolve referência → texto real a partir de
`NVI.json`. É usado por `/api/verse` e por `lib/rereads/generate.ts`.
**Não é usado pelo estudo.** Todo `bibleQuote.text` de um estudo é prosa
gerada, e o prompt gasta uma seção inteira ("REGRA DE OURO") pedindo ao modelo
que não parafraseie a Escritura — um problema já resolvido no repositório,
resolvido de novo, e pior, por instrução.

## 1.5 Não existe etapa de decisão — tudo acontece numa inferência só

A parte mais importante do pedido é:

> identificação dos assuntos que realmente merecem aprofundamento

Hoje essa decisão acontece implicitamente, dentro do mesmo forward pass que
escolhe o tema, seleciona a abordagem, recupera conhecimento, escreve 15-25
blocos e roda um self-check de 9 itens. É uma decisão que ninguém consegue
ler, logar, avaliar ou corrigir. Quando sai errada, o único instrumento
disponível é acrescentar mais uma proibição ao prompt — o que nos trouxe até a
§1.1.

## 1.6 O auditor não tem como auditar

Ele recebe `finalSummary` + `draft`. Sem transcrição, sem plano, sem texto
bíblico. Logo:

- **não pode** verificar fidelidade ao sermão (critério nº 2 da task);
- **não pode** verificar se uma palavra grega pertence ao texto pregado — só
  pode adivinhar pelo tema;
- **não pode** verificar citação nenhuma.

O que ele consegue fazer é detectar repetição contra o resumo e reescrever
blocos. E um modelo a `t=0.15` reescrevendo conteúdo teológico **sem a fonte**
é, ele mesmo, um vetor de fabricação: preenche o que reescreve com
conhecimento paramétrico.

## 1.7 A forma de saída impede a estrutura adaptativa que a task pede

`DeepeningPayload = SummaryPayload`. O estudo é obrigado a falar o vocabulário
de blocos do resumo: `h1 h2 paragraph bibleQuote highlight example quote
conclusion`. Não existe bloco para objeção, para distinção, para tensão, para
leitura recomendada, para pergunta em aberto, para fonte com proveniência.

"A estrutura deve surgir do assunto" não é um problema de prompt: o tipo não
tem como expressar estruturas diferentes. Todo estudo sai parecendo um resumo
mais longo porque, estruturalmente, **é** um resumo mais longo.

## 1.8 Não há sinal de qualidade

Nada mede se um estudo ficou bom. `hallucination_reports` cobre `live` e
`summary`, não `deepening`. Sem sinal, a única evidência disponível é a
impressão do usuário — que é como esta task começou.

---

# 2. Nova proposta de experiência

Um estudo bom no Scriba deve ser **legível como um ensaio**, não como um
formulário preenchido. Três compromissos:

**a) O estudo declara o que escolheu aprofundar.** Abre nomeando o ponto do
sermão de onde parte e a razão de valer profundidade ali. Não é meta-texto
sobre o sermão — é o contrato: o leitor sabe na primeira linha que não vai
reler o resumo.

**b) Todo apoio externo é rastreável.** Citação sem obra localizável não entra.
Referência bíblica sem texto conferido não entra. Indicação de leitura sem
autor e título reais não entra. A ausência é preferível: um estudo com três
fontes sólidas vale mais que um com oito plausíveis.

**c) A forma segue o material.** Um sermão expositivo em Romanos 8 pede exegese
e história da doutrina. Uma pregação temática sobre ansiedade pede distinção
conceitual, contexto pastoral e uma objeção honesta. Uma homilia narrativa pede
contexto histórico-cultural e conexões canônicas.

Corolário desagradável e necessário: **nem todo sermão rende um estudo de 25
blocos**, e o produto precisa parar de fingir que rende. Um estudo honesto de
8 blocos densos é a entrega correta para um sermão raso, e é melhor que 25
blocos de enchimento — que é o que o usuário recebe hoje.

---

# 3. Nova arquitetura de geração

Pipeline de cinco etapas, **duas delas determinísticas** (sem LLM). A hipótese
da task (pipeline editorial) acerta a direção, mas tem etapas demais: cada
chamada extra é mais uma chance de derivar do sermão. Cinco etapas, três
chamadas de modelo.

```
transcrição + finalSummary + feedItems
        │
        ▼
[1] PLANO (LLM, JSON)                    ← a decisão, explícita e persistida
        │  tema real, texto(s) base, 1-3 eixos de aprofundamento,
        │  abordagem escolhida por eixo + justificativa,
        │  o que NÃO cobrir (já está no resumo),
        │  referências bíblicas candidatas, autores candidatos
        ▼
[2] ANCORAGEM (determinístico)           ← sem LLM
        │  lookupVerse(NVI) em toda referência do plano
        │  referência inexistente → descartada do plano
        │  saída: texto bíblico REAL para injetar no passo 3
        ▼
[3] REDAÇÃO (LLM, JSON)                  ← escreve seguindo o plano
        │  recebe: plano + versículos ancorados + resumo + transcrição
        │  não decide mais nada estrutural; só escreve
        ▼
[4] REVISÃO (LLM, JSON)                  ← agora com a fonte à mão
        │  recebe: plano + rascunho + transcrição + versículos ancorados
        │  corta o que não se sustenta. NÃO tem cota para preencher.
        ▼
[5] SELAGEM (determinístico)             ← sem LLM
        │  bibleQuote.text reescrito da NVI (nunca do modelo)
        │  quote sem obra declarada → descartado
        │  autor fora do índice → descartado
        ▼
payload final + plano persistido para avaliação
```

## Por que esta forma e não a da task

A task propunha oito etapas, com "pesquisa" e "análise das fontes" separadas.
As duas ficam de fora **por ora**, por um motivo concreto: hoje não há fonte
para pesquisar. `lib/llm/openai.ts::callChat` fala com Chat Completions sem
ferramentas — não há web search, não há base indexada. Uma etapa de "pesquisa"
contra o conhecimento paramétrico do modelo é apenas mais uma chance de
inventar, com um rótulo mais confiável colado em cima.

A pesquisa entra quando a camada de conhecimento existir
(`docs/scriba-rag-proposta-claude.md`, PR 1-2). O ponto de encaixe já está
desenhado: o passo [2] passa a produzir `âncoras = versículos + chunks
recuperados`, e o passo [3] recebe fontes reais com proveniência. **O pipeline
foi desenhado para que essa troca seja um parâmetro, não uma reescrita.**

## As duas etapas determinísticas são o coração da proposta

É a diferença de método em relação a tudo que já se tentou aqui. Nenhuma
instrução em linguagem natural — por mais maiúscula, por mais "REGRA DE OURO" —
consegue o que uma consulta a `NVI.json` consegue de graça: garantir que o
versículo está certo.

Regra geral que passa a valer: **toda restrição que pode virar código sai do
prompt e vira código.** O que sobra no prompt é o que só linguagem consegue
pedir — julgamento.

---

# 4. Estratégia de modelos

| Etapa | Papel | Env var | Temp. | Por quê |
|---|---|---|---|---|
| [1] Plano | julgamento editorial sobre texto longo | `OPENAI_STUDY_PLAN_MODEL` | 0.3 | A decisão precisa ser estável e reproduzível; é o que vamos avaliar |
| [3] Redação | prosa teológica densa | `OPENAI_STUDY_WRITE_MODEL` | 0.7 | Única etapa que ganha com variação — o plano já fixou o esqueleto |
| [4] Revisão | verificação contra a fonte | `OPENAI_STUDY_AUDIT_MODEL` | 0.1 | Corte, não criação |

**Especializar por etapa é a decisão certa; usar três famílias de modelo
diferentes não é.** O ganho real vem de temperatura e escopo distintos por
etapa, não de trocar de fornecedor. Manter três env vars separadas permite
subir só a redação para um modelo mais caro e medir o delta isoladamente — a
única forma honesta de saber se o modelo maior compensou.

Custo: hoje são duas chamadas somando ~25k tokens de entrada. O pipeline sobe
para três, com entradas mais focadas. A conta fica na mesma ordem de grandeza —
perto de 1,3× do atual, não 3×. Com a margem declarada na task, é irrelevante.
Se um dia importar, a alavanca é o passo [1], o mais barato de rebaixar.

---

# 5. Estrutura do estudo

`DeepeningPayload` deixa de ser alias de `SummaryPayload`.

## 5.1 Blocos novos

Ao vocabulário atual, quatro tipos que hoje não têm como existir:

- `objection` — uma objeção honesta ao que foi pregado, com a resposta. É o que
  mais falta: nenhum bloco atual comporta tensão.
- `distinction` — `{ a, b, text }`: dois conceitos que o sermão colapsou.
- `reading` — `{ author, title, note }`: indicação de leitura. Campos separados
  justamente para que autor e obra possam ser validados em código.
- `question` — pergunta em aberto, para o leitor continuar pensando.

Cada um sai do modelo com campos, não com prosa — é o que permite à selagem [5]
conferir. Mesmo princípio de `bibleQuote.reference` vs `text`.

## 5.2 A estrutura deixa de ser obrigatória

Não há mais cota. O plano do passo [1] decide quantos eixos existem (1 a 3) e
qual abordagem cada um recebe; a redação segue o plano. Um estudo pode sair com
um eixo só, sem citação nenhuma e sem palavra original, se é isso que o material
sustenta — e isso é sucesso, não falha.

Permanece obrigatório apenas o que é estrutural, não temático: `title`,
`shortSummary` (a tese) e um fechamento.

## 5.3 Abordagens disponíveis (escolhidas no plano, não fixas)

`exegese` · `contexto-historico` · `teologia-biblica` · `teologia-sistematica`
· `historia-da-igreja` · `filosofia` · `pastoral` · `conceitual`

A oitava responde à pergunta 8 da task ("assuntos em que nenhuma abordagem é
útil"): quando nenhuma disciplina ilumina, o valor está em explicar bem o
conceito, com exemplo e analogia. É uma escolha legítima do plano, não um
fallback envergonhado.

---

# 6. Estratégia de fontes

Regra única, aplicada em código na selagem:

> **Uma fonte só entra se tiver identificação suficiente para ser conferida por
> um humano em menos de um minuto.**

Na prática:

- `quote` passa a exigir `author` **e** `work` (obra nomeável). Sem `work`, o
  bloco é descartado no passo [5] — não "avaliado", descartado.
- `reading` exige `author` e `title`.
- `author` é validado contra um índice em `lib/prompts/theologians.ts` que
  substitui a whitelist plana: cada autor com século, tradição, obras
  principais e temas. O índice serve a dois propósitos — filtrar na selagem e,
  sobretudo, **entrar no prompt de redação já filtrado por tema**: o modelo
  recebe os oito a doze autores pertinentes ao eixo, com obra e assunto, em vez
  de 48 nomes soltos. É o ataque direto ao "nomes jogados no texto".
- Versículo nunca vem do modelo. Vem da NVI, sempre.

O passo que fecha o problema de vez fica registrado como próximo: quando a base
do RAG existir, `quote` deixa de ser "o modelo lembrou" e passa a ser "o chunk
indexado diz", com `source_id` no bloco. A estrutura de campos proposta aqui já
é a que esse dia vai exigir.

---

# 7. Critérios de qualidade

Oito critérios, avaliados por leitura humana sobre uma **amostra fixa** de
sessões — reaproveitar as mesmas sessões a cada rodada é o que torna a
comparação possível. Nota 1-5, exceto os binários.

| # | Critério | Como se mede |
|---|---|---|
| 1 | **Fidelidade** | Alguma afirmação atribui ao pregador algo que ele não disse? (binário; qualquer ocorrência reprova) |
| 2 | **Verificabilidade** | % de `quote`/`reading` cuja obra existe e contém a formulação |
| 3 | **Novidade sobre o resumo** | Quantos blocos trazem substância ausente do `finalSummary` |
| 4 | **Pertinência da abordagem** | A abordagem escolhida no plano era a melhor disponível? |
| 5 | **Ausência de genérico** | Quantos blocos passariam intactos para um sermão de outro tema |
| 6 | **Densidade** | Blocos com conteúdo ÷ blocos totais |
| 7 | **Provocação** | O estudo produz uma pergunta que o leitor não tinha |
| 8 | **Honestidade de extensão** | Estudo curto para sermão raso conta a favor, não contra |

O critério 5 é o único já perseguido hoje (via anti-template) e sozinho não
resolveu nada — está na lista para não regredir, não como meta.

**O plano do passo [1] é persistido junto com o estudo.** Sem isso, avaliar o
critério 4 exige adivinhar o que o modelo pensou. Com isso, a decisão editorial
vira dado, e a próxima rodada de melhoria parte de evidência em vez de
impressão.

---

# 8. Planos e feature entitlements

## 8.1 Flag e entitlement são coisas diferentes — e a distinção vale

- **Entitlement**: "este plano dá direito a isto". Muda com contrato, dura
  enquanto a assinatura vive, e negá-lo é uma decisão de produto que o usuário
  reverte comprando.
- **Flag**: "isto está ligado". Muda com deploy ou incidente, é temporária, e
  não tem nada a ver com quem o usuário é.

Confundir as duas produz `if (plan === "estudioso" && !isBroken)` espalhado.
Mas criar duas abstrações grandes seria pior. A saída: **um ponto único de
consulta, com as duas dimensões dentro dele.**

```ts
canUseFeature(ctx, "study_generation")
// false se: a feature está desligada (kill switch)
//        ou o plano do usuário é inferior ao mínimo
//        ou um override do admin revogou para este usuário
```

## 8.2 Onde mora a regra

O catálogo (`feature → plano mínimo`) mora **em código**, client-safe, em
`lib/entitlements/features.ts`. Pela mesma razão que `lib/billing/catalog.ts`
mora em código: uma linha errada numa tabela do banco não pode virar acesso
grátis a uma feature paga. O admin **vê** a matriz; não a edita.

O que o admin edita é o que faz sentido editar em runtime:

- **kill switch por feature** — desligar para todos durante um incidente;
- **override por usuário** — conceder a um beta tester, revogar de um abusador.

Ambos em `feature_overrides`, com `service_role` como único escritor — o mesmo
padrão de `grant_coins`.

## 8.3 A proteção mora no servidor

Esconder o botão é UX, não segurança. `POST /api/deepening` passa a chamar
`requireFeature("study_generation")` **antes de cobrar moedas**, e responde 403
`feature_not_available`. O botão também é escondido, porque oferecer o que vai
dar 403 é um bug de produto — mas a ordem importa: servidor primeiro.

## 8.4 Duas decisões de produto que a implementação assume

Fechar o "Gerar estudo" para o Estudioso tira uma capacidade de quem já a
tinha. Ambas revertem em uma linha do catálogo:

1. **Estudos já gerados continuam legíveis** por qualquer plano. Só a *geração*
   é restrita. Retirar acesso a conteúdo já pago seria confisco.
2. **`reprocess_deepening` segue a mesma regra da geração** — é geração com
   outro nome.

---

# 9. Ordem de implementação

| Passo | Entrega |
|---|---|
| 1 | Feature entitlements: catálogo, gate no servidor, UI, admin, docs |
| 2 | Índice de teólogos com obra, século e tema |
| 3 | Tipos de bloco novos + `DeepeningPayload` próprio + renderer |
| 4 | Pipeline de cinco passos + persistência do plano |
| 5 | Amostra fixa de sessões + planilha dos oito critérios |
| 6 | (RAG PR 1-2) fontes reais no passo [2] — ver `docs/scriba-rag-*` |

O passo 1 é independente dos demais e por isso entra primeiro. Os passos 2-4
são um bloco só: nenhum deles isolado muda o que o usuário lê.
