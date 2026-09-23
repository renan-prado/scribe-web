import type { Metadata } from "next";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { LexiconManager } from "@/features/admin/components/LexiconManager";
import { LexiconReports } from "@/features/admin/components/LexiconReports";
import { ContentTabs } from "@/features/admin/components/SectionTabs";
import { listLexiconForAdmin, listLexiconReports } from "@/lib/db/lexicon";
import { LEXICON_CATEGORIES, type LexiconCategory } from "@/lib/domain/lexicon";

export const metadata: Metadata = { title: "Léxico" };
export const dynamic = "force-dynamic";

/**
 * O cadastro dos nomes que o resumo marca.
 *
 * Ele é uma aba de **Conteúdo**, junto de Sessões e Feedback, porque responde à
 * mesma pergunta que as outras duas: "o que a pessoa recebeu presta?". As duas
 * primeiras olham para o que o modelo escreveu; esta olha para o que NÓS
 * escrevemos, que é a única parte do texto de um resumo com a nossa voz.
 *
 * (E não é um nono item de menu pela regra do painel: item de menu é uma
 * pergunta, recorte é aba. Ver `features/admin/AGENTS.md`.)
 */

type PageProps = {
  searchParams: Promise<{ q?: string; categoria?: string; estado?: string }>;
};

function parseCategory(value: string | undefined): LexiconCategory | undefined {
  return (LEXICON_CATEGORIES as readonly string[]).includes(value ?? "")
    ? (value as LexiconCategory)
    : undefined;
}

function parsePublished(value: string | undefined): boolean | undefined {
  if (value === "publicadas") return true;
  if (value === "rascunho") return false;
  return undefined;
}

export default async function AdminLexiconPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  // Duas leituras: a filtrada, que a tabela desenha, e a INTEIRA, que dá o
  // denominador do "x de y publicadas". Sem a segunda, filtrar por rascunho
  // mudaria o total na mesma tela em que se está tentando acompanhar o
  // progresso do trabalho.
  const [entries, all, reports] = await Promise.all([
    listLexiconForAdmin({
      search: sp.q?.trim() || undefined,
      category: parseCategory(sp.categoria),
      published: parsePublished(sp.estado),
    }),
    listLexiconForAdmin(),
    // Os alertas de leitores. Vêm sempre, e não só quando algum filtro pede: um
    // alerta fura a fila do cadastro (ver `LexiconReports`), e escondê-lo atrás
    // de um filtro seria enterrar exatamente o que veio de fora.
    listLexiconReports(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Léxico"
        subtitle="Os nomes que o resumo marca no texto, e o cartão que abre em cada um."
      />

      <ContentTabs active="lexico" />

      <LexiconReports reports={reports} />

      <LexiconManager
        entries={entries}
        current={{
          q: sp.q ?? "",
          categoria: sp.categoria ?? "",
          estado: sp.estado ?? "",
        }}
        total={{ all: all.length, published: all.filter((e) => e.published).length }}
      />
    </div>
  );
}
