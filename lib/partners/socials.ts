/**
 * Perfis de rede social do parceiro: guardamos o @, não a URL.
 *
 * O campo é preenchido à mão pelo operador, e o que chega ali varia mais do
 * que parece: `@joao`, `joao`, `instagram.com/joao`, a URL inteira com
 * `?igsh=` colado do botão de compartilhar. Se cada um for gravado como veio,
 * o mesmo perfil aparece de três jeitos e não dá para montar um link a partir
 * do que está no banco.
 *
 * A normalização é deliberadamente burra — só extrai o último segmento de
 * caminho e tira o arroba. Não valida se o perfil existe nem se a rede é a
 * certa: isso exigiria bater na rede social, e o custo de errar aqui é um link
 * quebrado numa tela interna, não dinheiro.
 */

export const SOCIAL_NETWORKS = ["instagram", "tiktok", "youtube"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const PROFILE_URL: Record<SocialNetwork, (handle: string) => string> = {
  instagram: (h) => `https://instagram.com/${h}`,
  tiktok: (h) => `https://tiktok.com/@${h}`,
  youtube: (h) => `https://youtube.com/@${h}`,
};

/**
 * Devolve o handle sem `@`, sem domínio e sem query string. String vazia
 * quando não sobrou nada aproveitável — o chamador trata isso como "não
 * informado".
 */
export function normalizeHandle(input: string): string {
  let value = input.trim();
  if (!value) return "";

  // URL completa ou colada sem protocolo: fica o último segmento não vazio,
  // que é onde o handle mora nas três redes.
  if (value.includes("/")) {
    const withoutQuery = value.split(/[?#]/)[0];
    const segments = withoutQuery.split("/").filter(Boolean);
    value = segments.at(-1) ?? "";
  }

  return value.replace(/^@+/, "").trim();
}

export function socialProfileUrl(network: SocialNetwork, handle: string): string | null {
  const clean = normalizeHandle(handle);
  return clean ? PROFILE_URL[network](clean) : null;
}

/** Aplica `normalizeHandle` no mapa inteiro e descarta o que ficou vazio. */
export function normalizeSocials(socials: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(socials)) {
    const handle = normalizeHandle(value);
    if (handle) out[key] = handle;
  }
  return out;
}
