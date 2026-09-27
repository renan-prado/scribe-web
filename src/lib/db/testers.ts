import "server-only";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A fila do teste fechado da Play Store (migração 0078).
 *
 * Service-role em tudo, e não por comodidade: a tabela tem RLS ligada e
 * NENHUMA policy, porque ela não tem dono — quem preenche o formulário ainda
 * não tem conta no produto. O que ela guarda é dado pessoal de terceiro
 * (e-mail e telefone), e a chave anônima é pública; sem este arquivo do lado
 * de cá da fronteira, a lista de contatos seria um `GET /rest/v1/` para
 * qualquer um. Ver o cabeçalho da migração.
 */

const log = createLogger("testers");

export type TesterSignupInput = {
  /** Já normalizado pela rota: minúsculas, sem espaço nas pontas. */
  playEmail: string;
  /** Já normalizado pela rota: E.164 sem o `+` (ver `lib/domain/whatsapp`). */
  whatsapp: string;
  displayName: string | null;
};

/**
 * Grava (ou reescreve) o pré-cadastro daquele e-mail.
 *
 * **É um upsert, e a chave é o e-mail**, porque a segunda submissão do mesmo
 * endereço quase nunca é engano: é alguém que trocou de número ou que não
 * teve certeza de ter enviado. Duas linhas com o mesmo e-mail dariam duas
 * respostas diferentes para "manda o link para qual número?", e o console da
 * Play Store consumiria o endereço repetido do mesmo jeito.
 *
 * `invited_at` NÃO é tocado: quem já foi convidado e reenvia o formulário
 * continua convidado, e o reenvio não o devolve para a fila.
 */
export async function upsertTesterSignup(input: TesterSignupInput): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("tester_signups").upsert(
    {
      play_email: input.playEmail,
      whatsapp: input.whatsapp,
      display_name: input.displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "play_email" }
  );
  if (error) {
    log.error("falha ao gravar pré-cadastro de testador", { error: error.message });
    return false;
  }
  return true;
}

/**
 * Reserva o presente daquele e-mail para aquela conta, se houver um por
 * reservar. Devolve `true` só quando ESTA chamada foi a que o pegou.
 *
 * **O UPDATE condicional é o trinco** (migração 0079). Ele marca `gifted_at`
 * e devolve a linha só enquanto a coluna estava nula, então duas abas fazendo
 * login ao mesmo tempo disputam o mesmo UPDATE e só uma sai com `true`. Quem
 * emite o presente de verdade é `grantTesterGiftIfAny`, DEPOIS desta reserva:
 * marcar depois de inserir deixaria a janela aberta exatamente onde ela
 * importa, e o mesmo testador levaria o presente duas vezes.
 *
 * O e-mail chega já em minúsculas de quem chama, que é a forma como ele foi
 * gravado. Comparar sem normalizar faria `Fulano@Gmail.com` e
 * `fulano@gmail.com` serem duas pessoas, e a segunda nunca receberia nada.
 */
export async function claimTesterGift(playEmail: string, userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tester_signups")
    .update({ gifted_at: new Date().toISOString(), user_id: userId })
    .eq("play_email", playEmail)
    .is("gifted_at", null)
    .select("id");
  if (error) {
    log.error("falha ao reservar presente de testador", { error: error.message });
    return false;
  }
  return (data?.length ?? 0) > 0;
}
