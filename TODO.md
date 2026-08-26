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
- [x] Configuração do cors (localhost e scriba.cc)
- [x] sql injection + proteger inputs e endpoints
- [x] criar llms.txt e robots.txt
- [x] melhorar seo e add meta dados, meta descriptions
- [x] criar xml sitemap (sitemap.xml)
- [x] pagina 404 propria e customizada (no design da aplicação atual, bem humorado)
- [x] og:image
- [x] politicas e privacidades e cookies (precisamos gerar um mesmo que generico ainda)
- [ ] add app no google search console (acho que isso é manual)
- [ ] fazer perfil no google negocio (manual tambem)
- [ ] testar speedpage (manual?)
- [ ] configurar dados no google analitics (manual)
- [ ] monitor de uptime
- [ ] rastreamento de erro (depois eu faço, ignora)