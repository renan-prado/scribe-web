import type { ConsolaReporter } from "consola/core";
import { formatContext, type LogContext } from "./format";

/**
 * Reporter do console do navegador.
 *
 * O devtools sabe fazer duas coisas que um terminal não faz: pintar com CSS
 * (`%c`) e renderizar um objeto EXPANDÍVEL. Este reporter usa as duas — a
 * pastilha do escopo é CSS, e o contexto vai como objeto vivo no fim da
 * chamada, não como texto. Quem lê vê a linha curta e abre o objeto só quando
 * quer o detalhe.
 */

const LEVEL_STYLE: Record<
  string,
  { ink: string; badge: string; method: "log" | "warn" | "error" }
> = {
  error: { ink: "#e5484d", badge: "#feebec", method: "error" },
  warn: { ink: "#ad5700", badge: "#fff4d5", method: "warn" },
  success: { ink: "#18794e", badge: "#e0f8ea", method: "log" },
  info: { ink: "#0d74ce", badge: "#e1f0ff", method: "log" },
  debug: { ink: "#6f6e77", badge: "#f1f0f3", method: "log" },
};

/**
 * A cor da pastilha do escopo vem de um hash do próprio nome. Assim `[bible]`
 * é sempre do mesmo tom e `[queue]` de outro, sem tabela para manter: com
 * quinze pipelines gritando no mesmo console, a cor é o que deixa a vista
 * achar a linha certa antes de ler o texto.
 */
function scopeHue(scope: string): number {
  let hash = 0;
  for (let i = 0; i < scope.length; i++) hash = (hash * 31 + scope.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

const PILL = "border-radius:4px;padding:1px 6px;font-weight:600;";

export const browserReporter: ConsolaReporter = {
  log(logObj) {
    const level = LEVEL_STYLE[logObj.type] ?? LEVEL_STYLE.info;
    const scope = logObj.tag || "app";
    const [message, context] = logObj.args as [string, LogContext | undefined];

    const hue = scopeHue(scope);
    const scopeCss = `${PILL}background:hsl(${hue} 70% 92%);color:hsl(${hue} 80% 30%);`;
    const levelCss = `${PILL}background:${level.badge};color:${level.ink};margin-left:4px;`;
    const messageCss = `color:${level.ink};font-weight:500;margin-left:6px;`;

    // O nível só ganha pastilha própria quando não é o `info` do dia a dia —
    // senão toda linha viraria duas etiquetas e o escopo perderia o destaque.
    const showLevel = logObj.type !== "info" && logObj.type !== "log";

    const format = showLevel ? "%c%s%c%s%c%s" : "%c%s%c%s";
    const head = showLevel
      ? [scopeCss, scope, levelCss, logObj.type, messageCss, message]
      : [scopeCss, scope, messageCss, message];

    // O objeto entra CRU como último argumento: é o que dá a árvore
    // expandível do devtools. Passá-lo já formatado jogaria isso fora.
    const tail = context && Object.keys(context).length > 0 ? [context] : [];

    console[level.method](format, ...head, ...tail);
  },
};

/**
 * Fallback para consoles que não interpretam `%c` (algumas WebViews de
 * Android, e o console do Safari em iOS quando aberto por inspetor remoto).
 * Mesma informação, sem estilo.
 */
export const browserPlainReporter: ConsolaReporter = {
  log(logObj) {
    const level = LEVEL_STYLE[logObj.type] ?? LEVEL_STYLE.info;
    const [message, context] = logObj.args as [string, LogContext | undefined];
    const line = `[${logObj.tag || "app"}] ${message}`;
    const ctx = formatContext(context);
    console[level.method](ctx ? `${line}  ${ctx}` : line);
  },
};
