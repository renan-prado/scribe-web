import { z } from "zod";

export const VersePayloadSchema = z.object({
  reference: z.string(),
  text: z.string(),
});

export type VersePayload = z.infer<typeof VersePayloadSchema>;
