import { AuthShell } from "@/features/auth/components/AuthShell";

/**
 * Tela de conta desativada.
 *
 * Aparece no lugar do app inteiro quando `profiles.is_active` é `false` — o
 * lado visível do 403 que `requireAuth()` devolve nas rotas de API. As duas
 * pontas existem porque uma sozinha não basta: barrar só as páginas deixaria
 * as rotas abertas a um cliente scriptado, e barrar só as rotas deixaria a
 * pessoa navegando por telas que falham uma a uma sem dizer por quê.
 *
 * Diz o motivo em vez de devolver 404. O 404 do `/admin` existe para não
 * confirmar a existência de uma área a quem não deveria vê-la; aqui é o
 * oposto — a pessoa precisa saber que a conta foi suspensa e a quem falar,
 * senão o suporte recebe "o site quebrou" em vez de "por que fui suspenso".
 *
 * O botão de sair é a única ação: sem ele, sair da conta exigiria limpar
 * cookie na mão, já que o menu do avatar mora no header que esta tela
 * substitui.
 */
export function AccountDisabled() {
  return (
    <AuthShell
      title="Conta desativada"
      subtitle="Esta conta foi suspensa e não pode gravar, transcrever ou acessar o conteúdo salvo por enquanto."
      footer={<>Acha que houve engano? Responda ao e-mail de suporte que você recebeu.</>}
    >
      <p className="text-center text-[13.5px] font-light leading-[1.6] text-scriba-ink-soft">
        Suas gravações continuam guardadas. Nada foi apagado.
      </p>
      <form action="/auth/sign-out" method="post">
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-[24px] border border-auth-btn-border bg-scriba-paper px-[22px] py-[16px] text-[14px] font-medium text-scriba-ink-strong transition-colors hover:border-auth-btn-border-hover hover:bg-auth-btn-bg-hover"
        >
          Sair da conta
        </button>
      </form>
    </AuthShell>
  );
}
