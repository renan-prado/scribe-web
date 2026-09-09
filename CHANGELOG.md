# Changelog

Cada versão aqui é um **corte de medição**, não um enfeite: ela é o valor de
`llm_usage_events.app_version` no `/admin/usage`, onde custo por chamada e
latência são comparados versão a versão. Quando aquela tabela disser que a
0.6.0 ficou mais cara, é esta lista que responde POR QUÊ.

Gerado por `npm run release` a partir dos Conventional Commits. `feat` sobe o
minor; o resto sobe o patch. Não edite à mão — a próxima execução escreve por
cima do topo do arquivo.

## 0.7.0 — 2026-09-09 — desde v0.6.0

### Novidades

- **youtube:** importar sermões de vídeos do YouTube (`15d71d5`)

## 0.6.0 — 2026-09-09 — desde v0.5.0

### Novidades

- **feedback:** pesquisa de satisfação nos marcos de gravação e estudo (`cff661e`)

## 0.5.0 — 2026-09-09 — desde v0.4.0

### Novidades

- **referrals:** botão de voltar em /indicar, seguindo a porta de entrada (`b662f8e`)

## 0.4.0 — 2026-09-09 — desde v0.3.0

### Novidades

- **referrals:** indique a um amigo, e moedas por cadastro para o parceiro (`709013b`)

## 0.3.0 — 2026-09-09 — desde v0.2.0

### Novidades

- **admin:** margem por versão, recortando a moeda pela janela em que ela esteve no ar (`78861bc`)

### Correções

- **session:** a barra de filtros das listas ganha um layout próprio no celular (`a182487`)

### Outros

- **app:** /list vira /recordings, e o caminho antigo responde 308 (`3666333`)

## 0.2.0 — 2026-09-09 — desde v0.1.0

### Novidades

- **admin:** custo e latência comparáveis versão a versão, e a versão sobe sozinha (`553709b`)
