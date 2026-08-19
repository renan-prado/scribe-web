import { z } from "zod";

const schema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_TRANSCRIBE_MODEL: z.string().default("gpt-transcribe"),
  OPENAI_SUMMARY_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_CONSOLIDATE_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_INSIGHTS_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_VERSE_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_FORMAT_MODEL: z.string().default("gpt-4o-mini"),
});

const parsed = schema.safeParse({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_TRANSCRIBE_MODEL: process.env.OPENAI_TRANSCRIBE_MODEL,
  OPENAI_SUMMARY_MODEL: process.env.OPENAI_SUMMARY_MODEL,
  OPENAI_CONSOLIDATE_MODEL: process.env.OPENAI_CONSOLIDATE_MODEL,
  OPENAI_INSIGHTS_MODEL: process.env.OPENAI_INSIGHTS_MODEL,
  OPENAI_VERSE_MODEL: process.env.OPENAI_VERSE_MODEL,
  OPENAI_FORMAT_MODEL: process.env.OPENAI_FORMAT_MODEL,
});

if (!parsed.success) {
  const details = JSON.stringify(parsed.error.flatten().fieldErrors, null, 2);
  throw new Error(`Invalid server environment variables:\n${details}`);
}

export const serverEnv = parsed.data;
