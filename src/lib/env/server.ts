import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente do SERVIDOR. Guardam a chave da OpenAI, a
 * service-role do Supabase, a chave secreta do Stripe e o CRON_SECRET.
 *
 * O `server-only` acima não é decoração. Sem ele, um import distraído a
 * partir de um componente `"use client"` compilava: o Next não inlina env sem
 * `NEXT_PUBLIC_` no bundle do navegador, então o `safeParse` abaixo falhava em
 * tempo de execução, no cliente, derrubando o componente e imprimindo no
 * console os NOMES de todas as variáveis que faltaram. Com o guard, o mesmo
 * import vira erro de BUILD, na máquina de quem escreveu, com a mensagem
 * certa. A regra já estava no AGENTS.md; agora é o compilador que a cobra.
 */

const schema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  /**
   * O transcritor. `gpt-transcribe` e NÃO o `gpt-4o-mini-transcribe` que era o
   * padrão: medido contra um sermão real gravado num salão com eco e microfone
   * distante, com transcrição de referência feita à mão, o mini fecha 27% de
   * WER e o gpt-transcribe 12%. A distância aumenta com a acústica, sob
   * reverberação forte o mini vai a 70% e o gpt-transcribe fica em 16%.
   *
   * Não existe degrau acima deste. `gpt-4o-transcribe` perde para ele em TODOS
   * os cenários medidos (16% no limpo, 37% com reverb), então a escalada de
   * modelo que existia aqui foi removida em vez de repontada, ver
   * `docs/transcricao.md`.
   */
  OPENAI_TRANSCRIBE_MODEL: z.string().default("gpt-transcribe"),
  /** A busca por sentido no painel da Bíblia (`server/biblo/bible-search.ts`).
   * Já existia, órfã, de um pipeline removido antes desta feature — reusada
   * em vez de nascer uma variável nova para o mesmo tipo de chamada. */
  OPENAI_BIBLE_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_INSIGHTS_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_ECHO_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_FINAL_SUMMARY_MODEL: z.string().default("gpt-4o"),
  /**
   * O Biblo, a conversa dentro da sessão.
   *
   * **`gpt-5-mini` com `reasoningEffort: "low"`**, e este arquivo já defendeu
   * o contrário: era `gpt-4.1-mini`, escolhido por latência e por custo, com
   * a família de raciocínio descartada em duas linhas. O que derrubou aquela
   * escolha não foi a conta, foi o PRODUTO.
   *
   * Um modelo sem raciocínio responde bem o que é recuperação ("quem foi
   * Paulo?", "onde ficava Nínive?") e responde raso tudo o que exige um passo
   * de pensamento: por que o texto diz isso, o que muda se a leitura for
   * outra, como isso encosta num autor de fora. São justamente as perguntas de
   * quem já passou da primeira semana no app, e a conversa inteira existe para
   * elas. Nenhuma formulação de prompt tira profundidade de um modelo que não
   * a tem, é a mesma lição que o estudo já pagou com o `gpt-4o` (ver "Nenhum
   * default é `gpt-4o`" no `src/lib/AGENTS.md`).
   *
   * **Por que `gpt-5-mini` e não `gpt-5.4-mini`.** A conta, com a saída maior
   * que a profundidade exige (~450 tokens, raciocínio incluído):
   *
   * | modelo | custo/mensagem | margem a 2 moedas |
   * |---|---|---|
   * | `gpt-4.1-mini` (antes) | ~R$ 0,005 | ~87% |
   * | **`gpt-5-mini`** | ~R$ 0,007 | **~83%** |
   * | `gpt-5.4-mini` | ~R$ 0,016 | ~55% |
   *
   * O 5.4-mini escreve melhor e é mais novo, mas cobra 4,5 por milhão de saída
   * contra 2,0 do 5-mini, e saída é onde mora 85% da conta de um chat. Cortar
   * a margem do Biblo pela metade é uma decisão de PREÇO, e o preço de
   * `bibloMessage` foi fixado para cair, não para subir. Fica registrado como
   * o degrau seguinte, se um dia a profundidade ainda parecer curta.
   *
   * **`reasoningEffort: "low"` não é economia, é a calibragem certa.** Token
   * de raciocínio é cobrado como saída, e uma pergunta de conversa não precisa
   * de um plano interno de mil tokens para ser bem respondida. `low` é o que
   * mantém a resposta na casa dos segundos, que é a outra metade do que este
   * comentário defendia antes: sem streaming no produto, a resposta aparece
   * inteira de uma vez, e uma conversa que leva 9s por mensagem não é uma
   * conversa. Ver `BIBLO_REASONING_EFFORT` em `biblo/answer.ts`.
   *
   * **O teto de saída subiu junto, e era obrigatório.** Na família de
   * raciocínio o `max_completion_tokens` inclui os tokens de raciocínio, então
   * manter 700 seria deixar o JSON ser cortado no meio pelo próprio
   * pensamento do modelo. Ver `BIBLO_ANSWER_MAX_TOKENS`.
   *
   * O cache automático da OpenAI cobra o prefixo estável (instruções + resumo)
   * a 10% do preço nesta família, contra 25% na 4.1: a ordem das mensagens em
   * `generateBibloAnswer` ficou mais valiosa, não menos.
   *
   * ⚠️ Trocar por um modelo FORA de `lib/llm/pricing.ts` faz o painel medir
   * zero e toda margem do Biblo sair inflada. Confira a tabela antes do deploy.
   */
  OPENAI_BIBLO_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_REREADS_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_REMINDERS_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_FORMAT_MODEL: z.string().default("gpt-4o-mini"),
  /**
   * Separa o título de um vídeo do YouTube em pregação / pregador / igreja.
   *
   * `mini` e não um modelo grande porque a tarefa é EXTRAÇÃO, não julgamento:
   * tudo que a resposta precisa conter já está na linha de entrada, e o prompt
   * traz cinco exemplos resolvidos. O que o modelo faz aqui é reconhecer que
   * um `I` entre espaços virou separador, e para isso um mini basta.
   */
  OPENAI_YOUTUBE_METADATA_MODEL: z.string().default("gpt-4o-mini"),
  /** Auditoria do alerta de alucinação. Julga se um card se sustenta na
   * transcrição, evento raro e de alto impacto, então vale o modelo bom. */
  OPENAI_HALLUCINATION_MODEL: z.string().default("gpt-4o"),
  /**
   * O analista financeiro do /admin. Roda no máximo uma vez por dia por tela,
   * disparado por um admin, sobre um briefing de números já agregados,
   * volume ínfimo, e a tarefa é aritmética cruzada, não redação. É o lugar do
   * modelo caro: um insight errado sobre margem custa mais que a chamada.
   */
  OPENAI_ADMIN_INSIGHTS_MODEL: z.string().default("gpt-5.1"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  /* ---- Stripe (billing) ----------------------------------------------
   * Deliberadamente OPCIONAIS: o app precisa subir num ambiente sem Stripe
   * configurado (dev local, preview, primeiro deploy). Quem consome estas
   * variáveis é `lib/billing/stripe.ts`, que devolve `null` quando faltam,
   * e as rotas /api/billing/* respondem 503 `billing_unavailable` em vez de
   * derrubar o processo inteiro no import.
   *
   * NENHUM valor de preço vive aqui: o preço real mora no Price object do
   * Stripe. O que guardamos é só o ID, e é dele que o webhook deriva quantas
   * moedas creditar (ver lib/billing/catalog.ts). */
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_PESSOAL: z.string().min(1).optional(),
  STRIPE_PRICE_ESTUDIOSO: z.string().min(1).optional(),
  STRIPE_PRICE_TOPUP_500: z.string().min(1).optional(),
  /** Base absoluta para as URLs de retorno do Checkout. Em produção é
   * https://scriba.cc; na Vercel cai no VERCEL_URL; local, no localhost. */
  APP_URL: z.string().url().optional(),
  /**
   * Chave da Supadata, o provedor de legendas do modo YouTube.
   *
   * **OPCIONAL pelo mesmo motivo das do Stripe:** o app tem de subir num
   * ambiente sem ela (dev local recém-clonado, preview, primeiro deploy). Quem
   * a consome é `lib/youtube/supadata.ts`, que devolve `provider_unavailable`
   * e faz `/api/youtube/import` responder 503, em vez de derrubar o processo
   * inteiro no import por causa de um modo que a maioria das sessões não usa.
   *
   * Ela existe porque extrair legenda do YouTube A PARTIR DE UM SERVIDOR não
   * funciona mais: desde o fim de 2024 o `timedtext` pune reputação de IP de
   * datacenter, e o mesmo código que roda na máquina de quem escreveu devolve
   * 429 e página de bot-check na Vercel. As alternativas eram proxy residencial
   * próprio (infra + manutenção do parser a cada mudança de formato) ou um
   * provedor hospedado. Ver `lib/youtube/supadata.ts`.
   */
  SUPADATA_API_KEY: z.string().min(1).optional(),
  /** Guarda de /api/billing/sweep (varredura periódica de pagamentos). Na
   * Vercel, basta a env var existir: o cron envia
   * `Authorization: Bearer <CRON_SECRET>` sozinho. Sem ela, a rota responde
   * 503 e a varredura simplesmente não existe. */
  CRON_SECRET: z.string().min(16).optional(),
});

const parsed = schema.safeParse({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_TRANSCRIBE_MODEL: process.env.OPENAI_TRANSCRIBE_MODEL,
  OPENAI_BIBLE_MODEL: process.env.OPENAI_BIBLE_MODEL,
  OPENAI_INSIGHTS_MODEL: process.env.OPENAI_INSIGHTS_MODEL,
  OPENAI_ECHO_MODEL: process.env.OPENAI_ECHO_MODEL,
  OPENAI_FINAL_SUMMARY_MODEL: process.env.OPENAI_FINAL_SUMMARY_MODEL,
  OPENAI_REREADS_MODEL: process.env.OPENAI_REREADS_MODEL,
  OPENAI_REMINDERS_MODEL: process.env.OPENAI_REMINDERS_MODEL,
  OPENAI_FORMAT_MODEL: process.env.OPENAI_FORMAT_MODEL,
  OPENAI_YOUTUBE_METADATA_MODEL: process.env.OPENAI_YOUTUBE_METADATA_MODEL,
  OPENAI_HALLUCINATION_MODEL: process.env.OPENAI_HALLUCINATION_MODEL,
  OPENAI_ADMIN_INSIGHTS_MODEL: process.env.OPENAI_ADMIN_INSIGHTS_MODEL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_PESSOAL: process.env.STRIPE_PRICE_PESSOAL,
  STRIPE_PRICE_ESTUDIOSO: process.env.STRIPE_PRICE_ESTUDIOSO,
  STRIPE_PRICE_TOPUP_500: process.env.STRIPE_PRICE_TOPUP_500,
  APP_URL:
    process.env.APP_URL ||
    (process.env.VERCEL_ENV === "production"
      ? "https://scriba.cc"
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"),
  CRON_SECRET: process.env.CRON_SECRET,
  // `|| undefined` e não o valor cru: esta variável nasce VAZIA no `.env.dev`
  // de quem clona o repositório e no painel da Vercel de quem ainda não criou
  // conta no provedor. Para o Zod, `""` é um valor PRESENTE que falha o
  // `.min(1)`, `.optional()` só perdoa `undefined`, e o efeito é o pior
  // possível: o boot inteiro morre com "Too small" por causa de um modo que a
  // maioria das sessões não usa. Linha em branco significa "não configurado",
  // que é exatamente o caso que o `.optional()` existe para cobrir.
  SUPADATA_API_KEY: process.env.SUPADATA_API_KEY || undefined,
});

if (!parsed.success) {
  const details = JSON.stringify(parsed.error.flatten().fieldErrors, null, 2);
  throw new Error(`Invalid server environment variables:\n${details}`);
}

export const serverEnv = parsed.data;
