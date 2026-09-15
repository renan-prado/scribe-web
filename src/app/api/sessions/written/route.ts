import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/db/profiles";
import { createEmptySession, getSessionMeta, updateSessionSummary } from "@/lib/db/sessions";
import { WrittenSummarySchema, writtenToPayload } from "@/lib/domain/summary";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("written");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    /**
     * O id vem SEMPRE, inclusive no primeiro salvamento: ele é sorteado no
     * aparelho quando a folha em branco abre. Continua opcional no schema para
     * não quebrar uma aba velha aberta de antes do deploy, que ainda manda o
     * corpo sem ele.
     */
    id: z.uuid().optional(),
    summary: WrittenSummarySchema,
  })
  .strict();

/**
 * POST /api/sessions/written
 *
 * Salva o texto que a pessoa ESCREVEU em `/escrever`. Cria a linha no primeiro
 * salvamento, sobrescreve nos seguintes, e devolve o id nos dois casos.
 *
 * **Uma rota para os dois, e não um POST e um PUT**, porque para quem chama é
 * uma ação só: o editor salva sozinho a cada pausa da digitação, e ele não
 * deveria ter de saber se aquele salvamento é o primeiro. O primeiro é o único
 * que cria, e "criar" aqui é uma linha vazia seguida do mesmo UPDATE que todos
 * os outros fazem.
 *
 * **O ID vem do CLIENTE, e a linha nasce com ele.** É o editor quem sorteia
 * (ver `escrever/draft-store.ts`), porque o rascunho no aparelho precisa de uma
 * chave antes de existir rede. Então "veio um id que não acha linha nenhuma"
 * não é erro: é o primeiro salvamento de um texto que já vinha sendo escrito, e
 * a resposta certa é CRIAR com aquele id — não um 404, que descartaria o texto
 * que a pessoa acabou de digitar.
 *
 * O que continua sendo recusa é o id de outra pessoa. A RLS o esconde (o SELECT
 * volta vazio), a criação esbarra na unicidade da chave primária, e isso vira
 * 409 `id_taken` — a única saída honesta, porque escrever ali seria escrever na
 * sessão de outro. Chegar nesse caso exige adivinhar um uuid v4 inteiro.
 *
 * **Não cobra moeda, e não há o que discutir aqui:** não existe transcrição,
 * não existe chamada de modelo, não existe provedor. É o único caminho do
 * produto que produz um resumo de graça, e é de graça porque o trabalho foi
 * todo de quem escreveu.
 *
 * **O payload é o único que entra vindo do CLIENTE.** Um resumo gravado nasce
 * dentro do servidor, a partir da resposta do modelo; este chega por POST, e é
 * por isso que `WrittenSummarySchema` tem teto em cada campo e em cada lista:
 * sem eles uma aba empurraria megabytes de jsonb para dentro da linha.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["sessions-write"], auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  const payload = writtenToPayload(parsed.data.summary);
  let id = parsed.data.id;

  // A linha existe? É o que separa "sobrescrever" de "criar", e com o id vindo
  // do cliente essa pergunta deixou de ser "veio id?".
  const existing = id ? await getSessionMeta(id).catch(() => null) : null;

  if (id && existing) {
    // Dono ANTES de trabalhar, como manda `app/AGENTS.md`. A RLS já escoparia
    // o UPDATE, mas um id alheio receberia `{ ok: true }` mesmo assim, porque
    // UPDATE que casa zero linhas não é erro no PostgREST — e `getSessionMeta`
    // devolver a linha é justamente a prova de que ela é de quem pediu.
    //
    // O editor só sabe escrever o vocabulário de `WRITTEN_BLOCK_TYPES`, e uma
    // sessão gravada tem blocos que ele não desenha. Deixar este POST tocar
    // uma sessão `audio` seria apagar em silêncio o que a IA escreveu sobre
    // uma pregação — e apagar junto a transcrição da tela, que continuaria no
    // banco sem nada que a explicasse.
    if (existing.mode !== "manual") {
      return NextResponse.json({ error: "not_manual" }, { status: 409 });
    }
  } else {
    // **O autor de um texto manual é quem o escreveu.** Nos outros modos o
    // `speaker_name` é o PREGADOR, alguém que não é quem está com o aparelho na
    // mão, e por isso nasce vazio esperando ser preenchido. Aqui não há terceiro
    // nenhum: quem digitou é o autor, e deixar o campo em branco fazia a
    // Biblioteca mostrar um cartão sem assinatura e a leitura oferecer
    // "Adicionar autor" para uma pergunta que já tinha resposta. Continua
    // editável em `/summary`, para o caso de alguém transcrever à mão o sermão
    // de outra pessoa.
    //
    // `displayName` pode ser nulo (perfil que nunca teve nome), e aí volta a
    // ser o comportamento de antes — um chute a partir do e-mail seria assinar
    // o texto com "r.nanpr".
    const profile = await getCurrentProfile().catch(() => null);
    try {
      id = await createEmptySession({
        id,
        speakerName: profile?.displayName?.trim() || null,
        speakerLocation: null,
        mode: "manual",
      });
    } catch (err) {
      const message = (err as Error).message;
      // Chave primária ocupada: o id existe e não é de quem está pedindo (se
      // fosse, o SELECT acima o teria achado). 409 e não 500 — não houve falha
      // nossa, houve uma colisão, e o cliente precisa saber que insistir com
      // este id não vai adiantar.
      if (/duplicate key|23505/i.test(message)) {
        log.warn("id em uso", { id });
        return NextResponse.json({ error: "id_taken" }, { status: 409 });
      }
      log.error("create failed", { error: message });
      return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }
  }

  try {
    await updateSessionSummary(id, payload, { markEnded: true });
  } catch (err) {
    log.error("save failed", { id, error: (err as Error).message });
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  log.debug("saved", { id, blocks: payload.blocks.length });
  return NextResponse.json({ id });
}
