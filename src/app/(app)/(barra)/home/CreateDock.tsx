"use client";

import { PenLine, Plus, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MicGlyph } from "@/components/icons/MicGlyph";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { NavLink } from "@/components/NavLink";
import { AiPaywallDialog } from "@/features/billing/components/AiPaywallDialog";
import { useCoinsStore } from "@/features/coins/store";
import { useTourReveal } from "@/features/tour/lib/reveal";
import { cn } from "@/lib/utils";

/**
 * A barra de baixo do v2: uma faixa que escurece até o preto, com o botão de
 * CRIAR no canto direito dela. **Só no celular.**
 *
 * **No desktop ela não existe, e quem cria é a barra do topo**
 * (`components/CreateActions.tsx`). O `+` é um clique cobrado para revelar três
 * ícones, e ele se paga enquanto a tela é estreita e o polegar mora no canto de
 * baixo: ali a faixa do topo é a única linha larga que a tela tem, e gastá-la
 * com três botões seria gastar o lugar do título. Num monitor as duas razões
 * caem — o cursor chega a qualquer canto pelo mesmo custo, e sobra vão de sobra
 * à direita do título. Por isso tudo aqui é `md:hidden` e cada chip de lá é
 * `hidden md:inline-flex`: nunca os dois na mesma largura, nunca nenhum dos
 * dois. Lá eles também não têm cor — o quadrado `--v2-accent` do "Resumo
 * automático" deste painel só funciona porque são três quadrados iguais
 * abertos no vazio; numa barra de controles, um disco colorido no meio de
 * quatro cinzas leria como alerta.
 *
 * **Era um microfone sozinho, e por isso o menu tinha de existir.** Gravar é um
 * dos três jeitos de uma sessão nascer — os outros dois, escrever e importar do
 * YouTube, moravam na gaveta do hambúrguer, três toques longe e num lugar que
 * ninguém abre para criar, abre para navegar. Com o `+`, as três portas ficam
 * atrás do mesmo botão, que é onde o polegar já estava.
 *
 * **Ele fica à DIREITA, não mais no centro.** Centralizado, o botão pousava
 * exatamente sobre a coluna da esquerda do mural de post-its e tampava o cartão
 * de baixo; e um painel que se abre a partir do centro não tem para que lado
 * crescer. No canto, ele cresce para a ESQUERDA, na mesma linha do botão e
 * alinhado por baixo com ele — é o desenho do print, e é também o que mantém o
 * painel fora de debaixo do dedo que acabou de tocar.
 *
 * **Abaixo de 350px de tela ele sobe para CIMA do botão.** Ali a linha não
 * cabe, e insistir nela custaria uma opção cortada pela borda esquerda; em
 * coluna o painel cabe inteiro, e o dedo em cima dele é o preço menor dos
 * dois. É a única regra de largura do componente, e ela mora no `className` da
 * linha, não num `useState` de tamanho de janela.
 *
 * **Ela não tem fundo chapado, e é aí que está o desenho.** O que separa a
 * barra do conteúdo é um GRADIENTE (`--v2-dock-fade`), preto embaixo e
 * transparente em cima, então a lista não é cortada por uma borda, ela mergulha
 * na faixa. Isso também resolve o que a sombra do botão resolvia antes, e
 * melhor: a sombra separava o botão do que estava atrás DELE, num ponto só; a
 * faixa separa a barra inteira. Por isso o botão hoje não tem `shadow`.
 *
 * **O botão é CINZA, e de VIDRO** (`--v2-glass-*`, ver `app/globals.css`). O
 * vermelho que ele teve por um commit é a cor do microfone — do gravar, do
 * ponto que pisca durante a pregação —, e num botão que abre três portas, das
 * quais só uma grava, ele prometia a errada.
 *
 * O vidro são três camadas do mesmo material, no botão e no painel: a
 * superfície translúcida sobre `backdrop-blur`, o brilho de 10% de branco caindo
 * a 2% (que é o que dá a curvatura sob uma luz de cima) e o fio de borda. É
 * sutil de propósito — subir esses números é o caminho mais curto para o
 * plástico brilhante de 2010 —, e é o que faz o mural de post-its continuar
 * atrás da peça, desfocado, em vez de apagado por um retângulo opaco.
 *
 * **Os três nomes dizem o RESULTADO, não o gesto**: "Resumo automático",
 * "Escrever resumo", "Importar do YouTube". Eles já foram um verbo cada
 * (Gravar, Escrever, Importar), e um verbo sozinho diz o que o toque faz, não
 * onde ele vai dar — "Gravar" não conta que o fim do caminho é um resumo, que é
 * o produto inteiro. Com o nome inteiro, cada porta se explica fora da fileira
 * também: no balão do tour, num leitor de tela, na volta de quem já não lembra
 * qual era qual. São os mesmos nomes dos chips gêmeos do desktop
 * (`(app)/(barra)/components/CreateActions.tsx`), menos o de gravar, que lá é
 * "Gravar resumo".
 *
 * **O painel tem um TÍTULO, "Criar resumo:"**, que diz uma vez o que os três
 * têm em comum. Ele é também o NOME do painel para quem usa leitor de tela
 * (`aria-labelledby`), no lugar do `aria-label="Criar"` que havia ali: a mesma
 * frase escrita em dois lugares é a frase que um dia diverge sem ninguém ver.
 *
 * **E não há véu.** O apanhador de toque atrás do painel é transparente:
 * escurecer a tela trataria como modal o que é um menu de três atalhos. A
 * Biblioteca continua legível atrás, porque ela não está bloqueada, só está
 * sendo deixada de lado por um segundo — e é justamente ela, vista pelo vidro,
 * o que dá ao painel a profundidade que um véu apagaria.
 *
 * **"Gravar" leva para o `/recording` JÁ GRAVANDO**, pelo `?auto=1` da
 * URL. O parâmetro existe porque as duas portas da mesma tela querem coisas
 * diferentes: quem tocou a opção já disse que quer gravar, e pedir um segundo
 * toque do outro lado seria cobrar duas vezes pela mesma decisão; quem digita
 * `/recording` na barra de endereço (ou volta a ela pelo histórico) não pediu
 * nada, e abrir o microfone sozinho ali seria uma tela que grava sem ser
 * chamada.
 *
 * As três são `NavLink`, e não `button` com `router.push`: os destinos são
 * ROTAS, e como links eles ganham de graça o que um botão não tem, abrir em
 * nova aba, copiar endereço, o prefetch do router e o foco do teclado se
 * comportando como o resto da navegação.
 *
 * **O BOTÃO some ao rolar para baixo e volta ao rolar para cima. A FAIXA fica.**
 * Rolar para baixo é ler, e o botão é o que cobre o que se está lendo; rolar
 * para cima é procurar, e quem procura na biblioteca costuma estar a um toque
 * de gravar. O gesto é o mesmo que esconde a barra de endereço do navegador no
 * celular, então a tela responde junto.
 *
 * O gradiente NÃO acompanha, e isso é escolha: ele não é enfeite do botão, é a
 * borda de baixo da tela, o que faz a lista terminar em desvanecimento em vez
 * de em corte. Piscando junto, a tela ganharia uma moldura que aparece e some
 * sozinha, que é justamente o tipo de movimento que cansa numa lista longa.
 *
 * As duas animações do botão são assimétricas (ver `app/globals.css`): sair é
 * opacidade e rápido, voltar é mais demorado e tem zoom. O painel reaproveita a
 * MESMA entrada (`animate-v2-rec-in`), com origem no canto de baixo à direita:
 * ele cresce de dentro do botão que o abriu, em vez de aparecer pousado sobre
 * ele.
 *
 * Três detalhes que não são estética:
 *
 * - **Perto do topo ela reaparece sempre**, mesmo que o último gesto tenha
 *   sido para baixo. Sem isso, uma lista curta demais para rolar de volta
 *   deixaria o botão escondido sem nenhum jeito óbvio de trazê-lo.
 * - **Um piso de 8px por gesto.** Sem ele o repique do iOS no fim da rolagem
 *   (e o tremor do dedo parado) alterna as duas animações sozinho.
 * - **O `scroll` é `passive`.** Um listener que pode chamar `preventDefault`
 *   obriga o navegador a esperar por ele antes de pintar cada quadro da
 *   rolagem, e é exatamente isso que o dedo sente.
 *
 * **Rolar com o painel aberto FECHA o painel**, e é o mesmo listener que faz
 * isso. O painel é `fixed`: sem isso ele ficaria parado no canto enquanto a
 * lista corre atrás dele, com um véu por cima que o dedo atravessa — dois
 * comportamentos contraditórios no mesmo gesto.
 *
 * **O TOUR também abre este painel, e ele é a razão de `open` ser derivado.**
 * As três portas do produto moram aqui dentro, atrás de um botão que nasce
 * fechado; a apresentação da Biblioteca tem um passo para cada uma, e um tour
 * que só pudesse falar do que já está na tela contaria as três apontando para
 * um `+`. O pedido chega por `useTourReveal` (ver `features/tour/lib/reveal.ts`),
 * e enquanto ele durar o painel não fecha por rolagem, por Esc nem por toque
 * fora — o dono do painel naquele momento é o tour, e um menu que se fecha
 * sozinho no meio do balão que fala dele é pior que um menu que não abre.
 */
export function CreateDock() {
  const [scrolledIn, setScrolledIn] = useState(true);
  // Enquanto ninguém rolou não há animação nenhuma: no carregamento da página
  // ela seria um movimento sem causa.
  const [moved, setMoved] = useState(false);
  const [tapped, setTapped] = useState(false);
  const revealed = useTourReveal("create-dock");
  // Aberto pelo dedo OU pelo tour. Derivado, e não um `setOpen` que o tour
  // chamaria: com um estado só, o `setTapped(false)` da rolagem e do Esc apagaria
  // o pedido do tour, e o painel fecharia no meio do passo que o explica.
  const open = tapped || revealed;
  // E o BOTÃO volta junto. Ele se esconde ao rolar para baixo, e um tour que
  // abrisse o painel a partir de um `+` invisível recortaria um furo em cima de
  // nada — o alvo continua tendo caixa, o holofote continua achando, e o que a
  // pessoa vê é o véu com um buraco vazio no canto.
  const visible = scrolledIn || revealed;
  const lastY = useRef(0);

  /**
   * As duas portas que custam moeda ficam FECHADAS quando o saldo acabou, e o
   * toque nelas abre a explicação em vez da tela.
   *
   * Antes elas navegavam: a pessoa chegava ao gravador, deixava o microfone
   * aberto durante a pregação e descobria no fim que não havia saldo para
   * transcrever. A parede existia, só estava no lugar errado — depois do
   * trabalho, em vez de antes dele.
   *
   * `balance === null` é "ainda não sei" e passa direto, nunca bloqueia: o
   * chip do saldo é semeado pelo layout (ver `CoinsSync`), mas um carregamento
   * lento não pode transformar uma conta paga numa parede. Só o ZERO lido
   * fecha a porta, que é o mesmo princípio do `requireBalance` do servidor.
   *
   * **A terceira porta nunca fecha.** Escrever à mão não custa moeda nenhuma e
   * não vai custar — é essa a promessa que o `AiPaywallDialog` repete do outro
   * lado do toque.
   */
  const balance = useCoinsStore((s) => s.balance);
  const broke = balance === 0;
  const [paywall, setPaywall] = useState<string | null>(null);

  useEffect(() => {
    lastY.current = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (Math.abs(dy) < 8) return;
      lastY.current = y;
      setTapped(false);
      const next = y < 80 ? true : dy < 0;
      setScrolledIn((prev) => {
        if (prev !== next) setMoved(true);
        return next;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Esc fecha, como qualquer coisa que abre por cima da tela. O listener só
  // existe enquanto o painel está aberto: um `keydown` global permanente para
  // um estado que quase sempre é `false` é escuta paga à toa.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setTapped(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* Tocar fora fecha, e é só isso: o apanhador é TRANSPARENTE, não um véu.
          Escurecer a tela atrás de um painel de três atalhos trata como modal o
          que é um menu — a Biblioteca continua legível, e ela não está sendo
          bloqueada, está sendo deixada de lado por um segundo.

          Ele é um `button`, e não uma `div` com `onClick`: tocar fora para
          fechar é uma AÇÃO, e como botão ela existe também para quem navega
          por teclado e para quem usa leitor de tela. Fica ABAIXO da faixa no
          empilhamento, senão cobriria o botão que o fecha. */}
      {open ? (
        <button
          type="button"
          aria-label="Fechar as opções de criação"
          onClick={() => setTapped(false)}
          className="fixed inset-0 z-20 cursor-default md:hidden"
        />
      ) : null}
      {/* `pointer-events-none` na faixa inteira: ela cobre o fim da lista, e um
          gradiente que engole o toque destinado ao último cartão seria um bug
          invisível. Só o botão e o painel recebem de volta o que ela abre mão.

          A coluna é a MESMA da lista (ver `home/page.tsx`), e é por isso que
          o número acompanhou quando ela foi a 1024: colado na borda direita da
          janela, o botão ficaria longe dos post-its numa tela larga, sem nada
          por perto a que ele pertencesse. A faixa nunca passa de `md`, então na
          prática o teto só chega a valer entre a lista já larga e o dock ainda
          presente — mas dois tetos diferentes ali desalinhariam os dois. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-[image:var(--v2-dock-fade)] pt-32 pb-[calc(1.75rem+env(safe-area-inset-bottom))] md:hidden">
        {/* O painel abre AO LADO do botão, na mesma linha, com os dois
            alinhados por baixo — é o desenho do print. Em cima do botão ele
            cobriria o próprio dedo que o abriu, e é por baixo que o polegar
            chega à barra.

            Em 360px, a largura confortável: 328 de útil contra 258 de painel
            (3 × 70 de opção, `gap-3`, `p-3`) + 12 de respiro + 48 de botão =
            318.

            **Abaixo de 350px a linha vira COLUNA** e o painel passa a abrir em
            CIMA do botão (`max-[349px]:flex-col`). Lado a lado ali não é
            apertado, é impossível: não há 318px para dar, e a única saída da
            linha seria comer o painel pela esquerda. Em cima ele cabe inteiro
            com folga — 258 de painel para 288 de útil —, e o preço é o painel
            ficar sob o dedo que o abriu, que é bem menos que uma opção cortada
            pela borda da tela.

            **Entre 350 e 360, quem cede é o PAINEL**, e é por isso que ele leva
            `min-w-0` e o botão leva `shrink-0`. Sem os dois era o BOTÃO que
            cedia, e virava uma elipse: um item de flex nasce com
            `min-width: auto`, então o painel se recusava a encolher abaixo do
            conteúdo dele e toda a compressão sobrava para o vizinho — que por
            acaso é o único elemento da tela cuja FORMA é parte do que ele diz.
            Um painel 8px mais apertado ninguém vê; um círculo amassado é a
            primeira coisa que se vê. */}
        <div className="mx-auto flex w-full max-w-[1024px] items-end justify-end gap-3 px-5 max-[349px]:flex-col">
          {open ? (
            <nav
              // `<nav>` com nome, e não `role="menu"`: ARIA menu promete
              // navegação por setas, e quem o anuncia sem implementar as setas
              // entrega ao leitor de tela um menu que não responde como menu.
              // São três LINKS para três telas — é navegação, e é assim que o
              // leitor anuncia ("Criar resumo, navegação").
              //
              // O nome vem do TÍTULO que está na tela (`aria-labelledby`), e não
              // de um `aria-label` escrito à parte: com os dois, a mesma frase
              // existiria duas vezes, e a que o leitor anuncia poderia divergir
              // da que se lê sem ninguém perceber.
              id="create-dock-options"
              aria-labelledby="create-dock-title"
              className="pointer-events-auto flex min-w-0 origin-bottom-right animate-v2-rec-in flex-col gap-2 rounded-[28px] bg-v2-glass-panel bg-[image:var(--v2-glass-sheen)] px-3 pt-3 pb-5 ring-1 ring-v2-glass-edge backdrop-blur-xl"
            >
              {/* O título diz o que as três opções têm EM COMUM, e dá nome ao
                  painel para quem usa leitor de tela.

                  Em `--v2-ink-mute` e no mesmo corpo dos rótulos: ele é uma
                  placa, não uma opção, e mais escuro que os nomes é o que o
                  mantém atrás deles na ordem de leitura. O `px-1` o alinha com o
                  primeiro ícone, que tem 48px de caixa para 20 de glifo. */}
              <p
                id="create-dock-title"
                className="pl-2 text-[11px] pt-2 pb-3 leading-none font-medium text-v2-ink-mute"
              >
                Criar resumo:
              </p>
              {/* A ordem na tela é da DIREITA para a esquerda: gravar encosta
                  no botão, depois escrever, depois importar. O
                  painel cresce para a esquerda a partir do `+`, então o que
                  está mais perto dele é o que o dedo alcança primeiro — e o que
                  mais se faz é gravar.

                  A ordem do DOM é essa mesma, invertida, e não um
                  `flex-row-reverse`: com a linha invertida no CSS, o TAB andaria
                  ao contrário do que o olho lê, que é o tipo de descompasso que
                  só quem navega por teclado sente. */}
              <div className="flex gap-3">
                <CreateOption
                  href="/importar"
                  icon={<YoutubeIcon className="size-5" />}
                  label="Importar do YouTube"
                  tourId="create-import"
                  onNavigate={() => setTapped(false)}
                  onBlocked={broke ? () => setPaywall("importar um vídeo") : undefined}
                />
                {/* Escrever não custa moeda nenhuma — não há STT nem chamada de
                  modelo em lugar nenhum dele —, e por isso não leva pastilha de
                  preço que os outros dois levariam. Ver `lib/domain/session.ts`. */}
                <CreateOption
                  href="/escrever"
                  icon={<PenLine className="size-5" strokeWidth={1.5} />}
                  label="Escrever resumo"
                  tourId="create-write"
                  onNavigate={() => setTapped(false)}
                />
                {/* A ÚNICA das três com cor (`--v2-accent`), e ela ANDA: o
                  vermelho do produto viajando até um vinho fundo e de volta, 6s
                  por volta (ver `--v2-accent-sheen`). O vermelho é o mesmo do
                  microfone e do ponto que pisca durante a pregação, e aqui ele
                  diz a verdade — esta é justamente a porta que grava; o que o
                  movimento acrescenta é que dali sai um resumo pronto, sem
                  pedir um adjetivo na tela. E a cor continua sendo o que faz o
                  olho cair na opção mais usada sem ler os três nomes. */}
                <CreateOption
                  href="/recording?auto=1"
                  icon={<MicGlyph className="size-5" />}
                  label="Resumo automático"
                  accent
                  tourId="create-record"
                  onNavigate={() => setTapped(false)}
                  onBlocked={
                    broke ? () => setPaywall("gravar e receber o resumo pronto") : undefined
                  }
                />
              </div>
            </nav>
          ) : null}
          <button
            type="button"
            onClick={() => setTapped((prev) => !prev)}
            aria-label={open ? "Fechar as opções de criação" : "Criar"}
            aria-expanded={open}
            aria-controls="create-dock-options"
            data-tour="create-dock"
            // Escondido ele também sai do alcance do dedo e do TAB: um botão
            // invisível que ainda recebe toque é pior que um botão visível.
            tabIndex={visible ? undefined : -1}
            aria-hidden={visible ? undefined : true}
            className={cn(
              // 56px, e não os 48 de antes. Ele é o único alvo flutuante da
              // tela e o mais tocado do app; 48 é o MÍNIMO de um alvo de dedo,
              // não o tamanho de um botão que a tela inteira existe para
              // oferecer.
              //
              // Os 8px a mais saem do PAINEL, não do botão, e é para isso que
              // o `min-w-0` de lá e o `shrink-0` daqui existem: em 360px a
              // linha pede 326 (258 de painel + 12 + 56) para 320 de útil com
              // o `px-5`, então o painel cede os 6 que faltam. Seis pixels num
              // painel de 258 ninguém vê; um círculo amassado é a primeira
              // coisa que se vê. Abaixo de 350 a linha já vira coluna e a
              // conta deixa de existir.
              "inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] text-v2-ink ring-1 ring-v2-glass-edge backdrop-blur-xl transition hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute",
              visible ? "pointer-events-auto" : "pointer-events-none",
              moved && (visible ? "animate-v2-rec-in" : "animate-v2-rec-out")
            )}
          >
            {/* Um `+` girado 45° É um `×`. Trocar de glifo faria o fechar
                aparecer do nada no lugar do abrir; girando, o mesmo objeto diz
                que o que ele abriu ele fecha. */}
            <Plus
              aria-hidden
              strokeWidth={1.5}
              className={cn("size-6 transition-transform duration-200", open && "rotate-45")}
            />
          </button>
        </div>
      </div>

      <AiPaywallDialog
        open={paywall !== null}
        onOpenChange={(next) => {
          if (!next) setPaywall(null);
        }}
        action={paywall ?? ""}
      />
    </>
  );
}

/**
 * Uma porta de criação: ícone num quadrado e o nome embaixo, como nos prints
 * em `public/prints/new-release/`.
 *
 * **O nome diz o RESULTADO: "Resumo automático", "Escrever resumo", "Importar
 * do YouTube".** Ele já foi um verbo só — Gravar, Escrever, Importar —, que
 * cabia numa linha e deixava a diferença na primeira sílaba, mas dizia o gesto
 * em vez do que sai dele.
 *
 * A largura é FIXA em 70px, e é ela que garante três alvos do MESMO tamanho:
 * ao conteúdo, os nomes têm comprimentos diferentes, e três alvos de larguras
 * diferentes lado a lado não leem como três opções da mesma lista. É o
 * `break-words` com o `leading-tight` que faz os nomes caberem ali — os três
 * quebram em duas linhas, que é o que mantém a fileira com uma altura só.
 *
 * O toque se anuncia CLAREANDO o quadrado do ícone (`brightness`), e não
 * pintando o fundo do alvo: o quadrado é `--v2-card-hover`, a mesma cor que um
 * fundo de hover teria, e os dois juntos apagariam o quadrado exatamente no
 * momento em que o dedo está em cima dele.
 *
 * **`accent` pinta o quadrado com o `--v2-accent`, e a COR é o único destaque
 * que ele tem.** Uma das três portas é a que quase todo mundo quer, e num
 * painel de três quadrados iguais ela só se acha lendo os nomes. O gradiente
 * ANDA (`animate-accent-sheen`, as mesmas keyframes dos cartões que o Scriba
 * escreve, na metade do tempo): é o que diz, sem adjetivo, que o resumo dali
 * sai pronto.
 *
 * **E ele leva o selo "IA" no canto**, amarelo, pendurado na borda de cima
 * do quadrado. O canto já teve um enfeite duas vezes — um sparkles solto, e
 * antes dele um hexágono — e as duas saíram pela mesma razão: num quadrado de
 * 48px que JÁ é o único colorido da fileira, um segundo OBJETO não acrescenta
 * destaque, só divide o olhar entre duas coisas pequenas.
 *
 * O selo é outra coisa, e é por isso que ele fica: aquilo era enfeite, e isto é
 * uma PALAVRA. A cor diz "esta é a porta principal", e nenhuma cor diz "o
 * resumo sai pronto, escrito pela máquina" — era o que o "mágico" do nome
 * antigo tentava dizer, e o que o rótulo "Resumo automático" diz pela metade
 * ("automático" também descreve um formulário que se preenche sozinho). O
 * glifo aqui é apoio de um texto, não o acento.
 */
function CreateOption({
  href,
  icon,
  label,
  accent = false,
  tourId,
  onNavigate,
  onBlocked,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
  /**
   * O mesmo nome que o chip gêmeo da barra do topo carrega
   * (`(app)/components/CreateActions.tsx`). Um dos dois está sempre em
   * `display: none`, e o tour fica com o visível — é o que faz os passos das
   * três portas servirem ao celular e ao desktop sem um `if` de largura.
   */
  tourId?: string;
  onNavigate: () => void;
  /**
   * A porta está fechada: em vez de navegar, ela explica por quê.
   *
   * `undefined` é o caso normal, e é o que mantém a porta um LINK de verdade —
   * com adiantamento de rota, abertura em nova aba e tudo o mais que um `<a>`
   * dá de graça. Só quando o saldo acabou é que o toque vira uma conversa; ver
   * `AiPaywallDialog`.
   */
  onBlocked?: () => void;
}) {
  return (
    <NavLink
      href={href}
      data-tour={tourId}
      onClick={(event) => {
        if (onBlocked) {
          event.preventDefault();
          onBlocked();
        }
        onNavigate();
      }}
      spinner="none"
      contentClassName="flex flex-col items-center gap-2"
      className="group flex w-[70px] min-w-0 flex-col rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
    >
      {/* Glifo de 20 num quadrado de 48: o ícone é o que a opção MOSTRA, mas o
          alvo é o quadrado inteiro, e um glifo que encosta nas bordas dele
          transforma a peça de vidro num botão de ícone apertado. */}
      <span
        className={cn(
          // `relative` por causa do selo "IA", que pousa na borda de cima.
          "relative flex size-12 items-center justify-center rounded-2xl transition",
          accent
            ? // O `bg-v2-accent` fica debaixo do gradiente e não é decoração:
              // uma cor de fundo sempre pinta, uma IMAGEM de fundo pode não
              // chegar (impressão sem cor de fundo, `forced-colors`), e sem ela
              // o quadrado seria transparente com um glifo branco em cima.
              //
              // O `bg-[size:200%_100%]` com o `animate-accent-sheen` é o MESMO
              // mecanismo dos cartões que o Scriba escreve (a ideia central, a
              // conclusão), com as MESMAS keyframes: a cor anda dentro do
              // quadrado e é isso que dá a ele cara de coisa viva em vez de
              // adesivo colado no painel. O que muda é a duração, 6s contra os
              // 12s de lá — num cartão de meia tela 12s é uma maré que se
              // percebe pelo canto do olho, num quadrado de 48px é uma peça
              // parada. Só `background-position`, sem filtro, sem custo por
              // quadro.
              //
              // O hover é `brightness`, e não a troca para outro token: com
              // gradiente por cima, mudar a cor de fundo não muda nada do que
              // se vê. O filtro clareia as pontas de uma vez e preserva a queda
              // de luz, que é o ponto dela.
              "animate-accent-sheen bg-v2-accent bg-[image:var(--v2-accent-sheen)] bg-[size:200%_100%] text-v2-accent-ink group-hover:brightness-110"
            : "bg-v2-glass-tile text-v2-ink group-hover:bg-v2-glass-edge"
        )}
      >
        {icon}
        {/* O SELO "IA", no canto de cima à direita do quadrado.
            **Duas letras, e não "com IA".** O selo mede ~34px contra os 48 do
            quadrado, então ele pousa no CANTO; com a preposição ia a 51px,
            quase a largura inteira, e um selo tão largo quanto o objeto deixa
            de ser selo e vira faixa atravessada no topo. O que a palavra a mais
            acrescentava era gramática, não informação.
            Ele cresce para a ESQUERDA a partir da borda direita (`-right-2`,
            sem `left`), e o avanço de 8px para fora do quadrado é o que faz o
            selo morder a quina em vez de ficar contido dentro dela. Os 8px são
            o teto útil, não um número redondo: a coluna da opção tem 70px para
            um quadrado de 48, então sobram 11px de cada lado, e depois deles
            vêm os 12 do `px-3` do painel — passar disso põe o selo por cima da
            borda arredondada, que não recorta nada.
            `aria-hidden` porque a porta já se chama "Resumo automático", e
            dentro do link o texto do selo viraria o COMEÇO do nome acessível
            dela ("IA Resumo automático"). Para o olho ele acrescenta; para o
            leitor de tela, o nome inteiro já estava dito.
            Amarelo da MOEDA (`--scriba-yellow` com `--scriba-yellow-ink`) e não
            uma cor nova: é o único amarelo do produto, e o selo fica no mesmo
            lugar da escala em que ficam as pastilhas de preço. A cor CHAPADA
            fica debaixo do `--scriba-yellow-sheen` pela razão de sempre: uma
            cor de fundo sempre pinta, uma imagem de fundo pode não chegar.
            A queda de luz dele é ESTÁTICA, e é a única coisa nesta peça que não
            se mexe: o quadrado embaixo já anda (`animate-accent-sheen`), e dois
            gradientes animados encaixados um no outro num objeto de 48px é
            movimento demais para o canto de uma tela de lista. O ângulo é o do
            vidro do painel, 160°. */}
        {accent ? (
          <span
            aria-hidden
            className="-top-2 -right-2 absolute inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-scriba-yellow bg-[image:var(--scriba-yellow-sheen)] px-1.5 py-[3px] font-semibold text-[9px] text-scriba-yellow-ink leading-none"
          >
            <Sparkles className="size-2.5" strokeWidth={2.5} />
            IA
          </span>
        ) : null}
      </span>
      <span className="w-full break-words text-center text-[11px] leading-tight font-medium text-v2-ink-soft">
        {label}
      </span>
    </NavLink>
  );
}
