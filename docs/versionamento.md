# Versionamento — a versão é uma régua de medição

**Status: implementado.** Migração `0044`, `scripts/release.mjs`,
`lib/app-version.ts` e o corte "Por versão" do `/admin/usage`.

---

## 1. O problema que isto resolve

O painel sabe dizer quanto cada rota custou, quanto cada usuário gastou e
quanto saiu em cada sessão. São todos cortes de **espaço**: onde o dinheiro
foi. Nenhum deles responde à pergunta que aparece toda vez que um prompt é
reescrito, um modelo é trocado ou uma etapa do pipeline é cortada:

> Depois daquilo, ficou melhor ou pior?

A régua natural seria a data. Ela não serve: a data sabe quando a CHAMADA
aconteceu, não quando o DEPLOY subiu. Entre o commit e o tráfego real há uma
build da Vercel, um horário de baixo movimento e — no caso de uma pregação
gravada no domingo — dias inteiros. Comparar "antes e depois de 12 de março" é
comparar duas misturas de código diferentes com uma linha divisória chutada.

A régua correta é a versão do app, carimbada pelo build em cada chamada.

## 2. Por onde o número passa

```
package.json  "version"          a fonte, e a única
   ↓ lido no build
next.config.ts  env.NEXT_PUBLIC_APP_VERSION
   ↓ embutido no bundle
lib/app-version.ts  APP_VERSION   client-safe
   ↓ carimbado em toda chamada
lib/db/usage.ts  →  llm_usage_events.app_version
   ↓ agrupado
/admin/usage  →  a tabela "Por versão" e o filtro
```

Três decisões dentro desse caminho:

- **A origem é o `package.json`, não uma variável de ambiente.** Variável de
  ambiente é digitada; um número no painel da Vercel discordaria do repositório
  no primeiro deploy em que alguém mexesse só num dos dois. Derivada, ela não
  tem como discordar. Por isso `NEXT_PUBLIC_APP_VERSION` **não** está no schema
  Zod de `lib/env/client.ts` e **não** entra no `.env.example` — declará-la ali
  convidaria exatamente a duplicação que a decisão evita.
- **Se o `package.json` não puder ser lido, o build QUEBRA.** Um build que sobe
  sem saber a própria versão contamina a série inteira com um rótulo falso, e
  isso só apareceria semanas depois, comparando versões que nunca existiram.
- **`app_version` nulo é permanente.** São as chamadas anteriores à migração
  `0044`. Não há backfill possível: ninguém sabe qual código as produziu, e
  atribuir a versão de hoje mentiria justamente na comparação. O painel as
  mostra como "Antes da medição", numa linha separada e sempre por último.

## 3. A regra que não pode ser esquecida

> **Antes de todo push, `npm run release`.**

Não é burocracia de release: é a condição de a medição existir. Sem o bump,
todo evento de todo deploy nasce com o mesmo rótulo, as linhas da tabela se
fundem numa só, e a pergunta da §1 deixa de ter onde ser respondida — **sem
erro nenhum na tela**, que é o pior jeito de uma medição falhar.

Ela está repetida no `AGENTS.md` da raiz, que carrega em toda sessão, porque
uma regra de processo que mora só num documento longo é uma regra que vale até
alguém ter pressa.

## 4. O fluxo

```bash
git commit -m "feat(admin): ..."   # 1. o trabalho, primeiro
npm run release                    # 2. versão + CHANGELOG + tag
git push --follow-tags origin develop
```

A ordem importa. O `release` roda **depois** do commit do trabalho, e recusa
uma árvore suja, porque o CHANGELOG desta versão precisa conseguir descrever o
commit que acabou de ser feito — e ele só existe depois de commitado.

O que o script faz:

1. lê os commits desde a última tag (`git describe --tags --abbrev=0`);
2. deriva o degrau dos Conventional Commits que o `commitlint` já obriga;
3. escreve a nova versão no `package.json`;
4. prepende a seção do `CHANGELOG.md`;
5. commita como `chore(release): vX.Y.Z` e cria a tag anotada;
6. **imprime** o comando de push. Não empurra.

Ele não empurra de propósito: a branch é escolha de quem está entregando, e um
push automático mandaria para produção uma versão que ninguém conferiu.

### O degrau

| Commits no intervalo | Degrau | Leitura no painel |
|---|---|---|
| algum `feat` | **minor** | entrou capacidade nova |
| `fix`, `perf`, `refactor`, `docs`, `chore` | **patch** | o mesmo produto, ajustado |
| `feat!` ou `BREAKING CHANGE` | **minor**, com aviso | ver abaixo |

Enquanto o major for `0`, quebra de contrato sobe o minor — é a semântica do
semver para `0.x`. Ir para `1.0.0` declara estabilidade a quem consome, e isso
é decisão de produto, não consequência de um commit: `npm run release major`.

Para forçar o degrau: `npm run release -- minor`. Para ver sem escrever:
`npm run release -- --dry-run`.

### Uma entrega, um release

O release roda **uma vez**, na `develop`. O `master` recebe a mesma versão pelo
`merge --ff-only` de sempre. Dois releases para a mesma entrega criariam duas
versões que dividem o mesmo tráfego, e a tabela do painel mostraria duas linhas
onde houve um deploy só.

## 5. O CHANGELOG é parte da medição

`CHANGELOG.md` não é cortesia com o usuário — o Scriba não publica notas de
versão. Ele existe porque **`0.6.0` sozinho não é uma resposta**. Quando a
tabela do painel disser que a `0.6.0` encareceu 40% a rota `study-answers`, é o
CHANGELOG que responde por quê, e a tag `v0.6.0` que permite ler o código
exato que produziu aquele número:

```bash
git show v0.6.0:lib/prompts/study-answers.ts
git diff v0.5.0 v0.6.0 -- lib/prompts/
```

É por isso que as tags são anotadas e vão para o remoto (`--follow-tags`): uma
tag que existe só na máquina de quem entregou não serve a essa leitura.

Ele é **gerado**, nunca editado à mão: a próxima execução reescreve o topo do
arquivo.

## 6. Como ler a tabela "Por versão"

Em `/admin/usage`, depois dos totais.

| Coluna | O que é |
|---|---|
| Versão | `app_version`, da mais nova para a mais antiga |
| No ar | primeiro e último evento gravado — **medido**, não digitado |
| Chamadas | eventos no período, já com os filtros ativos |
| Custo | soma, convertida pelo câmbio de `lib/fx/usd-brl.ts` |
| Por 1.000 chamadas | custo médio, com a variação contra a versão anterior |
| Latência média | `latency_ms` médio, com a mesma variação |
| Tokens/chamada | entrada + saída, **só nas chamadas de chat** |

**A leitura correta é uma ROTA de cada vez.** A armadilha é silenciosa: sem
fixar a rota no filtro, o custo médio por chamada de uma versão muda só porque
a MISTURA de rotas mudou entre dois deploys — uma semana com mais estudos
gerados parece "a 0.6.0 encareceu tudo". A tela avisa em cima da tabela, e o
aviso troca de texto quando há rota filtrada.

Quatro coisas que a tabela deliberadamente não faz:

- **Não tem coluna de moedas.** `coin_transactions` não carrega versão, e o
  débito é por minuto de gravação, não por chamada. Uma coluna "custo por 1.000
  moedas" por versão seria custo filtrado dividido por moeda inteira.
- **Os dois KPIs de moeda no topo da página viram `—` quando há filtro de
  ROTA.** O número que apareceria ali é sempre baixo e tem cara de margem
  folgada — o tipo de mentira que ninguém investiga, porque a conta parece boa.
  Sob filtro de VERSÃO eles continuam somando, pela regra da §7.
- **Variação com menos de 20 chamadas de um dos lados sai cinza**, não colorida.
  Duas chamadas caras numa versão recém-subida produzem "+340%" em vermelho, e
  esse vermelho é lido como regressão quando o que ele diz é "ainda não deu
  tempo de medir".
- **Variação abaixo de 1% sai neutra.** Pintar meio ponto percentual acenderia
  a coluna inteira, e aí nenhuma linha chama atenção.

O seletor de versão do filtro lista TODAS as versões do período mesmo depois de
uma ser escolhida — o recorte é aplicado em memória, e não no SQL, justamente
para o filtro não se trancar depois do primeiro clique.

Antes da primeira versão carimbada o seletor aparece DESABILITADO, com o motivo
no `title` — nunca escondido. A primeira versão dele sumia da tela nesse caso, e
o efeito era o oposto do pretendido: a funcionalidade desaparecia exatamente
quando alguém ia procurá-la (o estado de todo ambiente no dia em que isto sobe),
e a leitura virava "não foi feito" em vez de "ainda não há o que comparar".

## 7. A regra da janela — como a moeda entra no recorte

Metade do painel não tem carimbo de versão para ler. `llm_usage_events` tem;
`coin_transactions` **não** — o débito é por minuto de gravação, por estudo,
por reprocessamento, nunca por chamada de LLM. E margem precisa dos dois lados:
recortar só o custo daria uma fatia dividida pela receita do mês inteiro.

Daí a regra única, e ela cabe numa frase:

> A versão recorta pelo **CARIMBO** onde há carimbo (as chamadas de LLM) e pela
> **JANELA** em que ela esteve no ar onde não há (o ledger de moedas).

A janela é MEDIDA, como todo o resto: começa no primeiro evento que a versão
gravou e termina no primeiro evento da versão seguinte (`VersionWindow`, em
`lib/db/admin/usage.ts`). A mais nova tem fim aberto — ela ainda está no ar.

Três consequências:

- **`/admin/precificacao` tem o filtro**, e é ele que responde "esta mudança
  melhorou a margem da ação?". A tela mostra o intervalo resolvido numa faixa
  logo abaixo do cabeçalho, porque um número recortado por uma versão que ficou
  seis horas no ar é indistinguível de um recortado por um mês — e as duas
  leituras levam a decisões de preço opostas.
- **Uma versão sem nenhum evento no período zera moeda e custo juntos.** Zerar
  só o custo produziria margem de 100%.
- **A imprecisão conhecida é o rollout.** Durante alguns minutos a Vercel serve
  as duas versões, e as moedas daquele intervalo caem toda na mais antiga. É
  pequena demais para justificar um modelo que teria de adivinhar a mesma coisa
  com mais passos.

## 8. O que fica de fora, e por quê

- **Nada é carimbado com o SHA do commit.** A tag já leva ao código exato, e
  uma segunda coluna de identidade só teria valor se a versão parasse de subir
  a cada entrega — que é o problema a resolver, não a contornar.
- **A versão não aparece na interface do usuário.** Ninguém que grava um sermão
  precisa saber em que build está. Se um dia precisar (um rodapé de suporte,
  um relatório de bug), o valor já está em `APP_VERSION`, client-safe.
