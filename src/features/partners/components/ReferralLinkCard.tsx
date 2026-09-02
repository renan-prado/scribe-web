"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/**
 * O link e o código do parceiro, prontos para copiar.
 *
 * Os dois aparecem lado a lado porque servem a situações diferentes, e o
 * parceiro precisa entender isso para divulgar direito: o LINK funciona em bio
 * e descrição de vídeo, onde dá para clicar; o CÓDIGO funciona quando ele fala
 * em vídeo e a pessoa vai criar a conta em outro aparelho, situação em que o
 * link não acompanha.
 *
 * Sem essa explicação, a tendência é divulgar só o link — e perder toda a
 * audiência que assiste no celular e assina no computador.
 */

type Props = {
  link: string;
  code: string;
  bonusCoins: number;
  ratePct: number;
};

export function ReferralLinkCard({ link, code, bonusCoins, ratePct }: Props) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[14px] font-semibold text-scriba-ink-strong">Seu link e seu código</h2>
        <p className="text-[12.5px] font-light leading-[1.5] text-scriba-ink-soft">
          Quem entra por qualquer um dos dois ganha{" "}
          <strong className="font-medium text-scriba-ink-strong">+{bonusCoins} moedas</strong> — o
          bastante para gravar um culto inteiro de graça. Você recebe{" "}
          <strong className="font-medium text-scriba-ink-strong">
            {ratePct.toLocaleString("pt-BR")}%
          </strong>{" "}
          da primeira mensalidade de cada pessoa que assinar.
        </p>
      </div>

      <CopyRow
        label="Link"
        hint="Para bio, descrição de vídeo, stories — onde dá para clicar."
        value={link}
      />
      <CopyRow
        label="Código"
        hint="Para falar em vídeo. Quem assiste no celular e assina no computador digita ele na tela de entrada."
        value={code}
        mono
      />
    </section>
  );
}

function CopyRow({
  label,
  hint,
  value,
  mono,
}: {
  label: string;
  hint: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard bloqueado (contexto inseguro, permissão negada): o valor
      // continua visível e selecionável, então não há o que recuperar aqui.
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-scriba-ink-mute">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <output
          className={
            mono
              ? "min-w-0 flex-1 truncate rounded-xl bg-scriba-surface px-3 py-2.5 font-mono text-[13px] text-scriba-ink-strong"
              : "min-w-0 flex-1 truncate rounded-xl bg-scriba-surface px-3 py-2.5 text-[13px] text-scriba-ink-strong"
          }
        >
          {value}
        </output>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copiar ${label.toLowerCase()}`}
          className="scriba-cta flex-none rounded-xl bg-[image:var(--scriba-cta)] px-3.5 py-2.5 text-scriba-cta-ink transition-[filter]"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p className="text-[11.5px] font-light leading-[1.4] text-scriba-ink-mute">{hint}</p>
    </div>
  );
}
