/**
 * Build the metadata object we send to OpenAI on every chat call.
 * These tags show up in the OpenAI Logs UI (platform.openai.com/logs)
 * and let admins reconcile our llm_usage_events dashboard against the
 * upstream billing/logs side-by-side.
 *
 * OpenAI accepts up to 16 keys, each value must be a string.
 */

export function buildLlmMetadata(input: {
  route: string;
  userId: string;
  sessionId?: string | null;
}): Record<string, string> {
  const md: Record<string, string> = {
    route: input.route,
    user_id: input.userId,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  };
  if (input.sessionId) md.session_id = input.sessionId;
  return md;
}
