# Changelog

Cada versão aqui é um **corte de medição**, não um enfeite: ela é o valor de
`llm_usage_events.app_version` no `/admin/usage`, onde custo por chamada e
latência são comparados versão a versão. Quando aquela tabela disser que a
0.6.0 ficou mais cara, é esta lista que responde POR QUÊ.

Gerado por `npm run release` a partir dos Conventional Commits. `feat` sobe o
minor; o resto sobe o patch. Não edite à mão, a próxima execução escreve por
cima do topo do arquivo.

## 0.45.0, 2026-09-18, desde v0.44.0

### Novidades

- **biblo:** microfone no compositor, fala em vez de digitar (`4510e7f`)

## 0.44.0, 2026-09-18, desde v0.43.0

### Novidades

- **landing:** as quatro promessas viram cards no hero, no lugar do paragrafo (`cd89bb3`)

## 0.43.0, 2026-09-18, desde v0.42.0

### Novidades

- **landing:** as telas de celular trocam sozinhas, e o mobile para de ter vao morto (`64e09cd`)

## 0.42.0, 2026-09-18, desde v0.41.0

### Novidades

- **planos:** uma lista de vantagens so, para a LP e para o dialogo de compra (`b90a348`)
- **biblo:** a despedida abre o dialogo de creditos em vez de mandar para /assinar (`db95031`)

## 0.41.0, 2026-09-18, desde v0.40.1

### Novidades

- **biblo:** a conversa abre do cache, e a despedida do presente aparece onde ela e verdade (`43a1249`)

### Correções

- **biblo:** resposta ja paga nao cai mais por JSON truncado ou campo fora do formato (`ea716d2`)

## 0.40.1, 2026-09-17, desde v0.40.0

### Correções

- **landing:** no celular a secao abre pelo texto, nao pela tela (`5525aa4`)

## 0.40.0, 2026-09-17, desde v0.39.4

### Novidades

- **landing:** a LP vira a do bloco de notas, com o Biblo e o editor (`415b8cc`)

## 0.39.4, 2026-09-17, desde v0.39.3

### Correções

- **escrever:** key no TopBar que o Composer recebe por prop (`a7c9f2e`)

## 0.39.3, 2026-09-17, desde v0.39.2

### Correções

- **biblo:** nada entra abaixo da conclusao, nem pela tela de leitura (`22e7abf`)

## 0.39.2, 2026-09-17, desde v0.39.1

### Correções

- **biblo:** a piscada nunca acontecia na tela de leitura, e nao so no fim (`29786eb`)

## 0.39.1, 2026-09-17, desde v0.39.0

### Correções

- **importar:** a tela de espera centra no que sobra da janela (`23dbd27`)
- **biblo:** a piscada do bloco nao acontecia na tela de leitura (`6955e24`)

## 0.39.0, 2026-09-17, desde v0.38.0

### Novidades

- **biblo:** adicionar um bloco rola ate ele e da uma piscada (`097a27c`)
- **biblo:** ele conversa sobre a Biblia, e recusa o resto numa linha (`0794f83`)

## 0.38.0, 2026-09-17, desde v0.37.0

### Novidades

- **biblo:** o cabecalho da gaveta ganha um balao de conversa (`dd5953b`)

### Correções

- **biblo:** ele para de repetir a resposta, e o aviso de falha fica legivel (`e39bd98`)

### Outros

- **biblo:** o balao do cabecalho fica solido (`ea5b761`)

## 0.37.0, 2026-09-17, desde v0.36.0

### Novidades

- **biblo:** tres portas da conversa para o resumo, e a gaveta reabre no fim (`1fa729b`)
- **biblo:** ele mostra a passagem, e a resposta ganha respiro (`7d14081`)
- **biblo:** a conversa ganha uma batida entre perguntar e pensar (`e16101b`)
- **biblo:** arrastar rola os chips de novo, agora sem o arrasto fantasma (`6171c0e`)
- **biblo:** arrastar rola os chips, e a barra fina aparece no desktop (`ef27c24`)

### Correções

- **biblo:** o clique nos chips volta — a captura do ponteiro so depois do arrasto (`17c0fb9`)
- **biblo:** a barra dos chips perde as setas (`3384c48`)
- **biblo:** ele aparece na folha em branco, e a gaveta para de comer a tela (`01f5051`)

### Outros

- a selecao usa o azul do Biblo, nao o amarelo da moeda (`21d14cf`)
- **biblo:** a selecao ganha o amarelo da marca, e o botao encurta (`963d6e6`)
- **biblo:** tira o arrastar-para-rolar dos chips, a barra basta (`ced493e`)

## 0.36.0, 2026-09-17, desde v0.35.0

### Novidades

- **biblo:** ele se apresenta nas tres primeiras conversas (`b541548`)
- **biblo:** a conversa vira conversa, e o Biblo para de escrever sem ser pedido (`e1148b8`)

### Correções

- **summary:** o servidor resolve os versiculos, e a hidratacao para de divergir (`6a1615a`)
- **biblo:** o cumprimento chama pelo nome, e o rosto deixa de ser vermelho (`9af0cbb`)

### Outros

- **biblo:** a apresentacao ganha "qualquer tema cristao" (`ab6bfdc`)
- **biblo:** "Biblo" com maiuscula no cabecalho da gaveta (`8e20ebd`)
- **biblo:** o cabecalho da gaveta volta a ter nome (`3600bd7`)
- **biblo:** a gaveta perde o cabecalho, e o campo cresce com a pergunta (`48334a2`)
- **biblo:** o rosto clareia para um azul esbranquicado (`d452369`)

## 0.35.0, 2026-09-17, desde v0.34.0

### Novidades

- **creditos:** o assinante ve o mes, nao o odometro (`4291baa`)
- **biblo:** a conversa dentro da sessao, com o rosto no canto (`fc6cbcd`)

## 0.34.0, 2026-09-16, desde v0.33.0

### Novidades

- **home:** o "Resumo automatico" ganha gradiente animado e o selo "IA" (`5346808`)
- **escrever:** ideia central e conclusao viram as duas pontas do texto (`e0d9bad`)
- **summary:** a transcricao vira o segundo slide, e "Editar" sobe para o cabecalho (`a63ac18`)

### Correções

- **app:** folga entre a barra do topo e o conteudo, e a Biblioteca para de divergir na hidratacao (`655878d`)

### Outros

- **bridge:** o contrato com o app descreve o que existe, e o editor volta para a leitura (`3d289b8`)

## 0.33.0, 2026-09-16, desde v0.32.1

### Novidades

- **summary:** o resumo gerado passa a ser editavel, como o escrito a mao (`fbbf1b6`)
- **admin:** o hamburguer abre as areas em grade, nas duas larguras (`adc34d7`)

### Correções

- **painel:** a barra de status do Android para de cobrir o cabecalho (`5cbbfb7`)
- **barra:** a barra da tela para de piscar, e o perfil ganha o voltar (`be77504`)

### Outros

- **admin:** o menu vira botao flutuante no canto de baixo a direita (`1efebed`)
- **biblioteca:** as portas do dock voltam a dizer o resultado (`aa317d9`)

## 0.32.1, 2026-09-16, desde v0.32.0

### Correções

- **youtube:** o campo do recorte passa a parecer tempo (`f24add8`)

### Outros

- **resumo:** a frase de destaque perde as aspas e ganha simetria (`fc5ccb6`)

## 0.32.0, 2026-09-16, desde v0.31.2

### Novidades

- **biblioteca:** o acervo passa a morar no aparelho, e as escritas ficam otimistas (`d15f8ea`)

### Desempenho

- **biblioteca:** o cartao adianta o resumo inteiro no toque (`2767788`)
- **summary:** a transcricao sai do payload e vem so quando alguem a pede (`8f70c31`)
- **auth:** o gate verifica o JWT localmente, sem ida ao servidor de auth (`7328079`)

### Outros

- **biblioteca:** os dois esqueletos da tela viram um so (`3bdf7e6`)

## 0.31.2, 2026-09-16, desde v0.31.1

### Correções

- **coins:** o saldo para de ficar preso em "ainda não sei" e destrava o botão do /importar (`7fa5c46`)
- **importar:** o X do recorte para de vazar para fora da tela (`3bf253d`)
- **home:** aumenta o botão + do rodapé e o tira da borda (`a037ff6`)

### Desempenho

- **app:** a barra do topo sobe para o layout e para de recarregar a cada toque (`f03464c`)

## 0.31.1, 2026-09-15, desde v0.31.0

### Correções

- **tour:** encurta os balões das três portas e tira o preço deles (`fd60453`)

## 0.31.0, 2026-09-15, desde v0.30.0

### Novidades

- **tour:** o tour da Biblioteca abre o menu e explica as três portas, uma a uma (`aa09bdd`)

## 0.30.0, 2026-09-15, desde v0.29.0

### Novidades

- **importar:** o recorte de trecho, o link por parâmetro e o id da folha no aparelho (`bd5192c`)

## 0.29.0, 2026-09-15, desde v0.28.3

### Novidades

- **app:** o desktop ganha 1024px, as portas de criação na barra e a busca no resumo (`0277852`)

## 0.28.3, 2026-09-15, desde v0.28.2

### Correções

- **app:** a segunda porta se chama "Escrever resumo" (`3e3a5cc`)
- **app:** o + do dock para de virar elipse em tela estreita (`a6f667b`)

## 0.28.2, 2026-09-15, desde v0.28.1

### Correções

- **app:** o dock de criar vira vidro, e o painel abre ao lado do botão (`455fdb7`)

## 0.28.1, 2026-09-15, desde v0.28.0

### Outros

- **app:** no canto da barra fica a pena sozinha, em cinza (`6fe857b`)

## 0.28.0, 2026-09-15, desde v0.27.0

### Novidades

- **app:** o + do rodapé abre as três portas, e a marca ocupa o canto do hambúrguer (`231e47a`)

## 0.27.0, 2026-09-15, desde v0.26.0

### Novidades

- **escrever:** o editor aprende a mostrar onde se está e a não perder o que se digita (`9697dc9`)

## 0.26.0, 2026-09-15, desde v0.25.0

### Novidades

- **escrever:** a terceira porta, a pessoa escreve o resumo ela mesma (`8e96f59`)

## 0.25.0, 2026-09-15, desde v0.24.0

### Novidades

- **tema:** o produto inteiro veste a pele do app, e o tema claro sai (`b0dd4c5`)

### Correções

- **brand:** os ícones, o banner e o splash saem do índigo (`960b2c0`)

## 0.24.0, 2026-09-15, desde v0.23.0

### Novidades

- **app:** sem zoom na pinça, e as barras do sistema no grafite do app (`7fae220`)

## 0.23.0, 2026-09-14, desde v0.22.1

### Novidades

- **admin:** a lista de usuários diz quem paga, e a aba de rotas some com as mortas (`dc89056`)

## 0.22.1, 2026-09-14, desde v0.22.0

### Correções

- **app:** as telas de leitura ficam sem lupa (`a8f6cfc`)

## 0.22.0, 2026-09-14, desde v0.21.0

### Novidades

- **app:** o estudo entra na pele do app, e a busca dos Estudos vai para a lupa (`ce3d041`)

## 0.21.0, 2026-09-14, desde v0.20.0

### Novidades

- **app:** uma barra do topo só, e os Estudos viram mural de post-its (`bf918fa`)

## 0.20.0, 2026-09-14, desde v0.19.0

### Novidades

- **home:** a Biblioteca vazia ensina o caminho, e não só o estado (`5882e39`)

### Correções

- **tour:** o passo da busca da Biblioteca aponta para a lupa, não para a barra (`4d6dca4`)

## 0.19.0, 2026-09-14, desde v0.18.1

### Novidades

- **db:** as tabelas do que o produto deixou de fazer (`460d291`)
- **scriba:** um modo de captura só (`5739d3c`)
- **v2:** relógio de gravação no canto direito do cabeçalho (`6c9e76e`)
- **v2:** fatia o áudio em pedaços e acaba com o teto de 44 minutos (`e87489b`)

### Correções

- **landing:** a copy pública para de vender o que não existe (`3a7a63a`)
- **coins:** a cobrança do gravador do v2 falhava em todo minuto (`c6dfbdd`)
- **v2:** volta a transcrever uma vez só, fatiando apenas para não perder áudio (`56bdf74`)
- **audio:** desliga o processamento do microfone no gravador do v2 (`7e87be8`)
- **v2:** guarda o áudio no aparelho antes de enviá-lo (`9e9c9d4`)

### Outros

- **tour:** a Biblioteca não promete mais que nada é apagado sozinho (`9ecb02b`)
- **admin:** o menu passa a ter uma pergunta por item, não um recorte (`f739cb7`)
- cada assunto passa a morar inteiro em src/features/ (`76d3bb1`)
- **lib:** tira do lib/ o que não é camada de servidor (`9fe76f3`)
- o /v2 sai das URLs e o código inteiro vai para src/ (`ba808b8`)
- os AGENTS.md param de descrever um produto que não existe (`3a13c10`)
- **admin:** o painel e os processos param de medir o que não roda (`d54f4f2`)
- **app:** o grupo (app) acaba, o v2 é a única moldura (`a0737d5`)

## 0.18.1, 2026-09-13, desde v0.18.0

### Outros

- alinha os AGENTS.md das features com a migração para o v2 (`64a9aee`)

## 0.18.0, 2026-09-13, desde v0.17.0

### Novidades

- **v2:** o Scriba v2 vira o app (`7158d86`)

## 0.17.0, 2026-09-11, desde v0.16.1

### Novidades

- **auth:** login pelo domínio customizado auth.scriba.cc (`9784354`)

## 0.16.1, 2026-09-11, desde v0.16.0

### Correções

- **ui:** sombra preta no lugar do halo azul na nav mobile e nos cards (`f20d192`)

## 0.16.0, 2026-09-11, desde v0.15.0

### Novidades

- **conta:** exclusão da própria conta em /profile/delete (`4b557ee`)

## 0.15.0, 2026-09-11, desde v0.14.0

### Novidades

- **admin:** cupons de convite, leitura da IA numa página só e fim da tela de estudos (`ce35851`)

## 0.14.0, 2026-09-11, desde v0.13.2

### Novidades

- **parceiros:** 20 moedas por cadastro, pagamento no dia 30 e a conta feita na LP (`dec7acb`)
- **lp:** hero em coluna única, página enxuta e planos que dizem a ausência (`4051b78`)
- **tema:** paleta neutra do shadcn, escuro por padrão e admin no dashboard-01 (`bfbbd18`)

## 0.13.2, 2026-09-10, desde v0.13.1

### Correções

- **copy:** tira a repetição no card do YouTube (`ced7e93`)

## 0.13.1, 2026-09-10, desde v0.13.0

### Correções

- **copy:** textos mais curtos no tour da biblioteca e no card do YouTube (`e8cdf13`)

## 0.13.0, 2026-09-10, desde v0.12.0

### Novidades

- **biblioteca:** porta de importar do YouTube na biblioteca vazia (`0e3e2b9`)

### Correções

- **tour:** balão não pousa mais em cima do alvo preso ao viewport (`d912cd4`)

## 0.12.0, 2026-09-10, desde v0.11.0

### Novidades

- **resumo:** resumos mais densos e teto de tempo próprio na chamada (`b91b3d6`)
- **resumo:** remover os comentários do Scriba do resumo final (`c32d44c`)

## 0.11.0, 2026-09-10, desde v0.10.0

### Novidades

- **tour:** apresentação guiada das telas logadas, uma vez por tela (`6c77997`)

## 0.10.0, 2026-09-10, desde v0.9.1

### Novidades

- **admin:** ler resumo, transcrição e estudo de qualquer sessão (`2c433b5`)

## 0.9.1, 2026-09-10, desde v0.9.0

### Correções

- **lp:** o convite de instalar segue o aparelho, não a largura da tela (`0105ee8`)

## 0.9.0, 2026-09-10, desde v0.8.0

### Novidades

- **lp:** o CTA do celular oferece a escolha, em vez de empurrar o app (`aab1b7b`)
- **parceiros:** pré-parceiro ganha moedas para conhecer o produto (`3f5f1e0`)

### Outros

- troca todo travessão por vírgula, dois-pontos ou hífen (`f7b4025`)

## 0.8.0: 2026-09-10, desde v0.7.0

### Novidades

- **ui:** estado pressionado para aparelhos sem hover (`98326b5`)
- **youtube:** importação a 30 moedas e card de descoberta no feed (`1c36e7a`)

### Correções

- **admin:** guarda a cotação do dia para o painel não ficar sem câmbio (`d46975a`)
- **admin:** alvo de toque e spinner no menu do painel (`756f39f`)

## 0.7.0: 2026-09-09, desde v0.6.0

### Novidades

- **youtube:** importar sermões de vídeos do YouTube (`15d71d5`)

## 0.6.0: 2026-09-09, desde v0.5.0

### Novidades

- **feedback:** pesquisa de satisfação nos marcos de gravação e estudo (`cff661e`)

## 0.5.0: 2026-09-09, desde v0.4.0

### Novidades

- **referrals:** botão de voltar em /indicar, seguindo a porta de entrada (`b662f8e`)

## 0.4.0: 2026-09-09, desde v0.3.0

### Novidades

- **referrals:** indique a um amigo, e moedas por cadastro para o parceiro (`709013b`)

## 0.3.0: 2026-09-09, desde v0.2.0

### Novidades

- **admin:** margem por versão, recortando a moeda pela janela em que ela esteve no ar (`78861bc`)

### Correções

- **session:** a barra de filtros das listas ganha um layout próprio no celular (`a182487`)

### Outros

- **app:** /list vira /recordings, e o caminho antigo responde 308 (`3666333`)

## 0.2.0: 2026-09-09, desde v0.1.0

### Novidades

- **admin:** custo e latência comparáveis versão a versão, e a versão sobe sozinha (`553709b`)
