import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o Scriba coleta, usa e protege seus dados pessoais.",
};

const LAST_UPDATED = "25 de agosto de 2025";
const CONTACT_EMAIL = "contato@scriba.cc";

export default function PrivacyPage() {
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
        Política de Privacidade
      </h1>
      <p className="mb-10 text-sm" style={{ color: "#9BA6B3" }}>
        Última atualização: {LAST_UPDATED}
      </p>

      <div className="prose-scriba space-y-8 text-sm leading-relaxed" style={{ color: "#4A5A6A" }}>
        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            1. Quem somos
          </h2>
          <p>
            O Scriba é um serviço de transcrição e resumo de sermões em tempo real. Nosso objetivo é
            ajudar igrejas e ministérios a registrar e revisar pregações com facilidade.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            2. Dados que coletamos
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Dados de conta:</strong> nome, endereço de e-mail e senha (armazenada de forma
              segura via hash).
            </li>
            <li>
              <strong>Áudio das gravações:</strong> processado em tempo real para transcrição. O
              áudio não é armazenado em nossos servidores após o processamento.
            </li>
            <li>
              <strong>Transcrições e resumos:</strong> vinculados à sua conta para que você possa
              acessá-los posteriormente.
            </li>
            <li>
              <strong>Dados de uso:</strong> páginas visitadas, horários de gravação e informações
              de sessão, usados para melhorar o serviço.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            3. Como usamos seus dados
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Fornecer, manter e melhorar o serviço Scriba.</li>
            <li>Processar as transcrições via provedores de IA (OpenAI).</li>
            <li>
              Enviar comunicações relacionadas à conta (confirmação de e-mail, recuperação de
              senha).
            </li>
            <li>Prevenir fraudes e garantir a segurança da plataforma.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            4. Compartilhamento de dados
          </h2>
          <p>
            Não vendemos seus dados pessoais. Compartilhamos informações apenas com prestadores de
            serviços necessários para o funcionamento do Scriba:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>OpenAI</strong> — para transcrição de áudio e geração de resumos. Os dados são
              processados de acordo com a{" "}
              <a
                href="https://openai.com/policies/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#4FA8F0" }}
              >
                política de privacidade da OpenAI
              </a>
              .
            </li>
            <li>
              <strong>Supabase</strong> — para armazenamento de dados e autenticação.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            5. Seus direitos
          </h2>
          <p>Você tem o direito de:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Acessar os dados que temos sobre você.</li>
            <li>Solicitar a correção de dados incorretos.</li>
            <li>Solicitar a exclusão da sua conta e dados associados.</li>
            <li>Portabilidade dos seus dados de transcrição.</li>
          </ul>
          <p className="mt-3">
            Para exercer qualquer desses direitos, entre em contato:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#4FA8F0" }}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            6. Cookies
          </h2>
          <p>
            O Scriba usa cookies de sessão essenciais para manter você autenticado. Não utilizamos
            cookies de rastreamento ou publicidade de terceiros.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            7. Segurança
          </h2>
          <p>
            Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo
            criptografia em trânsito (HTTPS) e senhas armazenadas com hash seguro. Nenhum sistema é
            100% inviolável; notificaremos você em caso de incidente relevante.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            8. Retenção de dados
          </h2>
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa. Ao solicitar a exclusão da conta,
            removemos seus dados pessoais e transcrições em até 30 dias, exceto quando houver
            obrigação legal de retenção.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            9. Alterações nesta política
          </h2>
          <p>
            Podemos atualizar esta política periodicamente. Em caso de mudanças relevantes,
            notificaremos por e-mail ou banner no aplicativo com pelo menos 15 dias de antecedência.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#2B3947" }}>
            10. Contato
          </h2>
          <p>
            Dúvidas sobre esta política? Fale conosco:{" "}
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
        <Link href="/terms" style={{ color: "#4FA8F0" }}>
          Termos de Uso
        </Link>{" "}
        · Scriba © {new Date().getFullYear()}
      </div>
    </main>
  );
}
