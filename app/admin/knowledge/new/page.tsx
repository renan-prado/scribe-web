import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { KnowledgeSourceForm } from "@/features/admin/knowledge/KnowledgeSourceForm";

export const metadata: Metadata = { title: "Nova fonte" };
export const dynamic = "force-dynamic";

export default function AdminKnowledgeNewPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Nova fonte"
        subtitle="Comentário, teologia sistemática, artigo, livro, editorial. Bíblias entram via CLI."
        actions={
          <Link href="/admin/knowledge">
            <Button variant="outline">← voltar</Button>
          </Link>
        }
      />
      <KnowledgeSourceForm />
    </div>
  );
}
