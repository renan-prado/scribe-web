import "server-only";

import { cookies } from "next/headers";

/**
 * Quantas conversas o Biblo já teve com este navegador — e, por isso, se ele
 * ainda precisa dizer quem é.
 *
 * ## Por que um COOKIE e não uma consulta
 *
 * O fato existe no banco: `biblo_messages` sabe em quantas sessões distintas a
 * pessoa já falou com ele. Só que um `count(distinct session_id)` não sai do
 * PostgREST sem uma função nova e um GRANT, e nada disso se paga para decidir
 * **o tom de uma frase de boas-vindas**.
 *
 * O preço do atalho é conhecido e é pequeno: o contador é por APARELHO. Quem
 * troca de celular para o computador, ou limpa os dados do navegador, ouve a
 * apresentação de novo. Numa atribuição de comissão isso seria inaceitável
 * (ver `features/referrals/cookies.ts`, que por isso mora no banco); aqui o pior
 * caso é alguém ser cumprimentado uma vez a mais por um assistente simpático.
 * E há um argumento a favor: aparelho novo é contexto novo.
 *
 * ## O que ele conta é CONVERSA, não abertura de gaveta
 *
 * Ele sobe em `POST /api/biblo`, e só quando a sessão ainda não tinha mensagem
 * nenhuma — ou seja, na PRIMEIRA pergunta de uma conversa. Abrir a gaveta,
 * olhar e fechar sem dizer nada não gasta apresentação, que é o comportamento
 * de quem ainda não entendeu para que ele serve: exatamente quem a
 * apresentação existe para alcançar.
 *
 * Nunca é lido por JavaScript de navegador — `httpOnly`, como todo cookie
 * nosso que não seja uma pista deliberada para a tela.
 */

export const BIBLO_INTRO_COOKIE = "scriba_biblo";

/**
 * Em quantas conversas ele se apresenta.
 *
 * Três é o suficiente para o hábito pegar sem virar ladainha: na primeira a
 * pessoa não sabe o que ele faz, na terceira ela já sabe e a frase começa a
 * atrapalhar o que ela veio perguntar.
 */
export const BIBLO_INTRO_CONVERSATIONS = 3;

/** Um ano. Expirar antes disso só faz ele se reapresentar, o que é inofensivo. */
const MAX_AGE = 365 * 24 * 60 * 60;

/** Teto de sanidade na leitura: o cookie é nosso, mas o navegador é do usuário. */
const MAX_COUNT = 999;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  } as const;
}

/** Quantas conversas este navegador já teve. Qualquer falha responde `0`. */
export async function readBibloConversations(): Promise<number> {
  try {
    const raw = (await cookies()).get(BIBLO_INTRO_COOKIE)?.value;
    const parsed = Number.parseInt(raw ?? "", 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(parsed, MAX_COUNT);
  } catch {
    return 0;
  }
}

/** Ele ainda se apresenta? */
export async function shouldIntroduceBiblo(): Promise<boolean> {
  return (await readBibloConversations()) < BIBLO_INTRO_CONVERSATIONS;
}

/**
 * Registra que uma conversa começou.
 *
 * **Só chame quando a sessão não tinha mensagem nenhuma.** Chamado a cada
 * mensagem, ele contaria perguntas em vez de conversas, e a apresentação
 * morreria na terceira pergunta da primeira conversa.
 *
 * Para de escrever depois do teto: passar de 3 não muda mais nada, e um cookie
 * que cresce para sempre é um cookie que um dia estoura sem motivo.
 */
export async function countBibloConversation(): Promise<void> {
  try {
    const current = await readBibloConversations();
    if (current >= BIBLO_INTRO_CONVERSATIONS) return;
    (await cookies()).set(BIBLO_INTRO_COOKIE, String(current + 1), cookieOptions());
  } catch {
    // Cookie recusado (contexto sem resposta escrevível, navegador travado):
    // o Biblo se apresenta de novo na próxima, e nada mais acontece. Nunca é
    // motivo para uma resposta já paga falhar.
  }
}
