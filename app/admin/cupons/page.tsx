import type { Metadata } from "next";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { CouponsManager } from "@/features/admin/components/CouponsManager";
import { listCoupons } from "@/lib/db/coupons";

export const metadata: Metadata = { title: "Cupons" };
export const dynamic = "force-dynamic";

/**
 * Os convites nominais: um link que credita moedas na conta criada por ele.
 *
 * Ele existe para uma coisa que nenhum dos três programas de indicação faz:
 * chamar UMA pessoa escolhida para testar o produto. `partners` paga comissão a
 * quem divulga, `referral_rewards` premia quem trouxe um amigo e
 * `partner_prospects` dá cortesia a quem se candidatou a divulgador. Os três
 * descrevem uma relação com alguém de fora; o cupom é o admin abrindo a porta
 * para quem ele quer, com um saldo dentro.
 *
 * A invariante da tela, e ela está no banco antes de estar aqui: **todo cupom
 * tem teto de usos**. Um link público que credita moedas é uma torneira, e o
 * custo de abusá-la é criar contas Google. Ver o cabeçalho da migração 0055.
 */
export default async function AdminCouponsPage() {
  const coupons = await listCoupons().catch(() => []);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Cupons"
        subtitle="Links de convite: quem criar a conta por um deles ganha as moedas do cupom, além das de boas-vindas."
      />
      <CouponsManager coupons={coupons} />
    </div>
  );
}
