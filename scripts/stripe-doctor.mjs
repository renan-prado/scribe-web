#!/usr/bin/env node
/**
 * Diagnóstico da configuração de cobrança.
 *
 *   npm run stripe:doctor
 *
 * Não cobra nada e não altera nada de valor. A única escrita é, em modo de
 * TESTE, criar uma Checkout Session de sondagem e expirá-la em seguida — é o
 * único jeito de responder com CERTEZA "o checkout funciona?", em vez de
 * deduzir a resposta a partir de flags da conta. Em modo live essa etapa é
 * pulada.
 *
 * Essa etapa existe por um motivo concreto: numa conta ainda em análise,
 * `charges_enabled` vem `false` nos DOIS modos, mas o modo de teste funciona
 * normalmente. Deduzir da flag dava um falso negativo; criar a sessão não dá.
 *
 * Rode depois de configurar as variáveis, e de novo ao virar a chave para live.
 */

import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";

const ENV_FILE = process.argv[2] ?? ".env.dev";

function loadEnv(file) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) {
    console.error(`✗ não achei ${file}. Uso: node scripts/stripe-doctor.mjs [caminho/do/.env]`);
    process.exit(1);
  }
  return Object.fromEntries(
    fs
      .readFileSync(full, "utf8")
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

const env = { ...loadEnv(ENV_FILE), ...process.env };
const problems = [];
const notes = [];

if (!env.STRIPE_SECRET_KEY) {
  console.error("✗ STRIPE_SECRET_KEY ausente. Veja docs/stripe-setup.md, passo 2.");
  process.exit(1);
}

const isLiveKey = env.STRIPE_SECRET_KEY.startsWith("sk_live");
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

console.log("\n── Chave ────────────────────────────────────────────");
console.log(`modo: ${isLiveKey ? "LIVE (cobranças reais)" : "TESTE"}`);

const appUrl = env.APP_URL ?? "";
const appUrlIsLocal = appUrl.startsWith("http://localhost") || appUrl.startsWith("http://127.");

if (isLiveKey && appUrlIsLocal) {
  problems.push(
    [
      "Chave LIVE com APP_URL local. Em desenvolvimento use a chave de TESTE (sk_test_...) —",
      "  além do risco de cobrar de verdade, `stripe listen` só encaminha eventos de TESTE,",
      "  então o webhook local nunca receberia a confirmação e o crédito não entraria.",
    ].join("\n")
  );
}
if (!isLiveKey && appUrl && !appUrlIsLocal) {
  problems.push(
    [
      `Chave de TESTE com APP_URL apontando para fora do localhost (${appUrl}).`,
      "  As URLs de retorno do Checkout saem dela, então depois de pagar você cairia",
      "  no site de produção em vez de voltar para a sua máquina.",
      "  Em desenvolvimento: APP_URL=http://localhost:3000",
    ].join("\n")
  );
}

console.log("\n── Conta ────────────────────────────────────────────");
let account;
try {
  account = await stripe.accounts.retrieve();
} catch (err) {
  console.error(`✗ não consegui ler a conta: ${err.message}`);
  process.exit(1);
}

console.log(`país:            ${account.country}`);
console.log(`moeda padrão:    ${account.default_currency}`);
console.log(`dados enviados:  ${account.details_submitted ? "sim" : "não"}`);
console.log(`pode cobrar:     ${account.charges_enabled ? "sim" : "NÃO (só afeta live)"}`);

const due = account.requirements?.currently_due ?? [];
const disabled = account.requirements?.disabled_reason ?? null;
if (due.length > 0) console.log(`pendências:      ${due.join(", ")}`);
if (disabled) console.log(`bloqueio:        ${disabled}`);

// `charges_enabled` é um fato da conta REAL e vem `false` nos dois modos
// enquanto a ativação não sai. Só bloqueia dinheiro de verdade — em modo de
// teste é irrelevante. Por isso o mesmo fato vira problema com chave live e
// apenas observação com chave de teste.
if (!account.charges_enabled) {
  const bucket = isLiveKey ? problems : notes;
  if (due.length > 0) {
    bucket.push(
      [
        `A conta ainda não cobra de verdade: faltam dados (${due.join(", ")}).`,
        "  Complete em https://dashboard.stripe.com/settings/account",
      ].join("\n")
    );
  } else if (disabled) {
    bucket.push(`A conta ainda não cobra de verdade. Motivo do Stripe: ${disabled}`);
  } else {
    bucket.push(
      [
        "A conta ainda não cobra de verdade, e não há nada pendente da sua parte —",
        "  é a análise do Stripe, que costuma levar de horas a alguns dias.",
        "  Não afeta o modo de teste.",
      ].join("\n")
    );
  }
}

console.log("\n── Métodos de pagamento ─────────────────────────────");
try {
  const configs = await stripe.paymentMethodConfigurations.list({ limit: 5 });
  if (configs.data.length === 0) {
    notes.push("Nenhuma configuração de métodos de pagamento encontrada.");
  }
  for (const cfg of configs.data) {
    const on = Object.entries(cfg)
      .filter(([, v]) => v && typeof v === "object" && "display_preference" in v)
      .filter(([, v]) => v.display_preference?.value === "on")
      .map(([k]) => k);
    console.log(`${cfg.is_default ? "★" : " "} ${cfg.name}: ${on.join(", ") || "(nenhum ligado)"}`);
    if (cfg.is_default && on.length === 0) {
      problems.push(
        [
          "Nenhum método de pagamento ligado na configuração padrão.",
          "  Ligue ao menos cartão em https://dashboard.stripe.com/settings/payment_methods",
        ].join("\n")
      );
    }
  }
} catch (err) {
  notes.push(`não consegui listar métodos de pagamento: ${err.message}`);
}

console.log("\n── Preços ───────────────────────────────────────────");
const EXPECTED = [
  { key: "STRIPE_PRICE_PESSOAL", kind: "recorrente", label: "plano Pessoal" },
  { key: "STRIPE_PRICE_ESTUDIOSO", kind: "recorrente", label: "plano Estudioso" },
  { key: "STRIPE_PRICE_TOPUP_500", kind: "único", label: "pacote avulso" },
];

for (const { key, kind, label } of EXPECTED) {
  const id = env[key];
  if (!id) {
    problems.push(`${key} ausente (${label}). Veja docs/stripe-setup.md, passo 3.`);
    console.log(`${key}: (ausente)`);
    continue;
  }
  try {
    const price = await stripe.prices.retrieve(id);
    const actual = price.recurring ? `recorrente/${price.recurring.interval}` : "único";
    const mode = price.livemode ? "LIVE" : "TESTE";
    const amount = (price.unit_amount ?? 0) / 100;
    console.log(
      `${key}: ${mode} | ${actual} | ${amount} ${price.currency} | ativo=${price.active}`
    );

    if (price.livemode !== isLiveKey) {
      problems.push(
        [
          `${key} é um preço de ${mode}, mas a chave é de ${isLiveKey ? "LIVE" : "TESTE"}.`,
          "  Produtos e preços NÃO são compartilhados entre os modos — recrie no modo certo.",
        ].join("\n")
      );
    }
    if (!price.active) {
      problems.push(`${key} aponta para um preço ARQUIVADO. Crie outro e atualize a variável.`);
    }
    if (Boolean(price.recurring) !== (kind === "recorrente")) {
      problems.push(
        [
          `${key} (${label}) é "${actual}" mas precisa ser "${kind}".`,
          "  Um preço não troca de tipo: crie um novo no produto e aponte a variável para ele.",
        ].join("\n")
      );
    }
    if (price.currency !== "brl") {
      notes.push(`${key} está em ${price.currency.toUpperCase()}, não BRL.`);
    }
  } catch (err) {
    problems.push(`${key} não existe nesta conta/modo: ${err.message.split("\n")[0]}`);
    console.log(`${key}: ERRO`);
  }
}

console.log("\n── Webhook ──────────────────────────────────────────");
// Existem TRÊS segredos de webhook possíveis e nenhum prefixo os distingue: o
// do `stripe listen`, o de um endpoint de teste no dashboard e o do endpoint
// live. Usar o errado dá a falha mais silenciosa do fluxo inteiro — o Stripe
// cobra, a tela mostra sucesso, e o webhook devolve 400 sem ninguém olhar.
// O Stripe não expõe o segredo pela API, então não dá para conferir daqui;
// dá, porém, para dizer QUAL deles deveria estar em uso, que é onde o erro mora.
const WEBHOOK_PATH = "/api/stripe/webhook";
const expectedEndpointUrl = appUrl ? `${appUrl.replace(/\/+$/, "")}${WEBHOOK_PATH}` : null;

const REQUIRED_EVENTS = [
  "invoice.paid",
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
  "charge.dispute.created",
];

try {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
  const enabled = endpoints.data.filter((e) => e.status === "enabled");
  console.log(`endpoints (${isLiveKey ? "live" : "teste"}): ${enabled.length || "nenhum"}`);

  if (enabled.length === 0) {
    if (isLiveKey) {
      problems.push(
        [
          "Nenhum endpoint de webhook cadastrado em modo LIVE — em produção nada vira crédito.",
          "  Crie em https://dashboard.stripe.com/webhooks apontando para",
          `  ${expectedEndpointUrl ?? `https://SEU-DOMINIO${WEBHOOK_PATH}`}`,
          "  e use o signing secret DELE em STRIPE_WEBHOOK_SECRET.",
        ].join("\n")
      );
    } else {
      notes.push(
        [
          "Sem endpoint cadastrado em teste, STRIPE_WEBHOOK_SECRET tem de ser o que o",
          "  `stripe listen` imprime ao subir ('Your webhook signing secret is whsec_...').",
          "  Se for outro (o do endpoint live, por exemplo), o webhook responde 400 e a",
          "  tabela stripe_events fica VAZIA mesmo com o pagamento aprovado — sintoma:",
          "  compra concluída no Stripe, saldo do usuário intacto.",
        ].join("\n")
      );
    }
  }

  for (const e of enabled) {
    const wildcard = e.enabled_events.includes("*");
    const missing = wildcard ? [] : REQUIRED_EVENTS.filter((ev) => !e.enabled_events.includes(ev));
    console.log(
      `  ${e.url} | eventos: ${wildcard ? "todos" : e.enabled_events.length}` +
        (missing.length > 0 ? ` | FALTAM ${missing.length}` : "")
    );
    if (missing.length > 0) {
      problems.push(
        [
          `O endpoint ${e.url} não escuta: ${missing.join(", ")}.`,
          "  Sem esses eventos, parte do fluxo deixa de creditar (ou de estornar).",
        ].join("\n")
      );
    }
    if (expectedEndpointUrl && e.url !== expectedEndpointUrl) {
      notes.push(`endpoint cadastrado (${e.url}) difere do esperado (${expectedEndpointUrl}).`);
    }
  }
} catch (err) {
  notes.push(`não consegui listar endpoints de webhook: ${err.message}`);
}

if (!env.STRIPE_WEBHOOK_SECRET) {
  problems.push(
    [
      "STRIPE_WEBHOOK_SECRET ausente — sem ele nenhum pagamento vira crédito.",
      "  Local: `stripe listen --forward-to localhost:3000/api/stripe/webhook` e use o whsec_ impresso.",
      "  Produção: docs/stripe-setup.md, passo 5.",
    ].join("\n")
  );
  console.log("secret: (ausente)");
} else {
  console.log("secret: presente");
  if (isLiveKey) {
    notes.push(
      [
        "Com chave LIVE, o whsec_ tem de ser o do endpoint criado no dashboard em modo live —",
        "  o do `stripe listen` só vale para eventos de TESTE.",
      ].join("\n")
    );
  }
}

console.log(`app url: ${appUrl || "(padrão do código)"}`);

console.log("\n── Checkout de verdade ──────────────────────────────");
if (isLiveKey) {
  console.log("pulado (chave live — não abrimos sessão de cobrança real só para sondar)");
} else if (!env.STRIPE_PRICE_TOPUP_500) {
  console.log("pulado (sem STRIPE_PRICE_TOPUP_500)");
} else {
  // A prova definitiva. Se esta sessão nasce, o checkout funciona — vale mais
  // que qualquer dedução a partir das flags acima.
  try {
    const probe = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: env.STRIPE_PRICE_TOPUP_500, quantity: 1 }],
      success_url: "https://example.com/ok",
      cancel_url: "https://example.com/cancel",
    });
    console.log(`✓ sessão criada — métodos: ${(probe.payment_method_types ?? []).join(", ")}`);
    await stripe.checkout.sessions.expire(probe.id).catch(() => {});
    console.log("  (sondagem expirada, nada ficou pendurado)");
  } catch (err) {
    const first = err.message.split("\n")[0];
    problems.push(
      [
        `O Stripe recusou criar uma sessão de checkout: ${first}`,
        "  Esta é a falha real — o que estiver acima é contexto para entendê-la.",
      ].join("\n")
    );
    console.log(`✗ ${first}`);
  }
}

console.log(`\n${"═".repeat(54)}`);
if (problems.length === 0) {
  console.log("✓ Nenhum problema encontrado. Pode testar uma compra.");
} else {
  console.log(`${problems.length} problema(s):\n`);
  for (const p of problems) console.log(`✗ ${p}\n`);
}
if (notes.length > 0) {
  console.log("Observações:");
  for (const n of notes) console.log(`· ${n}`);
}
console.log("");
process.exit(problems.length === 0 ? 0 : 1);
