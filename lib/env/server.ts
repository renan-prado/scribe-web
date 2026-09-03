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
  OPENAI_STUDY_QUESTIONS_MODEL: z.string().default("gpt-4o"),
  OPENAI_STUDY_ANSWERS_MODEL: z.string().default("gpt-4o"),
  OPENAI_STUDY_WRITE_MODEL: z.string().default("gpt-4o"),
  OPENAI_PRACTICES_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_REREADS_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_REMINDERS_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_FORMAT_MODEL: z.string().default("gpt-4o-mini"),
  /** Auditoria do alerta de alucinação. Julga se um card se sustenta na
   * transcrição — evento raro e de alto impacto, então vale o modelo bom. */
  OPENAI_HALLUCINATION_MODEL: z.string().default("gpt-4o"),
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
  OPENAI_PRACTICES_MODEL: process.env.OPENAI_PRACTICES_MODEL,
  OPENAI_REREADS_MODEL: process.env.OPENAI_REREADS_MODEL,
  OPENAI_REMINDERS_MODEL: process.env.OPENAI_REMINDERS_MODEL,
  OPENAI_FORMAT_MODEL: process.env.OPENAI_FORMAT_MODEL,
  OPENAI_HALLUCINATION_MODEL: process.env.OPENAI_HALLUCINATION_MODEL,
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
