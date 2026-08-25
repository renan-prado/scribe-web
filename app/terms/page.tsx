import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos e condições de uso do Scriba.",
};

const LAST_UPDATED = "25 de agosto de 2025";
const CONTACT_EMAIL = "contato@scriba.cc";

export default function TermsPage() {
  return (
    <main
      className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6"
      style={{ fontFamily: "var(--font-poppins)", color: "#33414F" }}
    >
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
        style={{ color: "#4FA8F0" }}
      >
        ← Voltar ao início
      </Link>

      <h1 className="mb-2 text-3xl font-semibold tracking-tight" style={{ color: "#2B3947" }}>
        Termos de Uso
      </h1>
      <p className="mb-10 text-sm" style={{ color: "#9BA6B3" }}>
        Última atualização: {LAST_UPDATED}
      </p>

      <div className="space-y-8 text-sm leading-relaxed" style={{ color: "#4A5A6A" }}>
        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            1. Aceitação dos termos
          </h2>
          <p>
            Ao criar uma conta ou usar o Scriba, você concorda com estes Termos de Uso. Se não
            concordar, não utilize o serviço.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            2. O serviço
          </h2>
          <p>
            O Scriba oferece transcrição automática de sermões e pregações, enriquecimento com
            citações bíblicas e geração de resumos via inteligência artificial. O serviço é
            fornecido "como está" e pode ser alterado ou encerrado a qualquer momento, com aviso
            prévio razoável.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            3. Conta e responsabilidades
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Você é responsável por manter suas credenciais de acesso em segurança.</li>
            <li>
              Não é permitido compartilhar sua conta com terceiros ou usar o serviço em nome de
              terceiros sem consentimento.
            </li>
            <li>Você é responsável por todo o conteúdo gravado e transcrito em sua conta.</li>
            <li>
              É proibido usar o Scriba para gravar conteúdo ilegal, difamatório, discriminatório ou
              que viole direitos de terceiros.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            4. Conteúdo do usuário
          </h2>
          <p>
            Você mantém todos os direitos sobre o conteúdo que grava e transcreve. Ao usar o Scriba,
            você nos concede uma licença limitada, não exclusiva e não transferível para processar
            esse conteúdo com o único propósito de fornecer o serviço.
          </p>
          <p className="mt-2">
            Certifique-se de ter o consentimento das pessoas cujas vozes são gravadas antes de
            utilizar o Scriba.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            5. Uso aceitável
          </h2>
          <p>É proibido:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Tentar acessar sistemas ou dados de outros usuários.</li>
            <li>
              Fazer engenharia reversa, descompilar ou tentar extrair o código-fonte do Scriba.
            </li>
            <li>Usar o serviço para fins comerciais de revenda sem autorização prévia.</li>
            <li>Sobrecarregar a infraestrutura do Scriba deliberadamente.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            6. Limitação de responsabilidade
          </h2>
          <p>
            O Scriba usa inteligência artificial para transcrição e enriquecimento. As transcrições
            e resumos gerados podem conter erros — não nos responsabilizamos por decisões tomadas
            com base no conteúdo gerado automaticamente. Revise sempre o conteúdo antes de publicar
            ou distribuir.
          </p>
          <p className="mt-2">
            Não garantimos disponibilidade ininterrupta do serviço. Em nenhuma hipótese nossa
            responsabilidade excederá o valor pago pelo usuário nos últimos 3 meses.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            7. Planos e pagamentos
          </h2>
          <p>
            Planos pagos são cobrados conforme descrito na página de preços. Cancelamentos entram em
            vigor no fim do período já pago — não há reembolso proporcional, exceto quando exigido
            por lei.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            8. Encerramento de conta
          </h2>
          <p>
            Você pode encerrar sua conta a qualquer momento nas configurações do perfil. Podemos
            suspender ou encerrar contas que violem estes termos, com ou sem aviso prévio,
            dependendo da gravidade da infração.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            9. Propriedade intelectual
          </h2>
          <p>
            O Scriba, sua marca, design e código são de propriedade de seus criadores. Estes Termos
            não concedem a você qualquer direito sobre a propriedade intelectual do Scriba além do
            necessário para usar o serviço.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            10. Alterações nos termos
          </h2>
          <p>
            Podemos atualizar estes Termos a qualquer momento. Notificaremos usuários ativos por
            e-mail ou banner com pelo menos 15 dias de antecedência para mudanças relevantes. O uso
            continuado do serviço após a vigência das alterações implica aceitação.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            11. Legislação aplicável
          </h2>
          <p>
            Estes Termos são regidos pelas leis brasileiras, incluindo a Lei Geral de Proteção de
            Dados (LGPD — Lei nº 13.709/2018). Fica eleito o foro da comarca de São Paulo/SP para
            dirimir quaisquer controvérsias.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            12. Contato
          </h2>
          <p>
            Dúvidas sobre estes termos? Fale conosco:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#4FA8F0" }}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>

      <div
        className="mt-12 border-t pt-6 text-xs"
        style={{ borderColor: "#EEF4FA", color: "#9BA6B3" }}
      >
        <Link href="/privacy" style={{ color: "#4FA8F0" }}>
          Política de Privacidade
        </Link>{" "}
        · Scriba © {new Date().getFullYear()}
      </div>
    </main>
  );
}
