"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatCoins } from "@/features/billing/plans";
import { TESTER_GIFT_COINS } from "@/lib/domain/tester";
import { maskWhatsapp, normalizeWhatsapp, WHATSAPP_PLACEHOLDER } from "@/lib/domain/whatsapp";
import { cn } from "@/lib/utils";

/**
 * O pré-cadastro: duas perguntas, e a segunda é o canal de resposta.
 *
 * **O e-mail pedido NÃO é "o seu e-mail", é o da conta Google do aparelho.**
 * São coisas diferentes para muita gente (o e-mail que se lê é um, o Android
 * está logado em outro), e o console do Google Play só entende o segundo: um
 * endereço errado ali não dá erro em lugar nenhum, a pessoa simplesmente
 * abre o link semanas depois e vê "não encontrado". Por isso o rótulo, o
 * texto de apoio e o placeholder dizem a mesma coisa de três jeitos.
 *
 * **O WhatsApp existe porque o e-mail não serve para avisar.** Justamente por
 * ser a conta do aparelho e não a caixa que a pessoa lê, mandar o "liberou"
 * para lá seria escrever para um endereço que ninguém abre.
 *
 * O nome é opcional e fica por último: um formulário público de duas linhas
 * ganha mais com a terceira pergunta ausente do que com ela respondida.
 *
 * **O erro é INLINE, não toast.** Esta página é o fim de um link
 * compartilhado no WhatsApp, e é comum ela ser aberta dentro do navegador do
 * próprio aplicativo; um aviso que desaparece sozinho, no canto de uma tela
 * de celular, é um aviso que não aconteceu.
 */

const INPUT_CLASS =
  "w-full rounded-2xl border border-scriba-hairline bg-background px-4 py-3.5 text-[14px] text-scriba-ink transition-colors placeholder:text-scriba-ink-mute focus-visible:border-scriba-ink-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-ink-mute/20 disabled:opacity-60";

const LABEL_CLASS = "px-1 text-[13px] font-medium text-scriba-ink";

type Status = "idle" | "sending" | "done";

type Props = {
  /**
   * O "O que acontece agora", renderizado SÓ no estado de sucesso.
   *
   * Vem de fora como `children` para continuar sendo markup de servidor: é
   * texto estático, e passá-lo como dado obrigaria a reescrevê-lo em
   * JavaScript de cliente para ganhar exatamente nada. Quem decide a HORA de
   * mostrá-lo é este componente, porque só ele sabe se o envio aconteceu.
   */
  children?: React.ReactNode;
};

export function TesterSignupForm({ children }: Props) {
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const whatsappOk = normalizeWhatsapp(whatsapp) !== null;
  const blocked = !emailOk || !whatsappOk || status === "sending";

  async function handleSubmit() {
    if (blocked) return;
    setStatus("sending");
    setError(null);
    try {
      const response = await fetch("/api/tester/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          whatsapp: whatsapp.trim(),
          name: name.trim() || undefined,
        }),
      });
      if (!response.ok) {
        setStatus("idle");
        setError(
          response.status === 429
            ? "Muitos envios deste aparelho. Tente de novo daqui a pouco."
            : "Não foi possível registrar agora. Tente de novo em alguns instantes."
        );
        return;
      }
      setStatus("done");
    } catch {
      setStatus("idle");
      setError("Sem conexão com o servidor. Confira a internet e tente de novo.");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col gap-12">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-scriba-hairline bg-scriba-paper px-6 py-9 text-center">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-scriba-ink-strong text-background"
          >
            <Check className="size-6" strokeWidth={2.4} />
          </span>
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-scriba-ink-strong">Cadastro recebido</h2>
            <p className="text-pretty text-[14px] leading-relaxed text-scriba-ink-soft">
              O e-mail entra na lista de testadores ainda hoje. O Google leva algumas horas para
              liberar o acesso, e o link do download chega no WhatsApp assim que isso acontecer.
            </p>
            <p className="text-pretty text-[13.5px] leading-relaxed text-scriba-ink-mute">
              As {formatCoins(TESTER_GIFT_COINS)} moedas de presente ficam esperando na Biblioteca,
              no primeiro acesso ao app com essa mesma conta Google.
            </p>
          </div>
        </div>
        {children}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-5 rounded-3xl border border-scriba-hairline bg-scriba-paper px-5 py-6 sm:px-7 sm:py-8"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="tester-email" className={LABEL_CLASS}>
          E-mail da sua conta Google
        </label>
        <input
          id="tester-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
          disabled={status === "sending"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@gmail.com"
          className={INPUT_CLASS}
        />
        <p className="px-1 text-[12px] font-light leading-relaxed text-scriba-ink-mute">
          Deve ser o e-mail com que o celular está logado na Play Store.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="tester-whatsapp" className={LABEL_CLASS}>
          WhatsApp
        </label>
        <input
          id="tester-whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          disabled={status === "sending"}
          value={whatsapp}
          onChange={(e) => setWhatsapp(maskWhatsapp(e.target.value))}
          placeholder={WHATSAPP_PLACEHOLDER}
          className={INPUT_CLASS}
        />
        <p className="px-1 text-[12px] font-light leading-relaxed text-scriba-ink-mute">
          É por aqui que chega o aviso de liberação, com o link do download.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="tester-name" className={LABEL_CLASS}>
          Seu nome <span className="font-normal text-scriba-ink-mute">(opcional)</span>
        </label>
        <input
          id="tester-name"
          type="text"
          autoComplete="name"
          maxLength={80}
          disabled={status === "sending"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Como podemos te chamar?"
          className={INPUT_CLASS}
        />
      </div>

      {error ? (
        <p role="alert" className="px-1 text-[12.5px] leading-relaxed text-scriba-rose-ink">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={blocked}
        className={cn(
          "scriba-cta mt-1 inline-flex items-center justify-center rounded-full bg-[image:var(--scriba-cta)] px-6 py-3.5 text-[13px] font-semibold uppercase tracking-[.04em] text-scriba-cta-ink transition-opacity",
          blocked && "opacity-50"
        )}
      >
        {status === "sending" ? "Enviando…" : "Quero testar"}
      </button>

      <p className="px-1 text-center text-[11.5px] font-light leading-relaxed text-scriba-ink-mute">
        Os dados recolhidos neste formulário servem apenas para liberar o teste e avisar quando ele
        liberar. Não iremos enviar e-mails de marketing, e nem mensagens indesejadas no whatsapp e a
        remoção pode ser pedida pelo{" "}
        <Link href="/contact" className="underline underline-offset-2">
          contato
        </Link>
        .
      </p>
    </form>
  );
}
