/**
 * Leitura dos arquivos de ambiente do projeto.
 *
 * Existem exatamente DOIS: `.env.dev` e `.env.prod`. Nenhum dos dois é
 * carregado automaticamente pelo Next — a escolha é sempre explícita, feita
 * por `scripts/with-env.mjs` a partir do script de npm que você rodou.
 *
 * Por que não usar os nomes que o Next reconhece sozinho (`.env.local`,
 * `.env.development.local`, …)? Porque o carregamento automático é o problema.
 * Com `.env.local` na pasta, um `next dev` distraído sobe apontando para o
 * Supabase e o Stripe de PRODUÇÃO sem dizer nada — e num app onde crédito é
 * dinheiro, "sem dizer nada" é o pior modo de falhar. Com nomes que o Next
 * ignora, subir sem escolher ambiente simplesmente não funciona: o Zod de
 * `lib/env/server.ts` derruba o processo no import.
 */

import fs from "node:fs";
import path from "node:path";

/** Os únicos alvos aceitos, e o arquivo de cada um. */
export const ENV_TARGETS = {
  dev: ".env.dev",
  prod: ".env.prod",
};

/**
 * Arquivos que o Next carrega SOZINHO (ver `loadEnvConfig` em `@next/env`).
 * A presença de qualquer um deles desfaz a garantia acima: variáveis que o
 * `with-env` não definiu seriam preenchidas por eles pelas costas. Por isso
 * `with-env.mjs` aborta se encontrar um.
 */
export const AUTOLOADED_BY_NEXT = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
  ".env.test",
  ".env.test.local",
];

/**
 * Parser mínimo de `.env`: uma variável por linha, `#` comenta a linha inteira,
 * aspas nas pontas são removidas. Deliberadamente sem interpolação de `$VAR` —
 * um segredo não deve depender do valor de outro.
 */
export function parseEnvFile(fullPath) {
  return Object.fromEntries(
    fs
      .readFileSync(fullPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.trimStart().startsWith("#") && line.includes("="))
      .map((line) => {
        const eq = line.indexOf("=");
        return [
          line.slice(0, eq).trim(),
          line
            .slice(eq + 1)
            .trim()
            .replace(/^["']|["']$/g, ""),
        ];
      })
  );
}

/** Resolve "dev" | "prod" (ou já um caminho de arquivo) para um caminho absoluto. */
export function resolveEnvPath(target, cwd = process.cwd()) {
  const file = ENV_TARGETS[target] ?? target;
  return path.resolve(cwd, file);
}

/** Lê o arquivo do alvo. Devolve `null` se ele não existir. */
export function readEnvTarget(target, cwd = process.cwd()) {
  const full = resolveEnvPath(target, cwd);
  if (!fs.existsSync(full)) return null;
  return parseEnvFile(full);
}
