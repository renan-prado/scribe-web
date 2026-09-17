"use client";

import { CreditCard, Scissors, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { CoinCost } from "@/features/coins/components/CoinCost";
import { COIN_COSTS } from "@/features/coins/pricing";
import { useCoinsStore } from "@/features/coins/store";
import { requestCreateSession } from "@/features/session/lib/api";
import {
  formatTimecode,
  isYoutubeVideoUrl,
  maskTimecode,
  parseClipRange,
  parseTimecode,
  YOUTUBE_MAX_DURATION_MS,
} from "@/lib/domain/youtube";
import { cn } from "@/lib/utils";

/**
 * Colar o link. Uma tela inteira para um campo só, e é o ponto.
 *
 * Isto já morou DENTRO do diálogo de gravação, como um card de modo com um
 * `<input>` embutido, e não funcionava por duas razões que só aparecem no uso:
 * o card precisava crescer no meio de uma lista de irmãos do mesmo tamanho, e
 * o rodapé do diálogo tinha de mentir sobre a unidade do preço ("/min" num modo
 * que cobra por vídeo). Escolher COMO capturar e escolher QUAL vídeo são duas
 * perguntas, e amontoá-las num controle só piorava as duas.
 *
 * **Ela é só o MIOLO, não a tela inteira.** O `<main>`, a barra do topo e o
 * voltar são do `/importar`; daqui saiu o link "← Biblioteca" que ficava acima
 * do título, porque com o voltar na barra a mesma saída aparecia duas vezes na
 * mesma tela, a três centímetros uma da outra.
 *
 * A tela não cria a sessão e não importa nada: ela valida o link e cria a linha
 * (`mode: "youtube"`), depois empurra para `/importar/:id`, que é onde
 * a cobrança e o trabalho acontecem. É a mesma divisão dos três modos de
 * gravação, o diálogo cria a linha, a página de gravação faz o trabalho.
 *
 * ## O campo pode chegar PREENCHIDO, e mesmo assim ninguém importa sozinho
 *
 * `/importar?url=…` (ver a página) entrega o link já no campo. O botão continua
 * sendo o único caminho: a rota seguinte COBRA 30 moedas, e uma URL que
 * importa por conta própria transforma um link colado num grupo — ou um
 * prefetch — em débito. O preenchimento economiza a colagem, não a decisão.
 */

const MAX_HOURS = Math.round(YOUTUBE_MAX_DURATION_MS / 3_600_000);

type Props = {
  /** Link já validado pela página, vindo de `?url=` / `?text=`. */
  initialUrl?: string;
  /** Recorte sugerido pela URL (`?inicio=`/`?fim=`, ou o `t=` do link). */
  initialStartMs?: number | null;
  initialEndMs?: number | null;
};

/** A frase de cada recusa do recorte. Ver `parseClipRange`. */
const CLIP_ERRORS: Record<string, string> = {
  clip_invalid: "O fim precisa vir depois do início.",
  clip_too_short: "O trecho precisa ter pelo menos 1 minuto.",
  clip_too_long: `O trecho não pode passar de ${MAX_HOURS} horas.`,
  // Com a máscara, a forma nunca mais está errada: o que sobra de recusa é
  // valor fora de faixa, `12:99`.
  timecode: "Minutos e segundos vão até 59.",
};

export function YoutubeUrlForm({ initialUrl = "", initialStartMs, initialEndMs }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  // O recorte começa fechado, porque importar o vídeo inteiro é o caso comum.
  // Um link que já veio com trecho (ou parado num instante) abre a seção: quem
  // mandou o tempo espera ver o tempo.
  const [clipOpen, setClipOpen] = useState(initialStartMs != null || initialEndMs != null);
  const [startRaw, setStartRaw] = useState(
    initialStartMs != null ? formatTimecode(initialStartMs) : ""
  );
  const [endRaw, setEndRaw] = useState(initialEndMs != null ? formatTimecode(initialEndMs) : "");
  const balance = useCoinsStore((s) => s.balance);
  const refresh = useCoinsStore((s) => s.refresh);

  const cost = COIN_COSTS.youtubeImport;
  const balanceLoading = balance === null;
  const insufficient = balance !== null && balance < cost;
  const valid = isYoutubeVideoUrl(url);
  /** Só acusa link inválido depois de a pessoa ter digitado algo de verdade,
   * um erro em vermelho no primeiro caractere é ruído, não ajuda. */
  const touched = url.trim().length > 6;

  // O recorte, lido dos dois campos. Campo vazio é "não disse", não é erro:
  // só início quer dizer "daqui até o fim", e é um pedido legítimo.
  const startMs = startRaw.trim() ? parseTimecode(startRaw) : null;
  const endMs = endRaw.trim() ? parseTimecode(endRaw) : null;
  const badTimecode =
    (startRaw.trim().length > 0 && startMs === null) ||
    (endRaw.trim().length > 0 && endMs === null);
  const range = parseClipRange(startMs, endMs);
  const clipError = !clipOpen
    ? null
    : badTimecode
      ? CLIP_ERRORS.timecode
      : range.ok
        ? null
        : CLIP_ERRORS[range.error];
  const clip = clipOpen && !badTimecode && range.ok ? range.clip : null;

  const blocked = insufficient || !valid || !!clipError;

  // Mesmo motivo do `NewRecordingDialog`: esta tela vive sob o layout de
  // `(app)`, que sobrevive à navegação. Sem isto o botão fica em "Preparando…"
  // se a pessoa voltar para cá pelo histórico.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só a troca de rota desarma o loading
  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  async function handleSubmit() {
    if (loading || blocked) return;
    setLoading(true);

    // Segunda conferência de saldo: outra aba pode ter gasto moedas enquanto
    // esta tela estava aberta. O botão já está desabilitado por `insufficient`,
    // isto pega só a corrida.
    const fresh = await refresh();
    if (fresh !== null && fresh < cost) {
      setLoading(false);
      toast.error("Saldo de moedas insuficiente", {
        description: `A importação de um vídeo custa ${cost} moedas.`,
      });
      return;
    }

    const result = await requestCreateSession({
      mode: "youtube",
      sourceUrl: url.trim(),
      // O recorte vai para a LINHA, e é por isso que ele viaja aqui e não no
      // POST da importação: `/importar/:id` redispara aquela rota a cada
      // reload, e um recorte que morasse no cliente viraria, num "atrás" do
      // navegador, o vídeo inteiro cobrado pelo mesmo preço.
      startMs: clip?.startMs ?? null,
      endMs: clip?.endMs ?? null,
    });
    if ("error" in result) {
      setLoading(false);
      toast.error("Não consegui iniciar a importação", { description: result.error });
      return;
    }
    // `loading` segue ligado: a linha já existe e a próxima página é dinâmica.
    router.push(`/importar/${result.id}`);
  }

  return (
    // `<div>`, e não o `<main>` que ele já foi: quem monta a página é o
    // `/importar`, e o `<main>` é de lá. Dois deles aninhados é HTML inválido, e
    // o de fora é que carrega a barra do topo e o pé da tela. A medida própria
    // (`max-w-lg`, mais estreita que os 640px da página) fica, é a largura em
    // que um campo só não vira uma linha de ponta a ponta.
    <div className="mx-auto flex w-full max-w-md flex-col gap-11">
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-2xl bg-[image:var(--scriba-cta)] text-scriba-cta-ink shadow-[0_10px_24px_var(--scriba-cta-shadow)]"
        >
          <YoutubeIcon className="size-6" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-scriba-ink-strong">
            Importar do YouTube
          </h1>
          <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink-soft">
            O Scriba entende o conteúdo do vídeo e monta um resumo organizado em segundos.
          </p>
        </div>
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <label htmlFor="youtube-url" className="px-1 text-[13px] font-medium text-scriba-ink">
          Link do vídeo
        </label>
        <input
          id="youtube-url"
          // `url` e não `text`: no celular é o teclado com "/" e ".com" à mão
          // que decide se colar um link é confortável.
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          // Foca sozinho: a tela tem um campo só, e chegar aqui já é a decisão
          // de colar um link. Menos quando o link JÁ veio pronto por parâmetro:
          // ali o que falta é decidir, não digitar, e o teclado subindo sobre o
          // botão só atrapalha.
          // biome-ignore lint/a11y/noAutofocus: tela de campo único, o foco não disputa com nada
          autoFocus={!initialUrl}
          disabled={loading}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=…"
          aria-invalid={touched && !valid}
          aria-describedby={touched && !valid ? "youtube-url-error" : "youtube-url-hint"}
          className={cn(
            "w-full rounded-2xl border bg-scriba-paper px-4 py-3.5 text-[14px] text-scriba-ink transition-colors",
            "placeholder:text-scriba-ink-mute",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/25",
            touched && !valid
              ? "border-scriba-cream-accent"
              : "border-scriba-hairline focus-visible:border-scriba-blue"
          )}
        />

        {touched && !valid ? (
          <p
            id="youtube-url-error"
            role="alert"
            className="px-1 text-[12px] font-light leading-relaxed text-scriba-cream-ink"
          >
            Cole o endereço de um vídeo. Links de canal e de playlist não funcionam aqui.
          </p>
        ) : null}

        {/* A LINHA SOB O CAMPO: o recorte à esquerda, o teto à direita.

            Os dois eram irmãos numa coluna — o teto alinhado à direita, o
            recorte à esquerda uma linha abaixo —, e o resultado era uma
            escadinha de duas linhas miúdas com um vão morto entre elas, cada
            uma num canto. Eles falam do MESMO campo (um diz até onde ele vai, o
            outro pede um pedaço dele), então dividem a linha: o texto do teto
            deixa de ser uma linha própria e passa a ser a legenda da ponta
            direita daquela que já existe.

            O `ml-auto` do teto, e não só o `justify-between`: com o recorte
            aberto o botão sai da linha, e sem ele o teto escorregaria para a
            esquerda, sob o começo do campo. */}
        <div className="flex items-center justify-between gap-3 px-1">
          {clipOpen ? null : (
            <button
              type="button"
              onClick={() => setClipOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-[12px] font-medium text-scriba-ink-soft transition-colors hover:text-scriba-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/25"
            >
              <Scissors aria-hidden className="size-3.5" strokeWidth={2.2} />
              Importar só um trecho
            </button>
          )}
          {touched && !valid ? null : (
            <p
              id="youtube-url-hint"
              className="ml-auto pr-4 text-[12px] font-light leading-relaxed text-scriba-ink-mute"
            >
              limite de {MAX_HOURS}h*
            </p>
          )}
        </div>

        {/* O RECORTE.
            Ele mora depois do link porque é uma pergunta sobre um vídeo que já
            foi escolhido, e fechado porque importar tudo é o caso comum. A
            transmissão de um culto inteiro é o caso que ele resolve: duas
            horas de fita com trinta minutos de pregação no meio. */}
        {clipOpen ? (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-scriba-hairline bg-scriba-paper px-4 py-3.5">
            {/* `justify-between` com os campos CEDENDO (`flex-1 min-w-0` no
                `ClipField`), e não `justify-around` com largura fixa. Os dois
                campos tinham 128px cravados: 256 de campo + os vãos + os 28 do
                X passavam dos ~296px úteis de uma tela de 360, e o último item
                da linha — o X — era empurrado para fora da página. Com os
                campos elásticos, quem encolhe é o que pode encolher, e o botão
                (`shrink-0`) fica onde tem de ficar em qualquer largura. */}
            <div className="flex items-center justify-between gap-2">
              <ClipField
                id="youtube-clip-start"
                value={startRaw}
                onChange={setStartRaw}
                placeholder="00:00"
                disabled={loading}
                invalid={!!clipError}
              />
              <span className="shrink-0 text-[12px] font-light text-scriba-ink-soft">até</span>
              <ClipField
                id="youtube-clip-end"
                value={endRaw}
                onChange={setEndRaw}
                placeholder="00:00"
                disabled={loading}
                invalid={!!clipError}
              />
              <button
                type="button"
                onClick={() => {
                  setClipOpen(false);
                  setStartRaw("");
                  setEndRaw("");
                }}
                aria-label="Importar o vídeo inteiro"
                className="-mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-scriba-ink-mute transition-colors hover:text-scriba-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/25"
              >
                <X aria-hidden className="size-3.5" strokeWidth={2.4} />
              </button>
            </div>

            {/* A recusa do recorte era CALCULADA e nunca desenhada: os campos
                mudavam de borda, o botão de importar ficava cinza, e nada na
                tela dizia por quê. */}
            {clipError ? (
              <p
                id="youtube-clip-error"
                role="alert"
                className="px-0.5 text-[12px] font-light leading-relaxed text-scriba-cream-ink"
              >
                {clipError}
              </p>
            ) : null}
          </div>
        ) : null}

        {balanceLoading ? (
          <span
            aria-hidden
            className="mt-3 block h-13.5 w-full animate-pulse rounded-full bg-scriba-ink-mute/15"
          />
        ) : insufficient ? (
          <div className="mt-3 flex flex-col gap-2.5">
            <p
              role="alert"
              className="rounded-2xl border border-scriba-cream-accent/40 bg-scriba-cream px-4 py-3 text-center text-[12px] font-light leading-relaxed text-scriba-cream-ink"
            >
              Você tem <strong className="font-semibold">{balance} créditos</strong>, importar um
              vídeo custa {cost}. Adicione créditos para começar.
            </p>
            <button
              type="button"
              onClick={() => setBillingOpen(true)}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full scriba-cta bg-[image:var(--scriba-cta)] px-7 py-3.5 text-[15px] font-semibold text-scriba-cta-ink shadow-[0_10px_24px_var(--scriba-cta-shadow)] transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
            >
              <CreditCard aria-hidden className="size-4" strokeWidth={2.4} />
              Adicionar créditos
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={loading || blocked}
            aria-disabled={blocked}
            className={cn(
              "mt-3 inline-flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-semibold transition-colors",
              blocked
                ? "cursor-not-allowed bg-scriba-ink-mute/25 text-scriba-ink-mute"
                : "scriba-cta bg-[image:var(--scriba-cta)] text-scriba-cta-ink shadow-[0_10px_24px_var(--scriba-cta-shadow)]",
              "disabled:cursor-not-allowed disabled:opacity-90",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
            )}
          >
            <YoutubeIcon className="size-4" />
            {loading ? "Preparando…" : "Importar"}
            {loading ? null : <CoinCost count={cost} suffix="/vídeo" />}
          </button>
        )}
      </form>

      <BillingDialog open={billingOpen} onOpenChange={setBillingOpen} />
    </div>
  );
}

/**
 * Um campo de tempo do recorte. `inputMode="numeric"` para o teclado do
 * celular abrir nos números, mas `type="text"`: um `number` recusaria os dois
 * pontos de "12:30", que é justamente a forma que o campo pede.
 *
 * O que ele digita passa pelo `maskTimecode` a cada tecla, então o campo nunca
 * mostra um número solto — os dois pontos aparecem no primeiro dígito, e é o
 * próprio campo que ensina a forma.
 */
function ClipField({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
  invalid: boolean;
}) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-1 items-center">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(maskTimecode(e.target.value))}
        placeholder={placeholder}
        aria-invalid={invalid}
        // Só aponta para a mensagem quando ela EXISTE: `aria-describedby` para
        // um id ausente é uma descrição vazia anunciada como se houvesse uma.
        aria-describedby={invalid ? "youtube-clip-error" : undefined}
        className={cn(
          // `w-full` sobre um pai `flex-1 min-w-0`: o campo OCUPA o que sobra e
          // ENCOLHE quando falta. Era `w-32` cravado, e a largura fixa
          // empurrava o X para fora da tela no celular.
          "w-full min-w-0 rounded-xl border bg-scriba-surface px-2 py-2 text-center text-[14px] tabular-nums text-scriba-ink transition-colors",
          "placeholder:text-scriba-ink-mute",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scriba-blue/25",
          invalid
            ? "border-scriba-cream-accent"
            : "border-scriba-hairline focus-visible:border-scriba-blue"
        )}
      />
    </label>
  );
}
