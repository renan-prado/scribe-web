#!/usr/bin/env node
/**
 * Roda um comando com UM ambiente escolhido explicitamente.
 *
 *   node scripts/with-env.mjs dev  -- next dev
 *   node scripts/with-env.mjs prod -- next dev
 *
 * As variáveis entram em `process.env` do processo pai e são herdadas pelo
 * filho. Isso importa: `@next/env` só preenche chaves que AINDA NÃO existem em
 * `process.env` (ver `processEnv` em @next/env — a condição é
 * `typeof initialEnv[key] === "undefined"`). Ou seja, o que definimos aqui
 * ganha de qualquer arquivo que o Next porventura encontre. Mesmo assim
 * abortamos se um desses arquivos existir: preferimos não depender de uma
 * regra de precedência para não vazar produção para dentro do dev.
 *
 * Antes de subir qualquer coisa, o script confere a COERÊNCIA do arquivo — a
 * classe de erro que mais dói aqui não é a variável ausente (essa o Zod pega no
 * boot), é a variável presente e errada: chave live num ambiente de teste,
 * `.env.dev` apontando para o Supabase de produção. Nenhuma delas quebra nada
 * na hora; elas quebram depois, em cima de dados reais.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { AUTOLOADED_BY_NEXT, ENV_TARGETS, parseEnvFile, resolveEnvPath } from "./env-file.mjs";

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const BLUE = "\x1b[94m";

/**
 * A marca em blocos, impressa antes de qualquer outra coisa. Sai em azul no
 * dev e em VERMELHO em `npm run prod` — a mesma cor da moldura de aviso logo
 * abaixo, para que a troca de ambiente se veja antes de se ler uma palavra.
 */
const WORDMARK = [
  "▄█████ ▄█████ █████▄  ██ █████▄ ▄████▄ ",
  "▀▀▀▄▄▄ ██     ██▄▄██▄ ██ ██▄▄██ ██▄▄██ ",
  "█████▀ ▀█████ ██   ██ ██ ██▄▄█▀ ██  ██",
];

function die(lines) {
  console.error(`\n${RED}✗ ${lines.join(`\n  `)}${RESET}\n`);
  process.exit(1);
}

/* ── argumentos ───────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
const target = argv[0];
const command = sep >= 0 ? argv.slice(sep + 1) : [];

if (!(target in ENV_TARGETS) || command.length === 0) {
  die([
    "uso: node scripts/with-env.mjs <dev|prod> -- <comando> [args...]",
    `alvos: ${Object.keys(ENV_TARGETS).join(", ")}`,
  ]);
}

const isProd = target === "prod";

/* ── 1. nenhum arquivo que o Next carregue sozinho ────────────────── */

const strays = AUTOLOADED_BY_NEXT.filter((f) => fs.existsSync(path.resolve(process.cwd(), f)));
if (strays.length > 0) {
  die([
    `estes arquivos são carregados pelo Next automaticamente: ${strays.join(", ")}`,
    "",
    "  Com eles na pasta, as variáveis que este script NÃO definir vêm deles em",
    "  silêncio — que é exatamente como um `npm run dev` acaba escrevendo no",
    `  Supabase de produção. Mova o conteúdo para ${ENV_TARGETS.dev} / ${ENV_TARGETS.prod}`,
    "  e apague os originais.",
  ]);
}

/* ── 2. o arquivo do alvo ─────────────────────────────────────────── */

const envPath = resolveEnvPath(target);
if (!fs.existsSync(envPath)) {
  die([
    `não achei ${ENV_TARGETS[target]}.`,
    "",
    "  Copie o modelo e preencha:",
    `    cp .env.example ${ENV_TARGETS[target]}`,
    "",
    "  Veja docs/ambientes.md.",
  ]);
}

const env = parseEnvFile(envPath);

/* ── 3. coerência ─────────────────────────────────────────────────── */

const problems = [];
const warnings = [];

const stripeKey = env.STRIPE_SECRET_KEY ?? "";
const appUrl = env.APP_URL ?? "";
const appUrlIsLocal = /^https?:\/\/(localhost|127\.)/.test(appUrl);

if (isProd) {
  if (stripeKey.startsWith("sk_test")) {
    warnings.push("STRIPE_SECRET_KEY é de TESTE num arquivo de produção.");
  }
  if (appUrl && appUrlIsLocal) {
    warnings.push(`APP_URL aponta para ${appUrl} num arquivo de produção.`);
  }
} else {
  // Chave live em dev é abortar, não avisar: `stripe listen` só encaminha
  // eventos de TESTE, então o webhook local nunca confirmaria a compra — e o
  // cartão teria sido cobrado de verdade no caminho.
  if (stripeKey.startsWith("sk_live")) {
    problems.push([
      `${ENV_TARGETS.dev} tem uma STRIPE_SECRET_KEY LIVE.`,
      "  Um checkout daqui cobraria de verdade, e o crédito não entraria (o",
      "  `stripe listen` só encaminha eventos de teste). Use a chave sk_test_.",
    ]);
  }
  if (appUrl && !appUrlIsLocal) {
    warnings.push(`APP_URL=${appUrl} — o retorno do Checkout não volta para a sua máquina.`);
  }
}

// O erro mais caro de todos: os dois arquivos apontando para o MESMO banco.
// Aí "ambiente separado" vira uma etiqueta sem nada por trás.
const otherPath = resolveEnvPath(isProd ? "dev" : "prod");
if (fs.existsSync(otherPath)) {
  const other = parseEnvFile(otherPath);
  const mine = env.NEXT_PUBLIC_SUPABASE_URL;
  if (mine && mine === other.NEXT_PUBLIC_SUPABASE_URL) {
    problems.push([
      `.env.dev e .env.prod apontam para o MESMO Supabase (${mine}).`,
      "  Não há ambiente separado nenhum: um `npm run dev` escreve no banco real.",
    ]);
  }
  if (
    env.STRIPE_SECRET_KEY &&
    env.STRIPE_SECRET_KEY === other.STRIPE_SECRET_KEY &&
    env.STRIPE_SECRET_KEY.startsWith("sk_live")
  ) {
    problems.push([".env.dev e .env.prod compartilham a mesma chave LIVE do Stripe."]);
  }
}

if (problems.length > 0) {
  die(problems.flat());
}

/* ── 4. banner ────────────────────────────────────────────────────── */

const supabaseRef = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\./)?.[1];
const stripeMode = stripeKey.startsWith("sk_live")
  ? `${RED}LIVE (cobranças reais)${RESET}`
  : stripeKey
    ? "teste"
    : `${DIM}não configurado${RESET}`;

const line = "─".repeat(58);

console.log("");
for (const row of WORDMARK) console.log(`${isProd ? RED : BLUE}${BOLD}  ${row}${RESET}`);

if (isProd) {
  console.log(
    [
      "",
      `${RED}${BOLD}  ╔${"═".repeat(56)}╗`,
      "  ║  PRODUÇÃO — este processo fala com os dados REAIS.      ║",
      `  ╚${"═".repeat(56)}╝${RESET}`,
    ].join("\n")
  );
} else {
  console.log(`\n${GREEN}  ▸ ambiente de DESENVOLVIMENTO${RESET}`);
}

console.log(
  [
    `${DIM}  ${line}${RESET}`,
    `  arquivo   ${ENV_TARGETS[target]}`,
    `  supabase  ${supabaseRef ?? "(ausente)"}`,
    `  stripe    ${stripeMode}`,
    `  app url   ${appUrl || "(padrão do código)"}`,
    `${DIM}  ${line}${RESET}`,
    "",
  ].join("\n")
);

for (const w of warnings) console.log(`${YELLOW}! ${w}${RESET}`);
if (warnings.length > 0) console.log("");

/* ── 5. execução ──────────────────────────────────────────────────── */

// `NEXT_PUBLIC_*` são inlinadas no bundle do cliente em tempo de build. O Next
// mantém um cache em `.next/` por ambiente de execução, e trocar de env sem
// limpar já produziu bundle de dev falando com a URL de prod. Marcamos qual
// ambiente gerou o build atual para o desenvolvedor não perseguir esse fantasma.
process.env.SCRIBA_ENV = target;

const child = spawn(command[0], command.slice(1), {
  stdio: "inherit",
  // No Windows os binários de node_modules/.bin são .cmd, que o spawn não
  // executa sem shell. O comando vem do package.json, não de entrada do
  // usuário, então não há superfície de injeção aqui.
  shell: process.platform === "win32",
  env: { ...process.env, ...env },
});

child.on("error", (err) => {
  if (err.code === "ENOENT") die([`comando não encontrado: ${command[0]}`]);
  die([`falha ao rodar ${command[0]}: ${err.message}`]);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
child.on("exit", (code) => process.exit(code ?? 0));
