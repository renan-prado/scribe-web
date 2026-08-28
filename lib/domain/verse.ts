import { z } from "zod";

const VersePayloadSchema = z.object({
  reference: z.string(),
  text: z.string(),
});

export type VersePayload = z.infer<typeof VersePayloadSchema>;
