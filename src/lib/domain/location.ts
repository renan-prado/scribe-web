import { z } from "zod";

const LocationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  city: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});

export type Location = z.infer<typeof LocationSchema>;
