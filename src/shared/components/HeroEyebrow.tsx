"use client";

import { useEffect, useState } from "react";
import { REF_HINT_COOKIE } from "@/lib/referrals/cookies";
import { cn } from "@/lib/utils";
import { ReferrerAvatar } from "@/shared/components/ReferrerAvatar";

/**
 * A pílula acima do título do hero: **"Indicado por Fulano"**, com a foto de
 * quem indicou, para quem chegou por um link de indicação. Para todo mundo
 * mais ela não aparece.
 *
 * ## Por que isto é cliente, e não server component
 *
 * `app/page.tsx` é ESTÁTICA por invariante declarada (ver "Landing page" em
 * `app/AGENTS.md`): nada nela pode ler cookie, sessão ou header. Uma leitura
 * ali marca a rota como dinâmica e a resposta passa a sair com `no-store` e
 * `X-Vercel-Cache: MISS`, HTML remontado na origem a cada visita anônima,
 * numa página cujo conteúdo é idêntico para todo mundo, e ainda sem bfcache.
 * Pagar isso na única página que converte, para personalizar uma pílula de
 * 30px, seria péssimo negócio.
 *
 * ## Os três estados, e por que a pílula nasce INVISÍVEL
 *
 * Ela já teve uma frase padrão ("Ouça, relembre e coloque em prática.") para
 * quem não vinha de indicação. A frase saiu: o hero virou coluna única
 * centrada e o título virou uma declaração direta, então uma segunda frase de
 * efeito logo acima dele só disputava a primeira leitura. **Hoje a pílula só
 * existe quando há indicação viva a anunciar**, e no resto das visitas ela não
 * ocupa espaço nenhum.
 *
 * Quem decide o estado inicial é o `HeroEyebrowScript`, um script que roda
 * ANTES DO PRIMEIRO PAINT e marca `data-scriba-ref` no `<html>` quando existe
 * a pista da indicação:
 *
 * | pista | primeiro paint | depois da resposta |
 * |---|---|---|
 * | ausente (99% das visitas) | nada | nada muda, e não há requisição |
 * | presente | **esqueleto** | "Indicado por Fulano" |
 * | presente, mas sem indicação viva | esqueleto | nada, a pílula some |
 *
 * O primeiro quadro é decidido por CSS (`.lp-eyebrow-pending` em
 * `app/globals.css`), e não por estado do React, justamente porque o React só
 * age depois do paint, que é o problema que estamos resolvendo. O HTML servido
 * é o mesmo para todo mundo, então a página continua saindo da CDN: a pílula
 * está sempre no HTML, escondida, e o atributo no `<html>` é o que a revela.
 *
 * ## A pista, e por que 99% dos visitantes não pagam nada por isto
 *
 * As rotas `/r/<slug>` e `/i/<codigo>` gravam, além do cookie de atribuição
 * (que é `httpOnly` e este código não consegue ler), um cookie-PISTA legível
 * por JS: `scriba_ref_hint=1`. Sem pista, este componente não faz requisição
 * nenhuma. Só quem realmente veio de um link pergunta ao servidor QUEM indicou.
 *
 * A pista não carrega nome nem foto de propósito. Se carregasse, teríamos dois
 * lugares dizendo quem é o padrinho, e o dia em que eles divergissem, a
 * página anunciaria uma pessoa e o cadastro creditaria outra. Quem responde
 * continua sendo o cookie `httpOnly`, lido no servidor. Quem RECRIA a pista
 * quando ela falta é o `proxy.ts`, ver `healReferralHint`.
 */

type Referral = {
  program: "partner" | "friend";
  name: string;
  avatarUrl: string | null;
};

const HINT_ATTR = "data-scriba-ref";

/**
 * Teto para o esqueleto desistir sozinho.
 *
 * A rota é local e responde em milissegundos, mas "responde rápido" não é
 * garantia: rede de igreja, aba em segundo plano, um deploy no meio do
 * caminho. Um esqueleto eterno no elemento mais visível da página é pior que
 * não personalizar nada, e é o único desfecho que não se resolve sozinho.
 */
const SETTLE_TIMEOUT_MS = 4000;

function hasReferralHint(): boolean {
  try {
    return document.cookie.split("; ").some((c) => c.startsWith(`${REF_HINT_COOKIE}=`));
  } catch {
    // Cookies bloqueados: não há pista, não há selo, e sem selo não há
    // pílula. Desfecho perfeitamente bom.
    return false;
  }
}

/**
 * Limpeza do atributo que o script escreveu. **Só depois que o React assumiu**
 * ver o efeito de `settled` lá embaixo.
 */
function clearHintAttribute(): void {
  document.documentElement.removeAttribute(HINT_ATTR);
}

export function HeroEyebrow() {
  const [referral, setReferral] = useState<Referral | null>(null);
  // `settled` só vira true quando o React assume o controle da pílula. Até lá
  // quem manda é o CSS, com o estado que o script escolheu antes do paint.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!hasReferralHint()) {
      // Sem pista o script não marcou nada e o CSS já está mostrando a frase.
      // Nem `settled`, nem requisição: o caminho da maioria não custa nada.
      return;
    }

    const controller = new AbortController();
    let done = false;

    // NÃO mexe no atributo aqui. Ele é o que REVELA a pílula antes do React
    // assumir, e o `setState` abaixo é ASSÍNCRONO: entre um `removeAttribute`
    // síncrono e o commit do React, o DOM ainda é o esqueleto, agora sem o
    // atributo que o mostrava. O navegador pinta essa janela, e o esqueleto
    // some por um quadro antes do selo entrar. Já aconteceu, na época em que
    // o estado resolvido ainda era uma frase padrão.
    //
    // Depois do commit o atributo não governa mais nada: o estado resolvido
    // não renderiza nenhuma das duas classes `.lp-eyebrow-*`. A limpeza vira,
    // então, higiene, e mora no efeito de `settled`.
    const settle = (found: Referral | null) => {
      if (done) return;
      done = true;
      setReferral(found);
      setSettled(true);
    };

    const timer = setTimeout(() => {
      controller.abort();
      settle(null);
    }, SETTLE_TIMEOUT_MS);

    fetch("/api/referral/active", { signal: controller.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { referral?: Referral | null } | null) => {
        settle(body?.referral?.name ? body.referral : null);
      })
      .catch((err: unknown) => {
        // **`AbortError` NÃO é resposta.** Ele diz "desisti da pergunta", e
        // tratá-lo como "não há indicação" foi um bug de verdade: em
        // desenvolvimento o StrictMode monta o efeito, executa a limpeza (que
        // aborta) e monta de novo, então a primeira tentativa caía aqui em
        // ~300ms, resolvia para "não há indicação", e a segunda trazia o selo
        // depois. O resultado era exatamente o pisca que este componente
        // existe para evitar: esqueleto → pílula sumindo → selo entrando. O mesmo vale fora do StrictMode, em toda
        // desmontagem: abortar não pode empurrar estado para um componente que
        // está saindo.
        //
        // Quem aborta POR DECISÃO nossa (o timeout) chama `settle(null)`
        // explicitamente logo depois, este ramo não precisa fazê-lo por ele.
        // Pelo NOME, e não por `instanceof DOMException`: o navegador rejeita
        // com DOMException, mas polyfills e o runtime de teste rejeitam com um
        // Error comum de mesmo nome, e um `instanceof` que falha aqui traz o
        // pisca de volta em silêncio.
        if ((err as { name?: string } | null)?.name === "AbortError") return;
        // Rede ruim, rota fora do ar, JSON quebrado: aí sim, a pílula some. O
        // selo é um adorno de conversão, nunca uma razão para a landing page
        // parecer quebrada.
        settle(null);
      })
      .finally(() => clearTimeout(timer));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  // A limpeza do atributo, depois do commit que tirou as duas classes do DOM.
  // Efeito separado de propósito: é a dependência em `settled` que garante a
  // ORDEM, remover antes é o bug descrito acima.
  useEffect(() => {
    if (settled) clearHintAttribute();
  }, [settled]);

  // Resolvido e sem indicação: nada. Não é uma pílula vazia com borda, é
  // ausência mesmo, e como o pai é um flex com `gap`, o que não renderiza
  // também não deixa o espaço dele para trás.
  if (settled && !referral) return null;

  return (
    <div
      className={cn(
        // `lp-eyebrow` é o `display: inline-flex` desta pílula, e NÃO o
        // utilitário de mesmo nome: utilitário mora numa @layer posterior e
        // venceria a regra que a esconde, a armadilha anotada no
        // `.lp-cta-soft`. Ver o bloco `.lp-eyebrow*` em `app/globals.css`.
        "lp-eyebrow min-h-[32px] items-center gap-2 self-center rounded-[22px] border border-scriba-hairline bg-scriba-paper px-3.5 py-[7px] pl-[9px] shadow-[0_4px_12px_rgba(79,168,240,.1)]",
        // Até o React assumir, quem manda é o CSS: sem `data-scriba-ref` no
        // `<html>` esta classe esconde a pílula INTEIRA, e é assim que a
        // esmagadora maioria das visitas nunca vê esqueleto nenhum.
        //
        // Depois do commit que resolveu o selo ela SAI, senão a pílula
        // desapareceria junto com o atributo que o efeito abaixo remove.
        !settled && "lp-eyebrow-pending"
      )}
    >
      {settled && referral ? (
        <>
          <ReferrerAvatar name={referral.name} avatarUrl={referral.avatarUrl} size={20} />
          <div className="text-[10.5px] font-semibold tracking-[.03em] text-scriba-ink-soft">
            Indicado por <span className="text-scriba-ink-strong">{referral.name}</span>
          </div>
        </>
      ) : (
        <span className="flex items-center gap-2" aria-hidden>
          <span className="size-5 flex-none animate-skeleton-shimmer rounded-full bg-scriba-blue-soft" />
          <span className="h-[7px] w-[104px] animate-skeleton-shimmer rounded-full bg-scriba-hairline [animation-delay:120ms]" />
        </span>
      )}
    </div>
  );
}
