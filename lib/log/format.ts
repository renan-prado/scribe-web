/**
 * Serialização de contexto compartilhada pelos três reporters.
 *
 * Um log só é útil se couber na tela. As funções aqui existem para que um
 * objeto de contexto vire `chave=valor` curto e estável — o mesmo objeto
 * produz sempre o mesmo texto, em dev, no browser e em produção.
 */

/** O contexto de um log: pares nomeados, nunca uma string já formatada. */
export type LogContext = Record<string, unknown>;

export type LogLevelName = "error" | "warn" | "info" | "success" | "debug";

/**
 * Chaves cujo VALOR nunca é impresso. Não é paranoia: os objetos que passam
 * por aqui vêm de payloads do Stripe e de headers de request, e um dia um
 * deles vai carregar um `secret` junto. Redigir na saída é a única defesa que
 * não depende de quem escreveu a chamada ter lembrado.
 *
 * A comparação é por PALAVRA, não por substring, e a diferença não é
 * teórica: `/token/` casa com `promptTokens`, `completionTokens` e
 * `cachedTokens` — os três números que todo log de rota da OpenAI existe
 * para mostrar. Uma redação gulosa aqui apaga exatamente o dado que se
 * queria ver, e apaga em silêncio.
 */
const SENSITIVE_WORDS = new Set([
  "secret",
  "password",
  "passwd",
  "authorization",
  "cookie",
  "bearer",
  "credential",
  "credentials",
  "jwt",
  "signature",
  // Singular de propósito: `token` é um segredo, `tokens` é uma contagem.
  "token",
]);

/** Chaves inteiras que são segredo mas cuja última palavra (`key`) não é. */
const SENSITIVE_KEYS = new Set([
  "apikey",
  "secretkey",
  "privatekey",
  "signingkey",
  "accesskey",
  "sessionkey",
  "anonkey",
  "servicerolekey",
]);

/** `promptTokens` → ["prompt","tokens"] · `API_KEY` → ["api","key"]. */
function words(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

function isSensitive(key: string): boolean {
  const parts = words(key);
  if (SENSITIVE_KEYS.has(parts.join(""))) return true;
  return parts.some((part) => SENSITIVE_WORDS.has(part));
}

/** Acima disso o valor é truncado — uma transcrição inteira num log cega. */
const MAX_VALUE_CHARS = 180;

const truncate = (text: string) =>
  text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS - 1)}…` : text;

/**
 * Um valor qualquer vira texto de UMA linha. Erro vira a mensagem (não o
 * stack: o stack sai separado, uma vez, no fim da linha de erro).
 */
export function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  if (typeof value === "string") {
    // Aspas só quando o valor tem espaço — senão `chave=valor` fica poluído.
    return /\s/.test(value) ? `"${truncate(value)}"` : truncate(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Error) return `"${truncate(value.message)}"`;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return truncate(`[${value.map(formatValue).join(",")}]`);

  try {
    return truncate(JSON.stringify(value) ?? String(value));
  } catch {
    return "[unserializable]";
  }
}

/**
 * Troca o VALOR de toda chave sensível por um marcador, devolvendo o próprio
 * objeto quando não há nada a esconder (o caso comum não aloca).
 *
 * A redação mora aqui, e não em cada reporter, porque o reporter `fancy` do
 * consola inspeciona o objeto CRU — redigir só na hora de virar texto deixava
 * o terminal de desenvolvimento imprimindo a chave por extenso.
 */
export function redact(context: LogContext): LogContext {
  let hit = false;
  for (const key of Object.keys(context)) {
    if (isSensitive(key)) {
      hit = true;
      break;
    }
  }
  if (!hit) return context;

  const safe: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    safe[key] = isSensitive(key) ? "[redacted]" : value;
  }
  return safe;
}

/** `{ latencyMs: 812, tokens: 430 }` → `latencyMs=812 tokens=430`. */
export function formatContext(context: LogContext | undefined): string {
  if (!context) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    parts.push(`${key}=${isSensitive(key) ? "[redacted]" : formatValue(value)}`);
  }
  return parts.join(" ");
}

/**
 * Separa o que é contexto do que é um Error solto. `log.error("falhou", err)`
 * e `log.error("falhou", { err })` têm de sair iguais — a primeira forma é a
 * que sai naturalmente de um `catch`, e recusá-la só faria o autor da chamada
 * embrulhar o erro à mão em todo `catch` do app.
 */
export function normalizeContext(input: LogContext | Error | undefined): LogContext | undefined {
  if (!input) return undefined;
  if (input instanceof Error) {
    return { error: input.message, ...(input.name !== "Error" && { errorName: input.name }) };
  }
  return input;
}
