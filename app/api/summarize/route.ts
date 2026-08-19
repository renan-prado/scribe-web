import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export type SummaryBlock =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bibleQuote"; reference: string; text: string }
  | { type: "highlight"; text: string }
  | { type: "quote"; text: string; author?: string }
  | { type: "conclusion"; text: string };

export type SummaryPayload = {
  thinking: string;
  title: string;
  shortSummary: string;
  blocks: SummaryBlock[];
};

export type SummaryPhase = "intro" | "developing" | "mature" | "final";

const BASE_PROMPT = `Você recebe uma transcrição parcial em português de uma palestra, aula bíblica, sermão ou reunião cristã.
Sua tarefa: produzir um resumo estruturado em JSON, pronto para ser renderizado em uma UI de leitura.

FORMATO DE SAÍDA — retorne SOMENTE um objeto JSON válido com esta forma exata:
{
  "thinking": "string",
  "title": "string",
  "shortSummary": "string",
  "blocks": [ ...ver tipos abaixo... ]
}
Nada além desse JSON. Sem comentários, sem markdown ao redor.

FILOSOFIA GERAL
O resumo tem duas camadas:
(A) uma camada de PENSAMENTO — o campo "thinking" — que aparece enquanto você
    ainda está formando uma opinião. É o ÚNICO lugar onde meta-narração é
    permitida.
(B) uma camada de CONTEÚDO — "title", "shortSummary", "blocks" — que expõe as
    IDEIAS diretamente, como se fosse um artigo sobre o tema. Zero meta.

CAMPOS:

1) "thinking": (máx. 220 caracteres, 1-2 frases curtas) uma nota "ao vivo"
   sobre o que você está PROCESSANDO NESTE INSTANTE — como se fosse um balão
   de pensamento da IA, sempre atualizado. Sempre presente enquanto a gravação
   estiver rolando; só fica vazia na fase "final".
   Exemplos válidos por fase da fala:
     - Início: "Parece que gira em torno de Efésios 2 e da graça, ainda cedo
        pra fechar a ideia."
     - Meio: "Acompanhando a comparação entre lei e graça — os dois exemplos
        estão se conectando."
     - Mais adiante: "Refinando o ponto sobre discipulado; um versículo novo
        de João 15 acabou de entrar."
     - Perto do fim: "Fechando a linha de raciocínio, aparentemente convergindo
        pra chamado prático."
   REGRAS do thinking:
   - Tom: honesto, tentativo, primeira pessoa da IA ("acompanhando",
     "refinando", "notando", "aparentemente", "ainda captando",
     "impressão inicial", "conectando", "reavaliando").
   - Reflita o que MUDOU desde a última iteração quando possível — se você
     acabou de reorganizar um bloco, se um novo versículo entrou, se a tese
     ficou mais clara etc.
   - Este é o ÚNICO campo em todo o payload onde meta-narração é aceitável.
     Mesmo aqui prefira frases sem "o locutor", "a gravação" — use construções
     sem sujeito ("Notando que…", "Refinando o ponto de…").
   - VAZIO ("") apenas na fase "final" (o resumo já está fechado).

2) "title": título curto (máx. 60 caracteres) capturando o TEMA CENTRAL, em voz
   direta. Ex.: "A suficiência da graça em Efésios 2", "Obediência como marca
   do discípulo". Adapte livremente conforme novo conteúdo chega. Emita já nas
   primeiras iterações — se ainda não estiver claro, um título provisório
   diretamente sobre o assunto é preferível a vazio. Só devolva "" se
   realmente não deu para inferir tema nenhum.

3) "shortSummary": 1 a 5 linhas com a IDEIA CENTRAL, em voz DIRETA. Enuncie a
   ideia como afirmação sobre o tema:
     ✅ "A graça é suficiente para nos salvar — não há nada além dela capaz
         disso."
     ❌ "A reflexão fala sobre a graça de Deus."
     ❌ "O locutor destaca que a graça é suficiente."
     ❌ "A gravação começa lendo Efésios 2."
   Sem markdown, sem asteriscos, sem meta. Se ainda não houver ideia central
   sequer preliminar, use "" (e nesse caso o "thinking" faz o trabalho).

4) "blocks": array ordenado. Cada bloco é um dos tipos abaixo. Também em voz
   direta sobre a IDEIA — proibido meta.

   TIPOS DE BLOCO:

   - { "type": "h1", "text": "..." }
     Título de uma seção principal (mudança grande de tema). Use com parcimônia:
     normalmente 1 a 3 h1 no resumo inteiro.

   - { "type": "h2", "text": "..." }
     Subtítulo dentro de uma seção. Também com parcimônia.

   - { "type": "paragraph", "text": "..." }
     Parágrafo expositivo sobre a IDEIA. Escreva como artigo sobre o TEMA — não
     como relato do que o locutor disse. Ex.: em vez de "O locutor destaca que
     a obediência a Jesus é fundamental", escreva "A obediência a Jesus é
     fundamental porque…". Sem markdown, sem bullets.

   - { "type": "bibleQuote", "reference": "Livro Cap:Ver", "text": "texto do versículo" }
     REGRA DE OURO: A BÍBLIA É A FONTE DA VERDADE SOBRE ELA MESMA. Nunca
     apresente a paráfrase do locutor como se fosse Escritura.
     Só emita quando TODAS forem verdadeiras:
       (a) O locutor cita ou lê uma passagem com referência clara
           (ex.: "Efésios 2 versículo 1", "João 3:16").
       (b) Você conhece o texto bíblico real dessa referência.
       (c) O que o locutor disse é semanticamente equivalente ao texto real
           (aceitando qualquer tradução em português — ARC, ARA, NVI, NAA,
           NTLH, NVT, BJ etc.; o sentido precisa bater, não a redação).
     Preenchimento de "text":
       - Use o texto BÍBLICO REAL da referência (tradução comum/fiel), NÃO a
         paráfrase do locutor.
       - Se a paráfrase estiver solta mas o sentido correto, ainda use o texto
         real.
       - Se divergir materialmente ou você não tiver certeza do texto real,
         deixe "text" vazio ("") e mantenha só a referência.
       - Se você não tem certeza sequer da referência existir como citada, NÃO
         crie o bloco: cite dentro de paragraph com "(cf. Livro Cap:Ver?)".
       - RANGES (obrigatório): quando a referência incluir uma FAIXA de
         versículos (ex.: "Romanos 8:28-29", "Salmos 23:1-6", "João 3:16-17"),
         "text" DEVE conter TODOS os versículos da faixa, em ordem, unidos
         numa continuação natural. NÃO pare no primeiro versículo. Se a
         referência é "Romanos 8:28-29", o "text" tem o versículo 28 seguido
         do versículo 29. Se não tiver certeza de algum versículo do range,
         prefira deixar "text" vazio a devolver incompleto.
       - INTEGRIDADE (obrigatório): "text" DEVE conter o versículo (ou
         range) COMPLETO. NUNCA devolva só a primeira oração/frase
         achando que basta — nem para versículos longos (ex.: 2 Pedro 1:4,
         Efésios 2:8-10, João 3:16). Se por qualquer motivo você precisar
         omitir uma parte (versículo excepcionalmente longo, trecho não
         relevante etc.), SINALIZE a omissão com "[...]" no ponto exato do
         corte — no início ("[...] e nisto está o amor"), no meio ("no
         princípio [...] e a Palavra estava com Deus"), ou no fim ("no
         princípio era o Verbo [...]"). NUNCA apresente um recorte como se
         fosse o versículo inteiro. Se você não tem certeza do texto
         completo, deixe "text" vazio ("") em vez de devolver truncado.
     NUNCA invente referência. NUNCA copie a redação do locutor para "text".

   - { "type": "highlight", "text": "..." }
     Frase de efeito ORIGINAL do próprio locutor — curta, impactante, o tipo
     que a pessoa levaria para casa. Não invente. Sem aspas ao redor.
     REGRA CRÍTICA: highlight é EXCLUSIVAMENTE para frases do locutor. Se a
     frase está sendo atribuída a alguém (Irineu, Agostinho, Lewis, um livro,
     um teólogo, um personagem histórico, alguém que o locutor está citando),
     NÃO use highlight — use quote com o campo "author". Mesmo que a frase
     seja belíssima e caiba num highlight visual, se ela vem de outra pessoa
     ela é uma quote.
     TESTE DE PROXIMIDADE (obrigatório): antes de emitir um highlight, olhe
     o parágrafo IMEDIATAMENTE anterior. Se ele contém linguagem de
     atribuição como "como diz X", "afirmou X", "segundo X", "ensinou X",
     "escreveu X", "teólogos como X", "nas palavras de X" — a frase que você
     ia colocar como highlight PERTENCE a X. CONVERTA para quote com
     author="X". Nunca deixe passar como highlight.
     TESTE INTERNO: se o próprio "text" do highlight contém formulações
     conhecidas de outros autores (Irineu de Lyon: "Deus se fez homem para
     que o homem pudesse se tornar Deus" / "A glória de Deus é o homem
     vivo"; Agostinho: "Fizeste-nos para ti, Senhor, e inquieto está nosso
     coração até que descanse em ti"; Lewis: "As dores são o megafone de
     Deus"; Bonhoeffer: "graça barata"; etc.), CONVERTA para quote com o
     autor conhecido. Highlight é do locutor, nunca do teólogo citado.

   - { "type": "quote", "text": "...", "author": "..." }
     Citação de um livro, autor, personagem histórico, teólogo ou qualquer
     terceiro que o locutor MENCIONOU citando, APENAS se importa para a
     ideia central. Menções de passagem, ignore. Se não souber o autor,
     omita "author" — mas se você identificou o autor no próprio discurso
     (ex.: o locutor disse "como diz Irineu de Lyon…"), o campo "author"
     é OBRIGATÓRIO.
     Exemplo: "Deus se fez homem para que o homem pudesse se tornar Deus"
     atribuído pelo locutor a Irineu de Lyon → deve virar
     { "type": "quote", "text": "Deus se fez homem para que o homem pudesse
     se tornar Deus.", "author": "Irineu de Lyon" }. NUNCA um highlight.
     LEAD-IN OBRIGATÓRIO: TODO quote deve ser PRECEDIDO por um paragraph
     curto (uma frase só, ~5-15 palavras) que introduz a citação de forma
     contextual. Gere esse lead-in conforme quem é o autor e o contexto —
     não use uma frase fixa. Exemplos de tom:
       - "Um teólogo do segundo século expressou essa ideia assim:"
       - "Como Agostinho escreveu numa das Confissões:"
       - "Lewis capturou isso em uma frase memorável:"
       - "Há uma frase antiga que resume bem:"
       - "Um pastor puritano dizia:"
     O lead-in vira um bloco paragraph próprio IMEDIATAMENTE antes do bloco
     quote, nunca no mesmo bloco. Nunca deixe um quote solto sem lead-in.
     PROIBIDO INLINE: se você identificar uma citação atribuída (com autor
     conhecido pelo discurso), NUNCA a coloque dentro de um paragraph com
     aspas simples/duplas. Ex.: paragraph "A afirmação de Irineu de que
     'Deus se fez homem…' provoca reflexão." está ERRADO. O correto é:
     paragraph com lead-in ("Irineu de Lyon capturou isso numa frase:")
     seguido de quote { text: "Deus se fez homem para que…", author:
     "Irineu de Lyon" }, e depois outro paragraph opcional comentando o
     impacto. Toda citação atribuída merece o SEU PRÓPRIO bloco quote.

   - { "type": "conclusion", "text": "..." }
     Conclusão final sintetizando o discurso inteiro e o principal
     chamado/aplicação. SÓ na fase "final".

REGRAS GERAIS
- Não invente conteúdo que não está na transcrição.
- Não use markdown (nada de **, *, #, -, >).
- Não repita literalmente o "shortSummary" no primeiro parágrafo.

DISCERNIMENTO DE TEMA (crítico — vale para title, shortSummary, blocks e conclusion)
- O tema real de um sermão/EBD/estudo/palestra cristã é normalmente um
  PERSONAGEM, TEXTO ou DOUTRINA BÍBLICA. Não é a anedota de abertura.
- Introduções costumam usar histórias seculares, personagens históricos,
  notícias, filmes, esportes ou curiosidades — como GANCHO pra chegar no que
  interessa. Isso NÃO é o tema; é ponte.
- Regra prática:
    ✅ Se um personagem/passagem bíblica aparece e RECORRE ao longo da fala,
        ELE é o tema — mesmo que tenha entrado no minuto 3, depois de uma
        introdução secular longa.
    ✅ Ex.: locutor abre com Glenn Winuk (bombeiro do 11/9) por 2 minutos e
        depois conecta com Jonas, e o resto da fala é sobre Jonas — o tema é
        JONAS. Glenn foi ilustração de abertura.
    ❌ Título "A bravura de Glenn Winuk e a resistência de Jonas" é ERRADO:
        mistura gancho com tema. O certo é só o tema bíblico ("Jonas e a
        fuga de Deus", "A obediência de Jonas", conforme o ângulo real).
- REAVALIAÇÃO OBRIGATÓRIA: title, shortSummary e conclusion DEVEM sempre
  refletir o tema BÍBLICO dominante quando ele emergir. Se o título inicial
  foi tirado da introdução e agora o conteúdo bíblico domina, TROQUE o
  título — mesmo que isso contrarie a preferência de estabilidade.
  Estabilidade cede pra correção de tema.
- Personagens/textos bíblicos SEMPRE têm precedência sobre figuras seculares
  na hora de nomear o tema, exceto se a fala inteira for construída em torno
  da figura secular (raro; se acontecer, você percebe pela recorrência).

PRESERVAÇÃO DE CONTEÚDO (crítica para UX de leitura ao vivo)
- Quando um "previousSummary" for enviado junto com a transcrição, os blocos
  já produzidos estão sendo LIDOS pelo usuário em tempo real. Reescrever
  blocos antigos quebra a leitura.
- REGRA GERAL: blocos ANTIGOS são TRAVADOS — copie verbatim em "blocks", na
  mesma ordem, sem mudar uma palavra. Só os blocos MAIS RECENTES ficam
  editáveis, e a janela varia por fase:
    - intro/developing: só o ÚLTIMO bloco é editável.
    - mature: os ÚLTIMOS 3 blocos são editáveis (pode refinar, substituir
      ou remover); blocos anteriores a esses três são travados.
    - final: liberdade total (ver instruções da fase).
- Você pode, dentro da janela editável:
    (a) refinar/reescrever blocos editáveis, ou
    (b) manter os editáveis intactos e APENDAR novos blocos ao final, ou
    (c) combinar: ajustar alguns editáveis e apendar novos.
- Você NÃO pode: reordenar, remover ou editar blocos TRAVADOS. Se um bloco
  travado ficou factualmente incorreto por causa de contexto novo, mencione
  a correção em um novo bloco (paragraph) ao final, em vez de reescrever o
  antigo.
- "title" e "shortSummary" podem ser refinados livremente (não são travados)
  — a regra de DISCERNIMENTO DE TEMA acima é o que manda aqui.
- EXCEÇÃO: na fase "final" (gravação encerrada), você tem liberdade total
  pra reestruturar tudo. É a revisão definitiva.

DIVERSIDADE DE BLOCOS (importante para leitura)
- Um resumo com só paragraph em sequência é ruim de ler. Após 2-3 parágrafos
  seguidos, avalie se cabe quebrar com:
    - um h2 introduzindo o próximo sub-tema
    - um highlight com a frase de efeito do momento
    - um bibleQuote se um versículo foi citado
    - um quote (com lead-in) se uma citação atribuída apareceu
- Meta prática: sempre que possível, misture tipos de bloco. Se você já
  emitiu 3 paragraphs seguidos e não tem nenhuma variedade, procure
  ativamente por uma frase de efeito ou uma mudança de tema pra inserir
  um highlight ou h2.
- Um resumo de 5+ blocos que só tem paragraph indica que você deixou passar
  citações, versículos ou momentos de destaque. Volte e re-classifique.

REGRA DE VOZ (crítica) — vale para "title", "shortSummary" e "blocks"
- É PROIBIDO usar como sujeito ou como cabeça de frase, em qualquer lugar do
  corpo do resumo, as seguintes expressões (não é lista exaustiva):
    "o locutor", "o pregador", "o autor", "o palestrante",
    "o discurso", "a fala", "a exposição", "a mensagem", "o sermão",
    "a narrativa", "a reflexão", "a gravação", "o áudio",
    "ele destaca", "ele menciona", "ele fala", "ele explica",
    "é apresentado que", "é dito que", "é abordado que".
- Se você começou uma frase com uma dessas, REESCREVA colocando a IDEIA como
  sujeito. Ex.: "O locutor destaca a graça" → "A graça é destacada como…" ou
  simplesmente "A graça é suficiente porque…".
- Meta-narração sobre o discurso vive EXCLUSIVAMENTE no campo "thinking".
  Fora dali, o texto fala sobre o TEMA em si.
- Exceção pontual: é aceitável mencionar o locutor quando ele traz uma
  experiência pessoal específica que ilustra a ideia (ex.: "A experiência que
  ele conta com os próprios filhos ilustra como…"), mas isso é raro, não
  padrão.`;

const PHASE_INSTRUCTIONS: Record<SummaryPhase, string> = {
  intro: `FASE ATUAL: INTRO (primeiros ~60 segundos de gravação — ainda no comecinho).
- Manter EXTREMAMENTE ENXUTO. Nesta fase o campo "thinking" faz quase todo
  o trabalho.
- "thinking": OBRIGATORIAMENTE preenchido, em tom tentativo ("parece que",
  "primeira impressão", "ainda captando"). É o que o usuário vê enquanto
  espera o resumo real começar a se formar.
- "title": vazio "" a não ser que já esteja MUITO claro um tema — não force
  um título nas primeiras frases. Melhor vazio do que precipitado.
- "shortSummary": vazio "" quase sempre nessa fase — se você preencher, será
  substituído logo. Só use se realmente há uma tese enunciada nas primeiras
  frases.
- "blocks": ARRAY VAZIO [] na maioria das iterações intro. Exceção única:
  se um versículo foi lido com referência clara e você conhece o texto real,
  pode emitir UM bibleQuote seguindo a REGRA DE OURO. Nada mais. Nenhum
  paragraph, highlight, h2, quote, h1, conclusion.
- Lembre: essa fase representa "o palestrante mal começou". Não invente
  estrutura sobre o nada. Deixe o usuário perceber que você está esperando
  o conteúdo se formar — é essa a experiência esperada aqui.`,

  developing: `FASE ATUAL: DEVELOPING (transcrição de tamanho médio, ideias começando a se formar).
- "thinking": PREENCHIDO, refletindo o que você está processando agora
  ("conectando os dois exemplos", "notando que a ênfase mudou pra…").
- "title" e "shortSummary" devem estar preenchidos com voz direta.
- Blocos permitidos: paragraph, bibleQuote, highlight, quote, h2. Sem h1
  ainda. Sem conclusion.
- Se houver uma frase de efeito clara, use highlight. Se citou versículo, use
  bibleQuote seguindo a REGRA DE OURO.
- LEMBRE-SE: se veio previousSummary, apenas o último bloco pode ser
  refinado; os demais são travados.`,

  mature: `FASE ATUAL: MATURE (transcrição extensa, ideias estabelecidas).
- "thinking": PREENCHIDO, com atualizações do que está sendo refinado agora
  ("aprofundando o ponto sobre X", "novo versículo entrou, integrando…").
- Todos os tipos de bloco liberados EXCETO conclusion (só em final).
- Use h1 apenas para mudanças grandes de tema (1 a 3 no total).
- JANELA EDITÁVEL: os ÚLTIMOS 3 blocos do previousSummary são editáveis —
  pode refinar, substituir ou remover. Blocos anteriores são TRAVADOS
  (verbatim, mesma ordem). Use essa janela pra corrigir rumo se um bloco
  recente estiver mal ancorado (ex.: ainda preso na anedota de abertura
  quando o tema bíblico já dominou).`,

  final: `FASE ATUAL: FINAL (gravação encerrada, transcrição completa).
- Este é o resumo definitivo. "thinking" deve estar VAZIO ("").
- Todos os tipos de bloco liberados.
- Você DEVE encerrar "blocks" com { "type": "conclusion", "text": "..." }
  sintetizando o discurso inteiro e o principal chamado/aplicação — em voz
  direta sobre o conteúdo.
- A "conclusion" DEVE fechar sobre o TEMA BÍBLICO dominante (personagem,
  texto, doutrina), NUNCA sobre a anedota de abertura. Se restam blocos
  ancorados na introdução secular que não conectam com o tema bíblico
  central, ESTA é a fase pra reescrevê-los ou removê-los.
- title e shortSummary devem estar 100% alinhados com o tema bíblico real
  (releia a regra de DISCERNIMENTO DE TEMA). Se o título arrastou o nome
  de figura secular do gancho de abertura, tire agora.
- LIBERDADE de reestruturação para paragraph, h1, h2, highlight, quote:
  pode reordenar, reescrever, remover ou fundir.
- PRESERVAÇÃO OBRIGATÓRIA de bibleQuote:
  - TODA referência bíblica que apareceu como bibleQuote durante a fase
    live DEVE aparecer também no resumo final, mesmo que reposicionada.
    Nunca dropar um versículo que o usuário já viu na tela ao vivo.
  - Se a transcrição completa contém uma referência bíblica citada
    claramente pelo locutor que ainda não virou bibleQuote, EMITA agora
    seguindo a REGRA DE OURO (e a regra de RANGES para faixas de versículos).
  - Coerência entre live e final é chave: o usuário confia que o que já
    viu continua ali.`,
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const model = process.env.OPENAI_SUMMARY_MODEL ?? "gpt-4o-mini";

  let body: {
    text?: string;
    phase?: SummaryPhase;
    isFinal?: boolean;
    elapsedSec?: number;
    previous?: SummaryPayload;
  };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${(err as Error).message}` },
      { status: 400 }
    );
  }
  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "empty text" }, { status: 400 });
  }
  const phase = resolvePhase(body.phase, body.isFinal, text, body.elapsedSec);
  const systemPrompt = `${BASE_PROMPT}\n\n${PHASE_INSTRUCTIONS[phase]}`;

  const previous = normalizePreviousForPrompt(body.previous);
  const userMessage = previous
    ? `previousSummary:\n${JSON.stringify(previous)}\n\n---\ntranscript:\n${text}`
    : `transcript:\n${text}`;

  const startedAt = performance.now();
  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch (err) {
    console.error("[summarize] upstream fetch failed", {
      phase,
      error: (err as Error).message,
    });
    return NextResponse.json(
      { error: `upstream fetch failed: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  const raw = await upstream.text();
  if (!upstream.ok) {
    console.error("[summarize] upstream error", {
      phase,
      status: upstream.status,
      latencyMs,
      snippet: raw.slice(0, 300),
    });
    return NextResponse.json(
      { error: `upstream ${upstream.status}: ${raw.slice(0, 500)}`, latencyMs },
      { status: 502 }
    );
  }

  let parsed: {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // fall through
  }
  const content = parsed.choices?.[0]?.message?.content?.trim() ?? "";
  const finishReason = parsed.choices?.[0]?.finish_reason ?? "";

  const payload = normalizePayload(content, phase);

  console.log("[summarize] ok", {
    phase,
    latencyMs,
    finishReason,
    promptTokens: parsed.usage?.prompt_tokens,
    completionTokens: parsed.usage?.completion_tokens,
    blocks: payload.blocks.length,
    title: payload.title.slice(0, 60),
  });
  if (finishReason === "length") {
    console.warn("[summarize] output truncated by max_tokens", {
      phase,
      completionTokens: parsed.usage?.completion_tokens,
    });
  }

  return NextResponse.json({ ...payload, phase, latencyMs, model });
}

function resolvePhase(
  requested: SummaryPhase | undefined,
  isFinal: boolean | undefined,
  text: string,
  elapsedSec: number | undefined
): SummaryPhase {
  if (isFinal) return "final";
  if (
    requested === "final" ||
    requested === "mature" ||
    requested === "developing" ||
    requested === "intro"
  ) {
    return requested;
  }
  // Primary signal: elapsed recording time. Word count is a safety net so the
  // model can escalate if someone speaks fast in a short talk.
  const elapsed = typeof elapsedSec === "number" && elapsedSec >= 0 ? elapsedSec : 0;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const timePhase: SummaryPhase = elapsed < 60 ? "intro" : elapsed < 300 ? "developing" : "mature";
  const wordPhase: SummaryPhase =
    wordCount < 40 ? "intro" : wordCount < 250 ? "developing" : "mature";
  // Escalate to the more advanced of the two so runaway silence doesn't lock
  // us in intro forever, and a burst of words doesn't skip past a real intro.
  const order: Record<SummaryPhase, number> = {
    intro: 0,
    developing: 1,
    mature: 2,
    final: 3,
  };
  return order[timePhase] >= order[wordPhase] ? timePhase : wordPhase;
}

function normalizePreviousForPrompt(prev: SummaryPayload | undefined): SummaryPayload | null {
  if (!prev || typeof prev !== "object") return null;
  const title = typeof prev.title === "string" ? prev.title : "";
  const shortSummary = typeof prev.shortSummary === "string" ? prev.shortSummary : "";
  const blocks = Array.isArray(prev.blocks) ? prev.blocks : [];
  const hasContent = title || shortSummary || blocks.length > 0;
  if (!hasContent) return null;
  // thinking is ephemeral — don't send it back to the model.
  return { thinking: "", title, shortSummary, blocks };
}

function normalizePayload(content: string, phase: SummaryPhase): SummaryPayload {
  const empty: SummaryPayload = { thinking: "", title: "", shortSummary: "", blocks: [] };
  let obj: unknown = null;
  try {
    obj = JSON.parse(content);
  } catch {
    return empty;
  }
  if (!obj || typeof obj !== "object") return empty;
  const src = obj as Record<string, unknown>;
  const thinking = typeof src.thinking === "string" ? src.thinking.trim() : "";
  const title = typeof src.title === "string" ? src.title.trim() : "";
  const shortSummary = typeof src.shortSummary === "string" ? src.shortSummary.trim() : "";
  const rawBlocks = Array.isArray(src.blocks) ? src.blocks : [];
  const blocks: SummaryBlock[] = [];
  for (const b of rawBlocks) {
    if (!b || typeof b !== "object") continue;
    const rec = b as Record<string, unknown>;
    const type = typeof rec.type === "string" ? rec.type : "";
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    switch (type) {
      case "h1": {
        if (phase === "intro" || phase === "developing") break;
        if (text) blocks.push({ type: "h1", text });
        break;
      }
      case "h2":
      case "paragraph":
      case "highlight": {
        if (phase === "intro") break;
        if (text) blocks.push({ type, text });
        break;
      }
      case "bibleQuote": {
        const reference = typeof rec.reference === "string" ? rec.reference.trim() : "";
        if (reference) blocks.push({ type: "bibleQuote", reference, text });
        break;
      }
      case "quote": {
        if (phase === "intro") break;
        if (!text) break;
        const author = typeof rec.author === "string" ? rec.author.trim() : "";
        blocks.push(author ? { type: "quote", text, author } : { type: "quote", text });
        break;
      }
      case "conclusion": {
        if (phase !== "final") break;
        if (text) blocks.push({ type: "conclusion", text });
        break;
      }
      default:
        break;
    }
  }
  return { thinking, title, shortSummary, blocks };
}
