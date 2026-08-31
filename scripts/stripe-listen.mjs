#!/usr/bin/env node
/**
 * Sobe o `stripe listen` já apontado para o ambiente certo.
 *
 *   npm run stripe:listen
 *   npm run stripe:listen -- --port 3001
 *   npm run stripe:listen -- --write     (grava o whsec no .env.local)
 *
 * Resolve três atritos que aparecem toda vez que se retoma o desenvolvimento
 * da cobrança:
 *
 * 1. CONTEXTO. O CLI atual abre em modo LIVE e responde "You're in live mode…
 *    run 'stripe switch context' to select a sandbox". Seguir essa sugestão é
 *    armadilha: sandboxes são ambientes SEPARADOS do test mode clássico, com
 *    produtos e preços próprios — cair num deles dá "preço não existe nesta
 *    conta/modo". Aqui passamos `--api-key` com a chave que a própria
 *    aplicação usa, então o CLI escuta exatamente o ambiente certo.
 *
 * 2. SEGREDO NO HISTÓRICO. A chave é lida do .env.local e passada como
 *    argumento de processo, não interpolada num comando de shell.
 *
 * 3. O whsec ERRADO. Existem três `whsec_` possíveis (o do `stripe listen`, o
 *    de um endpoint de teste no dashboard, o do endpoint live) e nada no
 *    formato os distingue. Usar o errado é a falha mais silenciosa do fluxo:
 *    o cartão passa, a tela mostra sucesso, e o webhook devolve 400 sem
 *    ninguém olhar. Este script lê o segredo que o CLI imprime, compara com o
 *    do .env.local e grita se forem diferentes.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");
const args = process.argv.slice(2);
const portArg = args.indexOf("--port");
const PORT = portArg >= 0 ? args[portArg + 1] : "3000";
const WRITE = args.includes("--write");
const FORWARD_TO = `localhost:${PORT}/api/stripe/webhook`;

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(ENV_PATH, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [
          l.slice(0, i).trim(),
          l
            .slice(i + 1)
            .trim()
            .replace(/^["']|["']$/g, ""),
        ];
      })
  );
}

const env = readEnv();
const apiKey = env.STRIPE_SECRET_KEY;

if (!apiKey) {
  console.error("✗ STRIPE_SECRET_KEY não encontrada em .env.local. Veja docs/stripe-setup.md.");
  process.exit(1);
}
if (apiKey.startsWith("sk_live")) {
  console.error(
    [
      "✗ STRIPE_SECRET_KEY é uma chave LIVE.",
      "  `stripe listen` encaminha eventos de TESTE — com uma chave live nada bateria,",
      "  e você estaria a um clique de uma cobrança real em desenvolvimento.",
      "  Use a chave sk_test_... da mesma conta. Veja docs/stripe-setup.md, passo 6.",
    ].join("\n")
  );
  process.exit(1);
}

// No Windows o `stripe` costuma ser um `.cmd` (instalação via npm), e o
// `spawn` do Node não executa .cmd/.bat sem passar pelo shell. Como o shell
// reintroduz o risco de injeção pela linha de comando, conferimos antes que a
// chave é só [A-Za-z0-9_] — se o .env.local tiver algo estranho, preferimos
// abortar a mandar isso para um interpretador.
const needsShell = process.platform === "win32";
if (needsShell && !/^sk_(test|live)_[A-Za-z0-9]+$/.test(apiKey)) {
  console.error(
    [
      "✗ STRIPE_SECRET_KEY tem caracteres fora do formato esperado (sk_test_… alfanumérico).",
      "  Verifique se não sobrou aspa, espaço ou quebra de linha no .env.local.",
    ].join("\n")
  );
  process.exit(1);
}

console.log(`▸ stripe listen → ${FORWARD_TO}`);
console.log(`▸ ambiente fixado pela chave ${apiKey.slice(0, 12)}… do .env.local\n`);

const child = spawn("stripe", ["listen", "--api-key", apiKey, "--forward-to", FORWARD_TO], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: needsShell,
});

child.on("error", (err) => {
  if (err.code === "ENOENT") {
    console.error(
      [
        "\n✗ comando `stripe` não encontrado.",
        "  Instale o Stripe CLI: https://docs.stripe.com/stripe-cli",
        "  Depois rode `stripe login` uma vez.",
      ].join("\n")
    );
  } else {
    console.error(`\n✗ falha ao rodar o stripe CLI: ${err.message}`);
  }
  process.exit(1);
});

/** O CLI imprime o segredo uma única vez, na linha de boas-vindas. */
const SECRET_RE = /whsec_[A-Za-z0-9]+/;
let checked = false;

function checkSecret(text) {
  if (checked) return;
  const found = text.match(SECRET_RE);
  if (!found) return;
  checked = true;

  const cliSecret = found[0];
  const current = readEnv().STRIPE_WEBHOOK_SECRET;

  if (current === cliSecret) {
    console.log("\n✓ STRIPE_WEBHOOK_SECRET do .env.local confere com o do CLI.\n");
    return;
  }

  if (WRITE) {
    let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
    const line = `STRIPE_WEBHOOK_SECRET=${cliSecret}`;
    content = /^STRIPE_WEBHOOK_SECRET=.*$/m.test(content)
      ? content.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, line)
      : `${content.replace(/\s*$/, "")}\n${line}\n`;
    fs.writeFileSync(ENV_PATH, content);
    console.log(
      [
        "",
        "✓ STRIPE_WEBHOOK_SECRET atualizado no .env.local.",
        "  REINICIE o `npm run dev` — o Next só lê env vars ao subir.",
        "",
      ].join("\n")
    );
    return;
  }

  console.log(
    [
      "",
      "┌────────────────────────────────────────────────────────────",
      "│ ATENÇÃO: o STRIPE_WEBHOOK_SECRET do .env.local NÃO é este.",
      "│",
      "│ Do jeito que está, o webhook responde 400 e NENHUM pagamento",
      "│ vira crédito — sem erro visível na tela.",
      "│",
      "│ Cole no .env.local e reinicie o `npm run dev`:",
      "│",
      `│   STRIPE_WEBHOOK_SECRET=${cliSecret}`,
      "│",
      "│ (ou rode: npm run stripe:listen -- --write)",
      "└────────────────────────────────────────────────────────────",
      "",
    ].join("\n")
  );
}

// Repassamos tudo que o CLI escreve, para não esconder nada do usuário — só
// espiamos de passagem em busca do segredo. O CLI usa stderr para a linha de
// boas-vindas em algumas versões, então observamos os dois canais.
child.stdout.on("data", (buf) => {
  const text = buf.toString();
  process.stdout.write(text);
  checkSecret(text);
});
child.stderr.on("data", (buf) => {
  const text = buf.toString();
  process.stderr.write(text);
  checkSecret(text);
});

// Ctrl+C deve derrubar o CLI, não deixar um processo órfão escutando.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
child.on("exit", (code) => process.exit(code ?? 0));
