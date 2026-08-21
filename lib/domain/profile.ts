import { z } from "zod";

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  email: z.string().nullable(),
  createdAt: z.string(),
});

export type Profile = z.infer<typeof ProfileSchema>;
