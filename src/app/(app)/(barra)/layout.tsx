import type { ReactNode } from "react";
import { PrivilegedMenuItems } from "@/features/auth/components/PrivilegedMenuItems";
import { CoinsSync } from "@/features/coins/components/CoinsSync";
import { INITIAL_COIN_BALANCE } from "@/features/coins/pricing";
import { isCurrentUserPartner } from "@/lib/auth/require-partner";
import { getCurrentAccount } from "@/lib/db/account";
import { AccountMenu } from "./components/AccountMenu";
import { AppHeaderShell } from "./components/AppHeaderShell";

/**
 * As telas do app que têm BARRA, e o dono da metade dela que não muda.
 *
 * O grupo existe para dizer quem tem barra sem uma lista de exceções: dentro de
 * `(barra)/` estão a Biblioteca, o resumo, a gravação, o `/escrever`, o
 * `/importar`, o perfil e os estudos; fora ficam `/assinar` e `/retorno`, que
 * são o fluxo de pagamento em tela cheia, e `/indicar`, que traz o próprio
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
  const [account, isPartner] = await Promise.all([
    getCurrentAccount().catch(() => null),
    isCurrentUserPartner().catch(() => false),
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
          botão do `/importar` preso num carregando eterno. Ver `CoinsSync`. */}
      {account ? <CoinsSync balance={account.coinBalance ?? INITIAL_COIN_BALANCE} /> : null}
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
                privilegedItems={privilegedItems}
              />
            </>
          ) : null
        }
      />
      {children}
    </>
  );
}
