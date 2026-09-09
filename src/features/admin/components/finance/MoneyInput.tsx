"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { Currency } from "@/lib/domain/finance";
import { parseMoneyToCents } from "@/lib/finance/money";

/**
 * Campo de dinheiro que guarda CENTAVOS INTEIROS e mostra texto.
 *
 * O estado interno é a string que a pessoa digitou, não o número — um campo
 * controlado por centavos reformata a cada tecla e torna impossível apagar a
 * vírgula para corrigi-la. A conversão acontece na digitação (para o
 * formulário sempre ter o valor) e o texto fica como está até o blur.
 *
 * `type="text"`, e não `type="number"`: o campo numérico do navegador usa o
 * separador decimal do LOCALE do sistema, então "1,50" digitado num Windows
 * em inglês vira campo inválido e valor vazio — sem mensagem nenhuma. O
 * `inputMode="decimal"` continua abrindo o teclado numérico no celular.
 *
 * `parseMoneyToCents` devolve `null` para o que não é número, e `null` sobe
 * como `null` — nunca como zero. Um campo em branco tratado como zero grava um
 * lançamento de R$ 0,00 que ninguém pediu.
 */
export function MoneyInput({
  id,
  valueCents,
  currency,
  onChange,
  placeholder,
  disabled,
}: {
  id?: string;
  valueCents: number | null;
  currency: Currency;
  onChange: (cents: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => centsToText(valueCents));

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-scriba-ink-mute">
        {currency === "USD" ? "US$" : "R$"}
      </span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        className="pl-11"
        value={text}
        placeholder={placeholder ?? "0,00"}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseMoneyToCents(e.target.value));
        }}
        onBlur={() => {
          const cents = parseMoneyToCents(text);
          setText(centsToText(cents));
        }}
      />
    </div>
  );
}

function centsToText(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Campo de percentual que guarda BASIS POINTS.
 *
 * Mesma razão do acima: o estado é texto, o valor é inteiro. 7,5% vira 750, e
 * nunca 0.075 — ver o cabeçalho de `lib/finance/money.ts` sobre por que
 * percentual não vive em float neste código.
 */
export function PercentInput({
  id,
  valueBps,
  onChange,
  disabled,
  placeholder,
}: {
  id?: string;
  valueBps: number | null;
  onChange: (bps: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => (valueBps === null ? "" : bpsToText(valueBps)));

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        className="pr-8"
        value={text}
        placeholder={placeholder ?? "0"}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = Number.parseFloat(e.target.value.replace(",", "."));
          onChange(Number.isFinite(parsed) ? Math.round(parsed * 100) : null);
        }}
        onBlur={() => {
          const parsed = Number.parseFloat(text.replace(",", "."));
          setText(Number.isFinite(parsed) ? bpsToText(Math.round(parsed * 100)) : "");
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-scriba-ink-mute">
        %
      </span>
    </div>
  );
}

function bpsToText(bps: number): string {
  const value = bps / 100;
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}
