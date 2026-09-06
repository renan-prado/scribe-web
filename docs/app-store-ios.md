# Publicar o Scriba na App Store — o que a Apple exige

**Status: nada disso está implementado.** Este documento existe para a decisão,
não para descrever o que está no ar. Ele responde a uma pergunta específica:
*se transformarmos o `scribe-web` num app React Native com WebView, o que a
Apple vai cobrar da gente?*

O contrato técnico da shell React Native — as mensagens que o site publica e o
que o nativo faz com elas — está em [`react-native-bridge.md`](./react-native-bridge.md)
e não se repete aqui. Este documento é sobre **política de loja**, que é um
problema diferente e, no caso do Scriba, mais caro.

A Play Store tem regras parecidas e mais frouxas na prática. O gargalo é a
Apple; resolvido o iOS, o Android sai de graça.

> ⚠️ **Regra de loja envelhece.** Comissões, programas e regimes de exceção
> mudam de ano em ano e variam por país. Os números e regimes abaixo valem
> como ordem de grandeza e ponto de partida — confirme no App Store Review
> Guidelines antes de fechar qualquer decisão em cima deles.

---

## Os quatro portões

Um app com WebView passa por quatro checagens independentes. Falhar em
qualquer uma delas é rejeição, e as três últimas não têm nada a ver com o
WebView — elas cairiam em cima do Scriba mesmo se o app fosse 100% nativo.

| # | Diretriz | O que exige | Custo para nós |
|---|---|---|---|
| 1 | **3.1.1** — In-App Purchase | Vender crédito e plano pelo pagamento da Apple | Alto: um segundo sistema de cobrança |
| 2 | **4.2** — Minimum Functionality | O app precisa fazer algo que o site não faz | Médio: já temos o argumento, falta construir |
| 3 | **4.8** — Login Services | Oferecer "Entrar com a Apple" ao lado do Google | Baixo |
| 4 | **5.1.1(v)** — Account Deletion | Excluir a conta de dentro do app | Baixo, mas não existe hoje |

O portão 1 é o único que mexe com dinheiro, e é onde está 80% do trabalho.

---

## Portão 1 — In-App Purchase (3.1.1)

### O que é IAP

**IAP** é *In-App Purchase*, "compra dentro do app": o sistema de pagamento da
própria Apple, embutido no iOS. Quando um app cobra por algo digital, quem
desenha a tela de pagamento não é o app — é o sistema operacional. Aquela
caixinha que sobe de baixo com o preço e pede Face ID é isso.

O usuário paga com o cartão que já está na conta Apple dele. A Apple recebe o
dinheiro, retém a comissão e repassa o resto por transferência, com semanas de
atraso. O app nunca vê o cartão e nunca processa nada. A biblioteca que faz
isso no lado iOS chama-se **StoreKit**.

Em uma frase: **é o Stripe da Apple, obrigatório e mais caro.**

### Por que se aplica ao Scriba

A 3.1.1 divide o mundo em dois:

- **Bem ou serviço do mundo físico** (corrida, comida, camiseta): use o
  pagamento que quiser. A Apple não se envolve.
- **Conteúdo digital consumido dentro do app** (assinatura, crédito,
  desbloqueio de recurso): **obrigatoriamente IAP.**

Moeda e os planos Pessoal/Estudioso são conteúdo digital consumido dentro do
app. Caem no segundo caso, sem margem de interpretação.

A segunda metade da regra pega mais gente do que a primeira: **o app não pode
sequer mencionar que existe outro jeito de pagar.** Nada de "compre no site",
nada de link para o checkout, nada de botão que abre o navegador. É rejeição
imediata. É por isso que o app da Netflix no iPhone não tem botão de assinar —
e não explica o motivo, só não tem.

**Onde o Scriba viola isso hoje:** o `useCoinGuard`
(`src/features/session/hooks/useCoinGuard.ts`). Quando o saldo zera, o
`PausedOverlay` manda o usuário comprar **em aba nova** — o comportamento
existe por um bom motivo (sair da página mataria o `MediaRecorder` e a fila de
chunks), mas dentro de uma shell iOS ele é exatamente o gatilho da rejeição.

### Quanto custa

A comissão padrão é **30%**. O *Small Business Program* baixa para **15%** para
quem fatura menos de US$ 1 milhão por ano — o Scriba se enquadra. Assinatura
que ultrapassa 12 meses com o mesmo assinante também cai para 15%. **O número
realista para nós é 15%.**

A comparação honesta não é "0% contra 15%": é contra o que o Stripe já leva.
A tabela abaixo assume uma taxa Stripe de ~3,99% + R$ 0,39 no cartão nacional
— **confira a taxa real da conta antes de usar isto para decidir.** O custo
por milheiro de moeda (R$ 5,97) é o alvo da régua descrita em
`lib/coins/pricing.ts`.

| Produto | Preço | Líquido Stripe | Líquido Apple 15% | Líquido Apple 30% |
|---|---|---|---|---|
| Pessoal (1.000 moedas) | R$ 19,90 | ~R$ 18,72 | R$ 16,92 | R$ 13,93 |
| Estudioso (2.500 moedas) | R$ 44,90 | ~R$ 42,72 | R$ 38,17 | R$ 31,43 |
| Pacote (500 moedas) | R$ 10,00 | ~R$ 9,21 | R$ 8,50 | R$ 7,00 |

E o que isso faz com a margem, que é o número que interessa:

| Produto | Margem Stripe | Margem Apple 15% | Margem Apple 30% |
|---|---|---|---|
| Pessoal | ~68% | ~65% | ~57% |
| Estudioso | ~65% | ~61% | ~53% |
| Pacote | ~68% | ~65% | ~57% |

**A leitura:** a 15%, que é o cenário real, perdem-se 3 a 4 pontos de margem.
Isso não inviabiliza nada. A 30% o Estudioso cairia para ~53%, bem abaixo do
alvo de 70% da régua — mas 30% só aconteceria se o faturamento passasse de
US$ 1 milhão/ano, e a essa altura o problema é outro.

**Detalhe de preço:** não se escolhe R$ 19,90 livremente. A Apple trabalha com
uma tabela de faixas de preço por país e você escolhe uma faixa. Na prática o
preço no iOS ficará próximo, mas provavelmente não idêntico ao do site — o que
por si só já pede um texto explicando a diferença em algum lugar.

### O que muda no código

Não é "trocar o Stripe pelo StoreKit". É **manter os dois**, e é aí que está o
custo real. Quatro frentes:

1. **Cadastrar cada produto no App Store Connect.** `pessoal`, `estudioso` e
   `topup500` viram produtos com identificador próprio no painel da Apple, com
   preço e descrição. É o espelho de `lib/billing/catalog.ts`, mantido à mão
   noutro lugar — com o risco de divergência que isso sempre traz.

2. **Um quinto caminho de crédito.** O `lib/billing/AGENTS.md` já prevê:
   *"um quinto caminho, se surgir, também usa `fulfill.ts`"*. O IAP é esse
   quinto. A Apple envia *App Store Server Notifications* ao nosso servidor —
   o equivalente ao webhook do Stripe. O fluxo é o mesmo de sempre: validar,
   resolver quantas moedas o produto vale, creditar por `fulfill.ts` com
   `external_ref` = id da transação da Apple. **A idempotência por
   `external_ref UNIQUE` que já existe cobre isso sem mudança.**

3. **Renovação vinda de outro lugar.** Hoje a renovação chega pelo webhook do
   Stripe e atualiza `current_period_end`. Com IAP quem renova é a Apple, e o
   Stripe não sabe de nada. A tabela de assinaturas precisa passar a guardar a
   **origem** de cada assinatura, e as três linhas de defesa descritas em
   `lib/billing/AGENTS.md` (reconcile, check preguiçoso no `summary`, sweep)
   precisam saber contra qual provedor conferir.

4. **O usuário não cancela dentro do app.** Assinatura comprada pela Apple só
   se cancela nos Ajustes do iPhone. A tela de billing precisa detectar a
   origem e, quando for Apple, trocar o botão de cancelar por uma instrução.
   Mostrar um botão que não funciona é reclamação na review da loja e motivo
   de rejeição.

É trabalho de semanas, não de dias. E dobra a superfície de um sistema que o
próprio `AGENTS.md` trata como intocável, pelo motivo certo: crédito é
dinheiro.

### As três saídas

**A) IAP completo.** Faz as quatro frentes acima. Caminho normal, aprova sem
discussão, custa 15% e algumas semanas de trabalho no código mais delicado do
repositório.

**B) App sem nenhuma compra.** O app iOS não vende nada: nenhum botão, nenhum
link, nenhuma menção a preço. Quem quer comprar descobre pelo site, por e-mail,
por qualquer canal que não seja o app. **Isso é permitido** — um usuário que
comprou crédito no site pode gastá-lo no app à vontade. O proibido é o app
*empurrar* a compra.

Essa opção é mais viável para o Scriba do que para a maioria dos apps, por um
motivo específico: o `INITIAL_COIN_BALANCE = 50`. Quem baixa da App Store e
cria conta já tem 50 moedas e consegue gravar de verdade. A Apple costuma
implicar com app que não faz nada até você pagar em outro lugar — não é o
nosso caso.

O preço é o funil: no iOS o `PausedOverlay` vira uma parede. "Seu saldo
acabou", ponto final, sem saída visível. Custa zero de engenharia e zero de
comissão, e custa conversão.

**C) Link externo autorizado.** Existe um regime em que o app pode levar o
usuário a pagar fora, mediante autorização específica da Apple e comissão
reduzida. O desenho varia por país e vem mudando ano a ano. **Trate como
possibilidade a verificar, nunca como plano** — e jamais como "vamos linkar
para o site e ver no que dá", que é rejeição na primeira submissão.

---

## Portão 2 — Minimum Functionality (4.2)

### O problema

A Apple rejeita app que é "um site embrulhado". A pergunta que o revisor faz é
sempre a mesma: *por que isso precisa ser um app?* Quase todo WebView rejeitado
por 4.2 é rejeitado porque não existe resposta.

### Nós temos a resposta, e ela é honesta

Está escrita no nosso próprio `src/features/session/AGENTS.md`:

> `useBackgroundKeepalive` reúne **tudo que a plataforma web permite** para
> manter uma gravação viva com a aba em segundo plano.

Loop de WAV silencioso de 2s, Media Session, wake lock, `autoplay=(self)`
liberado no `Permissions-Policy` do `next.config.ts`. É uma pilha de
contornos contra uma limitação real da plataforma — e no iOS ela perde: o
Safari suspende o `MediaRecorder` assim que o app vai para segundo plano
(ver `react-native-bridge.md`). Sermão de 45 minutos com o celular no bolso e
a tela apagada não sobrevive na web.

**Essa é a justificativa do app, e ela não é retórica.**

### O que construir, em ordem de peso

**1. A captura de áudio, de verdade.** Não basta embrulhar a WebView: se o
`MediaRecorder` continuar no JS, o WKWebView é suspenso com a tela bloqueada e
trocamos um contorno por outro. O caminho é `AVAudioSession` em `playAndRecord`
com background mode `audio`, e o recorder nativo fatiando por VAD.

O ponto bom é que **existe uma costura limpa**: `createRecorder`
(`lib/recorder.ts`) já é a fronteira, e os três componentes de gravação a
consomem pela mesma porta. Ela vira uma interface com duas implementações —
web e nativa. `useTranscribeQueue`, o
IndexedDB, os três pipelines e o feed não mudam; continuam recebendo chunk. O
`nativeBridge` ganha um `recording:chunk` além dos eventos que já publica.

**2. Live Activity / Dynamic Island durante a gravação.** Tempo decorrido,
moedas consumidas, último card do feed, botão de parar. Impossível na web, é a
primeira coisa que o revisor vê, e resolve um problema real: hoje o
`onExternalStop` depende do Media Session do Android e no iOS não tem
equivalente.

**3. Notificações locais para o `/feed`.** O encaixe mais natural que o projeto
tem. Os cards de releia / lembra / frase marcante já são agendados por data
absoluta (`createdAt + dayOffset`, em `lib/db/feed-entries.ts`) — a agenda
inteira é conhecida no momento em que a sessão fecha. Não precisa de APNs, nem
servidor de push, nem certificado: quando o `final-summary` termina, o bridge
manda a lista e o nativo agenda tudo localmente. Zero infraestrutura nova, e é
o recurso que faz o usuário voltar — hoje esses cards só existem se ele lembrar
de abrir o app.

**4. Share Extension: "compartilhar áudio para o Scriba".** Áudio de pregação
chega por WhatsApp o tempo todo. O modo `audio_only` já é exatamente isso —
transcribe + resumo final, sem captura ao vivo. Recurso novo de produto que só
existe no nativo.

**5. Widget (WidgetKit) com o card do dia.** Baixo esforço para o peso que tem:
o versículo para reler na tela de início. Reforça o item 3.

**6. App Intents / Siri e o Botão de Ação.** "Ei Siri, gravar sermão". Barato,
e o `NewRecordingDialog` já coleta modo/local/pregador — o intent preenche o
modo padrão e abre direto na gravação.

O haptic que já existe (`haptics:tap` no `nativeBridge`) fica, mas sozinho não
conta como nada para o revisor.

**Pacote mínimo para submeter:** itens 1, 2 e 3. São três coisas que o revisor
sente nos primeiros 30 segundos, e nenhuma é enfeite — cada uma corrige um
buraco que está documentado neste repositório como limitação da web.

---

## Portão 3 — Sign in with Apple (4.8)

Hoje o Scriba tem **só Google** (`GoogleSignInButton`, `signInWithOAuth` com
`provider: "google"`). A regra 4.8 diz que um app que oferece login de terceiro
precisa oferecer também uma opção equivalente com garantias de privacidade —
na prática, "Entrar com a Apple".

Não é opcional e não tem contorno. É rejeição direta.

O trabalho é pequeno: o Supabase Auth suporta o provider `apple`, então é
configurar o provider no painel do Supabase, criar as credenciais no portal de
desenvolvedor da Apple, e acrescentar um botão ao lado do de Google em
`app/sign-in/page.tsx` e `app/sign-up/page.tsx`.

**Atenção a um efeito colateral:** o "Ocultar meu e-mail" da Apple entrega um
endereço de relay (`...@privaterelay.appleid.com`). Onde o produto assume que o
e-mail é o e-mail real da pessoa, isso muda. O convite de parceiro, por
exemplo, hoje diz "precisa ser a conta Google dele"
(`src/features/admin/components/PartnerDialog.tsx`) — vale reconferir esse
fluxo antes de ligar o provider.

---

## Portão 4 — Exclusão de conta (5.1.1v)

App que permite criar conta **precisa permitir excluí-la de dentro do app**.
Não vale "mande um e-mail para o suporte", não vale link para uma página de
formulário. Precisa ser um caminho dentro do app que apague a conta e os dados.

Hoje `app/(app)/profile/page.tsx` não tem nada disso — não há nenhuma rota de
exclusão de conta no repositório.

O que precisa existir:

- Uma ação em `/profile` com confirmação clara do que será apagado.
- Uma rota que apague o usuário e o que pende dele — sessões, transcrições,
  cards de feed, estudos.
- Uma decisão sobre o que fazer com a assinatura ativa e com o saldo de
  moedas. Excluir conta com assinatura viva no Stripe sem cancelar a
  assinatura é cobrar alguém que não existe mais.
- Uma decisão sobre o histórico financeiro. `coin_transactions` e o ledger de
  crédito provavelmente precisam sobreviver anonimizados, por obrigação
  contábil — o que é compatível com a regra, desde que os dados pessoais
  sumam.

Esse portão vale a pena resolver **independentemente do app**: a mesma
exigência vem da LGPD, e o site também está sem.

---

## Coisas menores que também derrubam a submissão

- **Textos de permissão no `Info.plist`.** `NSMicrophoneUsageDescription` é
  obrigatório e precisa ser específico. "Este app usa o microfone" é rejeitado;
  "para gravar e transcrever a pregação que você está assistindo" passa.
  Vale o mesmo para notificações, se o item 3 do portão 2 for implementado.
- **Background mode `audio` tem de ser usado de verdade.** Declarar e não usar
  é rejeição. Como no nosso caso ele é o coração do argumento de 4.2, isso não
  é risco — é só não declarar antes de implementar.
- **App Privacy ("nutrition labels").** É um formulário no App Store Connect
  declarando o que se coleta e para quê. Precisa bater com a realidade: áudio,
  transcrição, e-mail, dados de pagamento. E precisa bater com a nossa própria
  `/privacy`.
- **Conta de teste para o revisor.** O Scriba exige login. Sem credenciais de
  teste nas notas da submissão, o revisor não consegue entrar e rejeita por
  isso — é uma das causas mais bobas e mais comuns de rejeição. Se o portão 1
  for pela saída B, a conta de teste precisa ter saldo suficiente para o
  revisor conseguir gravar.
- **Nada de chrome de navegador visível.** Barra de endereço, botão de voltar
  do browser, menu de compartilhar do Safari — qualquer coisa que denuncie o
  WebView pesa contra no 4.2.

---

## Rota sugerida

Nada disso está decidido; o que segue é uma recomendação, não um plano
aprovado.

1. **Portões 3 e 4 primeiro, no site.** Sign in with Apple e exclusão de conta
   são baratos, valem por si (LGPD), e não dependem de nenhuma decisão sobre o
   app. Feitos, dois dos quatro portões já estão fechados.
2. **Portão 1 pela saída B.** Primeira versão do app sem nenhuma compra. Custa
   zero de engenharia e zero de comissão, e a Apple aceita porque os 50
   créditos iniciais fazem o app funcionar sem pagamento nenhum.
3. **Portão 2 com o pacote mínimo:** áudio nativo em background, Live Activity,
   notificações locais do feed.
4. **Submeter. Aprender.** Só depois de o app provar que traz gente é que vale
   pagar o preço da saída A — o IAP completo, com o segundo backend de
   cobrança. Se o app não converter, essas semanas foram economizadas.

O erro a evitar é o inverso: gastar um mês dobrando o sistema de cobrança para
descobrir que o app foi rejeitado por 4.2, ou que ninguém baixa.
