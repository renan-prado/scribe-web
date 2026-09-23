import { Bone } from "../components/Bone";

/**
 * O esqueleto do perfil.
 *
 * A tela lê perfil, assinatura e histórico de crédito — três respostas antes de
 * a primeira pixel aparecer, e ela é aberta pelo menu da conta, que fecha no
 * mesmo toque: sem esqueleto, o menu some e nada toma o lugar dele.
 *
 * O primeiro osso é o cartão de identidade, redondo e alto, porque é a primeira
 * coisa que chega; os de baixo são as seções de plano e créditos.
 */
export default function ProfileLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[1024px] flex-col gap-6 px-4 pb-10 sm:gap-8">
      <Bone className="h-56 w-full rounded-[28px]" />
      {[0, 1].map((section) => (
        <div key={`section-${section}`} className="flex flex-col gap-3">
          <Bone className="ml-1 h-4 w-32" />
          <Bone className="h-28 w-full rounded-3xl" />
        </div>
      ))}
    </main>
  );
}
