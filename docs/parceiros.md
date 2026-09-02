# Programa de Parceiros do Scriba

Documento de referência do programa. A primeira parte é o que o parceiro
precisa saber (pode ser enviada como está). A última seção, **Pendências**, é
interna.

Status: **implementado**. O plano técnico e o que ficou de fora estão em
[`parceiros-plano.md`](./parceiros-plano.md); as invariantes de código, na
seção "Parceiros divulgadores" do `AGENTS.md`.

---

## O que é

Um programa por convite. Criadores de conteúdo convidados recebem um link
próprio, um código de indicação e um painel em `scriba.cc/partners` para
acompanhar resultados e valores a receber.

Não há inscrição aberta: o parceiro é cadastrado pela equipe do Scriba e
entra com a mesma conta Google que usa no app.

---

## Como uma pessoa é vinculada a um parceiro

Existem **duas** formas, e ambas valem:

**1. Pelo link** — `scriba.cc/r/<codigo>`

Quem abre esse link fica marcado por **30 dias**. Se criar conta nesse
período, é vinculado ao parceiro. O link pode ser usado em bio, descrição de
vídeo, stories, onde for.

**2. Pelo código de indicação**

Na tela de cadastro existe um campo opcional de código. Serve para quem viu o
conteúdo no celular e foi criar a conta no computador — situação em que a
marcação do link se perde. O código é o mesmo do link (`<codigo>`).

### Regras do vínculo

- **O vínculo é permanente e único.** Uma vez que a conta foi criada e
  vinculada, ela pertence àquele parceiro para sempre. Um link ou código
  usado depois não transfere a pessoa.
- **Vale o primeiro.** Se a pessoa passou pelo link de dois parceiros antes de
  se cadastrar, vale o parceiro do vínculo mais recente registrado no
  navegador no momento do cadastro. Código digitado tem precedência sobre o
  link.
- **O parceiro não pode indicar a si mesmo.** A própria conta do parceiro
  nunca gera comissão.

---

## O benefício para quem se cadastra

Quem entra pelo link ou pelo código do parceiro ganha **150 moedas extras**,
somadas às 50 de boas-vindas — **200 moedas no total**.

Na prática:

| saldo | Modo Completo | Modo Áudio | Só Transcrição |
|---|---|---|---|
| 50 (padrão) | 10 min | 25 min | 50 min |
| **200 (pelo parceiro)** | **40 min** | 100 min | 200 min |

40 minutos no Modo Completo é aproximadamente um culto inteiro. É essa a
oferta que o parceiro anuncia: *"pelo meu link você grava seu primeiro culto
inteiro, de graça"*.

O bônus é creditado uma única vez por conta, no momento do cadastro.

---

## O que o parceiro recebe para usar

Além da comissão, o parceiro tem uma **mesada mensal de moedas** — 500 por
padrão, configurável por parceiro no cadastro (0 desliga).

A razão é simples e não é generosidade: **quem não usa o produto não consegue
falar dele**. Um parceiro sem saldo para de gravar, para de ter o que mostrar,
e o programa morre em silêncio — sem que nada apareça em painel nenhum.

500 moedas equivalem a ~100 minutos no Modo Completo por mês, o suficiente
para acompanhar os cultos que ele mesmo grava.

As moedas caem sozinhas no começo de cada mês, na primeira vez que o parceiro
abre o app. Não há acúmulo entre meses: a mesada é uma permissão de uso, não
um saldo a resgatar.

---

## Como o parceiro é remunerado

**30% do valor da primeira mensalidade paga por cada pessoa indicada.**

O percentual é configurável por parceiro e definido no convite — 30% é o
padrão do programa, e pode ser negociado individualmente.

| plano | mensalidade | comissão (30%) |
|---|---|---|
| Pessoal | R$ 19,90 | R$ 5,97 |
| Estudioso | R$ 44,90 | R$ 13,47 |

### Regras da comissão

- **Só a primeira assinatura.** É um pagamento único por pessoa indicada, não
  uma recorrência. Renovações dos meses seguintes não geram nova comissão.
- **Uma vez por pessoa, para sempre.** Se o indicado cancelar e voltar a
  assinar meses depois, não há nova comissão.
- **Proporcional ao plano.** Como é percentual, um indicado que assina o plano
  mais caro rende mais.
- **Só assinaturas.** Compra avulsa de pacote de créditos não gera comissão.
- **O valor é travado na primeira fatura.** Se o indicado começar no Pessoal e
  migrar para o Estudioso depois, a comissão continua sendo a do Pessoal.
- **Reembolso e contestação cancelam a comissão.** Se o pagamento for
  estornado, a comissão correspondente é revertida.

---

## Quando e como o parceiro recebe

- Toda comissão passa por uma **carência de 30 dias** antes de ficar
  disponível. É o prazo em que um pagamento ainda pode ser contestado.
- O pagamento é feito **manualmente, por PIX**, uma vez por mês, sobre o total
  disponível.
- O painel mostra as duas colunas separadas: **a liberar** (dentro da
  carência) e **disponível** (pronto para o próximo pagamento).
- **Valor mínimo para saque: R$ 50.** Abaixo disso o saldo permanece acumulado
  para o mês seguinte — nunca expira, e é pago integralmente caso o parceiro
  deixe o programa.

O parceiro informa chave PIX e CPF/CNPJ no cadastro. Sem esses dados não há
como pagar. O CPF/CNPJ é conferido pelo dígito verificador na hora de salvar —
um documento digitado errado só apareceria quando o PIX não caísse.

Ao registrar o pagamento, quem paga pode anexar o **link do comprovante** (um
arquivo no Drive, por exemplo). Ele aparece no painel do parceiro junto da
linha do pagamento. Não há upload: guardamos o endereço, não o arquivo.

---

## O que o painel do parceiro mostra

- **Visitas** — quantas pessoas abriram o link (contagem única por dia).
- **Cadastros** — quantas dessas criaram conta.
- **Assinantes** — quantas viraram assinantes pagantes.
- **A liberar / disponível / já pago** — em reais.
  - *A liberar*: dentro da carência de 30 dias.
  - *Disponível*: passou a carência e ainda não foi pago — é o que sai no
    próximo PIX.
  - *Já pago*: quitado, com link do comprovante quando houver.
- Histórico por mês.

As três seções (divulgação, ganhos e pagamentos) ficam em abas; os valores em
reais ficam acima delas, sempre visíveis — é a pergunta que traz o parceiro ao
painel, e escondê-la atrás de um clique seria esconder a resposta.

O painel mostra **apenas números**. Nome, e-mail ou qualquer dado dos usuários
indicados nunca são exibidos ao parceiro.

> Nota sobre a leitura dos números: há defasagem natural entre as etapas. Uma
> visita de hoje pode virar cadastro amanhã e assinatura daqui a duas semanas.
> O painel deixa a data de referência explícita para o mês corrente não ser
> lido como fracasso.

---

## O que encerra a participação

O Scriba pode suspender um parceiro por uso indevido — tráfego artificial,
contas criadas em massa, promessa falsa sobre o produto, ou uso da marca de
forma que induza a erro. Comissões de indicações fraudulentas não são pagas.

---

## Economia do programa (interno)

Premissas, todas mensuráveis e todas sujeitas a drift:

| premissa | valor | origem |
|---|---|---|
| custo de 1.000 moedas | R$ 2,69 | medido em `llm_usage_events` + câmbio (`/admin`) |
| taxa do Stripe | 3,99% + R$ 0,39 | cartão nacional |

### Margem por plano

| | Pessoal | Estudioso |
|---|---|---|
| preço | R$ 19,90 | R$ 44,90 |
| − Stripe | R$ 1,18 | R$ 2,18 |
| − moedas (consumo total) | R$ 2,69 | R$ 6,73 |
| **margem** | **R$ 16,03 (80,5%)** | **R$ 35,99 (80,2%)** |

Os dois planos foram precificados no mesmo patamar de margem — coincidência
feliz que simplifica qualquer decisão de comissão percentual.

Ponto de ruptura: o Pessoal só empata se o custo do milheiro subir para
R$ 18,72 — 7× o atual. Há folga grande para variação de câmbio e de preço de
modelo.

### O custo dominante é o bônus, não a comissão

O bônus de 150 moedas custa **R$ 0,40** e é pago em **todo cadastro
indicado**, inclusive nos que nunca assinam. Amortizado por assinante
conquistado, com `c` = taxa de conversão cadastro→assinante e `u` = fração dos
indicados que efetivamente gastam as moedas:

| conversão | u = 100% (pessimista) | u = 40% (realista) |
|---|---|---|
| 3% | R$ 13,45 | R$ 5,38 |
| 5% | R$ 8,07 | R$ 3,23 |
| 10% | R$ 4,04 | R$ 1,61 |
| 20% | R$ 2,02 | R$ 0,81 |

Com conversão baixa, o bônus custa **mais que a comissão**. É a variável a
vigiar — não o percentual do parceiro.

### Resultado do mês 1 por assinante Pessoal (c = 5%, u = 40%)

| comissão | valor ao parceiro | resultado mês 1 | conversões p/ R$ 50 |
|---|---|---|---|
| 20% | R$ 3,98 | R$ 8,82 | 13 |
| 30% | R$ 5,97 | R$ 6,83 | 9 |
| 40% | R$ 7,96 | R$ 4,84 | 7 |
| 50% | R$ 9,95 | R$ 2,85 | 6 |

Do mês 2 em diante a margem é limpa: R$ 16,03/mês, sem comissão e sem bônus.
Seis meses de permanência = R$ 96 de margem bruta, contra uma comissão única.
Em base de LTV, mesmo 50% custa ~10% — a restrição real não é margem.

---

## Pendências (interno)

- ~~Percentual definitivo.~~ **Fechado: 30% padrão, editável por parceiro.**
  Positivo no mês 1 mesmo com premissas pessimistas, e resolve a tensão com o
  mínimo de R$ 50 — a 20% seriam 13 conversões até o primeiro pagamento, o que
  deixaria a maioria travada abaixo do piso por meses; a 30% são 9, e 4 no
  Estudioso. Taxas negociadas caso a caso passam pelo simulador do admin, que
  mostra o efeito no mês 1 antes de salvar.
- **Bruto ou líquido.** O documento acima usa o valor cheio da mensalidade
  porque o parceiro consegue conferir sozinho a partir do preço público — o
  que gera confiança. A taxa do Stripe sai da nossa margem. Se apertar, a
  alternativa é comissionar sobre o líquido e explicar.
- **Revisão periódica das premissas.** O custo do milheiro é *medido*, não
  configurado: muda com câmbio e com preço de modelo. `rate_bps` fica
  congelado na linha da comissão, então mudanças não reescrevem o passado —
  mas vale reconferir a tabela acima a cada trimestre.
- **Teto de bônus por parceiro.** Como login é só Google (e, no futuro, Apple),
  o custo de criar contas em massa é alto e o risco é baixo — mas um orçamento
  configurável por parceiro no admin continua sendo barato de ter.
- **Prazo do programa.** Se as condições podem mudar, o regulamento precisa
  dizer com quanta antecedência.
