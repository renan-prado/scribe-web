import { PLAN_ORDER, PLANS, TOPUP } from "@/lib/billing/plans";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { FAQ_ITEMS } from "@/shared/content/landing-faq";

/**
 * Dados estruturados (schema.org) da landing page.
 *
 * É o que permite ao Google mostrar preço e avaliação no resultado de busca em
 * vez de só título e descrição — e é o formato que os buscadores de IA leem
 * primeiro para decidir o que o produto faz.
 *
 * Os preços saem de `lib/billing/plans.ts`, o MESMO catálogo dos cards de
 * `/#planos`. Vale aqui a regra que já vale para a LP: a página não tem números
 * próprios. Um preço avulso neste arquivo seria pior que na tela — ficaria
 * invisível para quem revisa a LP e continuaria sendo exibido no Google.
 */

/** Centavos → "19.90". Schema.org exige ponto decimal, independente do locale. */
function priceFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

const OFFERS = [
  ...PLAN_ORDER.map((key) => {
    const plan = PLANS[key];
    return {
      "@type": "Offer",
      name: plan.name,
      description: `${plan.tagline} — ${plan.coins} créditos.`,
      price: priceFromCents(plan.priceCents),
      priceCurrency: "BRL",
      ...(plan.priceCents > 0 && {
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: priceFromCents(plan.priceCents),
          priceCurrency: "BRL",
          billingDuration: 1,
          billingIncrement: 1,
          unitCode: "MON",
        },
      }),
    };
  }),
  {
    "@type": "Offer",
    name: TOPUP.name,
    description: `${TOPUP.coins} créditos avulsos, sem assinatura e sem prazo de validade.`,
    price: priceFromCents(TOPUP.priceCents),
    priceCurrency: "BRL",
  },
];

const GRAPH = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/brand/favicon-light-theme.svg`,
      email: "contato@scriba.cc",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "pt-BR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      // "Web" e não "Android/iOS": o Scriba roda no navegador e se instala como
      // PWA (ver app/manifest.ts). Declarar uma loja que não existe faz o
      // rich result ser recusado.
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      browserRequirements: "Requer um navegador com acesso ao microfone.",
      inLanguage: "pt-BR",
      publisher: { "@id": `${SITE_URL}/#organization` },
      featureList: [
        "Transcrição de sermões ao vivo",
        "Detecção automática de citações bíblicas",
        "Resumo estruturado ao final da pregação",
        "Estudos gerados a partir do sermão",
        "Biblioteca de sermões gravados",
      ],
      offers: OFFERS,
    },
    {
      // As respostas são as MESMAS strings renderizadas na seção "Perguntas
      // frequentes" — ambas leem `FAQ_ITEMS`. O Google compara o dado
      // estruturado com o texto visível, e responder aqui algo que não está
      // na página custa o rich result do site inteiro, não só deste bloco.
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      inLanguage: "pt-BR",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};

export function LandingJsonLd() {
  const json = JSON.stringify(GRAPH);
  // JSON-LD só existe como conteúdo de <script type="application/ld+json">, e o
  // payload é uma constante serializada no servidor — nada aqui vem do usuário.
  // biome-ignore lint/security/noDangerouslySetInnerHtml: ver comentário acima.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
