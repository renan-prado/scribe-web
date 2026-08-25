import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { KnowledgePlayground } from "@/features/admin/knowledge/KnowledgePlayground";
import { SOURCE_TYPES } from "@/lib/knowledge/types";
import { KNOWLEDGE_PLAYGROUND_SYSTEM_PROMPT } from "@/lib/prompts/knowledge-playground";

export const metadata: Metadata = { title: "Playground" };
export const dynamic = "force-dynamic";

export default function AdminKnowledgePlaygroundPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Playground de retrieval"
        subtitle="Consulta livre à biblioteca. Ajuste o nº de resultados, filtros e prompt e observe se o retrieval trouxe o que era esperado."
        actions={
          <Link href="/admin/knowledge">
            <Button variant="outline">← voltar</Button>
          </Link>
        }
      />
      <KnowledgePlayground
        defaultSystemPrompt={KNOWLEDGE_PLAYGROUND_SYSTEM_PROMPT}
        sourceTypes={SOURCE_TYPES as unknown as string[]}
      />
    </div>
  );
}
