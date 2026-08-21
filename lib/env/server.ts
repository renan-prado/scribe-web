import { z } from "zod";

const schema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_TRANSCRIBE_MODEL: z.string().default("gpt-transcribe"),
  OPENAI_EXTRACT_MODEL: z.string().default("gpt-4o"),
  OPENAI_SUGGEST_MODEL: z.string().default("gpt-4o"),
  OPENAI_ECHO_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_FINAL_SUMMARY_MODEL: z.string().default("gpt-4o"),
  OPENAI_FORMAT_MODEL: z.string().default("gpt-4o-mini"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const parsed = schema.safeParse({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_TRANSCRIBE_MODEL: process.env.OPENAI_TRANSCRIBE_MODEL,
  OPENAI_EXTRACT_MODEL: process.env.OPENAI_EXTRACT_MODEL,
  OPENAI_SUGGEST_MODEL: process.env.OPENAI_SUGGEST_MODEL,
  OPENAI_ECHO_MODEL: process.env.OPENAI_ECHO_MODEL,
  OPENAI_FINAL_SUMMARY_MODEL: process.env.OPENAI_FINAL_SUMMARY_MODEL,
  OPENAI_FORMAT_MODEL: process.env.OPENAI_FORMAT_MODEL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

if (!parsed.success) {
  const details = JSON.stringify(parsed.error.flatten().fieldErrors, null, 2);
  throw new Error(`Invalid server environment variables:\n${details}`);
}

export const serverEnv = parsed.data;
