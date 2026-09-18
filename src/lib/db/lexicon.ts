import "server-only";
import type {
  AdminLexiconEntry,
  LexiconCard,
  LexiconCategory,
  LexiconEntryInput,
  LexiconIndexEntry,
} from "@/lib/domain/lexicon";
import { canPublishLexiconEntry, slugifyTerm } from "@/lib/domain/lexicon";
import { clientEnv } from "@/lib/env/client";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * O léxico: o índice que marca nomes na prosa, o cartão que abre no toque, e o
 * cadastro do painel.
 *
 * As três leituras públicas passam pelo client do USUÁRIO (anon + cookie), não
 * pelo service-role, e isso é deliberado: a policy da migração 0063 já diz
 * `using (published)`, então o rascunho não chega ao cliente por construção, e
 * não por um `.eq("published", true)` que alguém pode esquecer de escrever na
 * próxima consulta. Service-role aqui seria trocar uma garantia do banco por um
 * filtro em TypeScript.
 *
 * A ESCRITA é o oposto: service-role, porque não existe policy de escrita
 * nenhuma. Quem chama é `/api/admin/lexicon`, atrás de `requireAdmin()`.
 */

const log = createLogger("db/lexicon");

const BUCKET = "lexicon";

/**
 * A URL pública de uma imagem do bucket.
 *
 * Montada aqui, e não guardada no banco: a linha guarda o CAMINHO, e o domínio
 * do projeto Supabase é diferente em dev e em produção. Uma URL gravada faria a
 * mesma linha apontar para o ambiente errado no primeiro dump que alguém
 * copiasse de um lado para o outro.
 */
function publicImageUrl(path: string | null): string | null {
  if (!path) return null;
  return `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/* -------------------------------------------------------------------------- */
/*  O índice                                                                  */
/* -------------------------------------------------------------------------- */

type IndexRow = {
  slug: string;
  term: string;
  aliases: string[] | null;
  category: LexiconCategory;
};

/**
 * Cache de instância, com prazo.
 *
 * O índice é lido no layout de TODA tela logada; sem cache, abrir um resumo
 * custaria uma consulta a mais, e o conteúdo dela é o mesmo para todo mundo e
 * muda quando o admin publica algo, ou seja, quase nunca.
 *
 * **O prazo é o que substitui a invalidação.** Em serverless não há um processo
 * para avisar: a instância que atende o admin não é a que atende o leitor, e um
 * `revalidate` aqui dentro limparia um mapa que as outras não têm. Um minuto é
 * o atraso máximo entre publicar uma entrada e ela acender na tela de alguém,
 * que é o tipo de atraso que ninguém percebe e que uma tela de admin explica em
 * uma linha se preciso.
 */
const INDEX_TTL_MS = 60_000;
let indexCache: { entries: LexiconIndexEntry[]; at: number } | null = null;
let indexLoading: Promise<LexiconIndexEntry[]> | null = null;

/**
 * Os nomes publicados, para o anotador marcar na prosa.
 *
 * Falha de leitura devolve o que houver em cache, e senão lista vazia: sem
 * índice o parágrafo aparece sem marcação, que é exatamente como ele aparecia
 * antes desta feature existir. Derrubar a leitura de um resumo porque o
 * catálogo de nomes não respondeu seria trocar um enfeite por uma tela branca.
 */
export async function getLexiconIndex(): Promise<LexiconIndexEntry[]> {
  const now = Date.now();
  if (indexCache && now - indexCache.at < INDEX_TTL_MS) return indexCache.entries;
  if (indexLoading) return indexLoading;

  indexLoading = (async (): Promise<LexiconIndexEntry[]> => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("lexicon_entries")
        .select("slug, term, aliases, category")
        .order("term");

      if (error) throw new Error(error.message);

      const entries: LexiconIndexEntry[] = (data as IndexRow[]).map((row) => ({
        slug: row.slug,
        term: row.term,
        aliases: row.aliases ?? [],
        category: row.category,
      }));
      indexCache = { entries, at: Date.now() };
      return entries;
    } catch (err) {
      log.error("índice não carregou", { error: (err as Error).message });
      return indexCache?.entries ?? [];
    } finally {
      indexLoading = null;
    }
  })();

  return indexLoading;
}

/* -------------------------------------------------------------------------- */
/*  O cartão                                                                  */
/* -------------------------------------------------------------------------- */

type CardRow = {
  slug: string;
  term: string;
  category: LexiconCategory;
  title: string | null;
  description: string | null;
  image_path: string | null;
};

/** O cartão de uma entrada publicada, ou `null` se ela não existe (ou é rascunho). */
export async function getLexiconCard(slug: string): Promise<LexiconCard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lexicon_entries")
    .select("slug, term, category, title, description, image_path")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    log.error("cartão não carregou", { slug, error: error.message });
    return null;
  }
  if (!data) return null;

  const row = data as CardRow;
  return {
    slug: row.slug,
    term: row.term,
    category: row.category,
    title: row.title?.trim() || row.term,
    description: row.description?.trim() ?? "",
    imageUrl: publicImageUrl(row.image_path),
  };
}

/**
 * Os cartões que o BIBLO recebe como fonte, pelos slugs que o anotador achou na
 * pergunta.
 *
 * Uma consulta para os três, não três consultas: a rota do Biblo já paga uma
 * chamada de modelo e um débito de moeda, e não tem orçamento de latência para
 * gastar num laço de idas ao banco.
 */
export async function getLexiconCards(slugs: string[]): Promise<LexiconCard[]> {
  if (slugs.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lexicon_entries")
    .select("slug, term, category, title, description, image_path")
    .in("slug", slugs);

  if (error) {
    log.error("cartões não carregaram", { slugs, error: error.message });
    return [];
  }

  return (data as CardRow[]).map((row) => ({
    slug: row.slug,
    term: row.term,
    category: row.category,
    title: row.title?.trim() || row.term,
    description: row.description?.trim() ?? "",
    imageUrl: publicImageUrl(row.image_path),
  }));
}

/* -------------------------------------------------------------------------- */
/*  O painel                                                                  */
/* -------------------------------------------------------------------------- */

type AdminRow = CardRow & {
  id: string;
  aliases: string[] | null;
  published: boolean;
  updated_at: string;
};

const ADMIN_COLUMNS =
  "id, slug, term, aliases, category, title, description, image_path, published, updated_at";

function toAdminEntry(row: AdminRow): AdminLexiconEntry {
  return {
    id: row.id,
    slug: row.slug,
    term: row.term,
    aliases: row.aliases ?? [],
    category: row.category,
    title: row.title ?? "",
    description: row.description ?? "",
    imagePath: row.image_path,
    imageUrl: publicImageUrl(row.image_path),
    published: row.published,
    updatedAt: row.updated_at,
  };
}

export type AdminLexiconFilter = {
  search?: string;
  category?: LexiconCategory;
  /** `true` = só publicadas, `false` = só rascunhos, ausente = as duas. */
  published?: boolean;
};

/**
 * A lista do painel.
 *
 * **Sem paginação, de propósito.** São ~260 linhas hoje e o crescimento é de
 * uma por vez, escrita à mão por uma pessoa; uma barra de páginas sobre isso
 * seria um mecanismo a manter para um problema que este cadastro não tem.
 *
 * **A busca é feita em MEMÓRIA, e a categoria e o rascunho no banco.** A
 * divisão não é preguiça: o texto precisa cobrir também os APELIDOS (quem
 * procura "Lutero" não sabe, nem tem de saber, que a entrada se chama "Martinho
 * Lutero"), e `aliases` é `text[]`, onde o PostgREST só oferece `cs`, que casa
 * o elemento INTEIRO. Buscar "luter" não acharia nada. Sobre uma tabela desta
 * ordem de grandeza, filtrar depois de ler custa menos que um índice de busca
 * textual para 260 linhas.
 */
export async function listLexiconForAdmin(
  filter: AdminLexiconFilter = {}
): Promise<AdminLexiconEntry[]> {
  const admin = createAdminClient();
  let query = admin.from("lexicon_entries").select(ADMIN_COLUMNS);

  if (filter.category) query = query.eq("category", filter.category);
  if (filter.published !== undefined) query = query.eq("published", filter.published);

  const { data, error } = await query.order("published").order("term").limit(2000);
  if (error) {
    log.error("lista do painel falhou", { error: error.message });
    return [];
  }

  const entries = (data as AdminRow[]).map(toAdminEntry);
  const needle = filter.search?.trim().toLowerCase();
  if (!needle) return entries;

  return entries.filter((entry) =>
    [entry.term, entry.title, ...entry.aliases].some((field) =>
      field.toLowerCase().includes(needle)
    )
  );
}

export async function getLexiconEntryForAdmin(id: string): Promise<AdminLexiconEntry | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lexicon_entries")
    .select(ADMIN_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toAdminEntry(data as AdminRow);
}

export type LexiconWriteResult =
  | { ok: true; entry: AdminLexiconEntry }
  | { ok: false; reason: "duplicate" | "not_found" | "incomplete" | "error" };

/** `23505` é unique_violation: slug ou termo já cadastrados. */
function isDuplicate(code: string | undefined): boolean {
  return code === "23505";
}

/**
 * Cria uma entrada, sempre como RASCUNHO.
 *
 * O slug é derivado do termo e não vem do formulário: ele é identidade técnica,
 * e um campo a mais para preencher à mão é um campo a mais para digitar errado
 * num cadastro cujo trabalho de verdade é escrever o texto do cartão.
 */
export async function createLexiconEntry(
  input: LexiconEntryInput,
  adminId: string
): Promise<LexiconWriteResult> {
  const slug = slugifyTerm(input.term);
  if (!slug) return { ok: false, reason: "error" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lexicon_entries")
    .insert({
      slug,
      term: input.term,
      aliases: input.aliases,
      category: input.category,
      title: input.title || null,
      description: input.description || null,
      created_by: adminId,
    })
    .select(ADMIN_COLUMNS)
    .single();

  if (error) {
    if (isDuplicate(error.code)) return { ok: false, reason: "duplicate" };
    log.error("criação falhou", { slug, error: error.message });
    return { ok: false, reason: "error" };
  }
  log.info("entrada criada", { slug, adminId });
  return { ok: true, entry: toAdminEntry(data as AdminRow) };
}

/**
 * Edita uma entrada.
 *
 * **O slug NÃO é recalculado quando o termo muda**, e essa é a decisão que
 * protege o que já foi escrito: o slug é o endereço do cartão e é o que o Biblo
 * grava quando aponta uma entrada. Trocá-lo por causa de um acerto de acento
 * quebraria em silêncio toda referência já gravada. Quem quer outro endereço
 * cria outra entrada.
 *
 * Uma entrada PUBLICADA que perde o título ou a descrição volta a rascunho: o
 * publicado é a promessa de que há cartão, e salvar não pode deixá-la vazia de
 * pé.
 */
export async function updateLexiconEntry(
  id: string,
  input: LexiconEntryInput
): Promise<LexiconWriteResult> {
  const admin = createAdminClient();
  const complete = canPublishLexiconEntry(input);

  const patch: Record<string, unknown> = {
    term: input.term,
    aliases: input.aliases,
    category: input.category,
    title: input.title || null,
    description: input.description || null,
  };
  if (!complete) patch.published = false;

  const { data, error } = await admin
    .from("lexicon_entries")
    .update(patch)
    .eq("id", id)
    .select(ADMIN_COLUMNS)
    .maybeSingle();

  if (error) {
    if (isDuplicate(error.code)) return { ok: false, reason: "duplicate" };
    log.error("edição falhou", { id, error: error.message });
    return { ok: false, reason: "error" };
  }
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true, entry: toAdminEntry(data as AdminRow) };
}

/**
 * Acende ou apaga uma entrada.
 *
 * Publicar é o ato que faz o nome ser marcado na prosa de todo mundo e ficar
 * visível ao Biblo, então ele confere o conteúdo aqui também, e não só no
 * botão: o botão é UX, a conferência é a regra. Ver `canPublishLexiconEntry`.
 */
export async function setLexiconPublished(
  id: string,
  published: boolean,
  /**
   * O que está no formulário AGORA.
   *
   * **Publicar grava junto**, e essa não é uma conveniência: sem ela, o botão
   * confere o formulário e a rota confere a LINHA, e os dois discordam sempre
   * que alguém preenche os campos e vai direto ao Publicar. O sintoma era
   * exatamente esse — *"Escreva o título e a descrição antes de publicar"* com
   * os dois escritos na tela —, e a causa é um passo escondido ("salve
   * primeiro") que nada na tela pedia.
   *
   * Uma escrita só, e não um salvar seguido de um publicar: duas chamadas
   * abrem a janela em que a primeira passa e a segunda falha, e aí a entrada
   * fica gravada e apagada, que é o pior dos dois resultados.
   */
  input?: LexiconEntryInput
): Promise<LexiconWriteResult> {
  const admin = createAdminClient();

  // A conferência é sobre o que VAI ficar gravado: o formulário quando ele
  // veio, a linha quando não veio (é o caso do botão da lista, que publica sem
  // abrir nada).
  if (published) {
    const subject = input ?? (await getLexiconEntryForAdmin(id));
    if (!subject) return { ok: false, reason: "not_found" };
    if (!canPublishLexiconEntry(subject)) return { ok: false, reason: "incomplete" };
  }

  const patch: Record<string, unknown> = { published };
  if (input) {
    patch.term = input.term;
    patch.aliases = input.aliases;
    patch.category = input.category;
    patch.title = input.title || null;
    patch.description = input.description || null;
  }

  const { data, error } = await admin
    .from("lexicon_entries")
    .update(patch)
    .eq("id", id)
    .select(ADMIN_COLUMNS)
    .maybeSingle();

  if (error) {
    if (isDuplicate(error.code)) return { ok: false, reason: "duplicate" };
    log.error("publicação falhou", { id, published, error: error.message });
    return { ok: false, reason: "error" };
  }
  if (!data) return { ok: false, reason: "not_found" };
  log.info("publicação mudou", { id, published });
  return { ok: true, entry: toAdminEntry(data as AdminRow) };
}

export async function deleteLexiconEntry(id: string): Promise<boolean> {
  const admin = createAdminClient();
  const current = await getLexiconEntryForAdmin(id);
  const { error } = await admin.from("lexicon_entries").delete().eq("id", id);
  if (error) {
    log.error("exclusão falhou", { id, error: error.message });
    return false;
  }
  // A imagem vai junto: um arquivo órfão no bucket não aparece em tela nenhuma,
  // e ninguém vai lembrar de procurá-lo.
  if (current?.imagePath) await removeLexiconImage(current.imagePath);
  log.info("entrada apagada", { id });
  return true;
}

/* -------------------------------------------------------------------------- */
/*  A imagem                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Sobe a imagem e aponta a linha para ela.
 *
 * O nome do arquivo carrega um carimbo de tempo porque o bucket é público e
 * público quer dizer CACHEADO: sobrescrever `abraao.jpg` deixaria a foto antiga
 * viva nos navegadores e nas bordas por horas, e o sintoma seria "troquei a
 * imagem e não mudou nada". Nome novo, URL nova, e a antiga é apagada logo
 * abaixo.
 */
export async function setLexiconImage(
  id: string,
  file: { bytes: ArrayBuffer; contentType: string; extension: string }
): Promise<LexiconWriteResult> {
  const current = await getLexiconEntryForAdmin(id);
  if (!current) return { ok: false, reason: "not_found" };

  const admin = createAdminClient();
  const path = `${current.slug}-${Date.now()}.${file.extension}`;

  const upload = await admin.storage
    .from(BUCKET)
    .upload(path, file.bytes, { contentType: file.contentType, upsert: false });

  if (upload.error) {
    log.error("upload falhou", { id, path, error: upload.error.message });
    return { ok: false, reason: "error" };
  }

  const { data, error } = await admin
    .from("lexicon_entries")
    .update({ image_path: path })
    .eq("id", id)
    .select(ADMIN_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    // A linha não aceitou o caminho: o arquivo que acabou de subir não tem dono,
    // então ele sai agora. Sem isto, cada falha deixaria lixo permanente.
    await removeLexiconImage(path);
    log.error("imagem não vinculou", { id, path, error: error?.message });
    return { ok: false, reason: "error" };
  }

  if (current.imagePath) await removeLexiconImage(current.imagePath);
  return { ok: true, entry: toAdminEntry(data as AdminRow) };
}

export async function clearLexiconImage(id: string): Promise<LexiconWriteResult> {
  const current = await getLexiconEntryForAdmin(id);
  if (!current) return { ok: false, reason: "not_found" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lexicon_entries")
    .update({ image_path: null })
    .eq("id", id)
    .select(ADMIN_COLUMNS)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "error" };
  if (current.imagePath) await removeLexiconImage(current.imagePath);
  return { ok: true, entry: toAdminEntry(data as AdminRow) };
}

async function removeLexiconImage(path: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).remove([path]);
  // Falha aqui é lixo no bucket, não erro de produto: a linha já aponta para o
  // lugar certo. Fica o registro para quem for limpar.
  if (error) log.warn("imagem antiga não saiu", { path, error: error.message });
}
