import type { ReactNode } from "react";
import { PrivilegedMenuItems } from "@/features/auth/components/PrivilegedMenuItems";
import { PLANS } from "@/features/billing/plans";
import { CoinsSync } from "@/features/coins/components/CoinsSync";
import { INITIAL_COIN_BALANCE } from "@/features/coins/pricing";
import { CacheOwner } from "@/features/session/components/CacheOwner";
import { PendingCaptureRunner } from "@/features/session/components/PendingCaptureRunner";
import { isCurrentUserPartner } from "@/lib/auth/require-partner";
import { getCurrentAccount } from "@/lib/db/account";
import { getCycleUsage } from "@/lib/db/coins";
import { getCurrentPlan } from "@/lib/entitlements/server";
import { OfflineBadge } from "@/shared/components/OfflineBadge";
import { PullToRefresh } from "@/shared/components/PullToRefresh";
import { ReconnectWatcher } from "@/shared/components/ReconnectWatcher";
import { AccountMenu } from "./components/AccountMenu";
import { AppHeaderShell } from "./components/AppHeaderShell";
import { GlobalSearchDialog } from "./components/GlobalSearchDialog";

/**
 * As telas do app que têm BARRA, e o dono da metade dela que não muda.
 *
 * O grupo existe para dizer quem tem barra sem uma lista de exceções: dentro de
 * `(shell)/` estão a Biblioteca, o resumo, a gravação, o `/summary/new`, o
 * `/import`, o perfil e os estudos; fora ficam `/subscribe` e `/subscribe/return`, que
 * são o fluxo de pagamento em tela cheia, e `/refer`, que traz o próprio
 * voltar. Grupo de rotas não aparece na URL, então nada mudou de endereço.
 *
 * **As duas consultas da conta acontecem AQUI, e essa é a mudança.** Elas
 * moravam dentro da `TopBar`, que é renderizada por cada PÁGINA — e página é o
 * que o App Router descarta ao navegar. Resultado: todo toque num link refazia
 * `getCurrentAccount` e `isCurrentUserPartner`, remontava o avatar e o saldo, e
 * deixava o cabeçalho num estado de carregando até a resposta voltar. Num
 * layout as duas rodam uma vez por carregamento de verdade e o menu da conta
 * sobrevive a toda navegação — ele nem perde o estado de aberto.
 *
 * O que continua vindo da página é o título, o voltar e os chips, que são da
 * TELA. Como eles chegam até a casca (por portal, e por quê) está no cabeçalho
 * de `AppHeaderShell`.
 */
export default async function BarraLayout({ children }: { children: ReactNode }) {
  // Duas consultas, em paralelo. `getCurrentAccount` traz perfil, saldo e papel
  // da MESMA linha de `profiles`; `isCurrentUserPartner` lê outra tabela, e é
  // também o ponto onde a mesada mensal do parceiro é conferida e creditada
  // (ver `lib/partners/allowance.ts`). Fica aqui, e não numa rota, porque esta
  // barra é o único caminho por onde todo parceiro passa ao usar o app.
  const [account, isPartner, plan, cycle] = await Promise.all([
    getCurrentAccount().catch(() => null),
    isCurrentUserPartner().catch(() => false),
    // O plano e o ciclo decidem se o chip do saldo mostra o NÚMERO ou o anel do
    // mês (ver `CoinBalance` e `docs/creditos-na-tela.md`). Os dois falham para
    // o lado calmo: sem plano ou sem ciclo, o chip volta ao odômetro de sempre,
    // que é o comportamento correto para a conta gratuita.
    getCurrentPlan().catch(() => "free" as const),
    getCycleUsage().catch(() => null),
  ]);

  // Montado aqui, no servidor, e descido pronto: é a razão do slot de
  // `PrivilegedMenuItems` — com `isAdmin &&` dentro do `AccountMenu`, que é
  // cliente, as strings "Admin" e "/admin" viajariam no chunk que TODO usuário
  // logado baixa.
  const privilegedItems = (
    <PrivilegedMenuItems isAdmin={account?.isAdmin ?? false} isPartner={isPartner} />
  );

  return (
    <>
      {/* Semeia o saldo na store com o número que esta consulta JÁ trouxe, e
          cuida da ressincronia. Não desenha nada, e fica aqui porque o único
          componente que fazia isso era o chip do saldo — que mora dentro do
          menu da conta, ou seja, só existia com o menu aberto. O sintoma era o
          botão do `/import` preso num carregando eterno. Ver `CoinsSync`. */}
      {account ? (
        <CoinsSync balance={account.coinBalance ?? INITIAL_COIN_BALANCE} cycle={cycle} />
      ) : null}
      <AppHeaderShell
        account={
          // Sem sessão não há conta a abrir, e o canto fica só com o que a
          // página pendurar no vão.
          account ? (
            <>
              {/* O FIO entre os controles e o avatar, e só no desktop.

                  Ali no celular há dois botões; no desktop são cinco discos do
                  mesmo tamanho em fila, e o quinto não é um controle da tela, é
                  a CONTA — outra categoria de coisa, que abre um menu em vez de
                  levar a uma tela. Sem o fio, "criar um resumo" e "sair do app"
                  ficam a um disco de distância um do outro, indistinguíveis até
                  se ler os ícones.

                  É `--v2-card-hover`, o cinza do hover dos chips: um degrau
                  acima do `--v2-card` deles e um abaixo da tinta. Em
                  `--v2-ink-mute` o fio pesaria mais que os glifos que ele
                  separa, e um divisor que se lê antes do conteúdo virou o
                  conteúdo.

                  24px de altura contra os 40 dos chips: um fio da altura cheia
                  fecharia a barra em duas caixas, e o que se quer é uma pausa,
                  não uma parede. */}
              <span aria-hidden className="hidden h-6 w-px shrink-0 bg-v2-card-hover md:block" />
              <AccountMenu
                displayName={account.profile.displayName ?? null}
                email={account.profile.email ?? null}
                avatarUrl={account.profile.avatarUrl ?? null}
                coinBalance={account.coinBalance ?? INITIAL_COIN_BALANCE}
                planName={plan === "free" ? null : PLANS[plan].name}
                privilegedItems={privilegedItems}
              />
            </>
          ) : null
        }
      />
      {/* "Modo offline", uma vez para todo o app. O estado é do APARELHO e não
          da página: repetido em sete telas, bastaria esquecer uma para o aviso
          sumir justamente onde alguém estava trabalhando. Ver `OfflineBadge`. */}
      <OfflineBadge />
      {/* E a outra metade: o aviso de que a rede VOLTOU, com a reidratação que
          ele anuncia (queries, mutações pausadas e os server components da
          moldura). Ver `ReconnectWatcher`. */}
      <ReconnectWatcher />
      {/* Puxar para baixo e atualizar, o gesto que o iPhone instalado não tem
          de fábrica e que o Android tinha recarregando a página inteira. Fica
          aqui pela razão dos dois acima: é do APARELHO, não da página. Ver
          `PullToRefresh`. */}
      <PullToRefresh />
      {/* Quem é o dono do cache do aparelho, e a faxina quando ele muda. Fica
          aqui porque é onde a conta já foi lida, e envolve `children` porque
          toda tela que lê a Biblioteca do disco precisa do id na chave. Sem
          sessão não há dono nem cache a escopar. Ver `CacheOwner`.

          Dentro dele, a FILA das gravações guardadas que ainda não viraram
          resumo: ela precisa continuar tentando enquanto o app estiver aberto,
          e uma página morre no primeiro toque num cartão. Fica dentro do
          `CacheOwner` porque, ao terminar um envio, ela invalida a lista da
          Biblioteca, que é escopada pelo id do dono. Ver
          `PendingCaptureRunner` e `features/session/capture-queue.ts`. */}
      {account ? (
        <CacheOwner userId={account.profile.id}>
          <PendingCaptureRunner />
          {/* A busca GLOBAL (Ctrl+K, o chip da `TopBar` e o botão da
              `MobileActionBar`), montada UMA vez aqui dentro: ela lê a
              Biblioteca de `useLibrary()`, que só tem dono dentro do
              `CacheOwner`. Ver `GlobalSearchDialog`. */}
          <GlobalSearchDialog />
          {children}
        </CacheOwner>
      ) : (
        children
      )}
    </>
  );
}
