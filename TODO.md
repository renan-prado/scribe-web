# TODO

## Estado e arquitetura

- [ ] Adicionar Zustand ao projeto
- [ ] Criar um store para centralizar os estados que fizerem sentido
- [ ] Diminuir o prop drilling existente no projeto

## Autenticação

- [ ] Adicionar validações de usuário autenticado/não autenticado no middleware
- [ ] Revisar validações de autenticação que atualmente estão sendo feitas diretamente dentro das páginas

## Controle de uso

- [ ] Adicionar controle de minutos disponíveis por usuário
- [ ] Associar a quantidade de minutos disponíveis ao usuário (ex.: contas de teste com 50 minutos)
- [ ] Ao processar um sermão, descontar os minutos utilizados do saldo do usuário
- [ ] Atualizar o saldo conforme o usuário utiliza a aplicação
- [ ] Por enquanto não haverá sistema de pagamento — inicialmente serão disponibilizadas contas para amigos testarem

## Interface

- [ ] Melhorar a lista de sermões da página Home (visual/layout)
- [ ] Melhorar o layout da área de Backstage
- [ ] Aproximar o visual do Backstage de um dashboard organizado em blocos/cards (referência: estilo do dashboard do ChatCM), mantendo a ideia atual

## Qualidade e segurança

- [ ] Fazer uma revisão de segurança do projeto
- [ ] Fazer uma revisão geral da qualidade do código
- [ ] Revisar partes do código criadas pela IA que podem ter ficado mal estruturadas

## Custo de processamento

- [ ] Continuar pesquisando maneiras de economizar no processamento
- [ ] Buscar formas de diminuir o custo por minuto de sermão processado
