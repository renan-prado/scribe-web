-- O bucket do léxico passa a aceitar SVG.
--
-- POR QUE ELE NÃO ESTAVA NA LISTA. A 0063 abriu com os três formatos de FOTO
-- (jpeg, png, webp), e um cartão de personagem bíblico nasceu pensando em
-- pintura. Mas boa parte do que ilustra um lugar não é foto: mapa, rota do
-- êxodo, planta do templo, linha do tempo — tudo desenho, tudo vetor, e tudo
-- coisa que num PNG fica borrada no zoom de um celular e pesa dez vezes mais.
--
-- SVG É EXECUTÁVEL, e é por isso que esta migração tem cabeçalho.
-- Um arquivo `.svg` pode conter `<script>`. O que torna isto aceitável aqui são
-- três coisas, e as três precisam continuar verdadeiras:
--
--   1. QUEM SOBE É O ADMIN. Não é upload de usuário. A rota está atrás de
--      `requireAdmin()` e o bucket não tem policy de escrita nenhuma.
--   2. O ARQUIVO MORA EM OUTRA ORIGEM. O bucket é servido pelo domínio do
--      projeto Supabase, não por `scriba.cc`. Script que rodasse ali não
--      alcançaria cookie, sessão nem localStorage do aplicativo.
--   3. A TELA O DESENHA COMO IMAGEM. `<img>` (e o `next/image` por cima dele)
--      não executa script de SVG — nenhum navegador executa. Quem executa é
--      `<object>`, `<iframe>`, `<embed>` e a navegação direta para o arquivo.
--      **Nenhum caminho do produto pode desenhar a imagem do cartão por um
--      desses quatro**, e é a terceira perna deste banquinho.
--
-- O `next.config.ts` precisou de `dangerouslyAllowSVG` junto com esta migração,
-- pela mesma razão: o otimizador do Next recusa SVG por padrão. Lá a tranca é
-- a CSP `script-src 'none'; sandbox`, que vale para o arquivo servido por nós.

update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg',
         'image/png',
         'image/webp',
         'image/svg+xml'
       ]
 where id = 'lexicon';
