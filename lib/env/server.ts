import { z } from "zod";

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
  OPENAI_DEEPENING_MODEL: z.string().default("gpt-4o"),
  OPENAI_DEEPENING_AUDIT_MODEL: z.string().default("gpt-4o"),
  OPENAI_PRACTICES_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_REREADS_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_REMINDERS_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_FORMAT_MODEL: z.string().default("gpt-4o-mini"),
  /** Auditoria do alerta de alucinação. Julga se um card se sustenta na
   * transcrição — evento raro e de alto impacto, então vale o modelo bom. */
  OPENAI_HALLUCINATION_MODEL: z.string().default("gpt-4o"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
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
  OPENAI_DEEPENING_MODEL: process.env.OPENAI_DEEPENING_MODEL,
  OPENAI_DEEPENING_AUDIT_MODEL: process.env.OPENAI_DEEPENING_AUDIT_MODEL,
  OPENAI_PRACTICES_MODEL: process.env.OPENAI_PRACTICES_MODEL,
  OPENAI_REREADS_MODEL: process.env.OPENAI_REREADS_MODEL,
  OPENAI_REMINDERS_MODEL: process.env.OPENAI_REMINDERS_MODEL,
  OPENAI_FORMAT_MODEL: process.env.OPENAI_FORMAT_MODEL,
  OPENAI_HALLUCINATION_MODEL: process.env.OPENAI_HALLUCINATION_MODEL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

if (!parsed.success) {
  const details = JSON.stringify(parsed.error.flatten().fieldErrors, null, 2);
  throw new Error(`Invalid server environment variables:\n${details}`);
}

export const serverEnv = parsed.data;
