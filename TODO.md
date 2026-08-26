# TODO

## Estado e arquitetura

- [x] Modularizar o projeto - organizar em modulos - /features ou algo semelhante
- [x] Criar stores para centralizar os estados que fizerem sentido ao modulo
- [x] Diminuir o prop drilling existente no projeto
  
## Tailwind
- [x] existe muito atributo style={}, a aplicação precisa ser tailwind first e só usar style em casos dinamicos extremos
- [x] melhore as variaveis de tamanho e cores, etc... no tailwind, pois tem muito valor sendo passado na mão nos componentes
- [x] melhore o style guide do tailwind e projeto
- [x] use o tailwind mais recente

## Qualidade e segurança

- [ ] encontrar e melhorar vunerabilidades de autenticação
- [ ] Fazer uma revisão de segurança do projeto
- [x] Fazer uma revisão geral da qualidade do código
- [x] Revisar partes do código criadas pela IA que podem ter ficado mal estruturadas

## Coisas para prestar atenção
- [x] Ausencia de rate-limit (limitação por ip, limitação por conta, etc...)
- [ ] Configuração do cors (localhost e scriba.cc)
- [ ] Analisar se api está devolvendo dados sensiveis de usuario
- [ ] mensagem generica de erro de login para não dar dicas se existe o usuario ou se a senha é certa
- [ ] sql injection + proteger inputs e endpoints
- [ ] add app no google search console (acho que isso é manual)
- [ ] fazer perfil no google negocio (manual tambem)
- [x] criar llms.txt e robots.txt
- [ ] testar speedpage (manual?)
- [x] melhorar seo e add meta dados, meta descriptions
- [x] criar xml sitemap (sitemap.xml)
- [ ] configurar dados no google analitics (manual)
- [x] pagina 404 propria e customizada (no design da aplicação atual, bem humorado)
- [ ] comprimir imagens (acho que nao precisamos ainda)
- [x] og:image
- [x] politicas e privacidades e cookies (precisamos gerar um mesmo que generico ainda)
- [ ] monitor de uptime
- [ ] rastreamento de erro (depois eu faço, ignora)