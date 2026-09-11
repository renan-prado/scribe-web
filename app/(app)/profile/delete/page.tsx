import { ArrowLeft, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DeleteAccountForm } from "@/features/auth/components/DeleteAccountForm";
import { isActiveStatus, PLANS } from "@/lib/billing/plans";
import { getCurrentAccount } from "@/lib/db/account";
import { getOwnSubscription } from "@/lib/db/billing";

export const metadata: Metadata = {
  title: "Excluir conta",
  description:
    "Peça a exclusão da sua conta do Scriba e de todos os seus dados: gravações, transcrições, resumos e estudos.",
};

/**
 * `/profile/delete`, a página que apaga a conta.
 *
 * Ela existe por três exigências que pedem a mesma coisa: a LGPD (art. 18, V),
 * a regra 5.1.1(v) da App Store e a política de exclusão de conta do Google
 * Play. A do Google é a que dita a FORMA: ela pede uma URL, para ser colada no
 * formulário de Segurança dos Dados da ficha da loja, e o revisor abre essa
 * URL sem ter conta nenhuma no produto.
 *
 * É por isso que esta é a única página dentro de `(app)` que renderiza para
 * quem NÃO está logado, e a razão de `/profile/delete` estar em
 * `PUBLIC_PREFIXES` no `proxy.ts` enquanto `/profile` segue protegido. Anônimo
 * lê a explicação inteira, do que é apagado ao que a lei nos obriga a guardar,
 * e encontra no fim o caminho de entrar. Se a página fosse protegida como o
 * resto, o que o revisor veria ao abrir a URL da ficha era uma tela de login
 * sem uma palavra sobre exclusão de conta, que é motivo registrado de recusa.
 *
 * **Ela não é um formulário de pedido: o botão apaga.** As três regras falam
 * de um caminho que o usuário percorre sozinho, e "mande um e-mail para o
 * suporte" é explicitamente recusado por duas delas. Ver
 * `docs/app-store-ios.md`, Portão 4.
 */
export default async function DeleteAccountPage() {
  const account = await getCurrentAccount().catch(() => null);
  const subscription = account ? await getOwnSubscription().catch(() => null) : null;
  const activePlan =
    subscription && isActiveStatus(subscription.status) && subscription.plan !== "free"
      ? PLANS[subscription.plan].name
      : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-scriba-ink-soft outline-none transition-colors hover:text-scriba-ink-strong focus-visible:text-scriba-ink-strong"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Voltar ao perfil
        </Link>
      </div>

      <section className="rounded-[28px] bg-scriba-paper p-6 ring-1 ring-scriba-hairline sm:p-8">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-scriba-rec-soft text-scriba-rec-ink">
          <ShieldAlert aria-hidden className="size-6" />
        </span>
        <h1 className="mt-4 font-heading text-[26px] font-semibold tracking-tight text-scriba-ink-strong">
          Excluir sua conta
        </h1>
        <p className="mt-2 text-sm font-light leading-relaxed text-scriba-ink-soft">
          Você pode encerrar sua conta do Scriba a qualquer momento, sozinho e por aqui. A exclusão
          é imediata e definitiva: não existe lixeira, período de recuperação nem como reverter
          depois.
          {account?.profile.email ? (
            <>
              {" "}
              A conta afetada é a de{" "}
              <span className="font-medium text-scriba-ink-strong">{account.profile.email}</span>.
            </>
          ) : null}
        </p>
      </section>

      <section className="rounded-[28px] bg-scriba-paper p-6 ring-1 ring-scriba-hairline sm:p-7">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-mute">
          O que é apagado
        </h2>
        <ul className="grid gap-2.5 text-sm font-light leading-relaxed text-scriba-ink-soft">
          <Item>Seu cadastro: nome, e-mail, foto e o acesso ao aplicativo.</Item>
          <Item>
            Todas as suas gravações e importações, com as transcrições, os resumos, os estudos
            aprofundados e os cards do feed (releia, lembra e frases marcantes).
          </Item>
          <Item>Suas marcações, lembretes, pregadores e locais salvos.</Item>
          <Item>Seu saldo de créditos, sem reembolso e sem transferência para outra conta.</Item>
          {activePlan ? (
            <Item>
              <span className="font-medium text-scriba-ink-strong">
                Sua assinatura do plano {activePlan} é cancelada na hora
              </span>
              , antes de a conta ser apagada. O período já pago não é reembolsado e não haverá novas
              cobranças.
            </Item>
          ) : null}
        </ul>
      </section>

      <section className="rounded-[28px] bg-scriba-paper p-6 ring-1 ring-scriba-hairline sm:p-7">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-scriba-ink-mute">
          O que a lei nos obriga a guardar
        </h2>
        <ul className="grid gap-2.5 text-sm font-light leading-relaxed text-scriba-ink-soft">
          <Item>
            Registros contábeis e fiscais das compras que você fez, incluindo as notas emitidas pelo
            processador de pagamento, pelos prazos legais aplicáveis.
          </Item>
          <Item>
            Registros de acesso à aplicação, por no mínimo seis meses, como manda o art. 15 do Marco
            Civil da Internet.
          </Item>
          <Item>
            Números agregados de uso e de custo, sem qualquer vínculo com você: o que resta é quanto
            uma chamada custou, não quem a fez.
          </Item>
        </ul>
        <p className="mt-4 text-xs font-light leading-relaxed text-scriba-ink-mute">
          Os detalhes estão na{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Política de Privacidade
          </Link>
          . Dúvidas sobre seus dados:{" "}
          <a href="mailto:contato@scriba.cc" className="underline underline-offset-2">
            contato@scriba.cc
          </a>
          .
        </p>
      </section>

      {account ? (
        <DeleteAccountForm />
      ) : (
        /* Anônimo (ou o revisor da loja abrindo a URL da ficha). A explicação
           acima já foi lida inteira; o que falta é provar que a conta é dele,
           e o `?next=` traz de volta exatamente para cá. */
        <section className="rounded-[28px] bg-scriba-paper p-6 text-center ring-1 ring-scriba-hairline sm:p-7">
          <p className="text-sm font-light leading-relaxed text-scriba-ink-soft">
            Para excluir uma conta é preciso entrar nela primeiro. É o que garante que ninguém
            apague os dados de outra pessoa.
          </p>
          <Link
            href="/sign-in?next=%2Fprofile%2Fdelete"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-scriba-ink-strong px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Entrar para excluir minha conta
          </Link>
        </section>
      )}
    </main>
  );
}

function Item({ children }: { children: ReactNode }) {
  return (
    <li className="relative pl-5 before:absolute before:top-2 before:left-0 before:size-1.5 before:rounded-full before:bg-scriba-ink-mute">
      {children}
    </li>
  );
}
