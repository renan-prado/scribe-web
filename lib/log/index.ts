import { type ConsolaInstance, createConsola } from "consola";
import { browserReporter } from "./browser";
import { formatContext, type LogContext, normalizeContext, redact } from "./format";
import { plainReporter } from "./plain";

export type { LogContext } from "./format";

/**
 * O logger da aplicação. Uma API, três saídas.
 *
 *   import { createLogger } from "@/lib/log";
 *   const log = createLogger("bible");
 *
 *   log.info("ok", { latencyMs, tokens });
 *   log.warn("schema-drop", { dropped });
 *   log.error("upstream falhou", err);        // Error direto também serve
 *   log.debug("gate pulou", { score });       // some em produção
 *
 *   const req = log.child({ sessionId });     // contexto grudado
 *   req.info("salvo");                        // sai com sessionId junto
 *
 *   const done = log.time("upsert");          // cronômetro
 *   done("pronto", { rows });                 // sai com durationMs
 *
 * A ESCOLHA DO REPORTER É POR AMBIENTE, e é a razão de o módulo existir:
 *
 *   servidor + dev  → reporter `fancy` do consola: cor, ícone por nível,
 *                     escopo alinhado e o contexto inspecionado pelo Node.
 *   navegador       → `browserReporter`: pastilha CSS com cor derivada do
 *                     escopo, e o contexto como OBJETO vivo, expandível.
 *   produção        → `plainReporter`: uma linha, sem cor, colunas fixas.
 *
 * A troca é automática: `consola` resolve para o build de browser no bundle
 * do cliente e para o de Node no servidor, pelo campo `exports` do pacote.
 * Nenhum código de terminal chega ao navegador.
 */

const isBrowser = typeof window !== "undefined";
const isProduction = process.env.NODE_ENV === "production";

/** Níveis do consola: 0 error · 1 warn · 3 info/success · 4 debug. */
const LEVEL_INFO = 3;
const LEVEL_DEBUG = 4;
const LEVEL_WARN = 1;

/**
 * No navegador em produção o padrão é `warn`: o console de quem usa o app não
 * é o nosso painel, e o rastro de execução de uma gravação ao vivo lá dentro
 * é barulho para o usuário e detalhe interno exposto de graça. A escotilha de
 * saída é o localStorage — é o que permite pedir a alguém com um bug real
 * "roda isto e me manda o console" sem precisar de um deploy.
 *
 *   localStorage.setItem("scriba:log", "debug")   // e recarregar a página
 *
 * O nível é resolvido UMA vez, no carregamento do módulo: mudar a chave com
 * a página aberta não tem efeito até o reload.
 */
function resolveLevel(): number {
  if (isBrowser) {
    try {
      const override = window.localStorage.getItem("scriba:log");
      if (override === "debug") return LEVEL_DEBUG;
      if (override === "info") return LEVEL_INFO;
      if (override === "silent") return -999;
    } catch {
      // localStorage bloqueado (aba anônima, cookies desligados) — segue o padrão.
    }
    return isProduction ? LEVEL_WARN : LEVEL_DEBUG;
  }
  return isProduction ? LEVEL_INFO : LEVEL_DEBUG;
}

/**
 * `reporters` só é passado quando temos um nosso. Omitir a chave é o que
 * deixa o consola instalar o reporter `fancy` dele — o desenho bonito do
 * terminal em dev que não faz sentido reescrever à mão.
 */
const root: ConsolaInstance = createConsola({
  level: resolveLevel(),
  ...(isBrowser
    ? { reporters: [browserReporter] }
    : isProduction
      ? { reporters: [plainReporter] }
      : {
          // `compact: 3` é o que mantém `{ latencyMs: 812, tokens: 430 }` numa
          // linha só: sem ele o util.inspect do Node quebra todo objeto em uma
          // chave por linha, e um "ok" de rotina ocupa seis linhas do terminal.
          formatOptions: { colors: true, compact: 3, breakLength: 100 },
        }),
});

export interface Logger {
  /** O nome que aparece na pastilha/coluna. */
  readonly scope: string;

  /** Evento normal que vale em produção: algo aconteceu e ficou registrado. */
  info(message: string, context?: LogContext): void;
  /** Como `info`, com destaque de sucesso no terminal. */
  success(message: string, context?: LogContext): void;
  /** Algo saiu do trilho mas o fluxo seguiu. Aparece em produção. */
  warn(message: string, context?: LogContext): void;
  /** Falhou. Aceita um Error direto — a forma que sai de um `catch`. */
  error(message: string, context?: LogContext | Error): void;
  /** Rastro de execução. NÃO aparece em produção. */
  debug(message: string, context?: LogContext): void;

  /** Um logger igual, com contexto grudado em toda chamada. */
  child(context: LogContext): Logger;
  /** Um sub-escopo: `createLogger("billing").scoped("webhook")` → `billing/webhook`. */
  scoped(name: string): Logger;

  /**
   * Cronômetro. Devolve a função que fecha a medição e loga com `durationMs`.
   * Sai em `debug` por padrão; passe `"info"` para medições que valem em
   * produção (uma cobrança, um webhook).
   */
  time(label?: string, level?: "debug" | "info"): (message: string, context?: LogContext) => void;

  /** Tabela — só em desenvolvimento, no-op em produção. */
  table(rows: readonly LogContext[]): void;
}

function make(scope: string, bound: LogContext | undefined): Logger {
  // A tag do consola é a string INTEIRA do escopo, não uma cadeia de
  // `withTag`. Encadear faria o terminal imprimir `billing:checkout` (o
  // separador do consola) enquanto a linha de produção diria
  // `billing/checkout` — e `/` é o separador que este projeto já usava nos
  // colchetes desde antes deste módulo existir.
  const consola = scope === "app" ? root : root.withTag(scope);
  /** Contexto grudado + contexto da chamada, sem criar objeto quando não há. */
  const merge = (context: LogContext | Error | undefined): LogContext | undefined => {
    const normalized = normalizeContext(context);
    const merged = bound ? (normalized ? { ...bound, ...normalized } : bound) : normalized;
    return merged && redact(merged);
  };

  return {
    scope,

    info: (message, context) => consola.info(message, merge(context)),
    success: (message, context) => consola.success(message, merge(context)),
    warn: (message, context) => consola.warn(message, merge(context)),
    error: (message, context) => consola.error(message, merge(context)),
    debug: (message, context) => consola.debug(message, merge(context)),

    child: (context) => make(scope, bound ? { ...bound, ...context } : context),
    scoped: (name) => make(`${scope}/${name}`, bound),

    time(label, level = "debug") {
      const startedAt = Date.now();
      return (message, context) => {
        const withDuration = { durationMs: Date.now() - startedAt, ...context };
        const full = merge(withDuration);
        const text = label ? `${label} · ${message}` : message;
        if (level === "info") consola.info(text, full);
        else consola.debug(text, full);
      };
    },

    table(rows) {
      if (isProduction || rows.length === 0) return;
      // console.table desenha de verdade nos dois ambientes; o reporter do
      // consola não tem equivalente, então esta é a exceção que fala direto
      // com o console — e só em dev, onde a tabela é para olho humano.
      console.table(rows.map((row) => ({ ...bound, ...row })));
    },
  };
}

/**
 * Cria o logger de um módulo. O escopo é o mesmo nome que já vivia entre
 * colchetes nas mensagens (`"[bible] ok"` → `createLogger("bible")`), e agora
 * ele é um CAMPO — por isso o reporter consegue alinhar coluna, escolher cor
 * e, um dia, filtrar. Declare um por arquivo, no topo, ao lado dos imports.
 */
export function createLogger(scope: string, context?: LogContext): Logger {
  return make(scope, context);
}

/** Logger sem escopo, para os poucos lugares que não pertencem a um módulo. */
export const log: Logger = make("app", undefined);

/** Reexportado para quem precisa montar a linha à mão (scripts, testes). */
export { formatContext };
