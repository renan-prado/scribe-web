import type { ConsolaReporter } from "consola/core";
import { formatContext, type LogContext } from "./format";

/**
 * Reporter de PRODUÇÃO. Sem cor, sem desenho, uma linha por evento:
 *
 *   18:04:11.204 INFO  bible             ok  latencyMs=812 tokens=430
 *   18:04:12.881 WARN  billing/checkout  mirror stale  userId=8f2c1a
 *   18:04:12.902 ERROR stripe/webhook    grant failed  event=evt_1P
 *
 * UMA linha é requisito, não estética. O coletor da Vercel trata cada linha
 * de stdout como um registro separado: quebrar o contexto numa segunda linha
 * o transformaria numa entrada órfã, sem nível, sem escopo e sem a mensagem a
 * que pertence — buscável, mas desgarrada justamente na hora do incidente.
 * O alinhamento por colunas dá a leitura em bloco que a segunda linha daria.
 */

/** Largura do escopo. Nomes maiores empurram a coluna nessa linha só. */
const SCOPE_WIDTH = 18;

const LEVEL_LABEL: Record<string, string> = {
  error: "ERROR",
  fatal: "FATAL",
  warn: "WARN ",
  success: "INFO ",
  info: "INFO ",
  debug: "DEBUG",
  log: "INFO ",
};

/** `HH:mm:ss.SSS` em UTC — o fuso do runtime da Vercel. */
function stamp(date: Date): string {
  return date.toISOString().slice(11, 23);
}

export const plainReporter: ConsolaReporter = {
  log(logObj) {
    const level = LEVEL_LABEL[logObj.type] ?? "INFO ";
    const scope = (logObj.tag || "app").padEnd(SCOPE_WIDTH);
    const [message, context] = logObj.args as [string, LogContext | undefined];

    const ctx = formatContext(context);
    const line = `${stamp(logObj.date)} ${level} ${scope} ${message}${ctx ? `  ${ctx}` : ""}`;

    const isFailure = logObj.type === "error" || logObj.type === "fatal";
    // stderr para falha, stdout para o resto: é o que separa "erro" de
    // "informação" em qualquer coletor, inclusive quando o log sai da Vercel.
    if (isFailure) console.error(line);
    else if (logObj.type === "warn") console.warn(line);
    else console.log(line);
  },
};
