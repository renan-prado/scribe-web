# Indique a um amigo

Documento de referência do programa aberto de indicação. A primeira parte é o
que o usuário vê; a seção **Economia** e a **Pendências** são internas.

Status: **implementado**. Migração `0045_referrals.sql`; invariantes de código
em [`src/features/referrals/AGENTS.md`](../src/features/referrals/AGENTS.md).

O irmão fechado deste programa é o de parceiros
([`parceiros.md`](./parceiros.md)), e as diferenças entre os dois não são
acidentais — estão explicadas na seção "Por que os dois programas existem".

---

## O que é

Todo usuário do Scriba tem um link próprio (`scriba.cc/i/<codigo>`) e um código
de sete caracteres. Quem cria conta por esse link ou digita esse código vira
uma indicação — e **quem indicou ganha moedas**.

Não há inscrição: o link existe para toda conta, e aparece em `/indicar`.

---

## Quanto se ganha

| quando | quem ganha | moedas |
|---|---|---|
| o amigo cria a conta | quem indicou | **50** |
| o amigo assina um plano | quem indicou | **200** |

50 moedas são ~7 minutos de Modo Completo; 200 são ~28 minutos, quase um culto
inteiro.

**Quem é convidado não ganha moedas extras** — recebe as 50 de boas-vindas de
qualquer conta nova. É a diferença deliberada em relação ao link de parceiro,
que dá 150 (ver "Por que os dois programas existem").

### Regras

- **As moedas do cadastro caem na hora**, na mesma transação que grava o
  vínculo, no primeiro login do amigo.
- **A recompensa da assinatura é uma vez por pessoa, para sempre.** Se o
  indicado cancelar e voltar a assinar meses depois, não há segunda
  recompensa.
- **Só contam contas NOVAS.** Quem já usa o Scriba não vira indicação de
  ninguém ao abrir um link — a conta precisa ser criada logo em seguida.
- **O vínculo é permanente e exclusivo.** Uma conta pertence a quem a indicou
  para sempre, e nunca a duas pessoas: quem chegou por um parceiro não pode
  também ser indicação de um amigo, e vice-versa. Vale o último link clicado
  antes do cadastro.
- **Ninguém indica a si mesmo.**
- **Até 10 cadastros premiados por mês.** Passando disso, o vínculo continua
  sendo gravado e a recompensa da assinatura continua valendo; só o bônus de
  entrada pausa até o mês seguinte.

---

## Onde o usuário encontra isso

- **`/indicar`** — o link, o botão de compartilhar (folha nativa do celular), o
  código para ditar, e os contadores: quantos entraram, quantos assinaram,
  quantas moedas rendeu.
- **`/profile`** — o atalho para a página, logo abaixo do cartão de plano.
- **`/feed`** — um card que aparece de tempos em tempos. Dispensado, ele tira
  uma soneca de duas semanas; aceito, de um mês.

## O selo "indicado por"

Quem abre um link de indicação — de amigo ou de parceiro — vê, no lugar da
frase de efeito do topo da landing page, **a foto e o nome de quem indicou**. O
mesmo aparece na tela de entrada.

É o que substitui, no programa aberto, o bônus de moedas que o convidado não
ganha: a persuasão deixa de ser dinheiro e vira prova social. Quem chega não
está diante de um anúncio, e sim da recomendação de alguém que ele conhece.

---

## Economia (interno)

Premissas, todas mensuráveis e todas sujeitas a drift:

| premissa | valor | origem |
|---|---|---|
| custo de 1.000 moedas | R$ 2,69 | medido em `llm_usage_events` + câmbio (`/admin`) |
| margem recorrente do Pessoal | R$ 16,03/mês | R$ 19,90 − Stripe R$ 1,18 − moedas R$ 2,69 |
| margem recorrente do Estudioso | R$ 35,99/mês | R$ 44,90 − R$ 2,18 − R$ 6,73 |

### A régua que decide se um número é seguro

Moedas emitidas por cadastro sem o mês 1 ficar negativo:

```
moedas ≤ margem_recorrente × conversão ÷ (custo_por_moeda × uso)
```

| cenário | conversão cadastro→assinante | uso do saldo | teto por cadastro |
|---|---|---|---|
| realista | 5% | 40% | 745 moedas |
| pessimista | 3% | 100% | **179 moedas** |
| custo do milheiro dobra | 3% | 100% | 89 moedas |

**O programa emite 50.** Fica em 28% do teto pessimista, e a folga é o ponto:
o custo de STT já dobrou uma vez (`docs/transcricao.md`), e o número não pode
depender de isso não voltar a acontecer.

### Resultado do mês 1 por assinante Pessoal conquistado

| conversão | custo dos cadastros amortizado | recompensa da assinatura | mês 1 |
|---|---|---|---|
| 5% | R$ 2,69 | R$ 0,54 | **+R$ 12,80** |
| 3% | R$ 4,48 | R$ 0,54 | +R$ 11,01 |
| 1% | R$ 13,45 | R$ 0,54 | +R$ 2,04 |

Positivo até a 1% de conversão — o programa de parceiros não sobrevive a 3%. A
diferença toda está em não pagar bônus ao convidado.

### O custo de um cadastro que nunca converte

**R$ 0,135**, e o teto é determinístico: moeda não vira saque, só transcrição,
então a exposição máxima de uma conta é 10 cadastros × 50 moedas = R$ 1,35 por
mês. Não existe cauda.

Para comparação, um cadastro por anúncio no Meta custa de R$ 3 a R$ 15. Mesmo
com conversão zero, este é o canal mais barato disponível — e é essa a
justificativa do programa, não a receita que ele traz.

### Por que o teto mensal não é antifraude

O login é só Google, criar conta em massa custa caro, e o prêmio é R$ 0,135.
Farmar não paga o trabalho. O teto existe como **sinal de produto**: quem
estoura 10 cadastros num mês não está indicando amigos, está divulgando — e o
lugar dessa pessoa é o programa de parceiros, onde há comissão em dinheiro.

---

## Por que os dois programas existem

| | Parceiro | Amigo |
|---|---|---|
| entrada | por convite da equipe | toda conta tem |
| o convidado ganha | 150 moedas | nada além das 50 de boas-vindas |
| quem indica ganha por cadastro | 50 moedas | 50 moedas |
| quem indica ganha por assinatura | **30% da 1ª mensalidade, em dinheiro** | 200 moedas |
| teto | orçamento de bônus, por parceiro | 10 cadastros premiados por mês |
| painel | `/partners`, com PIX e comprovantes | `/indicar`, três contadores |

O parceiro tem audiência, emite nota e recebe PIX; o amigo mandou um link no
grupo da igreja. O link do parceiro precisa continuar sendo a **melhor oferta
da casa** — é o que ele anuncia publicamente e o que sustenta a negociação. Por
isso o programa aberto não dá bônus ao convidado: se desse, a vantagem
exclusiva do parceiro sumiria sem que ninguém tivesse decidido isso.

---

## As moedas por cadastro do parceiro

Junto deste programa, o parceiro passou a ganhar **50 moedas por cadastro
atribuído** (`partners.signup_reward_coins`, editável por parceiro no admin,
0 desliga). Antes ele só recebia quando o indicado assinava — e quem traz
tráfego que ainda não converteu ficava meses sem nada.

Efeito na conta do programa dele, com 200 moedas emitidas por cadastro (150 ao
indicado + 50 ao parceiro):

| cenário | mês 1 antes | mês 1 agora |
|---|---|---|
| realista (c=5%, u=40%) | +R$ 6,83 | **+R$ 5,76** |
| pessimista (c=3%, u=40%) | +R$ 2,89 | +R$ 1,72 |
| pessimista (c=3%, u=100%) | −R$ 1,90 | −R$ 7,87 → paga em 15 dias do mês 2 |

O simulador do cadastro do admin já mostra esse efeito antes de salvar: as
moedas ao parceiro entram na mesma amortização do bônus, sem a fração de uso
(o parceiro é usuário ativo por desenho do programa — é essa a razão da
mesada).

**Elas acumulam antes de virar saldo.** `partners.user_id` nasce nulo — o
parceiro é cadastrado antes de existir como conta e pode divulgar o link antes
do primeiro login. A liberação acontece na primeira visita dele ao app, pelo
mesmo caminho preguiçoso da mesada. Não há perda: moeda só serve dentro do app.

---

## Pendências (interno)

- **Contagem de visitas.** `/i/<codigo>` não conta cliques, ao contrário de
  `/r/<slug>`. O parceiro precisa do topo do funil porque otimizar divulgação é
  o trabalho dele; quem manda o link no grupo da igreja não vai. Se um dia o
  painel de `/indicar` precisar de "N pessoas abriram seu link", a tabela é um
  espelho de `partner_clicks` — e a escrita anônima que ela exige é o custo a
  pesar antes.
- **Revisão das premissas.** O custo do milheiro é MEDIDO, não configurado:
  muda com câmbio e com preço de modelo. As tabelas acima valem uma reconferida
  por trimestre, junto das de `parceiros.md`.
- **Colisão entre código de amigo e slug de parceiro.** Um código tem 7
  caracteres minúsculos alfanuméricos, forma que um slug de parceiro admite. Se
  coincidirem, o campo da tela de entrada resolve como PARCEIRO. O admin
  escolhe os slugs à mão e pode evitar a colisão; se ela incomodar, a saída é
  exigir um caractere fora do alfabeto dos códigos no formato do slug.
- **Nada de expiração.** Moedas ganhas por indicação não vencem, como nenhuma
  outra moeda do produto. Se um dia houver expiração, ela é decisão do produto
  inteiro, nunca deste programa.
