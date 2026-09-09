"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

/**
 * O link de indicação, pronto para sair daqui.
 *
 * Duas ações e não uma, porque são dois gestos diferentes e o segundo é o que
 * de fato acontece: **compartilhar** abre a folha nativa do celular (WhatsApp,
 * o grupo da igreja, a lista de contatos) e é onde uma indicação de verdade
 * nasce; **copiar** serve ao desktop e a quem quer colar num lugar que a folha
 * nativa não oferece.
 *
 * `navigator.share` não existe em todo navegador — no desktop, quase nunca. Em
 * vez de esconder o botão (o que deixaria a tela diferente para cada pessoa
 * sem explicação), ele cai em copiar e diz que copiou. Compartilhar cancelado
 * pelo usuário é `AbortError` e NÃO é erro: silêncio é a resposta certa.
 *
 * O CÓDIGO aparece ao lado do link pelo mesmo motivo que aparece no painel do
 * parceiro: quem ouve a recomendação numa conversa vai criar a conta em outro
 * aparelho, e ali o link não acompanha. O campo da tela de entrada existe
 * exatamente para esse caminho.
 */

type Props = {
  link: string;
  code: string;
  signupCoins: number;
  subscriptionCoins: number;
};

const SHARE_TEXT =
  "Uso o Scriba para gravar as pregações: ele transcreve, resume e ainda ajuda a relembrar durante a semana. Entra pelo meu link:";

export function InviteLinkCard({ link, code, signupCoins, subscriptionCoins }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard bloqueado (contexto inseguro, permissão negada): o link
      // continua visível e selecionável na tela, então não há o que recuperar.
    }
  }

  async function share() {
    if (typeof navigator.share !== "function") {
      await copy(link);
      return;
    }
    try {
      await navigator.share({ title: "Scriba", text: SHARE_TEXT, url: link });
    } catch {
      // Inclui o AbortError de quem abriu a folha e desistiu. Não é falha, e
      // um alerta aqui puniria a pessoa por ter mudado de ideia.
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-[24px] bg-scriba-paper p-5 ring-1 ring-scriba-hairline sm:p-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[15px] font-semibold text-scriba-ink-strong">Seu link</h2>
        <p className="text-[12.5px] font-light leading-[1.55] text-scriba-ink-soft">
          Quem criar a conta pelo seu link rende{" "}
          <strong className="font-medium text-scriba-ink-strong">+{signupCoins} moedas</strong> para
          você. Se essa pessoa assinar um plano, são{" "}
          <strong className="font-medium text-scriba-ink-strong">
            +{subscriptionCoins} moedas
          </strong>{" "}
          — uma vez por amigo.
        </p>
      </div>

      <output className="min-w-0 truncate rounded-xl bg-scriba-surface px-3.5 py-3 text-[13px] text-scriba-ink-strong">
        {link}
      </output>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={share}
          className="scriba-cta inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[image:var(--scriba-cta)] px-5 py-3 text-[12px] font-semibold uppercase tracking-[.04em] text-scriba-cta-ink transition-[filter]"
        >
          <Share2 aria-hidden className="size-4" />
          Compartilhar
        </button>
        <button
          type="button"
          onClick={() => copy(link)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-scriba-btn-muted px-5 py-3 text-[12px] font-semibold uppercase tracking-[.04em] text-scriba-ink-soft transition-colors hover:text-scriba-ink-strong"
        >
          {copied ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <Copy aria-hidden className="size-4" />
          )}
          {copied ? "Copiado" : "Copiar link"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-scriba-hairline pt-3.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-scriba-ink-mute">
          Ou dite o código
        </span>
        <button
          type="button"
          onClick={() => copy(code)}
          className="rounded-lg bg-scriba-surface px-2.5 py-1 font-mono text-[13px] font-medium tracking-[0.08em] text-scriba-ink-strong transition-colors hover:bg-scriba-btn-muted"
        >
          {code}
        </button>
        <span className="text-[11.5px] font-light text-scriba-ink-mute">
          Quem ouviu de você e vai criar a conta no computador digita isso na tela de entrada.
        </span>
      </div>
    </section>
  );
}
