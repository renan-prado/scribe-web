import { formatCoins } from "@/lib/billing/plans";
import { CoinMark } from "@/shared/icons/CoinMark";

/**
 * O selo de quem chegou por um cupom de convite, na tela de entrada.
 *
 * Irmão do `ProspectNotice` e do `ReferralField`, e existe pela mesma razão:
 * uma tela de login genérica desperdiça a única coisa que a pessoa acabou de
 * receber. Quem clicou num link que dizia "crie sua conta e ganhe moedas" e
 * chega num "Entrar no Scriba" sem menção nenhuma a isso tem todo motivo para
 * achar que clicou no link errado.
 *
 * **O número vem do servidor, e só aparece se o cupom AINDA valer.** Quem
 * resolve isso é `getCouponPublicByCode`, que devolve `null` para cupom
 * inativo, expirado ou esgotado, exatamente as três situações em que
 * `redeem_signup_coupon` vai recusar o crédito. Anunciar aqui um bônus que a
 * RPC vai negar é prometer moeda que não existe, e a pessoa descobre isso
 * depois de já ter criado a conta.
 *
 * Server component puro, sem estado, sem client boundary: ele não decide nada,
 * quem lê o cookie é a página e quem credita é a RPC.
 */
export function CouponNotice({ coins }: { coins: number }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-scriba-hairline bg-scriba-mint p-4">
      <div className="flex items-center gap-2.5">
        <CoinMark size={26} className="flex-none" />
        <div className="flex min-w-0 flex-col">
          <span className="text-[13.5px] font-semibold leading-tight text-scriba-mint-ink">
            {formatCoins(coins)} moedas no seu convite
          </span>
          <span className="text-[11.5px] font-medium text-scriba-mint-accent">
            Elas entram assim que a conta for criada
          </span>
        </div>
      </div>
      <p className="text-pretty text-[12px] font-light leading-[1.55] text-scriba-mint-body">
        O convite é seu e vale uma vez. Criando a conta agora com o Google, as moedas se somam às de
        boas-vindas e você já começa gravando de verdade.{" "}
        <strong className="font-semibold">Sem cartão e sem assinatura.</strong>
      </p>
    </div>
  );
}
