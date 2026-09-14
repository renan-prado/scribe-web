# Changelog

Cada versão aqui é um **corte de medição**, não um enfeite: ela é o valor de
`llm_usage_events.app_version` no `/admin/usage`, onde custo por chamada e
latência são comparados versão a versão. Quando aquela tabela disser que a
0.6.0 ficou mais cara, é esta lista que responde POR QUÊ.

Gerado por `npm run release` a partir dos Conventional Commits. `feat` sobe o
minor; o resto sobe o patch. Não edite à mão, a próxima execução escreve por
cima do topo do arquivo.

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
