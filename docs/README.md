# docs/: guias longos

Aqui ficam os documentos que se LÊ do começo ao fim: passo a passo de
configuração, regras de negócio, propostas. As regras que um agente precisa
saber ao editar código ficam nos `AGENTS.md` de cada pasta, não aqui.

**Onde procurar cada coisa:**

| Pergunta | Documento |
|---|---|
| Como mexer em código de X? | o `AGENTS.md` da pasta de X, comece pelo da raiz |
| Como ligar o Stripe do zero? | [`stripe-setup.md`](./stripe-setup.md) |
| O que configurar no Supabase para o login por e-mail e senha? | [`auth.md`](./auth.md) |
| Como funcionam dev e produção? | [`ambientes.md`](./ambientes.md) |
| Por que o login sai por `auth.scriba.cc`? | [`ambientes.md` §7](./ambientes.md) |
| Por que subir a versão antes de dar push? | [`versionamento.md`](./versionamento.md) |
| O que falta configurar nos painéis? | [`checklist-ambiente-dev.md`](./checklist-ambiente-dev.md) |
| Quais são as regras do programa de parceiros? | [`parceiros.md`](./parceiros.md) |
| Quanto se ganha indicando um amigo, e por que esses números? | [`indicacao.md`](./indicacao.md) |
| Como o painel sabe quanto ganhamos, gastamos e devemos? | [`financeiro.md`](./financeiro.md) |
| Por que o estudo entrega pouco, e o que fazer? | [`estudo-v2.md`](./estudo-v2.md) |
| O que é o Biblo, o bate-papo dentro do resumo? | [`biblo.md`](./biblo.md) |
| Como o Biblo vai ser construído, e quanto ele custa? | [`biblo-implementacao.md`](./biblo-implementacao.md) |
| Por que o assinante não vê o número de créditos? | [`creditos-na-tela.md`](./creditos-na-tela.md) |
| Por que a transcrição erra, e o que já foi tentado? | [`transcricao.md`](./transcricao.md) |
| Por que importar do YouTube custa 30 e não um preço por minuto? | [`youtube.md`](./youtube.md) |
| Qual plano libera qual funcionalidade? | [`estudo-v2.md` §8](./estudo-v2.md) e `src/lib/entitlements/features.ts` |
| Como a shell React Native sabe que estamos gravando? | [`react-native-bridge.md`](./react-native-bridge.md) |
| O que a Apple exige para aprovar o app na loja? | [`app-store-ios.md`](./app-store-ios.md) |
| O que já foi auditado em segurança? | [`security/`](./security/README.md) |

## Operação

- **[`ambientes.md`](./ambientes.md)**: os dois conjuntos de recursos
  (Supabase, Stripe, URL), o `with-env`, e por que `.env.local` é proibido.
- **[`checklist-ambiente-dev.md`](./checklist-ambiente-dev.md)**, o trabalho
  manual em painéis externos (GoDaddy, Google Cloud, Supabase, Vercel) que não
  dá para automatizar do repositório.
- **[`versionamento.md`](./versionamento.md)**: por que `npm run release` roda
  antes de todo push: a versão do `package.json` é carimbada em cada chamada de
  LLM e é o eixo da tabela "Por versão" do `/admin/custos`. Sem o bump, a
  comparação entre deploys deixa de existir sem nenhum erro na tela. Traz o
  fluxo, a regra do degrau e como ler a tabela. **Status: implementado.**
- **[`auth.md`](./auth.md)**: as duas portas de entrada (Google e e-mail com
  senha) e as três chaves do painel do Supabase sem as quais a segunda não
  funciona: o provedor, as URLs de retorno e os modelos de e-mail (os quatro
  prontos em `supabase/email-templates/`), mais o remetente, o SMTP próprio e os
  registros de DNS que decidem se a confirmação chega na caixa de entrada ou no
  lixo eletrônico. Explica por que os modelos com `token_hash` são recomendados
  (o link de recuperação aberto em OUTRO aparelho falha com os de fábrica), por
  que a recuperação responde "enviado" mesmo para e-mail inexistente, e por que
  criar senha numa conta do Google não cria uma segunda conta.
  **Status: implementado.**
- **[`stripe-setup.md`](./stripe-setup.md)**: ligar a cobrança do zero:
  objetos a criar no Stripe, as variáveis, e as armadilhas conhecidas.
  Ferramentas: `npm run stripe:doctor` e `npm run stripe:listen`.

## Produto e negócio

- **[`parceiros.md`](./parceiros.md)**: o programa de divulgadores. A primeira
  parte pode ser enviada ao parceiro como está; a seção "Pendências" é interna.
  **Status: implementado.**
- **[`parceiros-plano.md`](./parceiros-plano.md)**: o plano técnico do mesmo
  programa e o que ficou de fora. Fases 0 a 7 entregues.
- **[`indicacao.md`](./indicacao.md)**: o programa ABERTO de indicação: quanto
  se ganha por cadastro e por assinatura, a régua que diz se um valor de bônus
  é financeiramente seguro (e por que 50 e não 150), e por que o convidado não
  ganha nada, é o que mantém o link do parceiro como a melhor oferta da casa.
  Traz também as moedas por cadastro que o parceiro passou a receber.
  **Status: implementado.**
- **[`transcricao.md`](./transcricao.md)**: por que a transcrição errava em
  igreja com eco, o que foi medido para corrigir (modelo, prompt, limiares) e o
  que foi tentado e NÃO funcionou (limpar o áudio, revisar com LLM, modelos de
  áudio-chat). Leitura obrigatória antes de mexer em `/api/transcribe`,
  `src/lib/vocabulario.ts`, `src/features/session/lib/transcription/*` ou `src/app/(app)/recording/`.
- **[`youtube.md`](./youtube.md)**: o modo que não grava: por que a legenda vem
  de um provedor PAGO (o `timedtext` bloqueia IP de datacenter desde 2024, e as
  três alternativas óbvias estão descartadas com o motivo de cada uma), por que
  só aceitamos legenda que já existe, por que o título do vídeo precisa de uma
  chamada de LLM para ser separado em pregação / pregador / igreja (o separador
  do caso real era a LETRA `I`, e o canal não é o autor), a conta que fixou as
  30 moedas por vídeo com teto de 2h, e a canibalização do Modo Resumo que foi
  assumida de olhos abertos. Leitura obrigatória antes de mexer no preço, no
  teto ou em `src/features/session/server/youtube/*`. **Status: implementado.**
- **[`financeiro.md`](./financeiro.md)**: o desenho do `/admin/financeiro`: o
  que já é medido e por isso NÃO se digita, o modelo de dados das cinco tabelas,
  a separação entre competência e caixa, o modelo de projeção com crescimento e
  churn, e quais indicadores valem a pena (e quais ficaram de fora, com o
  motivo). **Status: implementado.**
- **[`melhorias-resumo-sermao.md`](./melhorias-resumo-sermao.md)**, o problema
  de o resumo soar como interpretação da IA em vez de organização do que foi
  dito, e o que fazer a respeito.
- **[`estudo-v2.md`](./estudo-v2.md)**: por que o "Gerar estudo" entrega
  pouco valor hoje (sete causas, todas no código, nenhuma resolvível por
  prompt), o pipeline de cinco etapas que substitui a chamada única, e o
  desenho de entitlements por plano. **Status: implementado, exceto a rotina de
  avaliação da §7 (passo 5 da §9).**
- **[`biblo.md`](./biblo.md)**: o bate-papo com o Biblo dentro do resumo e do
  editor: conversar sobre o conteúdo, receber contexto, passagens e provocações
  em pedaços pequenos, e mandar o que prestou de volta para o texto. É a mesma
  ambição do estudo pelo caminho oposto — dirigido pela pessoa, um pedaço de
  cada vez. **Status: proposta.**
- **[`biblo-implementacao.md`](./biblo-implementacao.md)**: o **como** do
  Biblo. Fecha com número as três decisões que a proposta deixou em aberto (o
  Biblo é dos planos pagos, a conta gratuita ganha 10 mensagens de presente, e
  cada mensagem custa 2 moedas, cobradas em silêncio), e descreve a tabela, a
  rota, o prompt, a
  janela deslizante que mantém o custo por mensagem constante e a ordem de
  implementação. **Status: plano aprovado, nada implementado.**
- **[`creditos-na-tela.md`](./creditos-na-tela.md)**: o odômetro do saldo só
  anda para baixo, e para quem assina isso é mentira — o crédito volta todo mês.
  O assinante passa a ver o anel e o nome do plano, o número aparece nos
  detalhes (e volta sozinho quando a reserva fica curta); para a conta gratuita
  nada muda, porque ali o número é a informação certa. Metade da decisão de
  cobrar o Biblo por mensagem, e subiu na mesma entrega.
  **Status: implementado.**

## Integração

- **[`react-native-bridge.md`](./react-native-bridge.md)**: como o shell
  React Native sabe que uma gravação está em andamento, e o que ele faz com
  isso. É a única forma real de manter a gravação viva com a tela bloqueada ou
  o app minimizado, porque a plataforma web não expõe foreground service. **Não
  há implementação neste repositório**, e isso é escolha: o módulo que emitia os
  eventos foi apagado num commit que mexia no gravador e ninguém notou por
  meses. Hoje o shell observa o `MediaRecorder` de fora. O documento lista as
  três mudanças em `useAudioCapture.ts` que o quebram em silêncio.
- **[`app-store-ios.md`](./app-store-ios.md)**: os quatro portões da App Store
  (IAP, minimum functionality, Sign in with Apple, exclusão de conta), o que
  cada um custa e uma rota sugerida. O irmão de negócio do documento acima: lá
  está COMO a shell funciona, aqui está o que a Apple cobra para deixá-la
  entrar. **Status: nada implementado, é documento de decisão.**

## Segurança

- **[`security/`](./security/README.md)**: a auditoria de segurança — o
  checklist e as oito tarefas (segredos, auth, RLS, validação de entrada, bomba
  de custo, rate limit, headers, superfície exposta), cada uma com o que foi
  procurado e o que foi achado. Morava em `security/` na raiz do repositório e
  veio para cá: é documentação, e a raiz não é o lugar dela.

## Exploração: NÃO implementado

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
