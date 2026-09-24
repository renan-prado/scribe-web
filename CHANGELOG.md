# Changelog

Cada versão aqui é um **corte de medição**, não um enfeite: ela é o valor de
`llm_usage_events.app_version` no `/admin/usage`, onde custo por chamada e
latência são comparados versão a versão. Quando aquela tabela disser que a
0.6.0 ficou mais cara, é esta lista que responde POR QUÊ.

Gerado por `npm run release` a partir dos Conventional Commits. `feat` sobe o
minor; o resto sobe o patch. Não edite à mão, a próxima execução escreve por
cima do topo do arquivo.

## 0.85.1, 2026-09-24, desde v0.85.0

### Correções

- **db:** renumera a migração de presença para 0071 (`b19a5da`)

## 0.85.0, 2026-09-24, desde v0.84.2

### Novidades

- **admin:** mostra acessos, presença online e gráficos com shadcn charts (`675ce52`)

### Outros

- sincroniza a versão do package-lock.json (`de79937`)

## 0.84.2, 2026-09-24, desde v0.84.1

### Correções

- **consent:** troca o diálogo central por uma barra discreta no rodapé (`306df03`)

## 0.84.1, 2026-09-24, desde v0.84.0

### Correções

- **consent:** ajusta os textos dos itens do aviso de cookies (`a94b60b`)

## 0.84.0, 2026-09-24

### Novidades

- **consent:** exige aceite de cookies para usar o Scriba (`a26603d`)
- **partners:** exige CPF e endereço no cadastro do parceiro (`2589ade`)
- **partners:** remove o valor mínimo de saque (`1ed320e`)
- **summary:** blocos do editor se movem arrastando, no punho e no dedo (`c76fd8a`)
- **summary:** o editor ganha o "+" que pergunta o que a linha é (`0173080`)
- **summary:** resumo vazio para de prometer e abre a porta do editor (`911fd52`)
- **app:** a caneta do lucide sai do app, e editar ganha o glifo próprio (`ced4987`)
- **summary:** o seletor de passagem ensina o atalho da barra, e a prévia fica sutil (`2ffbd09`)
- **summary:** a barra acha qualquer livro da Bíblia, e o seletor mostra o texto (`2944be3`)
- **biblioteca:** troca o ícone de escrever pelo glifo próprio (`0658e31`)
- **biblioteca:** adiciona botão de voltar e mais respiro ao abrir uma pasta (`c70ba6c`)
- **summary:** aumenta a fonte do corpo do resumo, na leitura e na edição (`da9d139`)
- **biblioteca:** os post-its voltam a ser pastéis, mais translúcidos (`20ceb2e`)
- **tema:** o tema claro volta, com a paleta inteira e o switch (`16a3926`)
- **biblo:** respostas com profundidade, em gpt-5-mini (`d7d8e1a`)
- **app:** endereços em inglês, estudo fora do app e admin em modal (`e23990e`)
- **app:** barra de baixo do celular serve o documento aberto (`412faf5`)
- **app:** barra de baixo no celular e busca global com Ctrl+K (`525e842`)
- **escrever:** barra "/" vira único jeito de inserir bloco, citação rápida e mais (`ec205ad`)
- **auth:** modelos de e-mail transacionais com a marca do Scriba (`e5d3f4b`)
- **pwa:** tela offline com atalhos e casca do app no service worker (`0a369d6`)
- **auth:** entrar e criar conta com e-mail e senha (`d387ba0`)
- **session:** pastas em três níveis, integradas à Biblioteca como cartões (`6643f23`)
- **session:** mostra a pasta da sessão no cabeçalho do resumo (`53cfbb3`)

### Correções

- **summary:** o punho do arrasto para de encostar na primeira letra (`c1a2200`)
- **session:** a Bíblia do painel recupera as superfícies, e a busca ganha a voz do Biblo (`4bf144e`)
- **summary:** a dica do "/" diz para que serve, e o Biblo convida a conversar (`226404d`)
- **editor:** menu da barra vai para o body e respeita a barra do app (`125dd9c`)
- plan title (`ccfc8a6`)
- **landing:** o script da pílula de indicação vai para o head do root layout (`17258ba`)
- **session:** useFolders só devolve a lista depois da hidratação (`9efbf05`)

### Outros

- **deps:** sincroniza a versão do package-lock com o package.json (`7804e27`)
- **release:** v0.83.1 (`ec207e6`)
- **release:** v0.83.0 (`20ec8c1`)
- **release:** v0.82.0 (`6e73d86`)
- **release:** v0.81.0 (`7b60f28`)
- **shared:** registra o par de glifos de escrever e editar (`bd6f349`)
- **release:** v0.80.0 (`0c14e0f`)
- **release:** v0.79.0 (`6a85934`)
- **release:** v0.78.0 (`c330bce`)
- **release:** v0.77.0 (`96fa1af`)
- **release:** v0.76.0 (`ce632cb`)
- **release:** v0.75.0 (`61d8602`)
- **release:** v0.74.0 (`50743a1`)
- **release:** v0.73.0 (`3787b3c`)
- **release:** v0.72.2 (`7180f6d`)
- **home:** remove as vistas lista e grade, deixa só o mural de post-its (`e52d14e`)
- **release:** v0.72.1 (`99aa3cd`)
- **release:** v0.72.0 (`d7309d2`)
- **release:** v0.71.0 (`cd6eee5`)
- **billing:** tira "Sem custo para sempre" da lista do plano grátis (`19808c2`)
- **release:** v0.70.1 (`1d74acf`)
- **release:** v0.70.0 (`995d24b`)
- **release:** v0.69.0 (`6086de9`)

## 0.83.1, 2026-09-24, desde v0.83.0

### Correções

- **summary:** o punho do arrasto para de encostar na primeira letra (`c1a2200`)

## 0.83.0, 2026-09-24, desde v0.82.0

### Novidades

- **summary:** blocos do editor se movem arrastando, no punho e no dedo (`c76fd8a`)
- **summary:** o editor ganha o "+" que pergunta o que a linha é (`0173080`)

## 0.82.0, 2026-09-24, desde v0.81.0

### Novidades

- **summary:** resumo vazio para de prometer e abre a porta do editor (`911fd52`)

### Correções

- **session:** a Bíblia do painel recupera as superfícies, e a busca ganha a voz do Biblo (`4bf144e`)
- **summary:** a dica do "/" diz para que serve, e o Biblo convida a conversar (`226404d`)

## 0.81.0, 2026-09-24, desde v0.80.0

### Novidades

- **app:** a caneta do lucide sai do app, e editar ganha o glifo próprio (`ced4987`)

### Outros

- **shared:** registra o par de glifos de escrever e editar (`bd6f349`)

## 0.80.0, 2026-09-24, desde v0.79.0

### Novidades

- **summary:** o seletor de passagem ensina o atalho da barra, e a prévia fica sutil (`2ffbd09`)
- **summary:** a barra acha qualquer livro da Bíblia, e o seletor mostra o texto (`2944be3`)
- **biblioteca:** troca o ícone de escrever pelo glifo próprio (`0658e31`)
- **biblioteca:** adiciona botão de voltar e mais respiro ao abrir uma pasta (`c70ba6c`)
- **summary:** aumenta a fonte do corpo do resumo, na leitura e na edição (`da9d139`)
- **biblioteca:** os post-its voltam a ser pastéis, mais translúcidos (`20ceb2e`)

## 0.79.0, 2026-09-23, desde v0.78.0

### Novidades

- **tema:** o tema claro volta, com a paleta inteira e o switch (`16a3926`)

## 0.78.0, 2026-09-23, desde v0.77.0

### Novidades

- **biblo:** respostas com profundidade, em gpt-5-mini (`d7d8e1a`)

## 0.77.0, 2026-09-23, desde v0.76.0

### Novidades

- **app:** endereços em inglês, estudo fora do app e admin em modal (`e23990e`)

## 0.76.0, 2026-09-23, desde v0.75.0

### Novidades

- **app:** barra de baixo do celular serve o documento aberto (`412faf5`)

## 0.75.0, 2026-09-23, desde v0.74.0

### Novidades

- **app:** barra de baixo no celular e busca global com Ctrl+K (`525e842`)

## 0.74.0, 2026-09-22, desde v0.73.0

### Novidades

- **escrever:** barra "/" vira único jeito de inserir bloco, citação rápida e mais (`ec205ad`)

## 0.73.0, 2026-09-22, desde v0.72.2

### Novidades

- **auth:** modelos de e-mail transacionais com a marca do Scriba (`e5d3f4b`)

## 0.72.2, 2026-09-22, desde v0.72.1

### Outros

- **home:** remove as vistas lista e grade, deixa só o mural de post-its (`e52d14e`)

## 0.72.1, 2026-09-22, desde v0.72.0

### Correções

- **editor:** menu da barra vai para o body e respeita a barra do app (`125dd9c`)

## 0.72.0, 2026-09-22, desde v0.71.0

### Novidades

- **pwa:** tela offline com atalhos e casca do app no service worker (`0a369d6`)

### Correções

- plan title (`ccfc8a6`)

## 0.71.0, 2026-09-22, desde v0.70.1

### Novidades

- **auth:** entrar e criar conta com e-mail e senha (`d387ba0`)

### Correções

- **landing:** o script da pílula de indicação vai para o head do root layout (`17258ba`)

### Outros

- **billing:** tira "Sem custo para sempre" da lista do plano grátis (`19808c2`)

## 0.70.1, 2026-09-22, desde v0.70.0

### Correções

- **session:** useFolders só devolve a lista depois da hidratação (`9efbf05`)

## 0.70.0, 2026-09-22, desde v0.69.0

### Novidades

- **session:** pastas em três níveis, integradas à Biblioteca como cartões (`6643f23`)

## 0.69.0, 2026-09-22, desde v0.68.1

### Novidades

- **session:** mostra a pasta da sessão no cabeçalho do resumo (`53cfbb3`)

## 0.68.1, 2026-09-22, desde v0.68.0

### Correções

- **session:** garante testemunhos e ilustracoes no resumo gerado (`7380122`)

## 0.68.0, 2026-09-22, desde v0.67.4

### Novidades

- **session:** sistema de pastas para organizar a Biblioteca (`6541f21`)

## 0.67.4, 2026-09-21, desde v0.67.3

### Correções

- **home:** alinha o respiro do Biblo com o do + (px-5 nos dois) (`70c26e9`)

## 0.67.3, 2026-09-21, desde v0.67.2

### Correções

- **session:** remove ações rápidas da linha da Biblioteca, só uma seta (`cb9ab3e`)

## 0.67.2, 2026-09-21, desde v0.67.1

### Correções

- **home:** inverte a coluna flutuante e o Biblo some ao rolar como o + (`ecb51c3`)

## 0.67.1, 2026-09-21, desde v0.67.0

### Correções

- **session:** move Biblo bible-search input to the bottom, like a chat (`f7a1201`)

## 0.67.0, 2026-09-21, desde v0.66.0

### Novidades

- **home:** redesenha a vista em lista com hierarquia e acoes rapidas (`6266a8a`)

## 0.66.0, 2026-09-21, desde v0.65.0

### Novidades

- **biblia:** busca por sentido com o Biblo no painel de leitura (`100db64`)

## 0.65.0, 2026-09-21, desde v0.64.0

### Novidades

- **biblo:** tres ferramentas novas viram o Biblo em copiloto do app (`b4a99ae`)

## 0.64.0, 2026-09-21, desde v0.63.7

### Novidades

- **biblia:** referencias biblicas encadeadas viram links separados (`0eb578a`)

## 0.63.7, 2026-09-21, desde v0.63.6

### Correções

- **bible:** a biblia lateral para de esticar ate o conteudo no celular (`440884a`)

## 0.63.6, 2026-09-21, desde v0.63.5

### Outros

- **recording:** biblo, biblia e notas viram camadas flutuantes na gravacao (`1d5d997`)

## 0.63.5, 2026-09-21, desde v0.63.4

### Correções

- **home:** aumenta o espaco entre o botao do Biblo e o + de criar (`d9c717f`)

## 0.63.4, 2026-09-21, desde v0.63.3

### Correções

- **editor:** a rolagem do menu da barra acompanha a navegacao pelo teclado (`fa7690f`)

## 0.63.3, 2026-09-21, desde v0.63.2

### Correções

- **editor:** o menu da barra para de cortar embaixo no celular (`6ebabf2`)

## 0.63.2, 2026-09-21, desde v0.63.1

### Correções

- **editor:** "Ver como ficou" espera o texto chegar ao banco antes de abrir (`e4a12f3`)

## 0.63.1, 2026-09-21, desde v0.63.0

### Correções

- **admin:** a dica do lexico para de pedir uma linha em branco (`fd13249`)
- **biblo:** a fileira de chips para de dizer a mesma coisa duas vezes (`87af4e1`)
- **editor:** o menu da barra sobe quando nao cabe embaixo da linha (`031465b`)
- **biblo:** o cartao da Biblioteca acompanha o titulo que o Biblo mudou (`d9bef93`)
- **gravacao:** a notificacao do sistema para de mentir quando a gravacao e pausada (`6bbc9dc`)
- **gravacao:** a transcricao longa diz em que pedaco esta (`a75e57e`)

### Outros

- **gravacao:** o id da sessao nasce no aparelho, e a linha so quando precisa (`d3affba`)

## 0.63.0, 2026-09-21, desde v0.62.1

### Novidades

- **lexico:** a marcacao de nome vira um pontilhado, sem area nenhuma (`e9505aa`)

## 0.62.1, 2026-09-21, desde v0.62.0

### Correções

- **lexico:** o cartao de personagem e lugar deixa de ser um bloco unico (`fd4faf3`)

## 0.62.0, 2026-09-21, desde v0.61.0

### Novidades

- **biblo:** os chips de abertura nomeiam o assunto em vez de dizer "isso" (`21bf813`)

## 0.61.0, 2026-09-21, desde v0.60.0

### Novidades

- **biblo:** o chip de abertura sorteia um capitulo em vez de repetir Joao 1 (`a5ba8da`)

## 0.60.0, 2026-09-21, desde v0.59.2

### Novidades

- **editor:** o bloco "Passagem biblica" passa a se chamar "Biblia" (`ad56e14`)

## 0.59.2, 2026-09-21, desde v0.59.1

### Correções

- **editor:** o placeholder do Exemplo tambem perde o "ele" (`e71daf7`)

## 0.59.1, 2026-09-21, desde v0.59.0

### Correções

- **editor:** a bolinha do topico aparece no instante em que o bloco nasce (`b634f6f`)

## 0.59.0, 2026-09-21, desde v0.58.0

### Novidades

- **editor:** menu da barra com busca, e markdown de bloco e de enfase (`002cf2e`)

## 0.58.0, 2026-09-21, desde v0.57.0

### Novidades

- **editor:** o bloco "Exemplo do pregador" passa a se chamar so "Exemplo" (`bff88e5`)

## 0.57.0, 2026-09-21, desde v0.56.0

### Novidades

- **biblo:** o Biblo na Biblioteca escreve o documento, nao so sugere um bloco (`1af8732`)

## 0.56.0, 2026-09-21, desde v0.55.0

### Novidades

- **home:** tres vistas do acervo, mural, lista e grade (`92da4a3`)

## 0.55.0, 2026-09-21, desde v0.54.0

### Novidades

- **biblia:** a Biblia a mao na leitura e no editor, sem sair da tela (`2e27703`)

## 0.54.0, 2026-09-21, desde v0.53.0

### Novidades

- **gravacao:** a tela de gravar vira bancada com notas, Biblo e Biblia (`35d585f`)

## 0.53.0, 2026-09-21, desde v0.52.0

### Novidades

- **gravacao:** o sistema avisa que a gravacao continua com o app minimizado (`ed58d6a`)

## 0.52.0, 2026-09-21, desde v0.51.0

### Novidades

- **gravacao:** audio longo e cortado na hora de enviar, e o aviso de tamanho sai (`dff5622`)

## 0.51.0, 2026-09-20, desde v0.50.0

### Novidades

- **planos:** o editor e gratis para sempre, e a tela passa a dizer isso (`f0c4d15`)
- **admin:** creditar moedas avulsas pelo painel (`c2ba293`)
- **escrever:** topicos, topicos numerados e marca-texto no editor (`979eb06`)
- **offline:** o app diz que esta offline, e as leituras respondem do disco (`d1e66bd`)

## 0.50.0, 2026-09-20, desde v0.49.0

### Novidades

- **gravacao:** a gravacao guardada aparece na Biblioteca e sobe sozinha (`9f61b26`)

### Outros

- **acervo:** levantamento das obras do CCEL (`872834c`)

## 0.49.0, 2026-09-19, desde v0.48.0

### Novidades

- **lexico:** o marca-texto de nome proprio volta a ser cinza (`eb590e1`)

## 0.48.0, 2026-09-18, desde v0.47.0

### Novidades

- **lexico:** os 211 cartoes sao escritos, e os autores citados saem (`ccf650a`)
- **lexico:** cartao ganha "Algo esta errado", e o painel ganha a fila (`cf0b39a`)
- **lexico:** abreviacao com capitulo solto tambem vira link (`171b196`)
- **lexico:** abreviacao biblica vira link, e o cartao navega dentro de si (`6e94437`)

### Correções

- **ui:** dialog ganha elevacao, para o caso em que o veu nao resolve (`37e64de`)

## 0.47.0, 2026-09-18, desde v0.46.0

### Novidades

- **lexico:** a marcacao ganha cor por categoria, azul para pessoa e verde para lugar (`90f9c80`)
- **lexico:** nomes marcados viram cadastro com cartao, e o Biblo os usa como fonte (`9c30fba`)

### Correções

- **lexico:** salvar deixa de fechar o dialog, e a imagem trocada aparece na leitura (`88fcd06`)
- **lexico:** o indice para de ficar congelado ate um F5 (`10dc1a3`)
- **lexico:** cabecalho do cartao fecha com folga, e o cartao alarga no desktop (`7cc1a19`)
- **lexico:** a imagem do cartao vira o retrato do cabecalho, ao lado do titulo (`d345f41`)
- **lexico:** a faixa da imagem do cartao cai para metade da altura (`1156de9`)
- **lexico:** imagem do cartao nao e mais cortada (`63b65fb`)
- **lexico:** publicar grava o formulario, em vez de conferir a linha antiga (`9eb0ffb`)

### Outros

- **lexico:** as marcacoes coloridas caem para um degrau acima do piso (`522274e`)

## 0.46.0, 2026-09-18, desde v0.45.0

### Novidades

- **session:** menu do resumo mais respirado, alerta em todo modo, autor e local editaveis no editor (`44c8446`)

### Correções

- **build:** contorna ::highlight() nao suportado pelo parser do Turbopack (`0e026e3`)

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
