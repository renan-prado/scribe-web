import type { Metadata } from "next";
import { YoutubeUrlForm } from "@/features/session/components/YoutubeUrlForm";

export const metadata: Metadata = { title: "Importar do YouTube" };

/**
 * `/importar`, onde se cola o link de um vídeo.
 *
 * Página própria, e não um passo dentro do diálogo de gravação: escolher COMO
 * capturar e escolher QUAL vídeo são duas perguntas, e o diálogo responde a
 * primeira. Ver o cabeçalho de `YoutubeUrlForm`.
 *
 * Ela não lê nada do servidor, a linha da sessão só nasce quando o formulário
 * é enviado. Fica em `(app)` pelo header, pela nav e pelo saldo de moedas, que
 * o formulário consulta.
 */
export default function ImportarPage() {
  return <YoutubeUrlForm />;
}
