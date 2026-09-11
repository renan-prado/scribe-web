"use client";

import { Loader2, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type AdminCoupon,
  COUPON_DEFAULT_REDEMPTIONS,
  COUPON_MAX_COINS,
  COUPON_MAX_REDEMPTIONS,
  couponPath,
  couponUnavailableReason,
  normalizeCouponCode,
} from "@/lib/domain/coupon";
import { CopyButton } from "./CopyButton";

/**
 * Emissão e controle dos cupons de cadastro.
 *
 * **O link é o produto desta tela**, não a linha da tabela. Quem abre aqui vai
 * copiar um endereço e mandá-lo a uma pessoa, então o link inteiro aparece
 * pronto, com o botão de copiar ao lado, em vez de só o código: montar
 * "scriba.cc/c/" + código na cabeça é o tipo de passo que se erra uma vez e se
 * descobre quando o convidado responde que o link não abre.
 *
 * O endereço é montado com `window.location.origin` (daí este componente ser
 * cliente): em dev ele precisa apontar para o localhost, e em `dev.scriba.cc`
 * para o domínio de preview, senão o link copiado leva o teste para produção.
 *
 * Três coisas da tabela que não são estética:
 *
 *   - **"Usos" é `resgatados / teto`, sempre com os dois números.** Só o
 *     primeiro não responde a pergunta que se faz ao olhar ("ainda posso mandar
 *     este link?"), e é a pergunta que traz alguém aqui.
 *   - **A pastilha diz por que um cupom não vale mais**, e não um "inativo"
 *     para tudo. Esgotado, expirado e desativado pedem coisas diferentes:
 *     emitir outro, emitir outro com data, ou reativar este.
 *   - **Apagar só aparece enquanto ninguém resgatou.** O banco recusa o resto
 *     (`on delete restrict`), e mostrar um botão que vai falhar é pior que não
 *     mostrá-lo. Cupom usado se desativa.
 */

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const UNAVAILABLE_LABEL = {
  inactive: "Desativado",
  expired: "Expirado",
  exhausted: "Esgotado",
} as const;

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : DATE_FMT.format(d);
}

export function CouponsManager({ coupons }: { coupons: AdminCoupon[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [code, setCode] = useState("");
  const [coins, setCoins] = useState("200");
  const [maxRedemptions, setMaxRedemptions] = useState(String(COUPON_DEFAULT_REDEMPTIONS));
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function post(body: unknown, okMessage: string, busyKey: string) {
    setBusy(busyKey);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(
          data.error === "duplicate_code"
            ? "Já existe um cupom com esse código."
            : data.error === "coupon_in_use"
              ? "Este cupom já foi resgatado: desative em vez de apagar."
              : "Não consegui salvar. Confira os valores e tente de novo."
        );
        return false;
      }
      toast.success(okMessage);
      startTransition(() => router.refresh());
      return true;
    } catch {
      toast.error("Falha de conexão.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = normalizeCouponCode(code);
    if (!cleanCode) {
      toast.error("O código aceita letras minúsculas, números e hífen, de 3 a 32 caracteres.");
      return;
    }
    const coinsNum = Number(coins);
    const maxNum = Number(maxRedemptions);
    if (!Number.isInteger(coinsNum) || coinsNum < 1 || coinsNum > COUPON_MAX_COINS) {
      toast.error(`As moedas vão de 1 a ${COUPON_MAX_COINS}.`);
      return;
    }
    if (!Number.isInteger(maxNum) || maxNum < 1 || maxNum > COUPON_MAX_REDEMPTIONS) {
      toast.error(`O limite de usos vai de 1 a ${COUPON_MAX_REDEMPTIONS}.`);
      return;
    }
    // O campo é uma data; o fim do dia escolhido é o que a pessoa quer dizer com
    // "vale até sexta". Meia-noite mataria o cupom um dia antes do combinado.
    const expires = expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null;

    void post(
      {
        action: "create",
        code: cleanCode,
        coins: coinsNum,
        maxRedemptions: maxNum,
        label: label.trim() || null,
        expiresAt: expires,
      },
      "Cupom criado.",
      "create"
    ).then((ok) => {
      if (ok) {
        setCode("");
        setLabel("");
        setExpiresAt("");
      }
    });
  }

  // O `origin` entra DEPOIS da montagem, e não durante o render.
  //
  // Este componente é cliente mas renderiza no servidor primeiro, e lá
  // `window` não existe: lendo-o no corpo, o HTML sairia com o caminho
  // relativo e o primeiro render do navegador com a URL inteira, que é
  // incompatibilidade de hidratação, o React descarta a árvore e avisa no
  // console. Com o efeito, as duas primeiras pinturas concordam e a linha só
  // ganha o domínio depois.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Novo cupom</h2>
          <p className="text-xs text-muted-foreground">
            Quem criar a conta pelo link ganha as moedas do cupom{" "}
            <strong className="font-medium">além</strong> das de boas-vindas. Vale uma vez por
            pessoa, só para conta NOVA (30 minutos a partir do cadastro), e o valor de um cupom
            emitido não muda: para mudar, desative e emita outro.
          </p>
        </div>

        <form
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3"
          onSubmit={handleCreate}
        >
          <div className="flex min-w-0 flex-col gap-1 sm:min-w-[170px] sm:flex-1">
            <span className="text-[11px] font-medium text-muted-foreground">Código</span>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="igreja-betel"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Moedas</span>
            <Input
              type="number"
              min={1}
              max={COUPON_MAX_COINS}
              value={coins}
              onChange={(e) => setCoins(e.target.value)}
              className="sm:w-[110px]"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Limite de usos</span>
            <Input
              type="number"
              min={1}
              max={COUPON_MAX_REDEMPTIONS}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              className="sm:w-[130px]"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Validade</span>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="sm:w-[160px]"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1 sm:min-w-[200px] sm:flex-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              Para quem (opcional)
            </span>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Pastores convidados do teste"
              maxLength={120}
            />
          </div>
          <Button type="submit" disabled={busy === "create"} className="w-full sm:w-auto">
            {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : null}
            Criar cupom
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Cupons emitidos</h2>
        <div className="admin-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Link</TableHead>
                <TableHead>Moedas</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-muted-foreground">
                    Nenhum cupom emitido ainda.
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((c) => {
                  // Antes da montagem sai o caminho relativo; ele vira link
                  // inteiro no efeito acima. Em dev e em `dev.scriba.cc` o
                  // domínio TEM de vir de `window`: um link fixo em scriba.cc
                  // mandaria o teste para produção.
                  const link = `${origin}${couponPath(c.code)}`;
                  const unavailable = couponUnavailableReason(c);
                  const toggleKey = `toggle:${c.code}`;
                  const deleteKey = `delete:${c.code}`;
                  return (
                    <TableRow key={c.code}>
                      <TableCell>
                        <div className="group flex min-w-0 flex-col gap-0.5">
                          <span className="flex items-center font-mono text-xs">
                            {link}
                            <CopyButton value={link} />
                          </span>
                          {c.label ? (
                            <span className="text-xs text-muted-foreground">{c.label}</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">{c.coins}</TableCell>
                      <TableCell className="tabular-nums">
                        {c.redemptions} / {c.maxRedemptions}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(c.expiresAt)}
                      </TableCell>
                      <TableCell>
                        {unavailable ? (
                          <Badge variant="secondary">{UNAVAILABLE_LABEL[unavailable]}</Badge>
                        ) : (
                          <Badge>Ativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy === toggleKey}
                            onClick={() =>
                              void post(
                                { action: "toggle", code: c.code, isActive: !c.isActive },
                                c.isActive ? "Cupom desativado." : "Cupom reativado.",
                                toggleKey
                              )
                            }
                          >
                            {busy === toggleKey ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Power className="size-4" />
                            )}
                            {c.isActive ? "Desativar" : "Reativar"}
                          </Button>
                          {c.redemptions === 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy === deleteKey}
                              onClick={() =>
                                void post(
                                  { action: "delete", code: c.code },
                                  "Cupom apagado.",
                                  deleteKey
                                )
                              }
                            >
                              {busy === deleteKey ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                              Apagar
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
