# docs/ — guias longos

Aqui ficam os documentos que se LÊ do começo ao fim: passo a passo de
configuração, regras de negócio, propostas. As regras que um agente precisa
saber ao editar código ficam nos `AGENTS.md` de cada pasta, não aqui.

**Onde procurar cada coisa:**

| Pergunta | Documento |
|---|---|
| Como mexer em código de X? | o `AGENTS.md` da pasta de X — comece pelo da raiz |
| Como ligar o Stripe do zero? | [`stripe-setup.md`](./stripe-setup.md) |
| Como funcionam dev e produção? | [`ambientes.md`](./ambientes.md) |
| O que falta configurar nos painéis? | [`checklist-ambiente-dev.md`](./checklist-ambiente-dev.md) |
| Quais são as regras do programa de parceiros? | [`parceiros.md`](./parceiros.md) |
| Por que o estudo entrega pouco, e o que fazer? | [`estudo-v2.md`](./estudo-v2.md) |
| Qual plano libera qual funcionalidade? | [`estudo-v2.md` §8](./estudo-v2.md) e `lib/entitlements/features.ts` |
| Como o app fala com a shell React Native? | [`react-native-bridge.md`](./react-native-bridge.md) |

## Operação

- **[`ambientes.md`](./ambientes.md)** — os dois conjuntos de recursos
  (Supabase, Stripe, URL), o `with-env`, e por que `.env.local` é proibido.
- **[`checklist-ambiente-dev.md`](./checklist-ambiente-dev.md)** — o trabalho
  manual em painéis externos (GoDaddy, Google Cloud, Supabase, Vercel) que não
  dá para automatizar do repositório.
- **[`stripe-setup.md`](./stripe-setup.md)** — ligar a cobrança do zero:
  objetos a criar no Stripe, as variáveis, e as armadilhas conhecidas.
  Ferramentas: `npm run stripe:doctor` e `npm run stripe:listen`.

## Produto e negócio

- **[`parceiros.md`](./parceiros.md)** — o programa de divulgadores. A primeira
  parte pode ser enviada ao parceiro como está; a seção "Pendências" é interna.
  **Status: implementado.**
- **[`parceiros-plano.md`](./parceiros-plano.md)** — o plano técnico do mesmo
  programa e o que ficou de fora. Fases 0 a 7 entregues.
- **[`melhorias-resumo-sermao.md`](./melhorias-resumo-sermao.md)** — o problema
  de o resumo soar como interpretação da IA em vez de organização do que foi
  dito, e o que fazer a respeito.
- **[`estudo-v2.md`](./estudo-v2.md)** — por que o "Gerar estudo" entrega
  pouco valor hoje (sete causas, todas no código, nenhuma resolvível por
  prompt), o pipeline de cinco etapas que substitui a chamada única, e o
  desenho de entitlements por plano. **Status: implementado, exceto a rotina de
  avaliação da §7 (passo 5 da §9).**

## Integração

- **[`react-native-bridge.md`](./react-native-bridge.md)** — o contrato de
  mensagens `window.ReactNativeWebView.postMessage`. É a única forma real de
  manter a gravação viva com a tela bloqueada ou o app minimizado, porque a
  plataforma web não expõe foreground service. Implementação:
  `src/features/session/lib/nativeBridge.ts`.

## Exploração — NÃO implementado

Os três documentos de RAG descrevem um sistema de base de conhecimento
teológico que **não existe no código**. São propostas e comparações, úteis como
contexto de decisão; não os leia como descrição do que está no ar.

- [`scriba-rag-knowledge-architecture.md`](./scriba-rag-knowledge-architecture.md)
- [`scriba-rag-proposta-claude.md`](./scriba-rag-proposta-claude.md)
- [`scriba-rag-todos-futuros.md`](./scriba-rag-todos-futuros.md)

---

Ao adicionar um documento aqui, acrescente a linha na tabela ou na seção certa.
Um `docs/` sem índice vira um cemitério de arquivos que ninguém sabe se ainda
valem.
