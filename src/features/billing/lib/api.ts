"use client";

import type { PaidPlanKey } from "@/lib/billing/plans";

/**
 * Wrappers tipados das rotas de cobrança.
 *
 * Repare no que estas funções NÃO enviam: valor, moeda, quantidade de
 * créditos, price id, customer id. O servidor deriva tudo isso. Se um dia
 * alguém for tentado a passar um preço daqui, o lugar certo de mudar é o
 * catálogo server-only, não este arquivo.
 */

export type CheckoutRequest =
  | { kind: "subscription"; plan: PaidPlanKey }
  | { kind: "topup"; quantity: number };

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string; status: number };

async function postJson(path: string, body?: unknown): Promise<CheckoutResult> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      return { ok: false, error: data.error ?? `HTTP ${res.status}`, status: res.status };
    }
    return { ok: true, url: data.url };
  } catch (err) {
    return { ok: false, error: (err as Error).message, status: 0 };
  }
}

export function requestCheckout(payload: CheckoutRequest): Promise<CheckoutResult> {
  return postJson("/api/billing/checkout", payload);
}

export function requestBillingPortal(): Promise<CheckoutResult> {
  return postJson("/api/billing/portal");
}

/** Mensagens em pt-BR para os códigos de erro que as rotas devolvem. */
export function checkoutErrorMessage(error: string): string {
  switch (error) {
    case "billing_unavailable":
    case "plan_unavailable":
    case "topup_unavailable":
      return "O pagamento ainda não está disponível. Tente de novo em instantes.";
    // Erro de configuração no Stripe (preço do tipo errado, arquivado ou
    // inexistente). O log do servidor diz qual variável consertar — a mensagem
    // aqui só evita que o usuário fique tentando de novo à toa.
    case "price_misconfigured":
    case "payment_methods_unavailable":
      return "O pagamento está temporariamente indisponível. Já registramos o erro — tente mais tarde.";
    case "already_subscribed":
      return "Você já tem uma assinatura ativa. Use “Gerenciar assinatura” para trocar de plano.";
    case "no_customer":
      return "Nenhuma compra encontrada nesta conta ainda.";
    case "rate_limited":
      return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
    default:
      return "Não consegui abrir o pagamento. Tente de novo.";
  }
}

/**
 * Abre uma aba nova em branco, para depois apontá-la ao Stripe.
 *
 * Aba nova, e não navegação, é decisão de arquitetura: durante uma gravação a
 * página atual segura o MediaRecorder, a fila de chunks em memória e o
 * transcript ainda não salvo. Sair dela destruiria tudo isso.
 *
 * Dois detalhes que parecem descuido e não são:
 *  - A janela é aberta ANTES do await do fetch. Navegadores só liberam
 *    `window.open` dentro do gesto do usuário; depois de um await o popup seria
 *    bloqueado.
 *  - SEM `noopener`. Com essa flag `window.open` devolve `null` por
 *    especificação, e perderíamos a referência necessária para redirecionar a
 *    aba — o código cairia no fallback e mataria a gravação. O opener fica
 *    exposto ao checkout.stripe.com, que é uma origem confiável.
 */
export function openCheckoutWindow(): Window | null {
  return window.open("about:blank", "_blank");
}

export type NavigateResult = "new-tab" | "same-tab" | "blocked";

/**
 * Aponta a aba já aberta para a URL do Stripe.
 *
 * `allowSameTabFallback` deve ser `false` quando há uma gravação em curso: se
 * o pop-up foi bloqueado, é melhor pedir para liberar pop-ups do que navegar a
 * aba e destruir a captura. Fora de uma gravação, navegar é a melhor saída.
 */
export function navigateCheckoutWindow(
  win: Window | null,
  url: string,
  allowSameTabFallback = true
): NavigateResult {
  if (win && !win.closed) {
    win.location.href = url;
    win.focus();
    return "new-tab";
  }
  if (!allowSameTabFallback) return "blocked";
  window.location.href = url;
  return "same-tab";
}
