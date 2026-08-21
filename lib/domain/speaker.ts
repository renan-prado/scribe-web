import { z } from "zod";

export const SpeakerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  defaultLocationId: z.string().uuid().nullable(),
  bio: z.string().nullable(),
  createdAt: z.string(),
});

export type Speaker = z.infer<typeof SpeakerSchema>;
