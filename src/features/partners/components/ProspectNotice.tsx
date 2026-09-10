import { formatCoins } from "@/lib/billing/plans";
import { PARTNER_PROSPECT_COINS } from "@/lib/partners/economics";
import { CoinMark } from "@/shared/icons/CoinMark";

/**
 * O selo de quem chegou pela página de parceiros, na tela de entrada.
 *
 * Irmão do `ReferralField`, e pela mesma razão de existir: uma tela de login
 * genérica desperdiça a única coisa que a pessoa acabou de ler. Quem clicou em
 * "Conhecer a plataforma" veio por causa de uma oferta específica, e chegar num
 * "Entrar no Scriba" sem menção nenhuma a ela é o momento em que metade
 * desiste, a oferta parecia boa demais e a tela seguinte não a confirma.
 *
 * **A palavra que mais importa aqui é "sem compromisso".** O medo de quem
 * clica não é o preço (não há), é o de estar assinando alguma coisa: uma
 * exclusividade, uma meta, uma cobrança depois. O selo diz o que a pessoa
 * ganha e, na mesma frase, o que ela NÃO está aceitando.
 *
 * Server component puro, sem estado, sem client boundary. Ele não decide nada:
 * quem lê o cookie é a página, e quem credita é `attach_partner_prospect`.
 */
export function ProspectNotice() {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-scriba-hairline bg-scriba-cream p-4">
      <div className="flex items-center gap-2.5">
        <CoinMark size={26} className="flex-none" />
        <div className="flex min-w-0 flex-col">
          <span className="text-[13.5px] font-semibold leading-tight text-scriba-cream-ink">
            {formatCoins(PARTNER_PROSPECT_COINS)} moedas para conhecer
          </span>
          <span className="text-[11.5px] font-medium text-scriba-cream-accent">
            Candidato a parceiro · sem compromisso
          </span>
        </div>
      </div>
      <p className="text-pretty text-[12px] font-light leading-[1.55] text-scriba-cream-body">
        Criando sua conta agora, as moedas entram no seu saldo para você usar o Scriba de verdade e
        decidir se faz sentido divulgá-lo.{" "}
        <strong className="font-semibold">Você não está se comprometendo com nada</strong>: sem
        meta, sem exclusividade e sem cartão. Se depois quiser entrar no programa, a gente conversa.
      </p>
    </div>
  );
}
