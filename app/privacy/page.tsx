import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter, LandingHeader } from "@/shared/components/LandingChrome";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o Scriba coleta, usa e protege seus dados pessoais.",
};

const LAST_UPDATED = "28 de agosto de 2026";
const CONTACT_EMAIL = "contato@scriba.cc";

export default function PrivacyPage() {
  return (
    <div className="w-full overflow-x-clip bg-background text-scriba-ink-strong antialiased">
      <LandingHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-16 text-scriba-ink-strong sm:px-6">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-scriba-ink-strong">
          Política de Privacidade
        </h1>
        <p className="mb-10 text-sm text-scriba-ink-mute">Última atualização: {LAST_UPDATED}</p>

        <div className="space-y-8 text-sm leading-relaxed text-scriba-ink">
          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              1. Quem somos e a quem esta política se aplica
            </h2>
            <p>
              O Scriba é um serviço de transcrição e resumo de sermões, palestras e conteúdos
              religiosos em tempo real, com apoio de inteligência artificial. Esta Política de
              Privacidade descreve como coletamos, usamos, compartilhamos, armazenamos e protegemos
              dados pessoais tratados no âmbito do serviço, em conformidade com a{" "}
              <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)</strong> e com o{" "}
              <strong>Marco Civil da Internet (Lei nº 12.965/2014)</strong>.
            </p>
            <p className="mt-2">
              Para fins da LGPD, o Scriba atua como <strong>controlador</strong> dos dados pessoais
              dos usuários da plataforma e como <strong>operador</strong> quando trata conteúdo
              enviado por você (áudio, transcrições) sob suas instruções.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              2. Canal de comunicação sobre privacidade
            </h2>
            <p>
              Para exercer direitos, esclarecer dúvidas ou tratar de qualquer assunto relacionado à
              proteção de dados pessoais, entre em contato pelo e-mail{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-scriba-blue underline-offset-2 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              3. Dados que coletamos
            </h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Dados de conta:</strong> nome, endereço de e-mail e credencial de acesso
                (senha armazenada em formato hash, quando aplicável).
              </li>
              <li>
                <strong>Áudio das gravações:</strong> capturado pelo seu dispositivo em curtos
                trechos (~30 segundos) e enviado aos provedores de IA para transcrição em tempo
                real. O áudio bruto não é retido em nossos servidores após o processamento; apenas o
                texto transcrito e os materiais derivados permanecem vinculados à sua conta.
              </li>
              <li>
                <strong>Transcrições, resumos e conteúdo derivado:</strong> textos, referências
                bíblicas, contextos, destaques, estudos e demais materiais gerados a partir das suas
                gravações.
              </li>
              <li>
                <strong>Metadados de sessão:</strong> data, hora, duração, local (se informado),
                pregador/palestrante (se informado) e identificadores associados às suas gravações.
              </li>
              <li>
                <strong>Dados de uso e diagnóstico:</strong> páginas visitadas, ações realizadas,
                horários, tipo de dispositivo, sistema operacional, navegador, endereço IP e logs de
                erro — usados para segurança, prevenção a fraudes e melhoria do serviço.
              </li>
              <li>
                <strong>Dados de pagamento:</strong> tratados diretamente por provedores autorizados
                (adquirentes/gateway). Não armazenamos números completos de cartão de crédito em
                nossos servidores.
              </li>
            </ul>
            <p className="mt-2">
              O Scriba não solicita, tampouco incentiva o envio de{" "}
              <strong>dados pessoais sensíveis</strong> (origem racial, convicção religiosa, opinião
              política, dado de saúde etc. — art. 5º, II, da LGPD). Contudo, o próprio contexto
              religioso e o conteúdo dos sermões podem revelar convicção religiosa; ao utilizar o
              Scriba, você fornece consentimento específico para o tratamento incidental desses
              dados na finalidade estrita de prestação do serviço.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              4. Base legal e finalidades do tratamento
            </h2>
            <p>
              Nos termos dos arts. 7º e 11 da LGPD, tratamos dados pessoais com as seguintes bases
              legais:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <strong>Execução de contrato</strong> (art. 7º, V): fornecer, manter e evoluir o
                serviço, criar e autenticar sua conta, processar transcrições e resumos, prestar
                suporte técnico.
              </li>
              <li>
                <strong>Consentimento</strong> (arts. 7º, I; 8º; 11, I): tratamento de áudio,
                transcrição e materiais que possam revelar convicção religiosa, bem como envio de
                comunicações não essenciais.
              </li>
              <li>
                <strong>Cumprimento de obrigação legal</strong> (art. 7º, II): guarda de logs de
                acesso por 6 meses (art. 15 do Marco Civil da Internet), obrigações fiscais e
                atendimento a ordens judiciais.
              </li>
              <li>
                <strong>Legítimo interesse</strong> (art. 7º, IX): segurança da plataforma,
                prevenção a fraudes, prevenção a abusos e análises agregadas de melhoria do serviço,
                sempre respeitando seus direitos e liberdades fundamentais.
              </li>
              <li>
                <strong>Exercício regular de direitos</strong> (art. 7º, VI): defesa em processos
                judiciais, administrativos ou arbitrais.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              5. Como usamos seus dados
            </h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Fornecer, manter e melhorar o Serviço.</li>
              <li>
                Processar transcrições, resumos e demais materiais via provedores de IA (atualmente
                OpenAI).
              </li>
              <li>
                Enviar comunicações relacionadas à conta (confirmação, recuperação de senha, avisos
                legais, alertas de segurança).
              </li>
              <li>Prevenir fraudes, abusos e garantir a segurança da plataforma.</li>
              <li>Cumprir obrigações legais, regulatórias e requisições de autoridades.</li>
              <li>
                Realizar análises agregadas e anonimizadas para entender uso e evoluir o produto.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              6. Compartilhamento de dados
            </h2>
            <p>
              <strong>Não vendemos seus dados pessoais.</strong> Compartilhamos informações apenas
              com operadores estritamente necessários para o funcionamento do Scriba, mediante
              contrato e obrigações de sigilo e segurança:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <strong>OpenAI</strong> — processamento de áudio para transcrição e geração de
                resumos e materiais. Dados tratados conforme a{" "}
                <a
                  href="https://openai.com/policies/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-scriba-blue underline-offset-2 hover:underline"
                >
                  política de privacidade da OpenAI
                </a>
                . A OpenAI declara que dados enviados via API não são utilizados para treinamento de
                modelos por padrão.
              </li>
              <li>
                <strong>Supabase</strong> — banco de dados, autenticação e armazenamento. Consulte a{" "}
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-scriba-blue underline-offset-2 hover:underline"
                >
                  política de privacidade da Supabase
                </a>
                .
              </li>
              <li>
                <strong>Provedores de hospedagem e infraestrutura</strong> em nuvem (ex.: Vercel),
                utilizados para entrega da aplicação e armazenamento de logs.
              </li>
              <li>
                <strong>Provedores de e-mail transacional</strong>, para comunicações relacionadas à
                conta.
              </li>
              <li>
                <strong>Autoridades públicas</strong>, quando exigido por lei, ordem judicial ou
                requisição legítima.
              </li>
              <li>
                Em caso de <strong>reorganização societária</strong> (fusão, aquisição, cisão), os
                dados podem ser transferidos ao sucessor, respeitando esta política.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              7. Transferência internacional de dados
            </h2>
            <p>
              Alguns dos nossos operadores (notadamente OpenAI, Supabase e provedores de nuvem)
              processam dados em servidores localizados fora do Brasil, incluindo Estados Unidos e
              União Europeia. Realizamos essas transferências com fundamento nos arts. 33 e 35 da
              LGPD, mediante cláusulas contratuais adequadas, garantias de segurança equivalentes às
              previstas na legislação brasileira e limitação estrita à finalidade de prestação do
              serviço.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              8. Direitos do titular
            </h2>
            <p>Nos termos do art. 18 da LGPD, você tem direito a, mediante requisição gratuita:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Confirmar a existência de tratamento e acessar seus dados.</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
              <li>
                Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários, excessivos
                ou tratados em desconformidade com a lei.
              </li>
              <li>Portabilidade dos seus dados a outro fornecedor.</li>
              <li>
                Eliminação dos dados pessoais tratados com base em consentimento, ressalvadas as
                hipóteses de guarda legal.
              </li>
              <li>Informação sobre entidades com as quais compartilhamos seus dados.</li>
              <li>Informação sobre a possibilidade de não fornecer consentimento.</li>
              <li>Revogar o consentimento, a qualquer momento.</li>
              <li>
                Opor-se a tratamentos realizados com fundamento em legítimo interesse, com indicação
                de motivos.
              </li>
              <li>
                Revisão de decisões automatizadas que afetem seus interesses (art. 20 da LGPD).
              </li>
              <li>
                Peticionar à Autoridade Nacional de Proteção de Dados (ANPD) —{" "}
                <a
                  href="https://www.gov.br/anpd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-scriba-blue underline-offset-2 hover:underline"
                >
                  www.gov.br/anpd
                </a>
                .
              </li>
            </ul>
            <p className="mt-3">
              Para exercer qualquer desses direitos, entre em contato:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-scriba-blue underline-offset-2 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              . Podemos exigir comprovação de identidade antes de atender à solicitação e
              responderemos no prazo legal.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              9. Consentimento de terceiros gravados
            </h2>
            <p>
              Ao gravar sermões, palestras ou reuniões, o usuário do Scriba é responsável por obter
              o consentimento livre, informado e inequívoco das pessoas cujas vozes serão
              capturadas, especialmente do pregador ou palestrante. O Scriba não é o responsável
              primário por essa coleta e recomenda que a autorização seja obtida expressamente e
              comunicada à comunidade envolvida.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">10. Cookies</h2>
            <p>
              Utilizamos apenas <strong>cookies estritamente necessários</strong> para autenticar
              sua sessão, manter suas preferências essenciais e proteger a plataforma contra
              fraudes. Não utilizamos cookies publicitários, de rastreamento comportamental
              cross-site ou de compartilhamento com anunciantes terceiros. Você pode bloquear
              cookies nas configurações do seu navegador, mas isso pode inviabilizar o uso do
              serviço.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              11. Segurança e incidentes
            </h2>
            <p>
              Adotamos medidas técnicas e organizacionais compatíveis com o estado da arte para
              proteger seus dados, incluindo: criptografia em trânsito (TLS/HTTPS), armazenamento de
              senhas com algoritmos de hash consagrados, controles de acesso baseados em função,
              autenticação e princípios de menor privilégio, monitoramento contínuo e rate limiting.
            </p>
            <p className="mt-2">
              Nenhum sistema é 100% inviolável. Em caso de incidente de segurança que possa
              acarretar risco ou dano relevante aos titulares, comunicaremos você e a Autoridade
              Nacional de Proteção de Dados (ANPD) em prazo razoável, conforme o art. 48 da LGPD.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              12. Retenção e eliminação
            </h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Áudio bruto:</strong> não retido após o processamento em tempo real.
              </li>
              <li>
                <strong>Dados de conta, transcrições e resumos:</strong> mantidos enquanto sua conta
                estiver ativa.
              </li>
              <li>
                <strong>Após a exclusão da conta:</strong> os dados pessoais e as transcrições
                associadas são removidos em até 30 dias, ressalvadas as hipóteses de guarda
                obrigatória.
              </li>
              <li>
                <strong>Logs de acesso à aplicação:</strong> mantidos por no mínimo 6 meses, em
                cumprimento ao art. 15 do Marco Civil da Internet.
              </li>
              <li>
                <strong>Dados fiscais e contábeis:</strong> mantidos pelos prazos legais aplicáveis.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              13. Crianças e adolescentes
            </h2>
            <p>
              O Scriba não é direcionado a menores de 16 anos. Adolescentes de 16 e 17 anos podem
              utilizar o serviço com assistência dos responsáveis legais. Caso identifiquemos
              tratamento de dados de menores de 12 anos sem consentimento específico de pelo menos
              um dos pais ou responsáveis, procederemos à exclusão imediata dos dados.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              14. Alterações nesta política
            </h2>
            <p>
              Podemos atualizar esta Política de Privacidade periodicamente. Em caso de mudanças
              relevantes, notificaremos por e-mail ou banner no aplicativo com pelo menos 15
              (quinze) dias de antecedência. O uso continuado após a vigência das alterações implica
              ciência das novas condições.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">15. Contato</h2>
            <p>
              Dúvidas sobre esta política, sobre o tratamento dos seus dados ou para exercer seus
              direitos:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-scriba-blue underline-offset-2 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-scriba-hairline-soft pt-6 text-xs text-scriba-ink-mute">
          <Link href="/terms" className="text-scriba-blue">
            Termos de Uso
          </Link>{" "}
          · Scriba © {new Date().getFullYear()}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
