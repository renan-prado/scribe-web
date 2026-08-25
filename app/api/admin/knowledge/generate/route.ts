import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { searchKnowledge } from "@/lib/knowledge/search";
import { SOURCE_TYPES } from "@/lib/knowledge/types";
import { callChat } from "@/lib/llm/openai";
import { KNOWLEDGE_PLAYGROUND_SYSTEM_PROMPT } from "@/lib/prompts/knowledge-playground";

const GenerateBody = z.object({
  query: z.string().min(1).max(4000),
  topK: z.number().int().min(1).max(30).optional(),
  sourceTypes: z.array(z.enum(SOURCE_TYPES)).max(SOURCE_TYPES.length).optional(),
  metadataFilter: z.record(z.string(), z.unknown()).nullable().optional(),
  systemPrompt: z.string().max(20_000).optional(),
  model: z.enum(["gpt-4o-mini", "gpt-4o"]).optional(),
});

const MAX_FONTES_CHARS = 8000;

/**
 * Playground generation: retrieve top-K, format as FONTES block, ask
 * the LLM to answer strictly from those chunks. This is a retrieval
 * quality bench, not a user-facing route.
 */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = GenerateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const startedAt = performance.now();
  let searchLatencyMs = 0;

  try {
    const searchStart = performance.now();
    const chunks = await searchKnowledge(parsed.data.query, {
      topK: parsed.data.topK ?? 10,
      sourceTypes: parsed.data.sourceTypes,
      metadataFilter: parsed.data.metadataFilter ?? undefined,
      admin: true,
    });
    searchLatencyMs = Math.round(performance.now() - searchStart);

    if (chunks.length === 0) {
      return NextResponse.json({
        chunks: [],
        answer: "Nenhum trecho relevante encontrado na biblioteca para essa consulta.",
        latencyMs: Math.round(performance.now() - startedAt),
        searchLatencyMs,
        usage: null,
      });
    }

    let fontesBlock = "";
    const chunksUsed: typeof chunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const entry = `[${i + 1}] ${c.sourceTitle}${c.section ? ` — ${c.section}` : ""}\n${c.content}\n\n`;
      if (fontesBlock.length + entry.length > MAX_FONTES_CHARS) break;
      fontesBlock += entry;
      chunksUsed.push(c);
    }

    const system = parsed.data.systemPrompt?.trim() || KNOWLEDGE_PLAYGROUND_SYSTEM_PROMPT;
    const userMessage = `PERGUNTA:\n${parsed.data.query}\n\nFONTES:\n${fontesBlock.trim()}`;

    const chatStart = performance.now();
    const chat = await callChat({
      model: parsed.data.model ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      maxTokens: 2000,
      metadata: {
        route: "admin_knowledge_generate",
        chunks: String(chunksUsed.length),
      },
    });
    const chatLatencyMs = Math.round(performance.now() - chatStart);

    if (!chat.ok) {
      return NextResponse.json(
        {
          chunks: chunksUsed,
          answer: null,
          error: chat.error.kind === "http" ? chat.error.message : chat.error.message,
          searchLatencyMs,
          chatLatencyMs,
        },
        { status: 502 }
      );
    }

    const latencyMs = Math.round(performance.now() - startedAt);
    console.log(
      JSON.stringify({
        tag: "[admin/knowledge]",
        event: "generate",
        query: parsed.data.query.slice(0, 80),
        topK: parsed.data.topK ?? 10,
        chunksUsed: chunksUsed.length,
        model: parsed.data.model ?? "gpt-4o-mini",
        promptTokens: chat.data.usage.promptTokens,
        completionTokens: chat.data.usage.completionTokens,
        latencyMs,
      })
    );

    return NextResponse.json({
      chunks: chunksUsed,
      answer: chat.data.content,
      usage: chat.data.usage,
      latencyMs,
      searchLatencyMs,
      chatLatencyMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      JSON.stringify({
        tag: "[admin/knowledge]",
        event: "generate_error",
        error: message,
      })
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
