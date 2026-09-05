import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente do SERVIDOR. Guardam a chave da OpenAI, a
 * service-role do Supabase, a chave secreta do Stripe e o CRON_SECRET.
 *
 * O `server-only` acima não é decoração. Sem ele, um import distraído a
 * partir de um componente `"use client"` compilava: o Next não inlina env sem
 * `NEXT_PUBLIC_` no bundle do navegador, então o `safeParse` abaixo falhava em
 * tempo de execução, no cliente, derrubando o componente e imprimindo no
 * console os NOMES de todas as variáveis que faltaram. Com o guard, o mesmo
 * import vira erro de BUILD, na máquina de quem escreveu, com a mensagem
 * certa. A regra já estava no AGENTS.md; agora é o compilador que a cobra.
 */

const schema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_TRANSCRIBE_MODEL: z.string().default("gpt-4o-mini-transcribe"),
  /** Modelo mais robusto usado quando a qualidade do chunk padrão sai ruim
   * (assinatura de alucinação ou baixa confiança). Custa ~2x o mini; só é
   * cobrado nos chunks/sessões que precisarem. */
  OPENAI_TRANSCRIBE_ESCALATED_MODEL: z.string().default("gpt-4o-transcribe"),
  OPENAI_BIBLE_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_INSIGHTS_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_ECHO_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_FINAL_SUMMARY_MODEL: z.string().default("gpt-4o"),
  OPENAI_SUMMARY_ENRICHMENT_MODEL: z.string().default("gpt-4o"),
  // O estudo é um pipeline de três chamadas com papéis distintos: quem
  // PERGUNTA, quem RESPONDE e quem ESCREVE (ver docs/estudo-v2.md). Três
  // variáveis e não uma porque a qualidade do estudo é a qualidade das
  // perguntas: dá para subir só o questionador de modelo e medir o efeito
  // isoladamente, que é a única forma honesta de saber se compensou.
  //
  // Nenhuma delas é `gpt-4o`, e a diferença foi MEDIDA sobre um sermão real:
  // com 4o, as perguntas orbitavam o sermão, as respostas paravam em 190
  // palavras quando o prompt pedia 350-500, e o artigo saía com um terço do
  // material que recebia. Prompt não consertava — era teto de modelo.
  //
  // Os três já foram `gpt-5.1`. O estudo fechava a −16% de MARGEM assim
  // ($0,227 por estudo contra R$ 1,00 de receita a 50 moedas), e a medição
  // disse onde: token de SAÍDA é 85% da conta, e ela se reparte em
  // questionador 20%, respondedor 40%, redator 39%.
  //
  // Daí a assimetria abaixo, e ela é a razão de o pipeline ser separado em
  // três: **o modelo caro fica só onde moram os fatos.**
  //
  //   - QUESTIONADOR em mini: levantar 25-30 ângulos a temperatura alta é
  //     divergência, não dedução, e dois terços das perguntas são descartadas
  //     por desenho — pagar $10/M por andaime era o pior negócio da tabela. A
  //     seleção continua sendo feita pelo respondedor grande, que é a rede.
  //   - RESPONDEDOR fica: é a única etapa que carrega obra, controvérsia,
  //     data e referência bíblica. Citação inventada nasce aqui, e é o pior
  //     erro que o produto comete. É onde o modelo caro se paga.
  //   - REDATOR: ele recebe a substância já fixada, as passagens já conferidas
  //     contra a NVI (`lib/study/anchor.ts`) e os autores já filtrados, e a
  //     selagem ainda descarta o que ele inventar. Compor prosa de material
  //     pronto é composição, não dedução — mesma razão do
  //     `reasoningEffort: "low"` que ele já usava.
  //
  // O redator é `gpt-5.4-mini`, e os três candidatos foram medidos sobre o
  // MESMO sermão, com o resto do pipeline igual (`tmp/dev-scripts/study-eval.mts`):
  //
  //                        gpt-5.1   gpt-5.4-mini   gpt-5-mini
  //   custo do estudo      $0,1820      $0,1272      $0,1193
  //   palavras autorais      3.755        3.219        2.314
  //   palavras/parágrafo       140          108          106
  //   passagens ancoradas       16            6            4
  //   pipeline inteiro        354s         257s         282s
  //
  // O `gpt-5-mini` comprime: 62% da prosa do 5.1, e o artigo perde os blocos
  // estruturados (7 contra 14). É a falha nº 1 do cabeçalho de
  // `study-write.ts`, de volta.
  //
  // O `gpt-5.1` não é a alternativa, e não por preço: a 354s ele ESTOURA o
  // `maxDuration = 300` da rota. Com o respondedor medindo 170-185s, o redator
  // não tem mais 147s de orçamento — voltar para ele é trocar margem de 35%
  // por uma função que morre depois de debitar as moedas.
  //
  // Fica a diferença que o 5.4-mini não cobre: 108 palavras por parágrafo
  // contra 140, e 6 passagens ancoradas contra 16 — ou seja, ele aproveita
  // menos o trabalho do passo 3. Nenhum dos três cumpre o "4 a 6 parágrafos
  // por seção" do prompt (3,3 · 3,6 · 2,6), o que faz disso um problema de
  // PROMPT, não de modelo.
  OPENAI_STUDY_QUESTIONS_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_STUDY_ANSWERS_MODEL: z.string().default("gpt-5.1"),
  OPENAI_STUDY_WRITE_MODEL: z.string().default("gpt-5.4-mini"),
  // O guardião só classifica, mas classificar "esta pergunta está presa a
  // ESTE sermão?" acabou sendo difícil demais para um modelo pequeno de
  // geração antiga: medido sobre um sermão real, o gpt-4o-mini reprovava 26 de
  // 27 perguntas com o mesmo prompt em que o gpt-5-mini reprova 6 — e um
  // filtro que reprova tudo não filtra nada, só aciona o fallback. Custa 9s.
  OPENAI_STUDY_GUARD_MODEL: z.string().default("gpt-5-mini"),
  /**
   * Capa dos livros indicados no estudo. OPCIONAL: sem ela o resolvedor
   * devolve null sem chamar ninguém e a UI desenha uma capa tipográfica.
   *
   * Sem chave, a API do Google responde 429 a toda chamada — foi medido. E as
   * alternativas gratuitas não têm acervo de teologia em português: a busca
   * livre na Open Library devolve a capa de OUTRO livro do mesmo autor, que é
   * pior que capa nenhuma. Ver lib/study/covers.ts.
   */
  GOOGLE_BOOKS_API_KEY: z.string().optional(),
  OPENAI_REREADS_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_REMINDERS_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_FORMAT_MODEL: z.string().default("gpt-4o-mini"),
  /** Auditoria do alerta de alucinação. Julga se um card se sustenta na
   * transcrição — evento raro e de alto impacto, então vale o modelo bom. */
  OPENAI_HALLUCINATION_MODEL: z.string().default("gpt-4o"),
  /**
   * O analista financeiro do /admin. Roda no máximo uma vez por dia por tela,
   * disparado por um admin, sobre um briefing de números já agregados —
   * volume ínfimo, e a tarefa é aritmética cruzada, não redação. É o lugar do
   * modelo caro: um insight errado sobre margem custa mais que a chamada.
   */
  OPENAI_ADMIN_INSIGHTS_MODEL: z.string().default("gpt-5.1"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  /* ---- Stripe (billing) ----------------------------------------------
   * Deliberadamente OPCIONAIS: o app precisa subir num ambiente sem Stripe
   * configurado (dev local, preview, primeiro deploy). Quem consome estas
   * variáveis é `lib/billing/stripe.ts`, que devolve `null` quando faltam —
   * e as rotas /api/billing/* respondem 503 `billing_unavailable` em vez de
   * derrubar o processo inteiro no import.
   *
   * NENHUM valor de preço vive aqui: o preço real mora no Price object do
   * Stripe. O que guardamos é só o ID, e é dele que o webhook deriva quantas
   * moedas creditar (ver lib/billing/catalog.ts). */
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_PESSOAL: z.string().min(1).optional(),
  STRIPE_PRICE_ESTUDIOSO: z.string().min(1).optional(),
  STRIPE_PRICE_TOPUP_500: z.string().min(1).optional(),
  /** Base absoluta para as URLs de retorno do Checkout. Em produção é
   * https://scriba.cc; na Vercel cai no VERCEL_URL; local, no localhost. */
  APP_URL: z.string().url().optional(),
  /** Guarda de /api/billing/sweep (varredura periódica de pagamentos). Na
   * Vercel, basta a env var existir: o cron envia
   * `Authorization: Bearer <CRON_SECRET>` sozinho. Sem ela, a rota responde
   * 503 e a varredura simplesmente não existe. */
  CRON_SECRET: z.string().min(16).optional(),
});

const parsed = schema.safeParse({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_TRANSCRIBE_MODEL: process.env.OPENAI_TRANSCRIBE_MODEL,
  OPENAI_TRANSCRIBE_ESCALATED_MODEL: process.env.OPENAI_TRANSCRIBE_ESCALATED_MODEL,
  OPENAI_BIBLE_MODEL: process.env.OPENAI_BIBLE_MODEL,
  OPENAI_INSIGHTS_MODEL: process.env.OPENAI_INSIGHTS_MODEL,
  OPENAI_ECHO_MODEL: process.env.OPENAI_ECHO_MODEL,
  OPENAI_FINAL_SUMMARY_MODEL: process.env.OPENAI_FINAL_SUMMARY_MODEL,
  OPENAI_SUMMARY_ENRICHMENT_MODEL: process.env.OPENAI_SUMMARY_ENRICHMENT_MODEL,
  OPENAI_STUDY_QUESTIONS_MODEL: process.env.OPENAI_STUDY_QUESTIONS_MODEL,
  OPENAI_STUDY_ANSWERS_MODEL: process.env.OPENAI_STUDY_ANSWERS_MODEL,
  OPENAI_STUDY_WRITE_MODEL: process.env.OPENAI_STUDY_WRITE_MODEL,
  OPENAI_STUDY_GUARD_MODEL: process.env.OPENAI_STUDY_GUARD_MODEL,
  GOOGLE_BOOKS_API_KEY: process.env.GOOGLE_BOOKS_API_KEY,
  OPENAI_REREADS_MODEL: process.env.OPENAI_REREADS_MODEL,
  OPENAI_REMINDERS_MODEL: process.env.OPENAI_REMINDERS_MODEL,
  OPENAI_FORMAT_MODEL: process.env.OPENAI_FORMAT_MODEL,
  OPENAI_HALLUCINATION_MODEL: process.env.OPENAI_HALLUCINATION_MODEL,
  OPENAI_ADMIN_INSIGHTS_MODEL: process.env.OPENAI_ADMIN_INSIGHTS_MODEL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_PESSOAL: process.env.STRIPE_PRICE_PESSOAL,
  STRIPE_PRICE_ESTUDIOSO: process.env.STRIPE_PRICE_ESTUDIOSO,
  STRIPE_PRICE_TOPUP_500: process.env.STRIPE_PRICE_TOPUP_500,
  APP_URL:
    process.env.APP_URL ||
    (process.env.VERCEL_ENV === "production"
      ? "https://scriba.cc"
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"),
  CRON_SECRET: process.env.CRON_SECRET,
});

if (!parsed.success) {
  const details = JSON.stringify(parsed.error.flatten().fieldErrors, null, 2);
  throw new Error(`Invalid server environment variables:\n${details}`);
}

export const serverEnv = parsed.data;
