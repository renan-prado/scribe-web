import type { Metadata } from "next";
import Link from "next/link";
import { formatBrl, formatCoins, PLANS } from "@/lib/billing/plans";
import { INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import {
  COMMISSION_HOLD_DAYS,
  commissionCents,
  DEFAULT_COMMISSION_BPS,
  DEFAULT_PARTNER_MONTHLY_COINS,
  DEFAULT_PARTNER_SIGNUP_REWARD_COINS,
  DEFAULT_SIGNUP_BONUS_COINS,
  PARTNER_PROSPECT_COINS,
  PAYOUT_MINIMUM_CENTS,
  PAYOUT_SCHEDULE_LABEL,
} from "@/lib/partners/economics";
import { REF_COOKIE_MAX_AGE } from "@/lib/referrals/cookies";
import { cn } from "@/lib/utils";
import { ScribaMark } from "@/shared/brand";
import { LandingFooter, LandingHeader, SectionLabel } from "@/shared/components/LandingChrome";
import { BookGlyph } from "@/shared/icons/BookGlyph";
import { CoinMark } from "@/shared/icons/CoinMark";

export const metadata: Metadata = {
  title: "Programa de Parceiros · Scriba",
  description:
    "Divulgue o Scriba para quem já te acompanha e receba 30% da primeira mensalidade de cada assinante. Link próprio, painel de resultados e moedas para usar o app.",
  alternates: { canonical: "/parceiros" },
};

/**
 * A página de convite do Programa de Parceiros.
 *
 * É a LP da landing page vista de outro lado: mesma linguagem visual, mesmo
 * chrome, outra pergunta. A `/` responde "por que eu usaria isso?"; esta
 * responde "por que eu FALARIA disso?", e a segunda só se responde depois da
 * primeira, por isso a página explica o produto antes de falar em dinheiro.
 *
 * **Estática, pelas mesmas razões da `/`** (ver `app/AGENTS.md` § Landing
 * page): nada aqui lê cookie, sessão ou header, e nenhum componente
 * `"use client"` é importado. Ela é servida da CDN para um visitante que, por
 * definição, ainda não tem conta.
 *
 * **E ela não tem números próprios.** Percentual, carência, mínimo de saque,
 * moedas e preços saem de `lib/partners/economics.ts`, `lib/billing/plans.ts`
 * e `lib/coins/pricing.ts`, os mesmos módulos que o painel do parceiro e o
 * simulador do admin leem. Um número redigitado aqui vira, semanas depois,
 * uma promessa que o painel desmente para a pessoa que confiou nela. A regra
 * inclui os MINUTOS: "500 moedas dão ~100 min" era verdade quando o minuto ao
 * vivo custava 5, e virou mentira em silêncio quando passou a custar 7.
 *
 * O regulamento detalhado é `/parceiros/regulamento`, e ele é a versão que
 * vale: esta página resume, aquela obriga.
 */

/**
 * O CTA não vai direto para `/sign-in`: passa por `/parceiros/entrar`, que
 * marca o visitante como pré-parceiro num cookie e só então redireciona. É o
 * mesmo desenho de `/r/<slug>`, e pela mesma razão, esta página é estática e
 * não pode escrever cookie sem deixar de ser. Sem esse desvio, a tela de
 * entrada não teria como saber que a pessoa veio daqui, e as moedas de
 * cortesia nunca seriam creditadas.
 */
const PROSPECT_ENTRY = "/parceiros/entrar";

/** Janela de atribuição do link, em dias. Vem do cookie, não de um literal. */
const ATTRIBUTION_DAYS = REF_COOKIE_MAX_AGE / (24 * 60 * 60);

/** Total creditado a quem se cadastra pelo link: boas-vindas + bônus. */
const REFERRED_TOTAL_COINS = INITIAL_COIN_BALANCE + DEFAULT_SIGNUP_BONUS_COINS;

const COMMISSION_PCT = DEFAULT_COMMISSION_BPS / 100;

export default function PartnersLandingPage() {
  return (
    <div className="w-full overflow-x-clip bg-background text-scriba-ink-strong antialiased">
      <LandingHeader />
      <main>
        <Hero />
        <TryFirst />
        {/* O NÚMERO antes da REGRA. "Quanto isso dá" mostra o resultado em três
            tamanhos de audiência; "A remuneração" explica a fórmula que produz
            aquele resultado e detalha o pagamento. Na ordem inversa, a pessoa
            tinha de guardar a fórmula na cabeça até chegar num valor, e a
            página pedia esforço antes de dar motivo. */}
        <Simulation />
        <Panel />
        <Rules />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}

/* ---------- Hero ---------- */

/**
 * Mesma composição do hero da `/`: coluna única, tudo no eixo, UM destino.
 *
 * Ele era duas colunas, texto à esquerda e o cartão do convite à direita, e
 * tinha dois botões. O segundo mandava para o regulamento, ou seja, oferecia a
 * letra miúda a quem ainda não entendeu a oferta, e disputava o eixo com o CTA.
 * Virou link de texto depois do cartão, que é onde alguém realmente quer
 * conferir as regras. O cartão desceu para logo abaixo, inteiro, e ficou mais
 * legível do que espremido em 400px.
 */
function Hero() {
  return (
    <section className="relative mt-[calc(var(--lp-header-h)*-1)] overflow-hidden bg-[image:var(--lp-hero)]">
      {/* Os halos acompanharam a composição, como na `/`: o dourado desce pelo
          centro, o azul fica atrás do cartão. */}
      <div className="pointer-events-none absolute -top-[260px] left-1/2 h-[720px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(248,198,75,.16)_0%,rgba(248,198,75,0)_70%)]" />
      <div className="pointer-events-none absolute -bottom-[200px] left-1/2 hidden h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(79,168,240,.16)_0%,rgba(79,168,240,0)_70%)] lg:block" />
      <div className="relative mx-auto flex max-w-[780px] flex-col items-center gap-4 px-5 pb-12 text-center pt-[calc(var(--lp-header-h)+2.25rem)] sm:px-10 lg:gap-6 lg:pb-16 lg:pt-[calc(var(--lp-header-h)+5rem)]">
        <h1 className="text-balance text-[29px] font-normal leading-[1.18] tracking-[-.02em] text-scriba-ink-strong sm:text-[40px] sm:leading-[1.14] sm:tracking-[-.025em] lg:text-[52px] lg:leading-[1.1]">
          Indique o Scriba para quem já te ouve e receba renda extra!
        </h1>
        {/* Mesma medida do hero da `/`: no celular a largura é MENOR que o vão
            e o texto é balanceado, senão as linhas fecham a poucos pixels da
            borda e o bloco parece espremido mesmo estando centrado. */}
        <p className="max-w-[320px] text-balance text-[14.5px] font-light leading-[1.62] text-scriba-ink-soft sm:max-w-[560px] sm:text-pretty lg:text-[17px]">
          Você já fala com o público cristão. Indique nosso app e receba{" "}
          <span className="font-medium text-scriba-ink">
            {COMMISSION_PCT.toLocaleString("pt-BR")}% da primeira mensalidade
          </span>{" "}
          de cada pessoa que assinar algum plano pelo seu link.
        </p>
        <div className="flex w-full flex-col pt-5 sm:w-auto lg:pt-7">
          <Link
            href={PROSPECT_ENTRY}
            className="scriba-cta inline-flex items-center justify-center gap-2.5 rounded-[26px] bg-[image:var(--scriba-cta)] py-[17px] px-8 text-[13px] font-semibold uppercase tracking-[.04em] text-scriba-cta-ink shadow-[0_9px_22px_var(--scriba-cta-shadow)]"
          >
            <ScribaMark size={20} />
            Conhecer sem compromisso
          </Link>
        </div>
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1.5 text-[12.5px] font-light text-scriba-ink-mute sm:pt-3">
          {["Sem compromisso", "Sem exclusividade", "Sem meta mínima"].map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <Check className="text-scriba-green" />
              {item}
            </li>
          ))}
        </ul>
        <div className="w-full pt-4 text-left sm:pt-6">
          <InviteCard />
        </div>
        <Link
          href="/parceiros/regulamento"
          className="text-[13px] font-medium text-scriba-ink-soft underline underline-offset-4"
        >
          Ler as regras completas
        </Link>
      </div>
    </section>
  );
}

/**
 * O cartão do convite. Ele existe para responder, sem rolagem, a pergunta que
 * traz alguém a esta página: "o que eu ganho com isso?".
 *
 * **A resposta é dinheiro, e a hierarquia do cartão diz isso.** O programa paga
 * em duas moedas, reais e créditos do app, e por um tempo as duas ocuparam
 * linhas iguais na lista, o que sugeria que metade do trato é crédito de uso.
 * Não é. As moedas viraram um rodapé em corpo menor: elas continuam ali porque
 * são o que chega ANTES da primeira assinatura, e é só isso que elas são.
 */
function InviteCard() {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-[26px] border border-scriba-hairline bg-scriba-paper p-6 shadow-[0_16px_40px_rgba(0,0,0,.12)] sm:p-8">
      <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-scriba-ink-mute">
        O que o programa inclui
      </div>
      <ul className="flex flex-col divide-y divide-scriba-hairline">
        <InviteRow
          title={`${COMMISSION_PCT.toLocaleString("pt-BR")}% da primeira mensalidade`}
          body={`${formatBrl(commissionCents(PLANS.pessoal.priceCents, DEFAULT_COMMISSION_BPS))} pelo plano ${PLANS.pessoal.name} e ${formatBrl(commissionCents(PLANS.estudioso.priceCents, DEFAULT_COMMISSION_BPS))} pelo plano ${PLANS.estudioso.name}.`}
        />
        {/* Quando e quanto, no cartão que responde "o que eu ganho".
            As duas regras que decidem a hora de receber estavam só no FAQ, e
            uma pessoa que lê a página inteira e não rola até lá sai achando que
            o pagamento é imediato e sem piso. As duas frustram na mesma hora, a
            primeira vez que alguém assina e o dinheiro não aparece, então elas
            vêm antes, não depois. */}
        <InviteRow
          title={`Pagamento por PIX ${PAYOUT_SCHEDULE_LABEL}`}
          body={`Sobre o que estiver disponível naquela data. Cada comissão espera ${COMMISSION_HOLD_DAYS} dias de carência antes de entrar no disponível, o prazo em que a cobrança ainda pode ser contestada no cartão.`}
        />
        <InviteRow
          title={`Mínimo de ${formatBrl(PAYOUT_MINIMUM_CENTS)} para o PIX sair`}
          body="Abaixo disso o saldo espera o mês seguinte, acumula e nunca expira. Se você sair do programa, ele é pago integralmente mesmo abaixo do mínimo."
        />
        <InviteRow
          title="Um painel só seu"
          body="Saiba quantas pessoas abriram seu link, quantas criaram conta, quantas assinaram e quanto você tem a receber."
        />
      </ul>
      {/* As moedas eram duas linhas da lista, com o mesmo peso da comissão, e
          davam a impressão de que metade do programa é crédito de uso. Não é:
          o que faz alguém divulgar é o dinheiro, e as moedas são o consolo de
          quem ainda não teve a primeira assinatura. Viraram um rodapé, que é
          exatamente a importância que elas têm. */}
      <p className="flex items-start gap-2.5 border-t border-scriba-hairline pt-4 text-[12px] font-light leading-[1.55] text-scriba-ink-mute">
        <CoinMark size={16} className="mt-px flex-none" />
        <span>
          De bônus: {formatCoins(DEFAULT_PARTNER_MONTHLY_COINS)} moedas por mês enquanto você
          estiver no programa e mais {formatCoins(DEFAULT_PARTNER_SIGNUP_REWARD_COINS)} moedas a
          cada cadastro pelo seu link para usar no Scriba. .
        </span>
      </p>
    </div>
  );
}

function InviteRow({ title, body, coin }: { title: string; body: string; coin?: boolean }) {
  return (
    <li className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
      {coin ? (
        <CoinMark size={20} className="mt-0.5 flex-none" />
      ) : (
        <span
          aria-hidden
          className="mt-0.5 flex size-5 flex-none items-center justify-center rounded-full bg-scriba-blue-soft"
        >
          <Check className="text-scriba-blue-ink" />
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13.5px] font-semibold leading-[1.35] text-scriba-ink-strong">
          {title}
        </span>
        <span className="text-pretty text-[12.5px] font-light leading-[1.55] text-scriba-ink-soft">
          {body}
        </span>
      </div>
    </li>
  );
}

/* ---------- Conheça antes de decidir ---------- */

/**
 * As moedas de cortesia, e a razão de elas virem ANTES do dinheiro na página.
 *
 * Ninguém recomenda de verdade um app que não usa, e pedir que alguém divulgue
 * primeiro e experimente depois inverte a ordem em que a confiança se forma.
 * A mesada existe no código por essa razão (`lib/partners/allowance.ts`), e a
 * página coloca a mesma razão na frente do percentual.
 */
function TryFirst() {
  return (
    <section id="conhecer" className="border-y border-scriba-hairline-soft bg-scriba-surface">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 sm:px-10 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="flex flex-col gap-4">
          <SectionLabel color="blue">Conheça o app</SectionLabel>
          <h2 className="text-pretty text-[27px] font-semibold leading-[1.18] tracking-[-.02em] text-scriba-ink-strong lg:text-[38px]">
            Primeiro você nos conhece.
          </h2>
          <p className="max-w-[520px] text-pretty text-[14.5px] font-light leading-[1.65] text-scriba-ink-soft lg:text-[16px]">
            Ninguém consegue falar bem de um app que nunca abriu. Por isso, primeiramente vamos te
            presentear com {formatCoins(PARTNER_PROSPECT_COINS)} moedas para você conhecer nosso
            produto.
          </p>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-3 rounded-[26px] border border-scriba-hairline bg-scriba-cream p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <CoinMark size={30} className="flex-none" />
              <div className="flex flex-col">
                <span className="text-[30px] font-semibold leading-none tracking-[-.02em] text-scriba-cream-ink sm:text-[34px]">
                  {formatCoins(PARTNER_PROSPECT_COINS)}
                </span>
                <span className="text-[12px] font-medium text-scriba-cream-accent">
                  moedas de presente ao criar sua conta hoje
                </span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniCard
              title="Receba antes de entrar no programa"
              body={`As ${formatCoins(PARTNER_PROSPECT_COINS)} moedas entram no saldo assim que a conta é criada.`}
            />
            <MiniCard
              title="E caso você entre no programa"
              body={`Você passa a receber ${formatCoins(DEFAULT_PARTNER_MONTHLY_COINS)} moedas por mês, renovadas.`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[20px] border border-scriba-hairline bg-scriba-paper p-5">
      <span className="text-[13px] font-semibold text-scriba-ink-strong">{title}</span>
      <span className="text-pretty text-[12.5px] pt-2 font-light leading-[1.55] text-scriba-ink-soft">
        {body}
      </span>
    </div>
  );
}

/* ---------- Quanto isso dá, na prática ---------- */

/**
 * A comissão de cada plano, em centavos. Sai de `commissionCents` sobre o
 * preço de `plans.ts`, nunca de um número escrito aqui.
 */
const COMMISSION_PESSOAL = commissionCents(PLANS.pessoal.priceCents, DEFAULT_COMMISSION_BPS);
const COMMISSION_ESTUDIOSO = commissionCents(PLANS.estudioso.priceCents, DEFAULT_COMMISSION_BPS);

/**
 * A mistura de planos suposta pela média abaixo: 80% no {PLANS.pessoal.name},
 * 20% no {PLANS.estudioso.name}.
 *
 * Era 50/50, o que é o palpite de quem não tem palpite, e 50/50 inflava a
 * média: supunha que metade de um público que ACABOU de conhecer o produto
 * assinaria direto o plano mais caro. Quem chega pelo link de um parceiro está
 * conhecendo o Scriba, e quem está conhecendo entra pelo mais barato. Errar
 * para cima aqui é o pior dos dois erros: a página existe para convencer
 * alguém a divulgar, e uma média otimista vira decepção no primeiro PIX.
 *
 * **Continua sendo hipótese, não medição**, e é por isso que ela mora aqui em
 * cima com nome próprio: no dia em que houver distribuição real, é esta linha
 * que muda e os três cartões acompanham sozinhos.
 */
const PESSOAL_SHARE = 0.8;

/**
 * Quanto vale, em média, uma pessoa que assina pelo link.
 *
 * Os cartões já mostraram uma FAIXA, "de R$ X a R$ Y", que era mais exata e
 * mais difícil de ler: obrigava a comparar seis números para entender três
 * cenários. Uma média com a hipótese declarada no rodapé informa melhor.
 */
const AVERAGE_COMMISSION_CENTS = Math.round(
  COMMISSION_PESSOAL * PESSOAL_SHARE + COMMISSION_ESTUDIOSO * (1 - PESSOAL_SHARE)
);

/**
 * Três cenários, contados em ASSINANTES, não em cadastros.
 *
 * A primeira versão partia de quanta gente criava conta e aplicava uma taxa de
 * conversão para chegar nos assinantes. Eram dois números inventados empilhados
 * (alcance e conversão) para produzir um terceiro, e o leitor tinha de aceitar
 * os dois antes de chegar ao dinheiro. Contar direto em assinantes tem uma
 * hipótese a menos e é a unidade que o parceiro entende: pessoas que assinaram
 * pelo link dele.
 */
const SCENARIOS: { subscribers: number; detail: string }[] = [
  { subscribers: 10, detail: "indicados por você" },
  { subscribers: 25, detail: "indicados por você" },
  { subscribers: 100, detail: "indicados por você" },
];

/**
 * A seção que responde "quanto isso dá, para mim?".
 *
 * A página inteira sabia dizer a REGRA, 30% da primeira mensalidade, e a regra
 * sozinha não faz ninguém querer entrar: ela obriga o leitor a fazer a conta,
 * e quase ninguém faz. Aqui a conta já está feita, em três números de
 * assinantes, com a mesma aritmética do painel.
 *
 * **Um valor por cartão, e a hipótese no rodapé.** A comissão depende do plano
 * que cada pessoa assina, e o parceiro não escolhe por ela. Isso já apareceu
 * como faixa ("de R$ X a R$ Y"), o que era exato e ilegível; hoje é a média de
 * `AVERAGE_COMMISSION_CENTS`, com a hipótese dita em letras no rodapé. Média
 * sem hipótese declarada seria invenção; faixa era exatidão que ninguém lia.
 *
 * **E o dinheiro aqui é de UMA VEZ por pessoa**, não por mês. A comissão não
 * recorre (ver `RULES`), e uma tabela que sugerisse renda mensal recorrente
 * seria a promessa mais fácil de fazer e a mais cara de desfazer. O rodapé diz
 * isso com todas as letras, e é por isso que ele não pode sair daqui.
 */
/**
 * Aqui não se fala em moedas, e isso é regra da seção, não esquecimento.
 *
 * Esta é a única parte da página que responde "quanto eu ganho", e a resposta
 * é em reais. As moedas de bônus já apareceram ao lado de cada valor e
 * diluíam exatamente o que a seção existe para deixar nítido: um cartão que
 * diz "R$ 747,00 + 2.000 moedas" faz o leitor somar duas grandezas que não se
 * somam, e a menor delas rouba atenção da maior. Elas seguem ditas uma vez, no
 * rodapé do cartão do convite, que é a importância que têm.
 */
function Simulation() {
  return (
    <section id="quanto-da" className="border-y border-scriba-hairline-soft bg-scriba-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-7 px-5 py-12 sm:px-10 sm:py-[88px] lg:gap-12">
        <div className="flex max-w-[680px] flex-col gap-3">
          <SectionLabel color="blue">Na prática</SectionLabel>
          <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[42px]">
            Quanto posso receber com o Scriba?
          </h2>
          <p className="text-pretty text-[14px] font-light leading-[1.62] text-scriba-ink-soft lg:text-[15.5px]">
            Cada pessoa que assina pelo seu link pode te render, em média,{" "}
            <strong className="font-semibold text-scriba-ink-strong">
              {formatBrl(AVERAGE_COMMISSION_CENTS)}
            </strong>
            . Abaixo você encontra uma simulação do quanto você poderia receber.
          </p>
        </div>

        <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-[22px]">
          {SCENARIOS.map((sc, i) => {
            const total = sc.subscribers * AVERAGE_COMMISSION_CENTS;
            // O maior cenário é o único destacado: três cartões igualmente
            // fortes não hierarquizam nada, e é o teto que responde à pergunta
            // "vale a pena?".
            const strong = i === SCENARIOS.length - 1;
            return (
              <div
                key={sc.subscribers}
                className={cn(
                  "flex flex-col gap-4 rounded-[24px] bg-scriba-paper p-6 sm:rounded-[26px] sm:p-8",
                  strong
                    ? "border-[1.5px] border-scriba-blue shadow-[0_16px_40px_rgba(0,0,0,.16)]"
                    : "border border-scriba-hairline"
                )}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-scriba-blue-ink">
                    {sc.subscribers} assinantes
                  </span>
                  <span className="text-pretty text-[12.5px] font-light leading-[1.5] text-scriba-ink-mute">
                    {sc.detail}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[32px] font-semibold leading-none tracking-[-.025em] text-scriba-ink-strong lg:text-[38px]">
                    {formatBrl(total)}
                    {/* O asterisco liga ao rodapé da seção, que explica que o
                        valor sai de uma MÉDIA e não de uma conta fechada.
                        `aria-hidden` porque ele não é para ser lido: um leitor
                        de tela anunciaria "R$ 972,00 asterisco" sem ganhar
                        nada, e o rodapé vem logo a seguir na ordem do
                        documento, então a ressalva chega de qualquer jeito. */}
                    <sup
                      aria-hidden
                      className="ml-0.5 align-super text-[0.45em] font-medium text-scriba-ink-mute"
                    >
                      *
                    </sup>
                  </span>
                  <span className="text-[11.5px] font-medium text-scriba-ink-soft">
                    aproximadamente
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-pretty text-[12.5px] font-light leading-[1.6] text-scriba-ink-mute">
          <span aria-hidden className="font-semibold text-scriba-ink-strong">
            *{" "}
          </span>
          <strong className="font-semibold text-scriba-ink-strong">
            Os números acima são uma ilustração, não uma previsão de ganhos.
          </strong>{" "}
          A média de {formatBrl(AVERAGE_COMMISSION_CENTS)} por assinante supõe{" "}
          {Math.round(PESSOAL_SHARE * 100)} em cada 100 pessoas assinando o {PLANS.pessoal.name} (
          {formatBrl(COMMISSION_PESSOAL)} para você) e as outras{" "}
          {Math.round((1 - PESSOAL_SHARE) * 100)} assinando o {PLANS.estudioso.name} (
          {formatBrl(COMMISSION_ESTUDIOSO)}), que é o que se espera de um público chegando agora ao
          produto. A comissão é paga{" "}
          <strong className="font-semibold text-scriba-ink-strong">
            uma única vez por indicado
          </strong>
          , sobre a primeira mensalidade, não todo mês. Quanto você realmente vai receber depende de
          quantas pessoas assinam.
        </p>
      </div>
    </section>
  );
}

/* ---------- O painel ---------- */

/**
 * A prévia do painel é markup ESTÁTICO, não o painel real.
 *
 * Mesma decisão dos mockups de celular da `/` (ver `app/AGENTS.md`): importar
 * a tela de verdade traria `PartnerTabs`, `EarningsByPlan` e o `RefreshPanelButton`,
 * todos `"use client"`, todos inúteis aqui, para o bundle de uma página que
 * ninguém clica. O preço é conhecido: mexer no painel não atualiza esta prévia.
 */
function Panel() {
  return (
    <section id="painel" className="border-y border-scriba-hairline-soft bg-scriba-surface">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 sm:px-10 sm:py-[88px] lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
        <div className="flex flex-col gap-4">
          <SectionLabel color="blue">O painel</SectionLabel>
          <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.02em] text-scriba-ink-strong lg:text-[40px]">
            No painel você consegue acompanhar tudo em tempo real.
          </h2>
          <p className="max-w-[520px] text-pretty text-[14px] font-light leading-[1.65] text-scriba-ink-soft lg:text-[15.5px]">
            Assim que você entra no programa, você tem acesso ao seu painel particular. Nele você
            encontra tudo o que precisa:
          </p>
          <ul className="flex flex-col gap-2.5 pt-1">
            {[
              "Quantas pessoas abriram seu link, quantas criaram conta",
              "Quantas pessoas assinaram algum plano",
              "Quanto você tem a receber",
              "O histórico mês a mês",
              "Comprovante de pagamentos",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-[3px] flex size-4 flex-none items-center justify-center rounded-full bg-scriba-blue-soft"
                >
                  <Check className="text-scriba-blue-ink" />
                </span>
                <span className="text-pretty text-[13.5px] font-light leading-[1.6] text-scriba-ink-soft">
                  {item}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 rounded-[18px] border border-scriba-hairline bg-scriba-paper p-4 text-pretty text-[12.5px] font-light leading-[1.6] text-scriba-ink-soft">
            <strong className="font-semibold text-scriba-ink-strong">
              O painel mostra apenas números.
            </strong>{" "}
            Nome, e-mail ou qualquer dado de quem se cadastrou pelo seu link nunca aparecem para
            você, nem no painel, nem em relatório nenhum. Respeitamos a lei de proteção de dados
            (LGPD)".
          </p>
        </div>
        <PanelMock />
      </div>
    </section>
  );
}

function PanelMock() {
  return (
    <div className="flex flex-col gap-3 rounded-[26px] border border-scriba-hairline bg-scriba-paper p-5 shadow-[0_16px_40px_rgba(0,0,0,.12)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold tracking-tight text-scriba-ink-strong">
            Olá, Parceiro!
          </span>
          <span className="text-[11.5px] font-light text-scriba-ink-soft">
            Seus resultados e o que há a receber.
          </span>
        </div>
        <span className="rounded-full bg-scriba-blue-soft px-3 py-1 text-[10.5px] font-semibold text-scriba-blue-ink">
          /partners
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <MockMoney label="A liberar" value="R$ 41,79" hint="Carência de 30 dias" />
        <MockMoney label="Disponível" value="R$ 89,55" hint="Entra no próximo PIX" strong />
        <MockMoney label="Já recebido" value="R$ 214,92" hint="R$ 346,26 no total" />
      </div>

      <div className="flex flex-col gap-3 rounded-[18px] border border-scriba-hairline-soft p-4">
        <span className="text-[12.5px] font-semibold text-scriba-ink-strong">Seu funil</span>
        <div className="grid grid-cols-3 gap-3">
          {/* Espelha o funil real de `/partners`: taxa em relação ao degrau
              ANTERIOR, e o primeiro degrau sem taxa por não ter um antes dele.
              Os números são fictícios, mas as contas fecham (176/1.284 =
              13,7%, 21/176 = 11,9%): uma prévia com aritmética errada é a
              primeira coisa que alguém confere. */}
          <MockStep label="Visitas" value="1.284" hint="pelo seu link ou código" />
          <MockStep label="Cadastros" value="176" hint="13,7% das visitas" />
          <MockStep label="Assinantes" value="21" hint="11,9% dos cadastros" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-[16px] bg-scriba-btn-muted p-1">
        {["Divulgação", "Ganhos", "Pagamentos"].map((tab, i) => (
          <span
            key={tab}
            className={cn(
              "flex-1 rounded-[12px] py-1.5 text-center text-[11.5px] font-medium",
              i === 0
                ? "bg-scriba-paper text-scriba-ink-strong shadow-[0_2px_6px_rgba(0,0,0,.12)]"
                : "text-scriba-ink-mute"
            )}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-[18px] border border-scriba-hairline-soft bg-scriba-cream p-4">
        <CoinMark size={20} className="mt-0.5 flex-none" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[12.5px] font-semibold text-scriba-cream-ink">
            {formatCoins(DEFAULT_PARTNER_MONTHLY_COINS)} moedas por mês, por nossa conta
          </span>
          <span className="text-[11.5px] font-light leading-[1.5] text-scriba-cream-body">
            Caem sozinhas no começo de cada mês, para você usar o Scriba de verdade.
          </span>
        </div>
      </div>

      <p className="text-center text-[10.5px] font-light text-scriba-ink-mute">
        Ilustração do painel. Os números são fictícios.
      </p>
    </div>
  );
}

function MockMoney({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-[18px] border border-scriba-hairline-soft p-4",
        strong ? "bg-scriba-mint" : "bg-scriba-paper"
      )}
    >
      <span
        className={cn(
          "text-[9.5px] font-semibold uppercase tracking-[.12em]",
          strong ? "text-scriba-mint-accent" : "text-scriba-ink-mute"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-[19px] font-semibold tracking-tight",
          strong ? "text-scriba-mint-dark" : "text-scriba-ink-strong"
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          "text-[10.5px] font-light",
          strong ? "text-scriba-mint-body" : "text-scriba-ink-mute"
        )}
      >
        {hint}
      </span>
    </div>
  );
}

function MockStep({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-[.1em] text-scriba-ink-mute">
        {label}
      </span>
      <span className="text-[18px] font-semibold tracking-tight text-scriba-ink-strong">
        {value}
      </span>
      {hint ? (
        <span className="text-[10.5px] font-light leading-[1.35] text-scriba-ink-soft">{hint}</span>
      ) : null}
    </div>
  );
}

/* ---------- As regras ---------- */

const RULES: { title: string; body: string }[] = [
  {
    title: `Seu link vale por ${ATTRIBUTION_DAYS} dias`,
    body: `Quem abre seu link tem ${ATTRIBUTION_DAYS} dias para criar a conta e ainda contar como sua indicação. Um cookie fica salvo por ${ATTRIBUTION_DAYS} dias para caso a pessoa volte e se cadastre depois.`,
  },
  {
    title: "A indicação é sua para sempre",
    body: "Criada a conta pelo seu link, ela conta como sua indicação e de mais ninguém. Nenhum link aberto depois transfere a pessoa para outro parceiro.",
  },
  {
    title: "A comissão é uma vez por pessoa",
    body: "A comissão só sobre a primeira mensalidade por pessoa. Renovação não gera nova comissão, e quem cancela e volta meses depois também não. Compra avulsa de créditos também não comissiona.",
  },
  {
    title: "O valor trava na primeira fatura",
    body: `Se a pessoa começar no plano ${PLANS.pessoal.name} e mudar para o plano ${PLANS.estudioso.name} depois, sua comissão continua sendo uma unica vez considerando o primeiro plano assinado.`,
  },
  {
    title: `Carência de ${COMMISSION_HOLD_DAYS} dias`,
    body: `Toda comissão espera ${COMMISSION_HOLD_DAYS} dias antes de ficar disponível, é o prazo em que a cobrança ainda pode ser contestada no cartão. Havendo reembolso ou contestação, aquela comissão é cancelada.`,
  },
  {
    title: "Você não indica a si mesmo",
    body: "Sua própria conta nunca gera comissão nem bônus. Contas criadas em massa, tráfego comprado e promessa falsa sobre o produto encerram a participação, e comissão de indicação fraudulenta não é paga.",
  },
];

function Rules() {
  return (
    <section
      id="regras"
      className="mx-auto flex max-w-[1200px] flex-col gap-7 px-5 py-12 sm:px-10 sm:py-24 lg:gap-10"
    >
      <div className="flex flex-col gap-3 lg:max-w-[680px]">
        <SectionLabel>As regras</SectionLabel>
        <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[40px]">
          O que você precisa saber antes de publicar o primeiro link.
        </h2>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-[22px]">
        {RULES.map((rule) => (
          <div
            key={rule.title}
            className="flex flex-col gap-2 rounded-[22px] border border-scriba-hairline bg-scriba-paper p-5 sm:p-6"
          >
            <h3 className="text-pretty text-[14.5px] font-semibold leading-[1.35] tracking-[-.01em] text-scriba-ink-strong">
              {rule.title}
            </h3>
            <p className="text-pretty text-[13px] font-light leading-[1.6] text-scriba-ink-soft">
              {rule.body}
            </p>
          </div>
        ))}
      </div>
      {/* O livrinho é o `BookGlyph`, o mesmo que marca versículo no feed e no
          resumo, e não um SVG novo: ele pinta com `currentColor` e acompanha o
          texto do botão nos dois temas.

          Sem `aria-hidden` de propósito, e não por esquecimento: `BookGlyph` só
          aceita `className`, e um `aria-hidden` passado aqui seria descartado
          em silêncio, porque atributo JSX com hífen escapa da checagem de tipo
          do TypeScript. Ele não faz falta: o glifo é um `<span>` vazio, sem
          texto e sem `role`, que leitor de tela nenhum anuncia. Quem diz o que
          o link é continua sendo o rótulo dele. */}
      <Link
        href="/parceiros/regulamento"
        className="lp-cta-soft inline-flex w-fit items-center gap-2.5 rounded-[24px] bg-scriba-btn-muted py-[15px] px-7 text-[12px] font-semibold uppercase tracking-[.04em] text-scriba-ink hover:bg-scriba-btn-muted-hover"
      >
        <BookGlyph className="size-3.5 flex-none" />
        Ler o regulamento completo
      </Link>
    </section>
  );
}

/* ---------- FAQ ---------- */

const FAQ: { question: string; answer: string }[] = [
  {
    question: "Criar a conta já me compromete com alguma coisa?",
    answer: `Não. Criar conta por esta página só faz duas coisas: te dá ${formatCoins(PARTNER_PROSPECT_COINS)} moedas para usar o app e nos avisa que você tem interesse. Você não assume compromisso com nada.`,
  },
  {
    question: "O que ganha quem se cadastra pelo meu link?",
    answer: `${formatCoins(REFERRED_TOTAL_COINS)} moedas em vez de ${formatCoins(INITIAL_COIN_BALANCE)}, que é a melhor oferta que o Scriba tem e só existe pelo link de um parceiro. É o que você tem para anunciar: quem entra por você começa com mais do que quem chega sozinho.`,
  },
  {
    question: "Preciso ter um canal grande?",
    answer:
      "Não. O que conta é a proximidade com quem ouve pregação, não o tamanho da audiência. Um líder de célula que fala com trinta pessoas toda semana costuma trazer mais gente do que um perfil grande e distante.",
  },
  {
    question: "Preciso pagar alguma coisa para entrar?",
    answer:
      "Não. Não há taxa de adesão, mensalidade nem compra de kit. A conta é gratuita e as moedas de cortesia são nossas.",
  },
  {
    question: "Sou obrigado a falar só do Scriba?",
    answer:
      "Não há exclusividade nem meta mínima. Você publica quando e onde fizer sentido, bio, descrição de vídeo, stories, grupo de WhatsApp, boletim da igreja.",
  },
  {
    question: "Quando o dinheiro cai na conta?",
    answer: `Cada comissão espera ${COMMISSION_HOLD_DAYS} dias, é o tempo em que a cobrança ainda pode ser contestada no cartão. Passado o prazo, ela fica disponível e entra no PIX ${PAYOUT_SCHEDULE_LABEL}, desde que o total disponível tenha chegado a ${formatBrl(PAYOUT_MINIMUM_CENTS)}.`,
  },
  {
    question: `E se eu não juntar os ${formatBrl(PAYOUT_MINIMUM_CENTS)}?`,
    answer:
      "O saldo continua acumulado para o mês seguinte e nunca expira. Se você decidir sair do programa, ele é pago integralmente, mesmo abaixo do mínimo.",
  },
  {
    question: "Eu vejo quem se cadastrou pelo meu link?",
    answer:
      "Não. O painel mostra só números, nenhum nome, e-mail ou dado de quem criou a conta chega até você. É uma decisão de projeto, não uma limitação técnica.",
  },
];

function Faq() {
  return (
    <section className="mx-auto flex max-w-[1200px] flex-col gap-7 px-5 py-12 sm:px-10 sm:py-24 lg:gap-12">
      <div className="flex flex-col gap-3 lg:items-center lg:text-center">
        <SectionLabel color="blue">Perguntas frequentes</SectionLabel>
        <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[40px]">
          O que costumam perguntar...
        </h2>
      </div>
      <div className="grid gap-x-[52px] gap-y-0 lg:grid-cols-2">
        {FAQ.map((item) => (
          <div
            key={item.question}
            className="flex flex-col gap-2 border-t border-scriba-hairline py-5 sm:py-6"
          >
            <h3 className="text-pretty text-[15px] font-semibold leading-[1.4] tracking-[-.01em] text-scriba-ink-strong sm:text-[16px]">
              {item.question}
            </h3>
            <p className="text-pretty text-[13.5px] font-light leading-[1.65] text-scriba-ink-soft sm:text-[14.5px]">
              {item.answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- CTA final ---------- */

function FinalCta() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-11 sm:px-10 sm:py-24">
      <div className="relative flex flex-col gap-5 overflow-hidden rounded-[30px] bg-[image:var(--lp-band)] p-9 text-white sm:rounded-[34px] lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:p-16">
        <div className="pointer-events-none absolute -top-[90px] right-[60px] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(248,198,75,.22)_0%,rgba(248,198,75,0)_70%)]" />
        <div className="relative flex max-w-[620px] flex-col gap-3">
          <div className="text-pretty text-[28px] font-semibold leading-[1.16] tracking-[-.022em] lg:text-[38px]">
            Conheça agora o nosso produto!
          </div>
          <div className="text-[14px] font-light leading-[1.6] text-lp-band-ink lg:text-[16px] lg:leading-[1.62]">
            Crie sua conta gratuita, grave a próxima mensagem que você ouvir e nos retorne quando o
            Scriba fizer sentido para o seu público, escreva para{" "}
            <a
              href="mailto:contato@scriba.cc?subject=Programa%20de%20Parceiros%20do%20Scriba"
              className="font-medium text-scriba-yellow-light underline underline-offset-4"
            >
              contato@scriba.cc
            </a>
            .
          </div>
        </div>
        <div className="relative flex flex-none flex-col items-stretch gap-3">
          <Link
            href={PROSPECT_ENTRY}
            className="lp-cta-yellow inline-flex items-center justify-center gap-2.5 rounded-[26px] bg-lp-band-cta py-[17px] px-[38px] text-[13px] font-semibold uppercase tracking-[.04em] text-lp-band-cta-ink shadow-[0_10px_24px_rgba(0,0,0,.2)]"
          >
            <ScribaMark size={20} />
            Conhecer o Scriba
          </Link>
          <div className="text-center text-[11px] font-light text-lp-band-ink lg:text-[11.5px]">
            Sem cartão e sem compromisso
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Átomos ---------- */

function Check({ className }: { className?: string }) {
  return (
    <svg
      role="presentation"
      className={cn("size-3 flex-none", className)}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 8.5L6.5 12L13 5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
