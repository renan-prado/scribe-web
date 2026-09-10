#!/usr/bin/env node
/**
 * Sobe a versão do `package.json`, escreve o CHANGELOG e marca o commit.
 *
 *   node scripts/release.mjs                # deriva o degrau dos commits
 *   node scripts/release.mjs minor          # força o degrau
 *   node scripts/release.mjs --dry-run      # mostra e não escreve nada
 *
 * POR QUE ISTO EXISTE, e não é burocracia de release:
 *
 * `llm_usage_events.app_version` carimba a versão em cada chamada de LLM, e o
 * `/admin/usage` compara VERSÃO CONTRA VERSÃO, custo por chamada, latência,
 * tokens. Esse corte só separa alguma coisa se a versão SUBIR a cada entrega.
 * Sem o bump, todo evento de todo deploy nasce com o mesmo rótulo, as linhas
 * da tabela se fundem numa só, e a pergunta "depois da 0.5.0 ficou pior?" não
 * tem onde ser respondida, sem erro nenhum na tela, que é o pior jeito de uma
 * medição falhar.
 *
 * A régua vem dos Conventional Commits que o `commitlint` já obriga, e ela é a
 * parte que dá SENTIDO ao número na tela do painel:
 *
 *   feat            → sobe o MINOR   (entrou capacidade nova)
 *   fix, perf       → sobe o PATCH   (o mesmo produto, consertado)
 *   resto           → sobe o PATCH
 *
 * `feat!` / `BREAKING CHANGE` sobe o MINOR enquanto o major for 0, e avisa: ir
 * para 1.0.0 é decisão de produto, não consequência de um commit.
 *
 * O que ele NÃO faz, de propósito: não faz push. A branch é escolha de quem
 * está entregando, e um push automático já mandaria para produção uma versão
 * que ninguém conferiu. Ele termina imprimindo o comando.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PKG = join(ROOT, "package.json");
const CHANGELOG = join(ROOT, "CHANGELOG.md");

const LEVELS = ["major", "minor", "patch"];

/** Tipo do commit → seção do CHANGELOG. O que não estiver aqui cai em "Outros". */
const SECTIONS = [
  { title: "Novidades", types: ["feat"] },
  { title: "Correções", types: ["fix"] },
  { title: "Desempenho", types: ["perf"] },
  { title: "Outros", types: null },
];

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}

function die(message, hint) {
  console.error(`\n  ✖ ${message}`);
  if (hint) console.error(`    ${hint}`);
  console.error("");
  process.exit(1);
}

// --- argumentos ------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const forced = args.find((a) => LEVELS.includes(a)) ?? null;
const unknown = args.filter((a) => a !== "--dry-run" && !LEVELS.includes(a));
if (unknown.length > 0) {
  die(`Argumento não reconhecido: ${unknown.join(", ")}`, "Use: [major|minor|patch] [--dry-run]");
}

// --- o repositório precisa estar limpo -------------------------------------

// A entrega vem ANTES do release, sempre: o CHANGELOG desta versão precisa
// conseguir descrever o commit que acabou de ser feito, e ele só existe depois
// de commitado. Uma árvore suja aqui quase sempre significa que o trabalho
// ainda não foi commitado, e o release entraria descrevendo uma versão que
// não é a que vai subir.
const dirty = git(["status", "--porcelain"]);
if (dirty && !dryRun) {
  die(
    "Há mudanças não commitadas.",
    "Commite o trabalho primeiro, o CHANGELOG desta versão precisa descrevê-lo."
  );
}

// --- de onde até onde ------------------------------------------------------

const lastTag = git(["describe", "--tags", "--abbrev=0"], { allowFail: true });
const range = lastTag ? `${lastTag}..HEAD` : "HEAD";

// Separadores de controle, e não vírgula ou barra: o corpo de um commit tem
// quebra de linha, dois-pontos e tudo mais que se possa eleger como
// delimitador. 0x1f separa CAMPO, 0x1e separa REGISTRO.
const FIELD = "\x1f";
const RECORD = "\x1e";
const raw = git(["log", "--format=%H%x1f%s%x1f%b%x1e", range]);
const commits = raw
  .split(RECORD)
  .map((chunk) => chunk.trim())
  .filter(Boolean)
  .map((chunk) => {
    const [hash, subject, body = ""] = chunk.split(FIELD);
    const match = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/.exec(subject ?? "");
    return {
      hash: (hash ?? "").slice(0, 7),
      subject: subject ?? "",
      type: match ? match[1] : null,
      scope: match ? (match[2] ?? null) : null,
      breaking: Boolean(match?.[3]) || /^BREAKING[ -]CHANGE:/m.test(body),
      description: match ? match[4] : (subject ?? ""),
    };
  });

if (commits.length === 0) {
  die(
    lastTag ? `Nenhum commit desde ${lastTag}.` : "Nenhum commit para versionar.",
    "Não há o que entregar, nada foi escrito."
  );
}

// --- o degrau --------------------------------------------------------------

const pkgText = readFileSync(PKG, "utf8");
const currentMatch = /"version"\s*:\s*"([^"]+)"/.exec(pkgText);
if (!currentMatch) die("Não achei o campo `version` no package.json.");
const current = currentMatch[1];
const [major, minor, patch] = current.split(".").map((n) => Number.parseInt(n, 10));
if (![major, minor, patch].every(Number.isFinite)) {
  die(`Versão atual não é semver: ${current}`);
}

const hasBreaking = commits.some((c) => c.breaking);
const hasFeat = commits.some((c) => c.type === "feat");
const derived = hasBreaking || hasFeat ? "minor" : "patch";
const level = forced ?? derived;

// Enquanto o major for 0, quebra de contrato sobe o minor: a semântica do
// semver para 0.x é justamente essa, e promover a 1.0.0 é decisão de produto,
// ela declara estabilidade a quem consome, e nenhum commit sabe declarar isso.
if (hasBreaking && major === 0 && level !== "major") {
  console.log("  ! Há commit marcado como BREAKING. Em 0.x isso sobe o MINOR.");
  console.log("    Ir para 1.0.0 é decisão de produto: rode `npm run release major`.");
}

const next =
  level === "major"
    ? `${major + 1}.0.0`
    : level === "minor"
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`;
const tag = `v${next}`;

if (git(["tag", "--list", tag])) {
  die(`A tag ${tag} já existe.`, "Rode com um degrau explícito ou apague a tag.");
}

// --- CHANGELOG -------------------------------------------------------------

function renderEntry(commit) {
  const scope = commit.scope ? `**${commit.scope}:** ` : "";
  return `- ${scope}${commit.description} (\`${commit.hash}\`)`;
}

const used = new Set();
const blocks = [];
for (const section of SECTIONS) {
  const picked = commits.filter((c) => {
    if (used.has(c.hash)) return false;
    return section.types === null || section.types.includes(c.type ?? "");
  });
  if (picked.length === 0) continue;
  for (const c of picked) used.add(c.hash);
  blocks.push(`### ${section.title}\n\n${picked.map(renderEntry).join("\n")}`);
}

const today = new Date().toISOString().slice(0, 10);
const compared = lastTag ? `, desde ${lastTag}` : "";
const entry = `## ${next}, ${today}${compared}\n\n${blocks.join("\n\n")}\n`;

const HEADER = `# Changelog

Cada versão aqui é um **corte de medição**, não um enfeite: ela é o valor de
\`llm_usage_events.app_version\` no \`/admin/usage\`, onde custo por chamada e
latência são comparados versão a versão. Quando aquela tabela disser que a
0.6.0 ficou mais cara, é esta lista que responde POR QUÊ.

Gerado por \`npm run release\` a partir dos Conventional Commits. \`feat\` sobe o
minor; o resto sobe o patch. Não edite à mão, a próxima execução escreve por
cima do topo do arquivo.
`;

// O cabeçalho é reescrito a cada release e o histórico é preservado inteiro: o
// corpo antigo começa na primeira linha "## ". Um arquivo sem nenhuma (a
// primeira execução) devolve corpo vazio, nunca o cabeçalho duplicado.
const previous = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, "utf8") : "";
const firstEntry = previous.indexOf("\n## ");
const body = firstEntry === -1 ? "" : previous.slice(firstEntry + 1);
const changelog = `${HEADER}\n${entry}${body ? `\n${body}` : ""}`;

// --- executa ---------------------------------------------------------------

console.log("");
console.log(`  ${current} → ${next}  (${level}${forced ? ", forçado" : ", derivado"})`);
console.log(`  ${commits.length} commit(s) desde ${lastTag ?? "o início do repositório"}`);
console.log("");
console.log(entry.replace(/^/gm, "  "));

if (dryRun) {
  console.log("  (--dry-run: nada foi escrito)\n");
  process.exit(0);
}

writeFileSync(PKG, pkgText.replace(currentMatch[0], `"version": "${next}"`), "utf8");
writeFileSync(CHANGELOG, changelog, "utf8");

git(["add", "--", "package.json", "CHANGELOG.md"]);
git(["commit", "-m", `chore(release): ${tag}`]);
git(["tag", "-a", tag, "-m", tag]);

const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
console.log(`  ✓ commit chore(release): ${tag} e tag ${tag}`);
console.log("");
console.log(`  Falta o push (a tag vai junto com --follow-tags):`);
console.log(`    git push --follow-tags origin ${branch}`);
console.log("");
