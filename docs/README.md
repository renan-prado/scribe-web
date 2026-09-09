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
| Por que subir a versão antes de dar push? | [`versionamento.md`](./versionamento.md) |
| O que falta configurar nos painéis? | [`checklist-ambiente-dev.md`](./checklist-ambiente-dev.md) |
| Quais são as regras do programa de parceiros? | [`parceiros.md`](./parceiros.md) |
| Quanto se ganha indicando um amigo, e por que esses números? | [`indicacao.md`](./indicacao.md) |
| Como o painel sabe quanto ganhamos, gastamos e devemos? | [`financeiro.md`](./financeiro.md) |
| Por que o estudo entrega pouco, e o que fazer? | [`estudo-v2.md`](./estudo-v2.md) |
| Por que a transcrição erra, e o que já foi tentado? | [`transcricao.md`](./transcricao.md) |
| Qual plano libera qual funcionalidade? | [`estudo-v2.md` §8](./estudo-v2.md) e `lib/entitlements/features.ts` |
| Como o app fala com a shell React Native? | [`react-native-bridge.md`](./react-native-bridge.md) |
| O que a Apple exige para aprovar o app na loja? | [`app-store-ios.md`](./app-store-ios.md) |

## Operação

- **[`ambientes.md`](./ambientes.md)** — os dois conjuntos de recursos
  (Supabase, Stripe, URL), o `with-env`, e por que `.env.local` é proibido.
- **[`checklist-ambiente-dev.md`](./checklist-ambiente-dev.md)** — o trabalho
  manual em painéis externos (GoDaddy, Google Cloud, Supabase, Vercel) que não
  dá para automatizar do repositório.
- **[`versionamento.md`](./versionamento.md)** — por que `npm run release` roda
  antes de todo push: a versão do `package.json` é carimbada em cada chamada de
  LLM e é o eixo da tabela "Por versão" do `/admin/usage`. Sem o bump, a
  comparação entre deploys deixa de existir sem nenhum erro na tela. Traz o
  fluxo, a regra do degrau e como ler a tabela. **Status: implementado.**
- **[`stripe-setup.md`](./stripe-setup.md)** — ligar a cobrança do zero:
  objetos a criar no Stripe, as variáveis, e as armadilhas conhecidas.
  Ferramentas: `npm run stripe:doctor` e `npm run stripe:listen`.

## Produto e negócio

- **[`parceiros.md`](./parceiros.md)** — o programa de divulgadores. A primeira
  parte pode ser enviada ao parceiro como está; a seção "Pendências" é interna.
  **Status: implementado.**
- **[`parceiros-plano.md`](./parceiros-plano.md)** — o plano técnico do mesmo
  programa e o que ficou de fora. Fases 0 a 7 entregues.
- **[`indicacao.md`](./indicacao.md)** — o programa ABERTO de indicação: quanto
  se ganha por cadastro e por assinatura, a régua que diz se um valor de bônus
  é financeiramente seguro (e por que 50 e não 150), e por que o convidado não
  ganha nada — é o que mantém o link do parceiro como a melhor oferta da casa.
  Traz também as moedas por cadastro que o parceiro passou a receber.
  **Status: implementado.**
- **[`transcricao.md`](./transcricao.md)** — por que a transcrição errava em
  igreja com eco, o que foi medido para corrigir (modelo, prompt, limiares) e o
  que foi tentado e NÃO funcionou (limpar o áudio, revisar com LLM, modelos de
  áudio-chat). Leitura obrigatória antes de mexer em `/api/transcribe`,
  `lib/vocabulario.ts`, `lib/transcription/*` ou `lib/recorder.ts`.
- **[`financeiro.md`](./financeiro.md)** — o desenho do `/admin/financeiro`: o
  que já é medido e por isso NÃO se digita, o modelo de dados das cinco tabelas,
  a separação entre competência e caixa, o modelo de projeção com crescimento e
  churn, e quais indicadores valem a pena (e quais ficaram de fora, com o
  motivo). **Status: implementado.**
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
- **[`app-store-ios.md`](./app-store-ios.md)** — os quatro portões da App Store
  (IAP, minimum functionality, Sign in with Apple, exclusão de conta), o que
  cada um custa e uma rota sugerida. O irmão de negócio do documento acima: lá
  está COMO a shell funciona, aqui está o que a Apple cobra para deixá-la
  entrar. **Status: nada implementado — é documento de decisão.**

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
