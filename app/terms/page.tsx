import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter, LandingHeader } from "@/shared/components/LandingChrome";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos e condições de uso do Scriba.",
};

const LAST_UPDATED = "28 de agosto de 2026";
const CONTACT_EMAIL = "contato@scriba.cc";

export default function TermsPage() {
  return (
    <div className="w-full overflow-x-hidden bg-white text-scriba-ink-strong antialiased">
      <LandingHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-16 text-scriba-ink-strong sm:px-6">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-scriba-ink-strong">
          Termos de Uso
        </h1>
        <p className="mb-10 text-sm text-scriba-ink-mute">Última atualização: {LAST_UPDATED}</p>

        <div className="space-y-8 text-sm leading-relaxed text-scriba-ink">
          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              1. Aceitação dos termos
            </h2>
            <p>
              Ao criar uma conta, acessar ou utilizar o Scriba ("Serviço"), você declara ter lido,
              compreendido e concordado integralmente com estes Termos de Uso, com a{" "}
              <Link href="/privacy" className="text-scriba-blue underline-offset-2 hover:underline">
                Política de Privacidade
              </Link>{" "}
              e com quaisquer políticas complementares publicadas no serviço. O aceite eletrônico
              (clique em "Criar conta", "Entrar" ou uso continuado) tem a mesma validade jurídica de
              uma assinatura física, nos termos da Medida Provisória nº 2.200-2/2001. Se você não
              concorda com qualquer disposição, não utilize o Scriba.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              2. Elegibilidade e capacidade
            </h2>
            <p>
              O Scriba é destinado a maiores de 18 anos. Menores entre 16 e 17 anos podem utilizar o
              serviço mediante assistência dos responsáveis legais e com consentimento específico
              para o tratamento de dados pessoais (art. 14 da LGPD). Ao utilizar o Scriba, você
              declara ter plena capacidade civil ou a devida representação legal.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">3. O serviço</h2>
            <p>
              O Scriba oferece transcrição automática de sermões, palestras e conteúdos religiosos,
              enriquecimento com citações bíblicas e geração de resumos e materiais derivados por
              meio de inteligência artificial. O serviço é fornecido "no estado em que se encontra"
              ("as is") e "conforme disponibilidade" ("as available"), podendo ser modificado,
              suspenso ou encerrado a qualquer tempo, com aviso prévio razoável sempre que possível.
            </p>
            <p className="mt-2">
              Recursos identificados como "beta", "experimental" ou "em teste" podem apresentar
              instabilidade, limitações e ser descontinuados sem aviso prévio.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              4. Conta e responsabilidades do usuário
            </h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Você é responsável pela veracidade das informações cadastrais e por mantê-las
                atualizadas.
              </li>
              <li>
                Você é responsável por manter a confidencialidade de suas credenciais e por toda
                atividade realizada em sua conta, ainda que não autorizada por você.
              </li>
              <li>
                É proibido compartilhar sua conta ou utilizar o serviço em nome de terceiros sem
                autorização expressa.
              </li>
              <li>
                Você é integralmente responsável por todo conteúdo gravado, transcrito, editado ou
                distribuído por meio da sua conta.
              </li>
              <li>
                Notifique-nos imediatamente em caso de uso não autorizado da sua conta pelo e-mail{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-scriba-blue underline-offset-2 hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              5. Conteúdo do usuário e consentimento de terceiros
            </h2>
            <p>
              Você mantém todos os direitos sobre o conteúdo que grava e transcreve ("Conteúdo do
              Usuário"). Ao usar o Scriba, você nos concede uma licença mundial, limitada, não
              exclusiva, não transferível e revogável — exclusivamente para processar, armazenar,
              transmitir e exibir o Conteúdo do Usuário com o único propósito de fornecer, manter e
              melhorar o Serviço.
            </p>
            <p className="mt-2">
              Você declara e garante que: (i) possui todos os direitos, licenças e autorizações
              necessários para gravar e utilizar o conteúdo; (ii) obteve o consentimento livre,
              informado e inequívoco das pessoas cujas vozes, imagens ou dados pessoais são
              capturados, inclusive para o processamento por meio de sistemas de inteligência
              artificial; (iii) o conteúdo não viola direitos autorais, marcas, honra, imagem,
              privacidade ou qualquer outro direito de terceiros; (iv) respeita as normas litúrgicas
              e institucionais da comunidade religiosa em que o conteúdo é capturado.
            </p>
            <p className="mt-2">
              A responsabilidade pela obtenção e comprovação dos consentimentos é exclusivamente
              sua. O Scriba não verifica previamente a legitimidade das autorizações.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              6. Uso aceitável
            </h2>
            <p>É expressamente proibido utilizar o Scriba para:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                Gravar ou distribuir conteúdo ilegal, difamatório, discriminatório, obsceno, que
                incite violência ou viole direitos fundamentais.
              </li>
              <li>
                Gravar pessoas sem o devido consentimento ou em ambientes onde há expectativa
                razoável de privacidade.
              </li>
              <li>
                Reproduzir integralmente obras protegidas por direitos autorais sem autorização,
                incluindo pregações, palestras e materiais didáticos de terceiros.
              </li>
              <li>Tentar acessar contas, dados ou sistemas de outros usuários.</li>
              <li>
                Fazer engenharia reversa, descompilar, desmontar ou tentar extrair o código-fonte,
                modelos ou prompts do Scriba.
              </li>
              <li>
                Utilizar robôs, scrapers, crawlers ou qualquer meio automatizado que sobrecarregue
                ou contorne limites do serviço.
              </li>
              <li>
                Revender, sublicenciar ou explorar comercialmente o Scriba sem autorização prévia
                por escrito.
              </li>
              <li>
                Utilizar as saídas de IA para treinar modelos concorrentes ou reconstruir bases de
                dados equivalentes.
              </li>
              <li>
                Contornar mecanismos de segurança, controle de acesso, cotas ou verificação de
                identidade.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              7. Inteligência artificial: isenção e uso responsável
            </h2>
            <p>
              As transcrições, resumos, referências bíblicas, contextos e demais materiais gerados
              pelo Scriba são produzidos com apoio de modelos de inteligência artificial (incluindo,
              mas não se limitando à OpenAI). Esses modelos podem produzir resultados imprecisos,
              incompletos, tendenciosos, defasados ou inventados ("alucinações"), inclusive em
              citações bíblicas, doutrinárias e teológicas.
            </p>
            <p className="mt-2">
              O Scriba <strong>não é</strong> uma fonte doutrinária oficial, não substitui
              aconselhamento pastoral, teológico, jurídico, médico ou profissional de qualquer
              natureza, e não deve ser utilizado como única base para decisões pessoais, litúrgicas,
              institucionais ou legais. Toda saída da IA deve ser revisada criticamente pelo usuário
              antes de publicação, ensino ou distribuição.
            </p>
            <p className="mt-2">
              Você é o único responsável pelas decisões e pelo conteúdo que compartilha com base em
              materiais gerados pelo Scriba.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              8. Serviços de terceiros
            </h2>
            <p>
              O Scriba integra-se a provedores terceiros necessários para o funcionamento do
              serviço, incluindo OpenAI (processamento de linguagem natural), Supabase
              (armazenamento e autenticação) e provedores de infraestrutura em nuvem. Ao utilizar o
              Scriba, você reconhece e aceita as políticas desses provedores. O Scriba não responde
              por atos, omissões, indisponibilidades, incidentes ou alterações unilaterais nos
              serviços de terceiros.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              9. Limitação de responsabilidade
            </h2>
            <p>
              Na máxima extensão permitida pela legislação aplicável, o Scriba, seus sócios,
              colaboradores e parceiros <strong>não se responsabilizam</strong> por danos indiretos,
              incidentais, especiais, punitivos ou emergentes, incluindo lucros cessantes, perda de
              dados, perda de oportunidades, danos morais ou à reputação, decorrentes ou
              relacionados ao uso ou à impossibilidade de uso do serviço, ainda que avisados da
              possibilidade de tais danos.
            </p>
            <p className="mt-2">
              Em qualquer hipótese, e para todos os fins, a responsabilidade total agregada do
              Scriba perante o usuário fica limitada ao maior valor entre: (i) o total efetivamente
              pago pelo usuário nos 3 (três) meses anteriores ao evento que originou a
              responsabilidade; ou (ii) R$ 100,00 (cem reais).
            </p>
            <p className="mt-2">
              Não garantimos que o serviço será ininterrupto, livre de erros, seguro contra
              intrusões ou compatível com todos os dispositivos e navegadores. Interrupções para
              manutenção, atualização ou motivos técnicos podem ocorrer sem aviso prévio.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">10. Indenização</h2>
            <p>
              Você concorda em defender, indenizar e isentar o Scriba, seus sócios, funcionários e
              parceiros de quaisquer reivindicações, danos, prejuízos, multas, custos e despesas
              (incluindo honorários advocatícios razoáveis) decorrentes de: (i) uso indevido do
              serviço; (ii) violação destes Termos ou da legislação aplicável; (iii) violação de
              direitos de terceiros, especialmente direitos autorais, de imagem, de voz e de
              proteção de dados; (iv) conteúdo gravado, transcrito ou distribuído por meio da sua
              conta.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              11. Planos, créditos e pagamentos
            </h2>
            <p>
              O uso do Scriba pode envolver planos gratuitos e pagos, com concessão de créditos
              conforme descrito na página de preços. Assinaturas são renovadas automaticamente ao
              final de cada ciclo, salvo cancelamento prévio pelo próprio usuário.
            </p>
            <p className="mt-2">
              Cancelamentos entram em vigor no fim do período já pago — não há reembolso
              proporcional pelo período restante, exceto quando exigido pelo Código de Defesa do
              Consumidor (Lei nº 8.078/1990), em especial pelo direito de arrependimento no prazo de
              7 (sete) dias para contratações à distância.
            </p>
            <p className="mt-2">
              Créditos não utilizados podem expirar conforme regras específicas do plano. Alterações
              de preço são comunicadas com pelo menos 30 dias de antecedência para usuários ativos.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              12. Encerramento e suspensão
            </h2>
            <p>
              Você pode encerrar sua conta a qualquer momento pelas configurações do perfil ou
              solicitando por e-mail. Podemos suspender ou encerrar contas — total ou parcialmente,
              com ou sem aviso prévio conforme a gravidade — em caso de: (i) violação destes Termos;
              (ii) risco à segurança da plataforma ou de outros usuários; (iii) determinação legal
              ou judicial; (iv) inatividade prolongada; (v) inadimplência.
            </p>
            <p className="mt-2">
              Encerramentos por violação grave podem ocorrer imediatamente e sem reembolso. O
              tratamento dos dados após o encerramento segue a Política de Privacidade.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              13. Propriedade intelectual
            </h2>
            <p>
              O Scriba — incluindo marca, logotipos, identidade visual, código-fonte, banco de
              dados, prompts, arquitetura, textos, layouts e materiais originais — é de titularidade
              exclusiva de seus criadores e está protegido pela Lei nº 9.610/1998 (Direitos
              Autorais), Lei nº 9.279/1996 (Propriedade Industrial) e demais normas aplicáveis.
              Estes Termos não transferem nenhum direito de propriedade intelectual ao usuário, além
              da licença estritamente necessária para uso pessoal do serviço.
            </p>
            <p className="mt-2">
              Se você acredita que conteúdo disponibilizado no Scriba viola seus direitos autorais,
              envie notificação circunstanciada para{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-scriba-blue underline-offset-2 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              , com identificação da obra, prova de titularidade e localização do conteúdo infrator.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              14. Alterações nos termos
            </h2>
            <p>
              Podemos atualizar estes Termos a qualquer momento. Alterações relevantes serão
              comunicadas por e-mail ou banner no aplicativo com pelo menos 15 (quinze) dias de
              antecedência. Alterações não substanciais (correções, esclarecimentos, ajustes
              formais) entram em vigor imediatamente após a publicação. O uso continuado após a
              vigência das alterações implica aceitação. Caso não concorde, você pode encerrar sua
              conta antes da entrada em vigor.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              15. Legislação aplicável e foro
            </h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil, com destaque
              para a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), o Marco Civil da Internet
              (Lei nº 12.965/2014) e o Código de Defesa do Consumidor (Lei nº 8.078/1990). Fica
              eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias, com
              renúncia expressa a qualquer outro, por mais privilegiado que seja, ressalvado o
              direito do consumidor de acionar o foro de seu domicílio.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">
              16. Disposições gerais
            </h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Se qualquer disposição destes Termos for considerada inválida ou inexequível, as
                demais permanecerão em pleno vigor.
              </li>
              <li>
                A tolerância quanto a qualquer descumprimento não implica renúncia, novação ou
                alteração das obrigações previstas.
              </li>
              <li>
                Você não pode ceder ou transferir estes Termos sem nossa autorização prévia por
                escrito. Podemos ceder livremente em caso de reorganização societária.
              </li>
              <li>
                Sobrevivem ao encerramento as cláusulas de propriedade intelectual, limitação de
                responsabilidade, indenização, legislação aplicável e foro.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-scriba-ink-strong">17. Contato</h2>
            <p>
              Dúvidas sobre estes Termos? Fale conosco:{" "}
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
          <Link href="/privacy" className="text-scriba-blue">
            Política de Privacidade
          </Link>{" "}
          · Scriba © {new Date().getFullYear()}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
