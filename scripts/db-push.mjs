#!/usr/bin/env node
/**
 * Aplica as migrações de `supabase/migrations/` no projeto do ambiente escolhido.
 *
 *   npm run db:push              → projeto de DEV  (ref lido de .env.dev)
 *   npm run db:push:prod -- --yes → projeto de PROD (ref lido de .env.prod)
 *
 * O CLI do Supabase guarda UM projeto vinculado por pasta (supabase/.temp/).
 * Com dois ambientes, esse estado invisível passa a ser um risco: você roda
 * `supabase db push`, ele acha que ainda está no dev, e estava no prod. Aqui o
 * vínculo é derivado do arquivo de ambiente a cada execução e reajustado antes
 * do push, então o que manda é o script de npm que você digitou — não um
 * `supabase link` que alguém rodou semana passada.
 *
 * Para produção o `--yes` é obrigatório: migração em banco com dados de gente
 * de verdade não deve caber num erro de digitação.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ENV_TARGETS, readEnvTarget } from "./env-file.mjs";

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function die(lines) {
  console.error(`\n${RED}✗ ${lines.join("\n  ")}${RESET}\n`);
  process.exit(1);
}

const argv = process.argv.slice(2);
const target = argv.find((a) => a in ENV_TARGETS) ?? "dev";
const confirmed = argv.includes("--yes");
const passthrough = argv.filter((a) => a !== target && a !== "--yes");
const isProd = target === "prod";

const env = readEnvTarget(target);
if (!env) die([`não achei ${ENV_TARGETS[target]}. Veja docs/ambientes.md.`]);

// O ref é o subdomínio da URL do projeto — não precisa ser uma variável
// separada, e duas fontes para o mesmo fato acabam divergindo.
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = env.SUPABASE_PROJECT_REF ?? url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

if (!ref) {
  die([
    `não consegui descobrir o project ref a partir de ${ENV_TARGETS[target]}.`,
    "  Esperava NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co",
  ]);
}

if (isProd && !confirmed) {
  die([
    `isto aplicaria migrações no Supabase de PRODUÇÃO (${ref}).`,
    "",
    "  Se é isso mesmo:",
    "    npm run db:push:prod -- --yes",
  ]);
}

console.log(
  isProd
    ? `\n${RED}▸ PRODUÇÃO — migrando ${ref}${RESET}\n`
    : `\n${GREEN}▸ dev — migrando ${ref}${RESET}\n`
);

/* ── vínculo ──────────────────────────────────────────────────────── */

const refFile = path.resolve(process.cwd(), "supabase/.temp/project-ref");
const linkedRef = fs.existsSync(refFile) ? fs.readFileSync(refFile, "utf8").trim() : null;

// `supabase link` pede a senha do banco interativamente; o CLI aceita
// SUPABASE_DB_PASSWORD para pular o prompt. Deixamos opcional — sem ela, o
// prompt aparece e você digita, o que é perfeitamente razoável.
const childEnv = { ...process.env };
if (env.SUPABASE_DB_PASSWORD) childEnv.SUPABASE_DB_PASSWORD = env.SUPABASE_DB_PASSWORD;
if (env.SUPABASE_ACCESS_TOKEN) childEnv.SUPABASE_ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN;

const shell = process.platform === "win32";

function supabase(args) {
  return spawnSync("supabase", args, { stdio: "inherit", shell, env: childEnv });
}

if (linkedRef !== ref) {
  console.log(`${DIM}vínculo atual: ${linkedRef ?? "(nenhum)"} → religando em ${ref}${RESET}\n`);
  const linked = supabase(["link", "--project-ref", ref]);
  if (linked.error?.code === "ENOENT") {
    die([
      "comando `supabase` não encontrado.",
      "  Instale o CLI: https://supabase.com/docs/guides/cli",
    ]);
  }
  if (linked.status !== 0) die(["`supabase link` falhou — veja a saída acima."]);
}

/* ── push ─────────────────────────────────────────────────────────── */

const pushed = supabase(["db", "push", ...passthrough]);
if (pushed.status !== 0) process.exit(pushed.status ?? 1);

console.log(`\n${GREEN}✓ migrações aplicadas em ${ref}.${RESET}`);
if (!isProd) {
  console.log(
    `${YELLOW}! O schema é só metade: provedores de auth, URLs de redirect e o Google OAuth`
  );
  console.log(`  moram no dashboard e NÃO vêm nas migrações. Veja docs/ambientes.md.${RESET}\n`);
}
