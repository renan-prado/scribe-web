-- 0081: o teto da imagem do léxico sobe de 2 MB para 8 MB.
--
-- A imagem do cartão virou um BANNER 21/9 (ver `LexiconCardDialog`), e o teto
-- da 0063 passou a recusar o insumo do próprio produto: uma arte nessa
-- proporção em resolução decente (2100x900 e acima) passa dos 2 MB sem esforço
-- em PNG, que é o formato de quem exporta um mapa, uma planta do templo ou uma
-- linha do tempo. Esse é justamente o caso que o SVG da 0064 existe para
-- servir, e nem todo mundo tem como entregar vetorizado.
--
-- O teto existe para não guardar um arquivo de câmera por engano, não para
-- obrigar quem escreve o cartão a passar a arte por um compressor antes. O
-- bucket é público mas a escrita continua sendo só do service-role, atrás de
-- `requireAdmin`: o que se paga ao subir o número é espaço em disco, não porta
-- aberta.
--
-- `LEXICON_LIMITS.imageBytes` (client-safe) e o `MAX_BODY_BYTES` da rota de
-- upload espelham este valor, pela régua de sempre: o Zod produz MENSAGEM, o
-- banco produz GARANTIA. Mexer num sem mexer no outro troca um aviso no
-- formulário por um erro de infraestrutura que a tela repassa sem saber o que
-- dizer.
--
-- A lista de tipos vai junto porque este `update` a reescreve: ela é a da 0064
-- (com `image/svg+xml`), e omiti-la aqui a derrubaria de volta para a da 0063.

update storage.buckets
   set file_size_limit = 8388608,
       allowed_mime_types = array[
         'image/jpeg',
         'image/png',
         'image/webp',
         'image/svg+xml'
       ]
 where id = 'lexicon';
