/**
 * A economia do "Indique a um amigo", em um lugar só.
 *
 * Client-safe de propósito: a página `/indicar`, o card do feed e a tela de
 * entrada mostram estes números, e as funções do banco os RECEBEM por
 * parâmetro (ver o cabeçalho da migração 0045). Uma cópia só, portanto, o
 * mesmo motivo de `lib/partners/economics.ts` existir, e o mesmo motivo de
 * `lib/coins/pricing.ts` ser lido tanto pelo botão quanto pela rota.
 *
 * Nada aqui é segredo: são as regras públicas do programa. O que NÃO mora
 * aqui é qualquer decisão de crédito, isso é `lib/db/referrals.ts`,
 * server-only, chamando RPC com service-role.
 *
 * A memória de cálculo está em docs/indicacao.md.
 */

/**
 * Moedas para quem INDICA, quando o convidado cria a conta.
 *
 * 50 e não 150: é exatamente o brinde de boas-vindas, "trouxe alguém, ganhou
 * uma conta nova de moedas", e são ~7 minutos de Modo Completo. Ao custo
 * medido de R$ 2,69 o milheiro, custa **R$ 0,135** por cadastro.
 *
 * A conta que dá segurança a este número: o teto de moedas que podem ser
 * emitidas por cadastro sem o mês 1 ficar negativo é
 * `margem_recorrente × conversão ÷ (custo_por_moeda × uso)`, 745 moedas no
 * cenário realista (5% de conversão, 40% de uso) e 179 no pessimista (3% e
 * 100%). Mintamos 50. Mesmo a 1% de conversão o mês 1 fecha positivo, o que
 * é mais do que o programa de parceiros aguenta.
 */
export const REFERRAL_SIGNUP_COINS = 50;

/**
 * Moedas para quem indica quando o convidado ASSINA, uma vez por pessoa, para
 * sempre (a trava é o `external_ref` UNIQUE da migração).
 *
 * 200 ≈ 28 minutos ao vivo. Custa R$ 0,538 contra R$ 16,03 de margem
 * recorrente do plano Pessoal: **3,4%**, contra os 30% que o parceiro leva.
 * A diferença é deliberada e é o desenho dos dois programas, o parceiro tem
 * audiência, emite nota e recebe PIX; o amigo mandou um link no grupo da
 * igreja.
 *
 * Sem teto mensal, ao contrário do cadastro: assinatura sempre paga a própria
 * conta, então limitá-la seria recusar lucro.
 */
export const REFERRAL_SUBSCRIPTION_COINS = 200;

/**
 * Quantos cadastros premiados uma mesma pessoa pode acumular por mês.
 *
 * NÃO é medo de fraude, o login é só Google e o prêmio é R$ 0,135; farmar
 * conta não paga o trabalho. É um sinal de produto: quem estoura este teto
 * não é alguém indicando amigos, é um divulgador, e o lugar dele é o programa
 * de parceiros (com comissão em dinheiro, que o link de amigo não dá).
 *
 * Estourado o teto, o vínculo CONTINUA sendo gravado e a recompensa por
 * assinatura continua valendo, ver `attach_referrer` na migração 0045. O
 * teto cala o crédito do cadastro, não o programa.
 */
export const REFERRAL_MONTHLY_SIGNUP_CAP = 10;

/** Exposição máxima em moedas que uma conta pode gerar por mês em cadastros. */
export const REFERRAL_MONTHLY_COIN_EXPOSURE = REFERRAL_SIGNUP_COINS * REFERRAL_MONTHLY_SIGNUP_CAP;

/**
 * Alfabeto do código, sem ambiguidade visual: nada de `0`/`O`, `1`/`l`/`i`.
 *
 * ESPELHA o `v_alphabet` de `generate_referral_code()` e o CHECK de formato
 * de `profiles.referral_code` (migração 0045). Se um mudar, mudam os dois.
 *
 * O código é ditado em conversa, "manda lá: k7m3q2r", e digitado à mão na
 * tela de entrada. Um "zero ou ó?" custa uma indicação inteira.
 */
export const REFERRAL_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const REFERRAL_CODE_LENGTH = 7;

const CODE_RE = new RegExp(`^[${REFERRAL_CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

/**
 * Normaliza um código vindo da URL ou de um campo digitado. Devolve `null`
 * quando não é um código POSSÍVEL, o que é diferente de inexistente: quem
 * decide se ele existe é o banco.
 *
 * Validar aqui evita ida ao banco para toda bobagem que aparecer na URL e,
 * no campo da tela de entrada, permite dizer "código inválido" antes do
 * submit.
 */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase();
  return CODE_RE.test(code) ? code : null;
}

/** O caminho público do link de indicação de um código. */
export function referralPath(code: string): string {
  return `/i/${code}`;
}
