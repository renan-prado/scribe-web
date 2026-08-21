/**
 * Loggers gated por ambiente. `devLog` vira no-op em produção — usado pra
 * "trilhas de execução" (feed drip, session rollup, "[route] ok") que só
 * servem pra debug local. Falhas continuam usando console.warn/error direto.
 *
 * process.env.NODE_ENV é inlined pelo bundler no client (Next.js) e lido do
 * runtime no server, então a checagem funciona nos dois lados.
 */
const isDev = process.env.NODE_ENV !== "production";

export const devLog: (...args: unknown[]) => void = isDev
  ? (...args) => console.log(...args)
  : () => {};
