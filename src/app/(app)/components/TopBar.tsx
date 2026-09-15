import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import { PrivilegedMenuItems } from "@/features/auth/components/PrivilegedMenuItems";
import { INITIAL_COIN_BALANCE } from "@/features/coins/pricing";
import { isCurrentUserPartner } from "@/lib/auth/require-partner";
import { getCurrentAccount } from "@/lib/db/account";
import { cn } from "@/lib/utils";
import { ScribaMark } from "@/shared/brand";
import { AccountMenu } from "./AccountMenu";
import { TOPBAR_CHIP_CLASS } from "./chip";

/**
 * A barra do topo do v2: a pena, o título, a busca.
 *
 * Mora aqui, e não dentro de `home/`, porque a `/recording` usa a mesma:
 * são telas diferentes do mesmo produto, e um cabeçalho que muda de desenho ao
 * entrar na gravação faria a pessoa achar que saiu do app.
 *
 * **O canto esquerdo é a PENA, sozinha, em cinza, e ela não clica.** Ali houve
 * um hambúrguer, e a gaveta dele tinha quatro destinos: Biblioteca, Estudos,
 * Escrever e Importar do YouTube. Os dois últimos passaram para o `+` do
 * rodapé, que é onde se cria; os Estudos saíram da interface; e a Biblioteca,
 * que sobrou, virou por um tempo o destino da própria marca. Hoje nem isso: a
 * pena é MARCAÇÃO, sem link e sem hover. Quem precisa da Biblioteca chega nela
 * pelo voltar do `/summary`, que é o caminho por onde se entrou.
 *
 * **Ela é um server component, e por isso é a PÁGINA quem a renderiza**, nunca
 * um componente cliente. É aqui que o perfil e o saldo são lidos (uma consulta,
 * `getCurrentAccount` é `cache()`), e é a única razão de a barra tocar o banco:
 * o menu da conta abre com quem é você e quanto você tem.
 *
 * O canto direito tem DUAS coisas, e só uma delas é da página. O `trailing` é
 * um SLOT: a Biblioteca passa as portas de criação e o gatilho da busca (que
 * precisa do estado dela, ver `SearchScope`), o `/summary` passa as portas e a
 * busca DENTRO do resumo, a gravação passa o relógio. **O avatar vem depois
 * dele e é da BARRA**, em toda tela que a monte: a conta não é assunto de uma
 * página, e um avatar que aparece e some conforme a tela obrigaria a decorar em
 * qual delas ele estava. Ver `AccountMenu`.
 *
 * **Entre os dois há um FIO, e só no desktop.** No celular o `trailing` tem um
 * ou dois botões; no desktop ele tem quatro, e o quinto disco da fila não é um
 * controle da tela, é a CONTA. O fio é o que separa as duas categorias — ver o
 * comentário dele lá embaixo.
 *
 * **Com `backHref`, o canto esquerdo troca a pena por um VOLTAR** e o título
 * pode sumir — é a barra do `/summary`. Uma tela de leitura aberta a partir de
 * um cartão precisa do caminho de volta no lugar onde o polegar já procura,
 * que é o canto onde a marca estava; e repetir ali o título do sermão, que a
 * página inteira grita duas linhas abaixo, seria dizê-lo duas vezes. O resto da
 * barra NÃO muda: a lupa e o avatar continuam onde estavam em toda tela.
 */
export async function TopBar({
  title,
  backHref,
  trailing,
}: {
  /** Some no `/summary`: a própria página já é o título. */
  title?: string;
  /** Quando passado, a pena vira um voltar para cá. */
  backHref?: string;
  trailing?: ReactNode;
}) {
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
  const identity = {
    displayName: account?.profile.displayName ?? null,
    email: account?.profile.email ?? null,
    avatarUrl: account?.profile.avatarUrl ?? null,
    coinBalance: account?.coinBalance ?? INITIAL_COIN_BALANCE,
  };

  return (
    // `gap-3`: o título encostado no botão da esquerda lia como legenda dele,
    // e não como o nome da tela.
    <header className="flex items-center gap-3 px-1 py-3">
      {backHref ? (
        <NavLink
          href={backHref}
          aria-label="Voltar"
          spinner="none"
          contentClassName="inline-flex items-center"
          className={cn("-ml-1", TOPBAR_CHIP_CLASS)}
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} />
        </NavLink>
      ) : (
        /* A PENA sozinha, e em cinza: sem a palavra e sem o gradiente do
           `ScribaLogo`. O logotipo inteiro ali competia com o título da tela —
           duas palavras no mesmo peso lado a lado, e a que importa é a que diz
           onde você está. A pena basta para dizer de quem é o app, e em
           `--v2-ink-mute` ela fica no plano em que uma marca fica: presente e
           atrás do conteúdo.

           **Ela NÃO é clicável, e não reage ao mouse: é marcação.** Foi um link
           para a Biblioteca por algumas versões, herdado da gaveta do
           hambúrguer que morava neste canto. Um logotipo que acende sob o
           cursor promete um destino, e num app de três telas esse destino não
           valia o clique que ele pedia. Sem `hover`, sem `focus`, sem `href`:
           quem olha entende que ali não há nada para tocar.

           Ela mora numa caixa de 40px — a mesma do chip do voltar e da lupa —,
           e é isso que mantém a barra com a mesma altura em toda tela. Mas NÃO
           ganha o disco `--v2-card` do chip: dentro de uma pastilha a marca
           viraria mais um botão numa fileira deles, que é exatamente o que ela
           deixou de ser.

           Não leva `aria-label` nenhum: a pena já é `aria-hidden`, e um enfeite
           sem ação não é coisa que o leitor de tela precise anunciar. */
        <span className="inline-flex size-10 shrink-0 items-center justify-center text-v2-ink-mute">
          <ScribaMark size={26} />
        </span>
      )}
      {/* Sem peso: o título é a placa da tela, e em negrito ele competia com o
          conteúdo que a página veio mostrar. */}
      {title ? (
        <h1 className="min-w-0 flex-1 truncate text-[22px] text-v2-ink">{title}</h1>
      ) : (
        <span className="flex-1" />
      )}
      {/* Sem `trailing`, um vão do tamanho do botão: é ele que mantém o título
          na mesma posição nas duas telas, e sem o vão o texto escorregaria
          para a direita ao trocar de página. Só que ele existe para segurar o
          TÍTULO — nas telas que não têm um (o `/summary`, o estudo) não há o
          que segurar, e o vão seria um buraco de 40px antes do avatar. */}
      {trailing ?? (title ? <span aria-hidden className="size-10 shrink-0" /> : null)}
      {/* Sem sessão não há conta a abrir, e o canto fica com a lupa sozinha. */}
      {account ? (
        <>
          {/* O FIO entre os controles e o avatar, e só no desktop.

              Ali no celular há dois botões; no desktop são cinco discos do
              mesmo tamanho em fila, e o quinto não é um controle da tela, é a
              CONTA — outra categoria de coisa, que abre um menu em vez de
              levar a uma tela. Sem o fio, "criar um resumo" e "sair do app"
              ficam a um disco de distância um do outro, indistinguíveis até
              se ler os ícones.

              É `--v2-card-hover`, o cinza do hover dos chips: um degrau acima
              do `--v2-card` deles e um abaixo da tinta. Em `--v2-ink-mute` o
              fio pesaria mais que os glifos que ele separa, e um divisor que
              se lê antes do conteúdo virou o conteúdo.

              24px de altura contra os 40 dos chips: um fio da altura cheia
              fecharia a barra em duas caixas, e o que se quer é uma pausa, não
              uma parede. */}
          <span aria-hidden className="hidden h-6 w-px shrink-0 bg-v2-card-hover md:block" />
          <AccountMenu {...identity} privilegedItems={privilegedItems} />
        </>
      ) : null}
    </header>
  );
}
