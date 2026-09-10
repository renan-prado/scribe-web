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
} from "@/lib/partners/economics";
import { REF_COOKIE_MAX_AGE } from "@/lib/referrals/cookies";
import { LandingFooter, LandingHeader } from "@/shared/components/LandingChrome";

export const metadata: Metadata = {
  title: "Regulamento do Programa de Parceiros · Scriba",
  description:
    "Regras completas do Programa de Parceiros do Scriba: vinculação, comissão, carência, pagamento, condutas vedadas e desligamento.",
  alternates: { canonical: "/parceiros/regulamento" },
};

/**
 * O regulamento do Programa de Parceiros.
 *
 * Mesma forma das páginas legais (`/terms`, `/privacy`): datada, numerada,
 * larga o suficiente para ser lida e estreita o suficiente para ser lida até o
 * fim. Ela é a versão que OBRIGA — `/parceiros` resume, e um resumo que
 * discorde daqui é o resumo que está errado.
 *
 * **Os números vêm dos mesmos módulos que o produto usa para cobrar e pagar**
 * (`lib/partners/economics.ts`, `lib/billing/plans.ts`). Um regulamento com
 * percentual redigitado é a pior forma possível de um número divergir: ele
 * continua verdadeiro na tela e falso no PIX.
 *
 * Ao mudar QUALQUER regra aqui, atualize `docs/parceiros.md` no mesmo commit —
 * aquele documento é o que a equipe envia por e-mail, e dois textos com a
 * mesma autoridade dizendo coisas diferentes é como um parceiro descobre uma
 * condição que ninguém anunciou.
 */

const LAST_UPDATED = "10 de setembro de 2026";
const CONTACT_EMAIL = "contato@scriba.cc";

const ATTRIBUTION_DAYS = REF_COOKIE_MAX_AGE / (24 * 60 * 60);
const COMMISSION_PCT = (DEFAULT_COMMISSION_BPS / 100).toLocaleString("pt-BR");
const REFERRED_TOTAL_COINS = INITIAL_COIN_BALANCE + DEFAULT_SIGNUP_BONUS_COINS;

export default function PartnersTermsPage() {
  return (
    <div className="w-full overflow-x-clip bg-background text-scriba-ink-strong antialiased">
      <LandingHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-16 text-scriba-ink-strong sm:px-6">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-scriba-ink-strong">
          Regulamento do Programa de Parceiros
        </h1>
        <p className="mb-2 text-sm text-scriba-ink-mute">Última atualização: {LAST_UPDATED}</p>
        <p className="mb-10 text-sm font-light leading-relaxed text-scriba-ink-soft">
          A versão resumida e ilustrada está em{" "}
          <Link href="/parceiros" className="text-scriba-blue-ink underline underline-offset-2">
            scriba.cc/parceiros
          </Link>
          . Em caso de divergência entre aquela página e este documento, prevalece este documento.
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-scriba-ink">
          <Section n={1} title="Objeto e aceitação">
            <p>
              Este Regulamento estabelece as condições do Programa de Parceiros do Scriba
              ("Programa"), pelo qual pessoas convidadas divulgam o Scriba ("Serviço") e são
              remuneradas pelos resultados dessa divulgação, na forma aqui prevista.
            </p>
            <p className="mt-2">
              A adesão ao Programa é voluntária e se aperfeiçoa com o cadastro do Parceiro pela
              equipe do Scriba e o primeiro acesso do Parceiro ao painel em{" "}
              <span className="font-mono text-[13px]">scriba.cc/partners</span>. O uso do link ou do
              código de divulgação implica aceitação integral deste Regulamento, dos{" "}
              <Link href="/terms" className="text-scriba-blue-ink underline underline-offset-2">
                Termos de Uso
              </Link>{" "}
              e da{" "}
              <Link href="/privacy" className="text-scriba-blue-ink underline underline-offset-2">
                Política de Privacidade
              </Link>
              , que a este se aplicam de forma complementar.
            </p>
          </Section>

          <Section n={2} title="Definições">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Parceiro:</strong> pessoa física ou jurídica convidada e cadastrada pela
                equipe do Scriba para participar do Programa.
              </li>
              <li>
                <strong>Link de divulgação:</strong> endereço único no formato{" "}
                <span className="font-mono text-[13px]">scriba.cc/r/&lt;código&gt;</span> atribuído
                ao Parceiro.
              </li>
              <li>
                <strong>Código de indicação:</strong> a mesma sequência do link, informável no campo
                opcional da tela de cadastro do Serviço.
              </li>
              <li>
                <strong>Candidato (ou pré-parceiro):</strong> pessoa que criou conta pela página
                scriba.cc/parceiros para conhecer o Serviço, na forma da cláusula 3.1. Candidato{" "}
                <strong>não é Parceiro</strong> e não faz jus a comissão.
              </li>
              <li>
                <strong>Indicado:</strong> pessoa que cria conta no Serviço vinculada ao Parceiro,
                na forma da cláusula 5.
              </li>
              <li>
                <strong>Assinante indicado:</strong> Indicado que contrata e paga uma assinatura
                mensal do Serviço.
              </li>
              <li>
                <strong>Comissão:</strong> valor em reais devido ao Parceiro na forma da cláusula 7.
              </li>
              <li>
                <strong>Moedas (ou créditos):</strong> unidade interna de consumo do Serviço, sem
                valor monetário, não resgatável e não conversível em dinheiro.
              </li>
            </ul>
          </Section>

          <Section n={3} title="Adesão, elegibilidade e natureza da relação">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                O Programa é <strong>por convite</strong>. Não há inscrição aberta: o Parceiro é
                cadastrado pela equipe do Scriba, que pode recusar ou encerrar convites a seu
                critério, de forma motivada.
              </li>
              <li>
                O Parceiro deve ser maior de 18 anos, ter plena capacidade civil e manter conta
                ativa no Serviço, acessada pelo mesmo provedor de login utilizado no aplicativo.
              </li>
              <li>
                A adesão <strong>não gera vínculo empregatício</strong>, societário, de agência, de
                representação comercial, de franquia ou de exclusividade entre as partes. O Parceiro
                atua por conta e risco próprios, sem subordinação, habitualidade obrigatória ou
                jornada.
              </li>
              <li>
                O Parceiro não tem poderes para representar o Scriba, assumir obrigações em seu
                nome, conceder descontos, prazos, garantias ou fazer declarações vinculantes sobre o
                Serviço.
              </li>
              <li>
                Não há taxa de adesão, mensalidade, compra de kit, meta mínima de resultado nem
                cláusula de exclusividade.
              </li>
            </ul>
          </Section>

          <Section n={3.1} title="Cadastro de candidato, sem compromisso">
            <p>
              Qualquer pessoa pode criar conta pela página scriba.cc/parceiros para conhecer o
              Serviço. Esse cadastro é{" "}
              <strong>gratuito e não gera compromisso para nenhuma das partes</strong>: não é adesão
              ao Programa, não confere a condição de Parceiro, não gera link de divulgação, código,
              comissão nem qualquer expectativa de contratação.
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                O Candidato recebe {formatCoins(PARTNER_PROSPECT_COINS)} moedas de cortesia,
                creditadas uma única vez, destinadas exclusivamente a experimentar o Serviço.
              </li>
              <li>
                A cortesia está sujeita a <strong>orçamento global</strong> definido pelo Scriba.
                Esgotado o orçamento, o cadastro é registrado normalmente e as moedas não são
                creditadas.
              </li>
              <li>
                A cortesia não é cumulativa com o bônus de indicação da cláusula 6: quem criou conta
                pelo link ou código de um parceiro ou de um amigo já recebeu o benefício de
                boas-vindas e não recebe este.
              </li>
              <li>
                O Candidato pode deixar de usar o Serviço a qualquer momento, sem aviso e sem
                qualquer ônus. Não há prazo, meta, exclusividade nem obrigação de divulgar.
              </li>
              <li>
                A passagem de Candidato a Parceiro depende de{" "}
                <strong>convite e cadastro pela equipe do Scriba</strong> e da concordância das duas
                partes, na forma da cláusula 3. O Scriba não se obriga a promover qualquer
                Candidato, e a ausência de promoção não gera direito a indenização.
              </li>
              <li>
                O Scriba pode registrar o interesse do Candidato para fins de contato sobre o
                Programa. Os dados tratados são os da conta, na forma da cláusula 15.
              </li>
            </ul>
          </Section>

          <Section n={4} title="Material de divulgação">
            <p>
              O Scriba fornece ao Parceiro um link de divulgação, um código de indicação e acesso ao
              painel de acompanhamento. O link e o código são pessoais e intransferíveis, não podem
              ser cedidos, revendidos, sublicenciados ou compartilhados com terceiros para uso
              próprio destes.
            </p>
            <p className="mt-2">
              O Parceiro é livre para publicar o link nos canais que mantiver — biografia de perfil,
              descrição de vídeo, transmissões, mensagens a seus seguidores, materiais impressos —
              desde que respeitadas as vedações da cláusula 11 e as regras da plataforma em que
              publicar.
            </p>
          </Section>

          <Section n={5} title="Vinculação do Indicado">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Pelo link:</strong> quem acessa o link de divulgação fica marcado por{" "}
                {ATTRIBUTION_DAYS} dias no navegador utilizado. Criando conta nesse período, é
                vinculado ao Parceiro.
              </li>
              <li>
                <strong>Pelo código:</strong> a pessoa pode informar o código no campo opcional da
                tela de cadastro. O código digitado prevalece sobre a marcação do link.
              </li>
              <li>
                <strong>A vinculação é única e definitiva.</strong> Uma conta tem um só vinculante,
                registrado no momento da criação. Link ou código utilizados depois não transferem a
                pessoa, e a vinculação não se altera por solicitação de qualquer das partes.
              </li>
              <li>
                <strong>Contas já existentes não são vinculadas.</strong> Somente contas criadas
                após o acesso ao link ou a informação do código geram vinculação.
              </li>
              <li>
                <strong>Prevalece o mais recente.</strong> Tendo a pessoa acessado links de mais de
                um parceiro antes de se cadastrar, vale a última marcação registrada no navegador,
                ressalvada a prevalência do código digitado.
              </li>
              <li>
                <strong>Autoindicação é vedada.</strong> A conta do próprio Parceiro, bem como
                contas por ele criadas ou controladas, não geram vinculação, Comissão ou moedas.
              </li>
              <li>
                A marcação depende de recursos do navegador do visitante (cookies). Sua perda por
                limpeza de dados, navegação anônima, troca de dispositivo ou bloqueio por extensões
                não gera direito a Comissão nem a revisão de atribuição — razão pela qual o código
                de indicação existe.
              </li>
            </ul>
          </Section>

          <Section n={6} title="Benefício ao Indicado">
            <p>
              Quem cria conta pelo link ou código do Parceiro recebe{" "}
              {formatCoins(DEFAULT_SIGNUP_BONUS_COINS)} moedas adicionais, somadas às{" "}
              {formatCoins(INITIAL_COIN_BALANCE)} moedas de boas-vindas concedidas a qualquer conta
              nova, totalizando {formatCoins(REFERRED_TOTAL_COINS)} moedas. O bônus é creditado uma
              única vez por conta, no momento do cadastro, e está sujeito a limite de orçamento por
              Parceiro definido no cadastro deste.
            </p>
            <p className="mt-2">
              O valor do bônus é condição do Programa, não do Parceiro, e pode ser alterado na forma
              da cláusula 14.
            </p>
          </Section>

          <Section n={7} title="Comissão">
            <p>
              O Parceiro faz jus a{" "}
              <strong>{COMMISSION_PCT}% do valor bruto da primeira mensalidade</strong> efetivamente
              paga por cada Assinante indicado, salvo percentual diverso acordado individualmente e
              registrado no cadastro do Parceiro.
            </p>
            <p className="mt-2">
              Nos preços vigentes na data deste Regulamento, a Comissão corresponde a{" "}
              {formatBrl(commissionCents(PLANS.pessoal.priceCents, DEFAULT_COMMISSION_BPS))} no
              plano {PLANS.pessoal.name} e{" "}
              {formatBrl(commissionCents(PLANS.estudioso.priceCents, DEFAULT_COMMISSION_BPS))} no
              plano {PLANS.estudioso.name}.
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                <strong>Pagamento único por pessoa.</strong> A Comissão incide exclusivamente sobre
                a primeira mensalidade paga. Renovações nos meses seguintes não geram nova Comissão.
              </li>
              <li>
                <strong>Uma vez por Indicado, em definitivo.</strong> Cancelada a assinatura e
                contratada novamente, ainda que meses depois, não há nova Comissão.
              </li>
              <li>
                <strong>Valor travado na primeira fatura.</strong> Migração posterior para plano
                mais caro ou mais barato não altera a Comissão já apurada.
              </li>
              <li>
                <strong>Sobre o valor bruto.</strong> A Comissão é calculada sobre o preço público
                da mensalidade; as taxas do meio de pagamento correm por conta do Scriba.
              </li>
              <li>
                <strong>Somente assinaturas.</strong> Compras avulsas de pacotes de créditos,
                promoções, cortesias e créditos concedidos pela equipe não geram Comissão.
              </li>
              <li>
                <strong>O percentual aplicado é o vigente na data da apuração</strong> e fica
                registrado na respectiva Comissão. Alteração posterior do percentual não recalcula
                Comissões já apuradas, para mais ou para menos.
              </li>
            </ul>
          </Section>

          <Section n={8} title="Moedas devidas ao Parceiro">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Por cadastro:</strong> {formatCoins(DEFAULT_PARTNER_SIGNUP_REWARD_COINS)}{" "}
                moedas por cada conta validamente vinculada ao Parceiro, independentemente de
                contratação de assinatura, salvo valor diverso registrado em seu cadastro. São
                acumuladas e creditadas no saldo do Parceiro no primeiro acesso deste ao Serviço
                após o cadastro do Indicado.
              </li>
              <li>
                <strong>Cortesia mensal:</strong> {formatCoins(DEFAULT_PARTNER_MONTHLY_COINS)}{" "}
                moedas por mês, creditadas automaticamente no primeiro acesso do Parceiro ao Serviço
                em cada mês civil, salvo valor diverso registrado em seu cadastro. A cortesia
                <strong> não é cumulativa</strong> entre meses: é permissão de uso do período, não
                saldo a resgatar.
              </li>
              <li>
                Moedas <strong>não têm valor monetário</strong>, não são resgatáveis, não são
                conversíveis em dinheiro, não são transferíveis entre contas e destinam-se
                exclusivamente ao consumo do Serviço.
              </li>
              <li>
                Encerrada a participação no Programa, cessa a cortesia mensal. As moedas já
                creditadas permanecem no saldo da conta e seguem os{" "}
                <Link href="/terms" className="text-scriba-blue-ink underline underline-offset-2">
                  Termos de Uso
                </Link>
                .
              </li>
            </ul>
          </Section>

          <Section n={9} title="Carência, apuração e pagamento">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Carência de {COMMISSION_HOLD_DAYS} dias.</strong> Toda Comissão apurada
                permanece em carência por {COMMISSION_HOLD_DAYS} dias contados do pagamento da
                fatura que a originou. É o prazo em que a cobrança ainda pode ser contestada ou
                estornada.
              </li>
              <li>
                <strong>Disponibilidade.</strong> Vencida a carência sem estorno, a Comissão passa a
                integrar o saldo disponível, exibido no painel do Parceiro.
              </li>
              <li>
                <strong>Pagamento.</strong> Realizado por PIX, mensalmente, sobre o total
                disponível, mediante chave PIX válida e dados fiscais previamente informados pelo
                Parceiro. Sem esses dados o pagamento não pode ser efetuado, e a ausência deles não
                configura mora do Scriba.
              </li>
              <li>
                <strong>Valor mínimo de {formatBrl(PAYOUT_MINIMUM_CENTS)}.</strong> Abaixo desse
                montante o saldo permanece acumulado para os meses seguintes.{" "}
                <strong>O saldo não expira</strong> e é pago integralmente, ainda que inferior ao
                mínimo, no encerramento da participação por qualquer motivo que não fraude.
              </li>
              <li>
                <strong>Comprovante.</strong> Efetuado o pagamento, o Scriba pode disponibilizar no
                painel o endereço eletrônico do comprovante correspondente.
              </li>
              <li>
                <strong>Divergências.</strong> Questionamentos sobre valores devem ser apresentados
                em até 90 dias da data em que a informação ficou disponível no painel, pelo e-mail
                de contato. Os registros do Scriba prevalecem como prova da apuração, salvo erro
                demonstrado.
              </li>
            </ul>
          </Section>

          <Section n={10} title="Tributos e obrigações fiscais">
            <p>
              Os valores pagos ao Parceiro têm natureza de remuneração por serviço de divulgação. O
              Parceiro é o único responsável pela apuração e pelo recolhimento dos tributos
              incidentes sobre os valores que receber, bem como pela emissão de documento fiscal
              quando a legislação aplicável a ele exigir.
            </p>
            <p className="mt-2">
              O Scriba pode reter ou deixar de efetuar pagamentos enquanto pendente a apresentação
              de dados cadastrais e fiscais exigidos por lei, e pode efetuar retenções quando a
              legislação assim o determinar.
            </p>
          </Section>

          <Section n={11} title="Condutas vedadas">
            <p>São vedadas ao Parceiro, entre outras condutas de efeito equivalente:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                Gerar tráfego artificial por robôs, cliques automatizados, granjas de cliques,
                serviços pagos de tráfego não qualificado ou qualquer meio que simule interesse
                inexistente.
              </li>
              <li>
                Criar, ou induzir a criação de, contas em massa, contas falsas, contas de terceiros
                sem conhecimento destes ou múltiplas contas da mesma pessoa.
              </li>
              <li>
                Oferecer pagamento, sorteio, vantagem indevida ou condicionar acesso a conteúdo em
                troca do cadastro pelo seu link, sem prévia autorização escrita do Scriba.
              </li>
              <li>
                Fazer promessa falsa, exagerada ou enganosa sobre o Serviço, seus resultados, seu
                preço, sua precisão ou sua natureza; declarar ou sugerir que a inteligência
                artificial substitui aconselhamento pastoral, teológico, jurídico, médico ou
                psicológico; ou apresentar as saídas do Serviço como fonte doutrinária.
              </li>
              <li>
                Divulgar em spam, disparo em massa não solicitado, comentários automatizados,
                mensagens não autorizadas ou canais que violem os termos das plataformas onde forem
                publicadas.
              </li>
              <li>
                Registrar domínios, perfis, aplicativos ou anúncios que reproduzam ou imitem a marca
                "Scriba", bem como anunciar em plataformas de busca ou de mídia utilizando a marca
                ou variações capazes de induzir o público a crer que fala em nome do Scriba.
              </li>
              <li>
                Associar o Serviço a conteúdo ilícito, discriminatório, difamatório, de ódio,
                sexualmente explícito, político-partidário ou que explore a fé de terceiros para
                obtenção de vantagem indevida.
              </li>
              <li>
                Manipular, interceptar ou alterar os mecanismos de atribuição, os cookies, o painel
                ou qualquer parte do Serviço.
              </li>
            </ul>
          </Section>

          <Section n={12} title="Uso da marca">
            <p>
              O Scriba concede ao Parceiro licença limitada, revogável, não exclusiva e
              intransferível para utilizar o nome e o logotipo "Scriba" exclusivamente na divulgação
              do Serviço durante a vigência da participação, sem direito a modificar os elementos
              visuais, combiná-los com outras marcas de modo a sugerir parceria societária ou
              registrá-los a qualquer título.
            </p>
            <p className="mt-2">
              Encerrada a participação, o Parceiro deve cessar o uso da marca e remover os links de
              divulgação em prazo razoável, não superior a 30 dias.
            </p>
          </Section>

          <Section n={13} title="Estorno, suspensão e encerramento">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Estorno.</strong> Reembolso, chargeback, cancelamento com devolução ou
                constatação de fraude no pagamento do Assinante indicado cancelam a Comissão
                correspondente, ainda que já disponível. Se já paga, o valor pode ser compensado com
                Comissões futuras.
              </li>
              <li>
                <strong>Suspensão.</strong> Havendo indício de conduta vedada, o Scriba pode
                suspender preventivamente a apuração e o pagamento enquanto durar a apuração dos
                fatos, comunicando o Parceiro.
              </li>
              <li>
                <strong>Encerramento por conduta vedada.</strong> Confirmada a infração, a
                participação é encerrada e as Comissões decorrentes de indicações fraudulentas não
                são devidas. Comissões legítimas já apuradas permanecem devidas.
              </li>
              <li>
                <strong>Encerramento voluntário.</strong> Qualquer das partes pode encerrar a
                participação a qualquer tempo, sem multa, mediante comunicação. O saldo disponível e
                as Comissões em carência que vencerem sem estorno são pagos integralmente, ainda que
                inferiores ao mínimo da cláusula 9.
              </li>
              <li>
                Encerrada a participação, cessam a cortesia mensal, o acesso ao painel e a
                vinculação de novos Indicados. A conta do Parceiro no Serviço permanece ativa como
                conta comum.
              </li>
            </ul>
          </Section>

          <Section n={14} title="Alteração das condições">
            <p>
              O Scriba pode alterar as condições do Programa — percentual padrão, valores em moedas,
              carência, mínimo de pagamento e demais regras — mediante comunicação ao Parceiro com{" "}
              <strong>antecedência mínima de 30 dias</strong> por e-mail ou aviso no painel.
            </p>
            <p className="mt-2">
              As alterações valem apenas para o futuro:{" "}
              <strong>
                Comissões já apuradas e moedas já creditadas não são recalculadas nem revogadas
              </strong>
              . A permanência no Programa após o prazo implica concordância com as novas condições;
              discordando, o Parceiro pode encerrar sua participação na forma da cláusula 13, com
              pagamento integral do saldo.
            </p>
            <p className="mt-2">
              O encerramento do Programa como um todo observa o mesmo aviso prévio de 30 dias, com
              pagamento integral dos saldos existentes.
            </p>
          </Section>

          <Section n={15} title="Proteção de dados">
            <p>
              O painel do Parceiro exibe <strong>exclusivamente números agregados</strong>. Nome,
              e-mail, telefone, conteúdo gravado ou qualquer dado pessoal de Indicados não são
              exibidos ao Parceiro, não são compartilhados com ele e não podem ser por ele
              solicitados.
            </p>
            <p className="mt-2">
              Os dados pessoais do próprio Parceiro — nome, e-mail, chave PIX, CPF ou CNPJ — são
              tratados para execução deste Regulamento e cumprimento de obrigações legais e fiscais,
              nos termos da Lei nº 13.709/2018 (LGPD) e da{" "}
              <Link href="/privacy" className="text-scriba-blue-ink underline underline-offset-2">
                Política de Privacidade
              </Link>
              .
            </p>
            <p className="mt-2">
              O Parceiro que colete dados de terceiros em suas próprias ações de divulgação é
              controlador desses dados e responde isoladamente pela base legal e pelas obrigações
              correspondentes.
            </p>
          </Section>

          <Section n={16} title="Limitação de responsabilidade">
            <p>
              O Scriba não responde por resultados de divulgação, alcance, conversão, receita
              esperada, decisões editoriais do Parceiro, custos por ele incorridos ou por
              indisponibilidades e alterações das plataformas de terceiros onde publicar.
            </p>
            <p className="mt-2">
              O Parceiro responde pelas declarações que fizer sobre o Serviço e isenta o Scriba de
              reclamações de terceiros decorrentes de conteúdo que produzir ou de conduta vedada na
              cláusula 11.
            </p>
            <p className="mt-2">
              A responsabilidade do Scriba perante o Parceiro, em qualquer hipótese, limita-se aos
              valores comprovadamente devidos e não pagos nos 12 meses anteriores ao evento.
            </p>
          </Section>

          <Section n={17} title="Disposições gerais, legislação e foro">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                A invalidade de qualquer disposição não afeta as demais, que permanecem em pleno
                vigor.
              </li>
              <li>
                A tolerância quanto a qualquer descumprimento não implica renúncia, novação ou
                alteração das obrigações previstas.
              </li>
              <li>
                O Parceiro não pode ceder sua participação no Programa sem autorização prévia por
                escrito.
              </li>
              <li>
                Este Regulamento é regido pela legislação brasileira. Fica eleito o foro da comarca
                de São Paulo/SP para dirimir controvérsias, com renúncia a qualquer outro, por mais
                privilegiado que seja.
              </li>
            </ul>
          </Section>

          <Section n={18} title="Contato">
            <p>
              Dúvidas sobre este Regulamento ou sobre o Programa:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Programa%20de%20Parceiros%20do%20Scriba`}
                className="text-scriba-blue-ink underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-12 border-t border-scriba-hairline-soft pt-6 text-xs text-scriba-ink-mute">
          <Link href="/parceiros" className="text-scriba-blue-ink">
            Programa de Parceiros
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="text-scriba-blue-ink">
            Termos de Uso
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="text-scriba-blue-ink">
            Política de Privacidade
          </Link>{" "}
          · Scriba © {new Date().getFullYear()}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}
