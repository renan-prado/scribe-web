# Changelog

Cada versão aqui é um **corte de medição**, não um enfeite: ela é o valor de
`llm_usage_events.app_version` no `/admin/usage`, onde custo por chamada e
latência são comparados versão a versão. Quando aquela tabela disser que a
0.6.0 ficou mais cara, é esta lista que responde POR QUÊ.

Gerado por `npm run release` a partir dos Conventional Commits. `feat` sobe o
minor; o resto sobe o patch. Não edite à mão, a próxima execução escreve por
cima do topo do arquivo.

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
