"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { DELETE_CONFIRMATION } from "@/lib/domain/account";

/**
 * O campo de confirmação e o botão que apaga, a metade cliente de
 * `/profile/delete`.
 *
 * Digitar a palavra não é cerimônia: é o único passo desta tela que não dá
 * para executar sem ter lido o que está escrito acima dela. Um diálogo de
 * "tem certeza?" com dois botões é atravessado no reflexo, e esta é a única
 * ação do produto que não tem desfazer.
 *
 * O sucesso NÃO redireciona. A pessoa acabou de apagar tudo o que tinha aqui,
 * e ser despejada na página de vendas no mesmo instante lê como se o produto
 * já estivesse tentando revendê-la. Fica uma confirmação, e ela sai quando
 * quiser. O `router.refresh()` existe para que o cabeçalho ao redor pare de
 * exibir o avatar e o saldo de uma conta que não existe mais: o layout de
 * `(app)` lê isso no servidor, e sem uma volta até lá a casca continuaria
 * mostrando a sessão antiga até a aba ser fechada.
 */
export function DeleteAccountForm() {
  const router = useRouter();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const confirmed = typed.trim().toUpperCase() === DELETE_CONFIRMATION;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: DELETE_CONFIRMATION }),
      });
      if (!response.ok) {
        setPending(false);
        toast.error(
          response.status === 429
            ? "Muitas tentativas seguidas. Espere um minuto e tente de novo."
            : "Não consegui excluir a conta agora. Tente de novo em alguns minutos."
        );
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setPending(false);
      toast.error("Não consegui falar com o servidor. Verifique sua conexão e tente de novo.");
    }
  }

  if (done) {
    return (
      <section className="rounded-[28px] bg-scriba-paper p-6 text-center ring-1 ring-scriba-hairline sm:p-7">
        <h2 className="font-heading text-lg font-semibold text-scriba-ink-strong">
          Sua conta foi excluída
        </h2>
        <p className="mt-2 text-sm font-light leading-relaxed text-scriba-ink-soft">
          Suas gravações, transcrições, resumos e estudos foram apagados, e a sessão neste
          dispositivo foi encerrada. Obrigado por ter usado o Scriba.
        </p>
        <a
          href="/"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-scriba-ink-strong px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Ir para a página inicial
        </a>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] bg-scriba-paper p-6 ring-1 ring-scriba-hairline sm:p-7"
    >
      <label htmlFor={inputId} className="block text-sm font-semibold text-scriba-ink-strong">
        Para confirmar, digite <span className="font-mono">{DELETE_CONFIRMATION}</span> no campo
        abaixo
      </label>
      <input
        id={inputId}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        disabled={pending}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-describedby={`${inputId}-hint`}
        className="mt-3 h-11 w-full rounded-xl border border-scriba-hairline bg-background px-3 font-mono text-base tracking-widest text-scriba-ink-strong outline-none transition-colors placeholder:font-sans placeholder:tracking-normal placeholder:text-scriba-ink-mute focus-visible:border-scriba-rec focus-visible:ring-2 focus-visible:ring-scriba-rec/30 disabled:opacity-60"
        placeholder={DELETE_CONFIRMATION}
      />
      <p id={`${inputId}-hint`} className="mt-2 text-xs font-light text-scriba-ink-soft">
        Esta ação é imediata e não tem como ser desfeita.
      </p>
      <button
        type="submit"
        disabled={!confirmed || pending}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-scriba-rec px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <Trash2 aria-hidden className="size-4" />
        )}
        {pending ? "Excluindo..." : "Excluir minha conta e meus dados"}
      </button>
    </form>
  );
}
