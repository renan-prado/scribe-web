-- Os cartões do LÉXICO: as 211 entradas ganham título, descrição e apelidos, e
-- acendem. E os "Autores citados" saem.
--
-- POR QUE ISTO É UMA MIGRAÇÃO, e não trabalho no painel. O cadastro do
-- `/admin/lexicon` existe justamente para que escrever cartão não precise de
-- deploy, e foi por ele que as primeiras 39 entradas foram escritas. Só que ele
-- escreve num banco SÓ: o que foi preenchido em dev ficou em dev, e produção
-- continuou com as 258 linhas nascidas como rascunho na 0063, ou seja, com o
-- léxico inteiro apagado na tela de quem paga. Não há no produto um caminho que
-- leve conteúdo de um ambiente ao outro, e inventar um (exportar, importar,
-- sincronizar) seria construir um mecanismo permanente para uma carga que
-- acontece uma vez. A migração já é esse caminho: ela roda nos dois, na mesma
-- ordem, e deixa os dois iguais.
--
-- Por isso as 39 escritas à mão estão aqui junto das 172 novas. Em dev elas
-- reescrevem o que já está lá, palavra por palavra; em produção são a única
-- forma de chegarem. Separá-las exigiria lembrar, no dia do push de produção,
-- que existe uma segunda metade em algum lugar.
--
-- IDEMPOTENTE POR SLUG. Toda linha é `update ... where slug = '...'`, nunca
-- insert: as 258 entradas já existem desde a 0063, e o slug é a identidade
-- estável (a 0063 explica por que ele não é recalculado quando o termo muda).
-- Rodar de novo reescreve o mesmo texto.
--
-- OS AUTORES CITADOS SAEM, por ora. Eram 47 linhas de `figure`, todas rascunho,
-- de Agostinho a Dostoiévski. Nenhuma foi escrita, e escrevê-las é um problema
-- diferente do de um personagem bíblico: Abraão tem um texto que a igreja
-- inteira reconhece, enquanto "quem foi Karl Barth" é uma posição, e uma
-- posição escrita por nós no cartão de um sermão alheio. A categoria `figure`
-- CONTINUA no código e no CHECK da tabela, porque a decisão é sobre conteúdo,
-- não sobre esquema: no dia em que houver um critério editorial para esses
-- cartões, as entradas voltam com um insert e mais nada precisa mudar.
--
-- OS APELIDOS NÃO PODEM SER PALAVRA DO PORTUGUÊS. O anotador casa EXATO, acento
-- e maiúscula inclusive (ver `lib/domain/annotate.ts`), então um apelido como
-- "Luz" para Betel acenderia um cartão de cidade em cima da palavra luz no
-- começo de qualquer frase, e "Cão" para Cam faria pior. Pelo mesmo motivo
-- nenhum apelido daqui é o TERMO de outra entrada: "Edom" é o nome do lugar,
-- não um apelido de Esaú, senão duas entradas disputam o mesmo casamento e
-- quem ganha depende da ordem do índice. Também ficaram de fora os gentílicos
-- ("romanos", "gálatas", "colossenses"), que são nome de livro antes de serem
-- nome de povo, e a primeira passada do anotador já os leva para a referência
-- bíblica.
--
-- ISRAEL É UM NOME SÓ, E TRÊS COISAS. É o nome dado a Jacó na luta do vau de
-- Jaboque, é o povo que veio dele e é a terra que esse povo ocupou. A entrada
-- ficou como `place`, que é o que um sermão quase sempre quer dizer ao falar
-- "Israel", e o cartão abre justamente pela pessoa, porque sem isso a terra não
-- se explica. "Israel" NÃO virou apelido de Jacó: seria o mesmo nome levando a
-- dois cartões, e o errado ganharia na maioria das ocorrências. É o tratamento
-- que as entradas do próprio painel já davam a Ana, Ananias, Antioquia e José:
-- um cartão, que começa dizendo quantos são.


-- OS AUTORES CITADOS -----------------------------------------------------------
-- Antes dos cartões, porque depois dele a contagem da tabela é a definitiva:
-- 211 entradas, todas com texto, todas acesas.

delete from public.lexicon_entries where category = 'figure';


-- PERSONAGENS BÍBLICOS (145) --------------------------------------------------

update public.lexicon_entries set
  aliases = array['Abede-Nego', 'Abednego', 'Abede Nego', 'Azarias'],
  title = 'Abede-Nego ou Azarias',
  description = 'Um dos jovens israelitas levados ao cativeiro na Babilônia junto com Daniel, Sadraque e Mesaque. Seu nome hebraico era Azarias, mas o chefe dos oficiais do rei lhe deu o nome babilônico Abede-Nego, em referência ao deus Nebo, como parte do processo de assimilação à corte de Nabucodonosor.

Junto com Sadraque e Mesaque, Abede-Nego se recusou a se curvar diante da estátua de ouro erguida pelo rei Nabucodonosor, mesmo sob ameaça de morte. Por desobedecerem à ordem, os três foram lançados numa fornalha ardente (Daniel 3).

Dentro do fogo, uma quarta figura apareceu ao lado deles, descrita como semelhante a "um filho dos deuses", e os três saíram ilesos, sem sequer cheiro de fumaça em suas roupas. O episódio impressionou Nabucodonosor, que reconheceu o poder do Deus deles e promoveu os três na província da Babilônia.',
  published = true
where slug = 'abede-nego';

update public.lexicon_entries set
  aliases = array['Abel', 'Hevel', 'Hebel', 'Habel'],
  title = 'Abel',
  description = 'Segundo filho de Adão e Eva, irmão de Caim. Abel era pastor de ovelhas e ofereceu a Deus os primogênitos do seu rebanho; Caim, agricultor, ofereceu frutos da terra. Deus aceitou a oferta de Abel e rejeitou a de Caim, o que despertou ciúme e ira em Caim, que matou o irmão no campo, o primeiro assassinato registrado na Bíblia (Gênesis 4:1-16). Por isso Abel é lembrado como o primeiro mártir das Escrituras. Jesus o cita como o primeiro dos "justos" perseguidos (Mateus 23:35), e a carta aos Hebreus destaca sua fé (Hebreus 11:4) e menciona "o sangue de Abel" como símbolo de clamor por justiça (Hebreus 12:24).',
  published = true
where slug = 'abel';

update public.lexicon_entries set
  aliases = array['Abrão', 'Abraão', 'Abraao', 'Abram', 'Avraham', 'Abrao'],
  title = 'Abraão, o pai da fé',
  description = 'Patriarca chamado por Deus para deixar Ur dos caldeus e ir a uma terra que lhe seria mostrada, com a promessa de se tornar pai de uma grande nação (Gênesis 12:1-3).

Casado com Sara, teve Ismael com a serva Agar e, já em idade avançada, Isaque com Sara, cumprindo a promessa divina. Deus fez um pacto com Abraão selado pela circuncisão (Gênesis 17) e testou sua fé pedindo o sacrifício de Isaque, interrompido por um anjo no último momento (Gênesis 22).

É considerado o patriarca do povo de Israel e, no Novo Testamento, é apresentado como modelo de fé e chamado "amigo de Deus" (Romanos 4, Hebreus 11:8-19, Tiago 2:23).',
  published = true
where slug = 'abraao';

update public.lexicon_entries set
  aliases = array['Absalão', 'Absalao', 'Absalom'],
  title = 'Absalão, o filho que se rebelou contra Davi',
  description = 'Terceiro filho do rei Davi, conhecido pela beleza e, especialmente, pelos cabelos longos e fartos. Sua irmã Tamar foi violentada pelo meio-irmão Amnom, e Absalão, sem que Davi tomasse providências, planejou vingança e mandou matar Amnom durante uma festa. Depois disso, fugiu para Gesur, onde ficou exilado por três anos, até ser trazido de volta a Jerusalém por intervenção de Joabe.

Mesmo reconciliado, Absalão passou a conspirar contra o próprio pai, conquistando o apoio do povo à porta da cidade e, por fim, se proclamando rei em Hebrom. Davi teve que fugir de Jerusalém diante do avanço do filho, e o conflito entre os dois se transformou em guerra civil (2 Samuel 13-18).

Na batalha final, o exército de Absalão foi derrotado, e ele, fugindo montado numa mula, ficou com a cabeça presa nos galhos de um carvalho. Joabe o matou ali, desobedecendo à ordem explícita de Davi de poupar a vida do filho. A notícia da morte de Absalão levou Davi a um dos lamentos mais conhecidos das Escrituras: "Meu filho Absalão, meu filho, meu filho Absalão!" (2 Samuel 18:33).',
  published = true
where slug = 'absalao';

update public.lexicon_entries set
  aliases = array['Acabe', 'Acab', 'Ahab'],
  title = 'Acabe, o rei de Israel casado com Jezabel',
  description = 'Filho de Onri, foi rei do reino do Norte (Israel) e reinou a partir de Samaria. Casou-se com Jezabel, princesa de Sidom, e sob influência dela promoveu o culto a Baal em Israel, construindo um templo para o deus e afastando o povo da adoração exclusiva ao Senhor.

Seu reinado é marcado pelo confronto constante com o profeta Elias, que anunciou uma seca como julgamento pela idolatria e depois venceu os profetas de Baal num célebre desafio no Monte Carmelo, provando que o Senhor era o verdadeiro Deus (1 Reis 18).

Outro episódio marcante é o da vinha de Nabote: como Acabe queria a propriedade de um vizinho chamado Nabote e este se recusou a vendê-la, Jezabel arquitetou uma acusação falsa que levou à morte de Nabote, permitindo que Acabe tomasse a vinha. Elias confrontou o rei e profetizou sua ruína (1 Reis 21).

Acabe morreu em batalha contra o rei da Síria em Ramote-Gileade, atingido por uma flecha disparada ao acaso. Seu sangue escorreu pela carruagem e foi lambido por cães, cumprindo a palavra que Elias havia profetizado contra ele (1 Reis 22).',
  published = true
where slug = 'acabe';

update public.lexicon_entries set
  aliases = array['Adão', 'Adao', 'Adam'],
  title = 'Adão, o primeiro homem criado por Deus',
  description = 'Formado por Deus a partir do pó da terra, recebeu o sopro da vida e se tornou o primeiro ser humano (Gênesis 2:7). Foi colocado no Jardim do Éden para cultivá-lo e cuidar dele, com a incumbência de nomear os animais. Como não havia entre eles alguém semelhante a ele, Deus criou Eva a partir de uma de suas costelas para ser sua companheira.

Adão e Eva viviam livremente no Éden, com apenas uma restrição: não comer do fruto da árvore do conhecimento do bem e do mal. Ao desobedecerem, tentados pela serpente, trouxeram o pecado e a morte para a humanidade, e foram expulsos do jardim (Gênesis 3). A partir daí, Adão passou a viver do trabalho da terra, e sua história marca o início da linhagem humana descrita nas Escrituras.

No Novo Testamento, Adão é usado por Paulo como figura de contraste com Jesus: enquanto por Adão o pecado e a morte entraram no mundo, por Cristo, o "último Adão", vem a vida e a redenção (Romanos 5:12-19, 1 Coríntios 15:22,45).',
  published = true
where slug = 'adao';

update public.lexicon_entries set
  aliases = array['Ageu', 'Hageu', 'Haggai'],
  title = 'Ageu, o profeta que pediu a reconstrução do templo',
  description = 'Profeta do Antigo Testamento que atuou logo após o retorno do povo de Israel do cativeiro babilônico, no segundo ano do rei persa Dario, por volta de 520 a.C. É autor do livro que leva seu nome, um dos menores do Antigo Testamento.

Sua mensagem central era um chamado à reconstrução do templo de Jerusalém, que havia sido deixada de lado enquanto o povo cuidava das próprias casas. Ageu dirigiu suas profecias principalmente a Zorobabel, governador de Judá, e a Josué, o sumo sacerdote, incentivando-os a retomar as obras.

O profeta associou o atraso na reconstrução do templo às más colheitas e dificuldades econômicas que o povo enfrentava, e prometeu bênção e a presença de Deus caso a obra fosse retomada. Também anunciou que a glória futura daquele templo seria maior que a do templo anterior, e dirigiu a Zorobabel uma promessa messiânica, chamando-o de "selo" escolhido por Deus (Ageu 2:23).',
  published = true
where slug = 'ageu';

update public.lexicon_entries set
  aliases = array['Amós', 'Amos'],
  title = 'Amós, o profeta que clamou por justiça',
  description = 'Profeta do Antigo Testamento, originário de Tecoa, na Judeia, onde trabalhava como pastor de ovelhas e cultivador de figueiras bravas. Mesmo sendo do reino do Sul, foi enviado por Deus para profetizar contra o reino do Norte (Israel), durante os reinados de Uzias em Judá e Jeroboão II em Israel, no século 8 a.C.

Sua mensagem denuncia com força a injustiça social, a exploração dos pobres e a hipocrisia religiosa de um povo que cumpria rituais e festas enquanto oprimia os necessitados. Ficou conhecido pelo apelo por justiça verdadeira, resumido na frase "corra a justiça como as águas, e a retidão como um ribeiro que não seca" (Amós 5:24).

Amós enfrentou oposição direta do sacerdote Amasias, em Betel, que tentou expulsá-lo do santuário real por suas profecias de julgamento contra Israel (Amós 7:10-17). Além de anunciar o castigo sobre Israel, o livro traz oráculos de juízo contra várias nações vizinhas e termina com uma promessa de restauração futura para o povo.',
  published = true
where slug = 'amos';

update public.lexicon_entries set
  aliases = array['Ana', 'Hannah', 'Channah', 'Anna'],
  title = 'Ana',
  description = 'Há duas mulheres chamadas Ana nas Escrituras. A primeira é Ana, esposa de Elcana, no Antigo Testamento. Estéril e angustiada por não ter filhos, orou intensamente no santuário de Siló pedindo um filho ao Senhor, prometendo dedicá-lo a ele. Deus atendeu seu pedido com o nascimento de Samuel, e Ana cumpriu o voto entregando o menino ainda pequeno para servir no santuário. Em resposta, entoou um cântico de louvor que depois inspirou o Magnificat de Maria (1 Samuel 1-2).

A segunda é Ana, a profetisa, no Novo Testamento. Viúva idosa da tribo de Aser, passava os dias no templo de Jerusalém em jejum e oração. Quando Maria e José levaram o menino Jesus ao templo para a apresentação exigida pela lei, Ana o reconheceu como o Messias e passou a falar dele a todos que esperavam a redenção de Jerusalém (Lucas 2:36-38).',
  published = true
where slug = 'ana';

update public.lexicon_entries set
  aliases = array['Ananias', 'Hananias', 'Hananiah'],
  title = 'Ananias',
  description = 'O nome Ananias aparece três vezes no livro de Atos, para três pessoas diferentes. O primeiro é Ananias, marido de Safira, um dos primeiros cristãos em Jerusalém. Junto com a esposa, vendeu uma propriedade e entregou à igreja apenas parte do valor, fingindo que era o total. Confrontado por Pedro sobre a mentira, caiu morto na hora, e Safira teve o mesmo destino pouco depois, ao repetir a mesma falsidade (Atos 5:1-11).

O segundo é Ananias de Damasco, um discípulo que recebeu de Jesus, em visão, a instrução de ir até Saulo de Tarso, que havia acabado de ter o encontro que o converteria no apóstolo Paulo. Apesar do medo, já que Saulo era perseguidor dos cristãos, Ananias obedeceu, orou por ele, devolveu-lhe a visão e o batizou (Atos 9:10-19).

O terceiro é Ananias, o sumo sacerdote, que presidiu o julgamento de Paulo perante o Sinédrio e mais tarde perante o governador Félix, acusando-o formalmente diante das autoridades romanas (Atos 23-24).',
  published = true
where slug = 'ananias';

update public.lexicon_entries set
  aliases = array['André', 'Andre', 'Andreas'],
  title = 'André, o primeiro apóstolo chamado por Jesus',
  description = 'Pescador de Betsaida, irmão de Simão Pedro. Antes de seguir Jesus, era discípulo de João Batista, e foi um dos primeiros a deixá-lo para acompanhar Jesus, quando este foi apontado como o "Cordeiro de Deus" (João 1:35-40). Logo em seguida, André foi buscar seu irmão Simão e o apresentou a Jesus, sendo por isso lembrado na tradição como o primeiro dos apóstolos a ser chamado.

André integra a lista dos doze apóstolos em todos os evangelhos sinóticos e em Atos (Mateus 10:2, Marcos 3:18, Lucas 6:14, Atos 1:13). Aparece em outros momentos do ministério de Jesus, como na multiplicação dos pães, quando indica o menino que tinha cinco pães e dois peixes (João 6:8-9), e junto com Filipe, quando leva a Jesus o pedido de alguns gregos que queriam vê-lo (João 12:20-22).

A tradição cristã posterior associa André à pregação do evangelho na região da Ásia Menor e da Grécia, e ao martírio por crucificação, numa cruz em formato de X, hoje conhecida como "cruz de Santo André".',
  published = true
where slug = 'andre';

update public.lexicon_entries set
  aliases = array['Apolo', 'Apollos'],
  title = 'Apolo, pregador eloquente de Alexandria',
  description = 'Judeu natural de Alexandria, no Egito, descrito como homem eloquente e profundamente versado nas Escrituras. Chegou a Éfeso pregando com fervor sobre Jesus, mas conhecia apenas o batismo de João. O casal Priscila e Áquila, ao ouvi-lo, o levaram à parte e explicaram-lhe o caminho de Deus com mais exatidão (Atos 18:24-26).

Depois disso, Apolo seguiu para a Acaia, região onde ficava Corinto, com uma carta de recomendação dos irmãos de Éfeso. Lá, refutou publicamente os judeus, demonstrando pelas Escrituras que Jesus era o Messias, e ajudou bastante os que já haviam crido (Atos 18:27-28).

Sua atuação em Corinto acabou gerando divisões na igreja local, com alguns se identificando como seguidores de Apolo e outros de Paulo. Paulo corrigiu essa disputa lembrando que ambos eram apenas servos de Deus trabalhando juntos: um plantou, o outro regou, mas quem faz crescer é Deus (1 Coríntios 1:12; 3:4-9). Mais tarde, Paulo ainda recomenda que se prepare bem a viagem de Apolo (Tito 3:13).',
  published = true
where slug = 'apolo';

update public.lexicon_entries set
  aliases = array['Áquila', 'Aquila', 'Aquilas'],
  title = 'Áquila, artesão e colaborador de Paulo',
  description = 'Judeu natural do Ponto, fabricante de tendas de profissão, a mesma de Paulo. Vivia em Roma com a esposa Priscila até serem obrigados a deixar a cidade por um decreto do imperador Cláudio que expulsou os judeus. O casal se estabeleceu em Corinto, onde conheceu Paulo, e os três passaram a trabalhar juntos no ofício (Atos 18:1-3).

Áquila e Priscila acompanharam Paulo em parte de sua viagem até Éfeso e permaneceram na cidade. Foi ali que, ao ouvir Apolo pregando com conhecimento incompleto, o casal o levou à parte e lhe explicou o caminho de Deus com mais exatidão (Atos 18:18-26).

O casal aparece em diversas cartas de Paulo com grande apreço. Em Romanos, são chamados de cooperadores que arriscaram a própria vida por Paulo (Romanos 16:3-4), e é mencionado que uma igreja se reunia na casa deles, tanto em Éfeso quanto depois em Roma (1 Coríntios 16:19, Romanos 16:5).',
  published = true
where slug = 'aquila';

update public.lexicon_entries set
  aliases = array['Arão', 'Arao', 'Aaron'],
  title = 'Arão, primeiro sumo sacerdote de Israel',
  description = 'Irmão mais velho de Moisés e de Miriã, da tribo de Levi. Quando Moisés alegou não ser bom orador para falar diante do Faraó, Deus designou Arão para ser seu porta-voz, e os dois juntos confrontaram o rei do Egito, com Arão realizando sinais com sua vara, como transformá-la em serpente (Êxodo 4:14-16, 7:8-13).

Após a saída do Egito, Arão foi consagrado como o primeiro sumo sacerdote de Israel, junto com seus filhos, dando início à linhagem sacerdotal do povo (Levítico 8). Porém, durante a ausência de Moisés no Monte Sinai, cedeu à pressão do povo e fabricou o bezerro de ouro para ser adorado, um dos episódios mais graves de sua trajetória (Êxodo 32).

Sua autoridade sacerdotal foi contestada mais tarde por outros líderes, mas confirmada quando, entre as varas das doze tribos colocadas diante do Senhor, apenas a de Arão brotou, floresceu e deu amêndoas da noite para o dia (Números 17). Arão morreu no Monte Hor, e suas vestes sacerdotais foram passadas ao filho Eleazar, que o sucedeu no sacerdócio (Números 20:22-29).',
  published = true
where slug = 'arao';

update public.lexicon_entries set
  aliases = array['Assuero', 'Xerxes', 'Ahasuerus', 'Assuérus'],
  title = 'Assuero, o rei persa do livro de Ester',
  description = 'Rei da Pérsia que reinava desde a Índia até a Etiópia, sobre cento e vinte e sete províncias, com capital em Susã. É geralmente identificado por historiadores com Xerxes I, que governou no início do século 5 a.C.

O livro de Ester começa com o banquete de cento e oitenta dias que ofereceu aos nobres do império, seguido de outro de sete dias para todo o povo de Susã. No auge da festa, mandou chamar a rainha Vasti para exibir sua beleza, e diante da recusa dela a destituiu por conselho de seus sábios, temerosos de que o exemplo se espalhasse entre as mulheres do reino (Ester 1).

Escolheu Ester como nova rainha sem saber de sua origem judaica. Depois, elevou Hamã acima de todos os príncipes e, sem examinar o conteúdo da acusação, autorizou com seu anel o decreto de extermínio dos judeus, dizendo apenas que a prata e o povo ficavam à disposição do ministro (Ester 3:8-11).

Numa noite de insônia, mandou ler as crônicas do reino e descobriu que Mardoqueu havia salvado sua vida sem ser recompensado (Ester 6). No segundo banquete de Ester, ao ouvir a denúncia da rainha, mandou enforcar Hamã e autorizou um novo decreto permitindo aos judeus se defenderem. Aparece no livro como um monarca facilmente influenciado, cujas decisões dependem de quem tem seu ouvido no momento.',
  published = true
where slug = 'assuero';

update public.lexicon_entries set
  aliases = array['Balaão', 'Balaao', 'Balaam', 'Bileão'],
  title = 'Balaão, o profeta e a jumenta que falou',
  description = 'Adivinho de Petor, junto ao rio Eufrates, contratado por Balaque, rei de Moabe, para amaldiçoar Israel quando o povo acampava nas planícies moabitas a caminho de Canaã. Deus proibiu que fosse, e depois permitiu que seguisse, mas com a condição de só falar o que lhe fosse dito (Números 22:1-21).

No caminho, o anjo do Senhor se pôs à sua frente com a espada desembainhada, invisível a ele mas visível à jumenta, que desviou três vezes. Ao ser espancada pela terceira vez, a jumenta falou e questionou o dono, e então os olhos de Balaão se abriram para o anjo (Números 22:22-35). É um dos episódios mais lembrados do Pentateuco.

Diante de Balaque, tentou por quatro vezes pronunciar maldição e por quatro vezes saiu bênção, para fúria do rei. No último oráculo anunciou: "uma estrela procederá de Jacó, e um cetro se levantará de Israel" (Números 24:17).

Apesar disso, seu nome ficou associado à corrupção: foi ele quem aconselhou Moabe a seduzir Israel pela idolatria em Baal-Peor (Números 31:16), e morreu na guerra contra os midianitas (Números 31:8). O Novo Testamento fala do "caminho de Balaão", que amou o prêmio da injustiça, e da "doutrina de Balaão" (2 Pedro 2:15, Judas 11, Apocalipse 2:14).',
  published = true
where slug = 'balaao';

update public.lexicon_entries set
  aliases = array['Baraque', 'Barak', 'Barac'],
  title = 'Baraque, o comandante convocado por Débora',
  description = 'Filho de Abinoão, de Quedes-Naftali, foi o comandante militar convocado pela profetisa Débora para enfrentar Sísera, chefe do exército de Jabim, rei de Canaã, que oprimia Israel havia vinte anos com novecentos carros de ferro (Juízes 4:1-7).

Débora lhe transmitiu a ordem de reunir dez mil homens de Naftali e Zebulom no monte Tabor. Baraque impôs uma condição: "se fores comigo, irei; mas se não fores, não irei". Débora concordou, mas avisou que por causa dessa escolha a glória da campanha não seria dele, pois o Senhor entregaria Sísera nas mãos de uma mulher (Juízes 4:8-9).

A batalha se deu junto ao ribeiro de Quisom, onde os carros de guerra ficaram inúteis. O exército cananeu foi destruído, e Sísera fugiu a pé até a tenda de Jael, mulher de Héber, que o matou com uma estaca enquanto ele dormia. Baraque chegou perseguindo o inimigo e o encontrou já morto (Juízes 4:12-22).

Junto com Débora, entoou o cântico de vitória registrado em Juízes 5. A carta aos Hebreus o inclui na lista dos que "pela fé venceram reinos" (Hebreus 11:32).',
  published = true
where slug = 'baraque';

update public.lexicon_entries set
  aliases = array['Barnabé', 'Barnabe', 'Barnabas', 'José Barnabé'],
  title = 'Barnabé, o filho da consolação',
  description = 'Levita natural de Chipre, chamava-se José e recebeu dos apóstolos o apelido de Barnabé, que significa "filho da consolação". Aparece pela primeira vez vendendo um campo que lhe pertencia e depositando o valor aos pés dos apóstolos (Atos 4:36-37).

Foi ele quem arriscou apresentar Saulo de Tarso aos discípulos de Jerusalém, que tinham medo do antigo perseguidor e não criam em sua conversão, contando-lhes como ele havia visto o Senhor no caminho e pregado com ousadia em Damasco (Atos 9:26-27).

Enviado a Antioquia para verificar a notícia de que gentios estavam crendo, alegrou-se com o que viu, exortou a todos a permanecerem firmes, e foi buscar Saulo em Tarso para ajudá-lo; os dois ensinaram ali por um ano inteiro, e foi nessa cidade que os discípulos passaram a ser chamados cristãos (Atos 11:22-26). O texto o descreve como "homem de bem, e cheio do Espírito Santo e de fé".

Partiu com Paulo na primeira viagem missionária, passando por Chipre e pela Ásia Menor, e os dois juntos defenderam no concílio de Jerusalém a liberdade dos gentios convertidos (Atos 13-15).

A parceria terminou numa discordância: Barnabé quis levar de novo João Marcos, que os havia abandonado antes, e Paulo se recusou. Separaram-se, e Barnabé seguiu com Marcos para Chipre (Atos 15:36-39). Anos depois, Paulo escreveria pedindo Marcos, por lhe ser útil para o ministério.',
  published = true
where slug = 'barnabe';

update public.lexicon_entries set
  aliases = array['Bartimeu', 'Bartimaeus', 'Bartimeo'],
  title = 'Bartimeu, o cego de Jericó',
  description = 'Mendigo cego, filho de Timeu, que estava sentado à beira do caminho na saída de Jericó. É um dos poucos beneficiados por um milagre cujo nome os evangelhos registram (Marcos 10:46).

Ao ouvir que era Jesus de Nazaré quem passava, começou a gritar: "Jesus, Filho de Davi, tem misericórdia de mim". Muitos o repreendiam para que se calasse, mas ele gritava ainda mais forte, repetindo o mesmo apelo. O título "Filho de Davi" é uma confissão messiânica, dita em voz alta por um mendigo cego às portas da cidade (Marcos 10:47-48).

Jesus parou e mandou chamá-lo. Os que antes o repreendiam mudaram de tom: "tem bom ânimo, levanta-te, que ele te chama". Bartimeu lançou fora a capa, o que para um mendigo significava abandonar onde recolhia as esmolas, deu um salto e foi até ele (Marcos 10:49-50).

A pergunta de Jesus foi a mesma feita pouco antes a Tiago e João: "que queres que te faça?". A diferença está na resposta. Onde os discípulos pediram lugares de honra, o cego pediu: "Mestre, que eu tenha vista". Jesus lhe disse que a sua fé o havia salvado, e imediatamente ele viu, e o seguiu pelo caminho (Marcos 10:51-52).

Mateus e Lucas narram o mesmo episódio sem dar o nome, e Mateus menciona dois cegos (Mateus 20:29-34, Lucas 18:35-43).',
  published = true
where slug = 'bartimeu';

update public.lexicon_entries set
  aliases = array['Bartolomeu', 'Bartholomew', 'Bartolomeo'],
  title = 'Bartolomeu, um dos doze apóstolos',
  description = 'Um dos doze apóstolos, mencionado nas quatro listas do Novo Testamento, sempre em companhia de Filipe nos evangelhos sinóticos (Mateus 10:3, Marcos 3:18, Lucas 6:14, Atos 1:13).

O nome é um patronímico: Bar-Tolmai significa "filho de Tolmai", o que sugere que ele tinha outro nome próprio. Por isso, desde os primeiros séculos, a tradição cristã o identifica com Natanael, que no evangelho de João é justamente quem Filipe leva a Jesus e que nos sinóticos não aparece nas listas, assim como Bartolomeu não aparece em João.

Nenhum episódio é narrado sob o nome de Bartolomeu. Está entre os que receberam autoridade para expulsar espíritos imundos e curar enfermidades quando Jesus enviou os doze (Mateus 10:1), e entre os que perseveravam em oração no cenáculo em Jerusalém depois da ascensão (Atos 1:13).

A tradição posterior associa sua pregação à Armênia, à Índia e à Mesopotâmia, e o martírio a uma execução particularmente cruel, motivo pelo qual costuma ser retratado na arte cristã segurando a própria pele.',
  published = true
where slug = 'bartolomeu';

update public.lexicon_entries set
  aliases = array['Baruque', 'Baruch', 'Baruc'],
  title = 'Baruque, o escriba de Jeremias',
  description = 'Filho de Nerias, foi secretário e companheiro do profeta Jeremias durante os últimos anos do reino de Judá.

Seu papel mais conhecido está em Jeremias 36. Impedido de entrar no templo, Jeremias ditou a Baruque todas as palavras que havia recebido, e o escriba as escreveu num rolo e as leu publicamente diante do povo num dia de jejum. Os príncipes ouviram o relato e levaram a notícia ao rei Jeoaquim, que mandou ler o rolo diante de si e, à medida que as colunas eram lidas, cortava-as com um canivete e as lançava no braseiro, até consumir tudo. A ordem seguinte foi prender o profeta e o escriba, mas o Senhor os escondeu. Jeremias ditou de novo o rolo, com muitas palavras semelhantes acrescentadas.

Em meio ao trabalho, Baruque desabafou: "ai de mim agora, porque me acrescentou o Senhor tristeza à minha dor". A resposta, registrada em Jeremias 45, é curta e severa: que não buscasse grandezas para si naqueles dias, mas receberia a própria vida como despojo em todo lugar aonde fosse.

Foi Baruque quem guardou as escrituras da compra do campo de Anatote num vaso de barro, para que durassem muitos dias (Jeremias 32:12-16). Depois da queda de Jerusalém, foi levado ao Egito junto com Jeremias (Jeremias 43:6).',
  published = true
where slug = 'baruque';

update public.lexicon_entries set
  aliases = array['Bate-Seba', 'Bateseba', 'Betsabé', 'Bathsheba'],
  title = 'Bate-Seba, mulher de Urias e depois de Davi',
  description = 'Filha de Eliã e esposa de Urias, o heteu, um dos guerreiros de elite de Davi. Numa tarde em que o rei andava pelo terraço do palácio, viu-a se banhando, mandou buscá-la e se deitou com ela. Bate-Seba engravidou (2 Samuel 11:1-5).

Para encobrir o ocorrido, Davi chamou Urias do campo de batalha na esperança de que fosse para casa, mas o soldado se recusou a dormir sob seu teto enquanto a arca e o exército estavam em campo. Davi então o mandou de volta com uma carta a Joabe, ordenando que fosse posto na linha de frente e abandonado ali, e Urias morreu (2 Samuel 11:6-17).

Passado o luto, Bate-Seba se tornou mulher de Davi. O profeta Natã confrontou o rei com a parábola do cordeiro da ovelha do pobre e anunciou o juízo. O filho nascido dessa união adoeceu e morreu, apesar do jejum de Davi (2 Samuel 12).

O segundo filho do casal foi Salomão. Anos depois, já idoso Davi, foi Bate-Seba quem, orientada por Natã, entrou nos aposentos do rei para lembrá-lo do juramento e garantir a sucessão do filho contra a tentativa de Adonias (1 Reis 1:11-31). Mateus a menciona na genealogia de Jesus, não pelo nome, mas como "a que fora mulher de Urias" (Mateus 1:6).',
  published = true
where slug = 'bate-seba';

update public.lexicon_entries set
  aliases = array['Belsazar', 'Belshazzar', 'Baltazar'],
  title = 'Belsazar, o rei da escrita na parede',
  description = 'Último governante da Babilônia mencionado no livro de Daniel, apresentado como filho de Nabucodonosor no sentido de sucessor da dinastia. Seu único episódio ocupa um capítulo inteiro e ficou conhecido pela expressão que originou.

Ofereceu um grande banquete a mil de seus grandes e, sob efeito do vinho, mandou trazer os vasos de ouro e prata que Nabucodonosor havia tomado do templo de Jerusalém, para que ele, seus nobres, suas mulheres e concubinas bebessem neles enquanto louvavam os deuses de ouro, prata, bronze, ferro, madeira e pedra (Daniel 5:1-4).

Naquele momento apareceram dedos de mão de homem que escreveram na parede caiada do palácio, diante do candeeiro. O rei empalideceu, seus joelhos bateram um no outro, e nenhum dos sábios conseguiu ler ou interpretar as palavras. Por sugestão da rainha, Daniel foi chamado (Daniel 5:5-12).

Daniel recusou as recompensas oferecidas, lembrou-lhe a humilhação de Nabucodonosor e acusou-o de não ter humilhado o coração apesar de saber de tudo aquilo. Depois leu a inscrição: "Mene, Mene, Tequel, Ufarsim", interpretada como o reino contado e acabado, o rei pesado na balança e achado em falta, e o reino dividido e dado aos medos e persas. Naquela mesma noite Belsazar foi morto, e Dario, o medo, tomou o reino (Daniel 5:25-31).',
  published = true
where slug = 'belsazar';

update public.lexicon_entries set
  aliases = array['Benjamim', 'Benjamin', 'Binyamin', 'Benoni'],
  title = 'Benjamim, o filho mais novo de Jacó',
  description = 'Décimo segundo e último filho de Jacó, segundo de Raquel, e o único dos irmãos nascido em Canaã. Raquel morreu ao dar à luz, e em seus últimos instantes o chamou de Benoni, "filho da minha dor"; Jacó trocou o nome para Benjamim, "filho da mão direita" (Gênesis 35:16-18).

Após o desaparecimento de José, tornou-se o filho mais querido de Jacó, que se recusava a deixá-lo viajar. Quando a fome obrigou os irmãos a voltar ao Egito, José exigiu vê-lo, e a cena em que o copo de prata é encontrado na bagagem de Benjamim leva Judá a se oferecer como escravo no lugar do irmão, provocando a revelação final de José (Gênesis 42-45).

A tribo de Benjamim ocupou um território pequeno mas estratégico, entre Efraim e Judá, incluindo Jerusalém e Jericó. Foi quase exterminada numa guerra civil narrada em Juízes 19-21 e depois reconstituída. Dela vieram Eúde, o juiz canhoto, e Saul, o primeiro rei de Israel.

Após a divisão do reino, Benjamim permaneceu ao lado de Judá. No Novo Testamento, o apóstolo Paulo se identifica como israelita "da tribo de Benjamim" (Romanos 11:1, Filipenses 3:5).',
  published = true
where slug = 'benjamim';

update public.lexicon_entries set
  aliases = array['Boaz', 'Booz'],
  title = 'Boaz, o resgatador que se casou com Rute',
  description = 'Homem rico e influente de Belém, parente de Elimeleque, marido de Noemi. Aparece pela primeira vez saudando os ceifeiros em sua propriedade com um "o Senhor seja convosco", e notando entre eles a estrangeira que respigava atrás dos segadores (Rute 2:1-5).

Ao saber que era Rute, a moabita que voltara com Noemi, ordenou que a deixassem respigar em segurança, que os moços não a tocassem, que ela bebesse da água dos trabalhadores, e que deixassem cair feixes de propósito no seu caminho. Explicou seu gesto dizendo que ouvira tudo o que ela fizera pela sogra e que viera abrigar-se sob as asas do Deus de Israel (Rute 2:8-16).

Quando Rute se apresentou a ele na eira durante a noite, pedindo que estendesse sobre ela a sua capa como resgatador, Boaz a elogiou e prometeu resolver a questão, mas avisou que havia um parente mais próximo com direito anterior (Rute 3).

No dia seguinte, reuniu dez anciãos à porta da cidade e tratou publicamente do assunto. O parente mais próximo desistiu do resgate, e Boaz adquiriu a propriedade e tomou Rute por mulher. Do casamento nasceu Obede, pai de Jessé e avô de Davi (Rute 4). Boaz é também o nome de uma das duas colunas do pórtico do templo de Salomão (1 Reis 7:21).',
  published = true
where slug = 'boaz';

update public.lexicon_entries set
  aliases = array['Caifás', 'Caifas', 'Caiaphas', 'José Caifás'],
  title = 'Caifás, o sumo sacerdote no julgamento de Jesus',
  description = 'Sumo sacerdote em Jerusalém entre cerca de 18 e 36 d.C., genro de Anás, que ocupara o cargo antes dele e continuava a exercer grande influência.

Após a ressurreição de Lázaro, com o número de seguidores de Jesus crescendo, reuniu-se o Sinédrio para deliberar sobre o risco de uma intervenção romana. Foi Caifás quem apresentou o argumento decisivo: "convém que um homem morra pelo povo, e que não pereça toda a nação". O evangelho de João observa que ele não disse isso por si mesmo, mas profetizou sem saber (João 11:47-52). A partir daquele dia, decidiram matá-lo.

Jesus foi levado primeiro a Anás e depois a Caifás, onde os escribas e anciãos estavam reunidos. As testemunhas convocadas não concordavam entre si, e Caifás por fim se levantou e o interrogou diretamente, exigindo sob juramento que dissesse se era o Cristo, o Filho de Deus. Diante da resposta, rasgou as próprias vestes, declarou que era blasfêmia e obteve a sentença de morte do conselho (Mateus 26:57-66).

Aparece ainda no livro de Atos, entre os que interrogaram Pedro e João depois da cura do coxo à porta do templo e lhes proibiram falar no nome de Jesus (Atos 4:5-18).',
  published = true
where slug = 'caifas';

update public.lexicon_entries set
  aliases = array['Caim', 'Cain', 'Qayin'],
  title = 'Caim, o primeiro homicida',
  description = 'Primeiro filho de Adão e Eva, irmão mais velho de Abel. Era agricultor e ofereceu a Deus frutos da terra, enquanto Abel, pastor, ofereceu os primogênitos do rebanho. Deus aceitou a oferta de Abel e rejeitou a de Caim, que se irou profundamente. Deus o advertiu de que o pecado estava à porta, como animal pronto a atacar, e que ele precisava dominá-lo (Gênesis 4:1-7).

Caim chamou o irmão ao campo e ali o matou, o primeiro homicídio registrado nas Escrituras. Questionado por Deus sobre onde estava Abel, respondeu com a frase que ficou célebre: "Sou eu o guardião do meu irmão?". Foi então amaldiçoado, condenado a errar pela terra sem que ela lhe desse fruto, mas recebeu um sinal de proteção para que ninguém o matasse (Gênesis 4:8-15).

Estabeleceu-se na terra de Node, a leste do Éden, onde construiu uma cidade que chamou de Enoque, nome de seu filho. Sua descendência é listada em Gênesis 4, e dela vêm os primeiros criadores de gado, músicos e artífices em bronze e ferro.

No Novo Testamento, Caim aparece como exemplo negativo: suas obras eram más (1 João 3:12), sua oferta foi inferior à de Abel por falta de fé (Hebreus 11:4), e Judas fala do "caminho de Caim" como figura da rebeldia (Judas 11).',
  published = true
where slug = 'caim';

update public.lexicon_entries set
  aliases = array['Calebe', 'Caleb', 'Kalev'],
  title = 'Calebe, o espia que confiou na promessa',
  description = 'Filho de Jefoné, da tribo de Judá, foi um dos doze homens enviados por Moisés para espiar a terra de Canaã. Dez voltaram assustados com as cidades fortificadas e os homens de grande estatura; apenas Calebe e Josué defenderam a entrada, e foi Calebe quem fez calar o povo diante de Moisés dizendo: "subamos animosamente e possuamo-la, porque certamente prevaleceremos contra ela" (Números 13:30).

O povo se recusou, e a geração que saiu do Egito foi condenada a morrer no deserto ao longo de quarenta anos. Calebe e Josué foram as duas únicas exceções, porque "seguiram plenamente ao Senhor" (Números 14:24, 30).

Quarenta e cinco anos depois, já com oitenta e cinco anos, Calebe se apresentou a Josué na partilha da terra e reivindicou a região montanhosa de Hebrom, onde estavam justamente os gigantes que assustaram os outros espias, dizendo que ainda estava tão forte quanto no dia em que fora enviado (Josué 14:6-14).

Tomou Hebrom e Debir, e ofereceu sua filha Acsa em casamento a quem conquistasse a cidade, o que foi feito por Otniel, seu parente, mais tarde o primeiro juiz de Israel (Josué 15:13-19).',
  published = true
where slug = 'calebe';

update public.lexicon_entries set
  aliases = array['Cam', 'Ham'],
  title = 'Cam, filho de Noé',
  description = 'Um dos três filhos de Noé, ao lado de Sem e Jafé, e pai de Cuxe, Mizraim, Pute e Canaã. Entrou na arca com o pai, os irmãos e as respectivas esposas, e atravessou com eles o dilúvio (Gênesis 7:13).

Depois do dilúvio, Noé plantou uma vinha, bebeu do vinho e ficou embriagado e descoberto dentro da tenda. Cam viu a nudez do pai e foi contar aos irmãos do lado de fora; Sem e Jafé, então, caminharam de costas com uma capa sobre os ombros para cobri-lo sem olhar. Ao despertar e saber do ocorrido, Noé amaldiçoou Canaã, filho de Cam, declarando que seria servo dos servos de seus irmãos (Gênesis 9:20-27).

A chamada Tábua das Nações apresenta os descendentes de Cam ocupando o Egito, a Etiópia, a Líbia e a região de Canaã, além de Ninrode, fundador de cidades como Babel e Nínive (Gênesis 10:6-20). Os salmos se referem ao Egito como "terra de Cam" (Salmos 105:23,27; 106:22).',
  published = true
where slug = 'cam';

update public.lexicon_entries set
  aliases = array['Coré', 'Core', 'Korah', 'Corá'],
  title = 'Coré, o levita que se rebelou contra Moisés',
  description = 'Levita da família de Coate, liderou junto com Datã, Abirão e Om uma revolta de duzentos e cinquenta príncipes da congregação contra a autoridade de Moisés e Arão no deserto. A acusação foi: "toda a congregação é santa, por que vos exaltais sobre o povo do Senhor?" (Números 16:1-3).

Moisés propôs uma prova: que cada um tomasse seu incensário e o apresentasse diante do Senhor, para que se visse a quem Deus escolhera. No dia seguinte, a terra se abriu sob as tendas dos rebeldes e os engoliu vivos com suas famílias e bens, enquanto fogo consumiu os duzentos e cinquenta que ofereciam incenso (Números 16:31-35).

Os incensários de bronze dos rebeldes foram batidos em lâminas e usados para cobrir o altar, como memorial de que ninguém que não fosse da descendência de Arão deveria oferecer incenso (Números 16:36-40).

A revolta prosseguiu no dia seguinte com a murmuração do povo, contida por Arão correndo com o incensário entre os vivos e os mortos. Os filhos de Coré, porém, não morreram (Números 26:11), e seu nome aparece no cabeçalho de vários salmos. A carta de Judas cita a "contradição de Coré" como exemplo de rebeldia (Judas 11).',
  published = true
where slug = 'core';

update public.lexicon_entries set
  aliases = array['Cornélio', 'Cornelio', 'Cornelius'],
  title = 'Cornélio, o centurião que abriu a porta aos gentios',
  description = 'Centurião romano da coorte chamada Italiana, sediado em Cesareia. É descrito como homem piedoso e temente a Deus com toda a sua casa, que fazia muitas esmolas ao povo e orava continuamente (Atos 10:1-2). Era gentio, isto é, não circuncidado e fora da aliança judaica.

Por volta das três da tarde, teve uma visão em que um anjo lhe disse que suas orações e esmolas haviam subido para memória diante de Deus, e o instruiu a mandar buscar em Jope um homem chamado Simão Pedro, hospedado na casa de um curtidor (Atos 10:3-8).

No dia seguinte, enquanto os enviados se aproximavam, Pedro subiu ao terraço para orar e teve a visão do lençol descido do céu com toda sorte de animais e a ordem de matar e comer. Recusou três vezes, alegando nunca ter comido nada impuro, e ouviu: "não chames tu comum ao que Deus purificou" (Atos 10:9-16).

Pedro foi a Cesareia e encontrou a casa cheia de parentes e amigos. Abriu o discurso reconhecendo o que acabara de compreender: "agora reconheço com verdade que Deus não faz acepção de pessoas". Enquanto ainda falava, o Espírito Santo desceu sobre todos os ouvintes, para espanto dos judeus que o acompanhavam, e eles foram batizados (Atos 10:34-48).

O episódio foi depois defendido por Pedro diante da igreja de Jerusalém e se tornou o precedente decisivo para a entrada dos gentios na igreja (Atos 11:1-18).',
  published = true
where slug = 'cornelio';

update public.lexicon_entries set
  aliases = array['Dalila', 'Delilah', 'Dalilá'],
  title = 'Dalila, a mulher que descobriu o segredo de Sansão',
  description = 'Mulher do vale de Soreque, por quem Sansão se apaixonou. Os príncipes dos filisteus a procuraram com uma proposta: descobrir de onde vinha a força extraordinária dele e como poderia ser subjugado, em troca de mil e cem moedas de prata de cada um, uma soma considerável (Juízes 16:4-5).

Três vezes ela perguntou, e três vezes Sansão mentiu: disse que seria amarrado com sete cordas de nervos frescos, depois com cordas novas nunca usadas, depois que as sete tranças de seu cabelo fossem tecidas na teia. Em cada ocasião, Dalila armou a cilada, chamou os filisteus escondidos no quarto e ele se soltou sem dificuldade (Juízes 16:6-14).

Insistindo diariamente até que a alma dele se angustiasse até a morte, acabou ouvindo a verdade: seu cabelo nunca fora cortado por ser nazireu desde o ventre. Ela o fez dormir sobre os joelhos, mandou rapar as sete tranças, e a força o deixou. Sansão despertou sem perceber que o Senhor se retirara dele (Juízes 16:15-20).

Os filisteus o prenderam, vazaram seus olhos e o levaram a Gaza para moer no cárcere. É o único episódio em que Dalila aparece nas Escrituras, e seu nome se tornou sinônimo popular de traição por sedução.',
  published = true
where slug = 'dalila';

update public.lexicon_entries set
  aliases = array['Daniel', 'Beltessazar', 'Belteshazzar'],
  title = 'Daniel, o profeta que sobreviveu à cova dos leões',
  description = 'Jovem israelita de origem nobre, levado para o cativeiro na Babilônia junto com outros jovens escolhidos para servir na corte real. Recusou-se a se contaminar com a comida e o vinho do rei, optando por uma dieta simples, e mesmo assim se destacou entre os demais em conhecimento e sabedoria (Daniel 1).

Daniel recebeu de Deus a capacidade de interpretar sonhos e visões, o que o tornou indispensável na corte babilônica. Interpretou para Nabucodonosor o sonho da estátua feita de diferentes metais, revelando a sucessão de impérios que viriam (Daniel 2), e mais tarde outro sonho sobre uma grande árvore derrubada (Daniel 4). Sua reputação como sábio o manteve em posição de destaque mesmo após a queda da Babilônia para os medos e persas.

Já idoso, sob o governo do rei Dario, Daniel continuou orando a Deus três vezes ao dia apesar de um decreto real que proibia orar a qualquer um além do rei. Por desobedecer, foi lançado na cova dos leões, mas saiu ileso na manhã seguinte, protegido por um anjo, episódio que levou o próprio rei a reconhecer o poder do Deus de Daniel (Daniel 6).

A segunda metade do livro de Daniel traz uma série de visões proféticas e apocalípticas, incluindo a visão de quatro bestas representando impérios sucessivos e a profecia das setenta semanas, textos que tiveram grande influência na literatura apocalíptica judaica e cristã posterior.',
  published = true
where slug = 'daniel';

update public.lexicon_entries set
  aliases = array['Dario', 'Darius', 'Dario o medo'],
  title = 'Dario, o rei da cova dos leões',
  description = 'No livro de Daniel, é o soberano que assume o reino após a morte de Belsazar, chamado "Dario, o medo", com cerca de sessenta e dois anos (Daniel 5:31). Sua identificação histórica é debatida, e o nome Dario aparece também em Esdras e Ageu para o rei persa Dario I, em cujo sexto ano o segundo templo foi concluído (Esdras 6:15).

Dario organizou o reino com cento e vinte sátrapas e três presidentes, entre os quais Daniel se destacava de tal modo que o rei pensava em constituí-lo sobre todo o reino. A inveja dos demais levou a uma armadilha: como não achavam falta nenhuma em sua administração, concluíram que só poderiam acusá-lo em algo relativo à lei do seu Deus (Daniel 6:1-5).

Convenceram o rei a assinar um decreto proibindo, por trinta dias, qualquer petição a deus ou homem que não fosse o próprio Dario, sob pena da cova dos leões. Daniel continuou orando três vezes ao dia com as janelas abertas para Jerusalém, como sempre fizera (Daniel 6:6-11).

O rei, ao perceber a cilada, esforçou-se até o pôr do sol para livrá-lo, mas a lei dos medos e persas não podia ser revogada. Passou a noite em jejum, sem música e sem dormir, e de madrugada correu à cova. Daniel respondeu que seu Deus enviara um anjo a fechar a boca dos leões. Dario o tirou dali e decretou que em todo o seu domínio se temesse o Deus de Daniel (Daniel 6:16-27).',
  published = true
where slug = 'dario';

update public.lexicon_entries set
  aliases = array['Davi', 'David'],
  title = 'Davi, rei de Israel',
  description = 'Filho mais novo de Jessé, de Belém, trabalhava como pastor de ovelhas quando o profeta Samuel o ungiu em segredo como futuro rei de Israel, ainda em vida do rei Saul. Ficou conhecido por enfrentar e derrotar o gigante filisteu Golias com uma funda e algumas pedras, num duelo que impressionou todo o exército israelita (1 Samuel 17).

Depois disso, serviu na corte de Saul como músico e guerreiro, mas se tornou alvo do ciúme do rei e precisou fugir, vivendo anos como fugitivo. Após a morte de Saul, Davi foi proclamado rei, primeiro sobre Judá e depois sobre todo o Israel. Conquistou Jerusalém e a tornou capital do reino, para onde trouxe a Arca da Aliança (2 Samuel 5-6).

Quis construir um templo para o Senhor, mas foi informado de que essa tarefa caberia a seu filho; em troca, recebeu a promessa de uma dinastia eterna (2 Samuel 7), base da esperança messiânica posterior. Seu reinado também teve falhas graves, como o adultério com Bate-Seba e a morte planejada do marido dela, Urias, o que trouxe sérias consequências à sua família, incluindo a rebelião do filho Absalão (2 Samuel 11-18).

Davi é apontado como autor de boa parte dos Salmos e é lembrado como o maior rei de Israel, ancestral direto de Jesus na genealogia bíblica (Mateus 1:1,6).',
  published = true
where slug = 'davi';

update public.lexicon_entries set
  aliases = array['Débora', 'Debora', 'Deborah'],
  title = 'Débora, juíza e profetisa de Israel',
  description = 'Profetisa e a única mulher entre os juízes de Israel. Julgava o povo sentada sob uma palmeira entre Ramá e Betel, na região montanhosa de Efraim, e os israelitas subiam até ela para resolver suas causas (Juízes 4:4-5).

Sob a opressão de Jabim, rei de Canaã, e de seu comandante Sísera, que tinha novecentos carros de ferro, Débora convocou Baraque e lhe transmitiu a ordem de Deus para reunir dez mil homens no monte Tabor. Baraque respondeu que só iria se ela fosse junto, e ela concordou, advertindo que, por causa disso, a honra da vitória não seria dele, mas cairia nas mãos de uma mulher (Juízes 4:6-9).

O exército de Sísera foi desbaratado, e ele fugiu a pé até a tenda de Jael, que o matou enquanto dormia, cumprindo a palavra de Débora (Juízes 4:15-22).

O capítulo seguinte traz o Cântico de Débora e Baraque, um dos textos poéticos mais antigos das Escrituras, que celebra a vitória, elogia as tribos que atenderam ao chamado e repreende as que ficaram. Nele, Débora se descreve como "mãe em Israel" (Juízes 5:7). A terra teve paz por quarenta anos.',
  published = true
where slug = 'debora';

update public.lexicon_entries set
  aliases = array['Demas', 'Demás'],
  title = 'Demas, o cooperador que abandonou Paulo',
  description = 'Companheiro de Paulo durante a primeira prisão em Roma, mencionado três vezes no Novo Testamento, e as três compõem uma trajetória em declínio.

Na carta aos colossenses, aparece simplesmente entre os que enviam saudações, ao lado de Lucas: "saúda-vos Lucas, o médico amado, e Demas" (Colossenses 4:14).

Na carta a Filemom, escrita na mesma ocasião, é listado entre os cooperadores do apóstolo, junto com Marcos, Aristarco e Lucas (Filemom 24).

A terceira menção está em 2 Timóteo, provavelmente a última carta de Paulo, e é a que fixou seu nome na memória cristã: "porque Demas me desamparou, amando o presente século, e foi para Tessalônica" (2 Timóteo 4:10). A frase aparece num trecho em que Paulo relata o esvaziamento ao seu redor, com companheiros enviados a outros lugares e outros que simplesmente partiram, e culmina na observação "só Lucas está comigo".

O texto não diz que ele abandonou a fé, apenas que amou o presente século e foi embora, e não registra o que aconteceu depois. É citado com frequência em sermões como figura de quem começa bem e não permanece, em contraste direto com Lucas, mencionado ao lado dele nas três ocorrências.',
  published = true
where slug = 'demas';

update public.lexicon_entries set
  aliases = array['Efraim', 'Ephraim', 'Efraím'],
  title = 'Efraim, o filho mais novo que recebeu a bênção maior',
  description = 'Segundo filho de José com Asenate, nascido no Egito. Seu nome significa "frutífero", porque, nas palavras de José, Deus o fez frutificar na terra da sua aflição (Gênesis 41:52).

Quando Jacó, já idoso e quase cego, abençoou os dois netos, cruzou os braços e pôs a mão direita sobre Efraim, o mais novo, e a esquerda sobre Manassés. José tentou corrigir o pai, mas Jacó respondeu que sabia o que fazia e que o irmão mais novo seria maior (Gênesis 48:13-20). Foi assim que os dois filhos de José entraram na conta das tribos de Israel no lugar do pai.

A tribo de Efraim ocupou a região central montanhosa de Canaã, onde ficavam Siló, com o tabernáculo, e Siquém. Josué era efraimita, e depois da divisão do reino o nome Efraim se tornou sinônimo do próprio reino do Norte nos escritos proféticos, especialmente em Oseias, que fala dele com mistura de acusação e ternura: "como te deixaria, ó Efraim?" (Oseias 11:8).',
  published = true
where slug = 'efraim';

update public.lexicon_entries set
  aliases = array['Eli', 'Heli', 'Éli'],
  title = 'Eli, o sacerdote de Siló',
  description = 'Sacerdote e juiz de Israel, servia no santuário de Siló, onde ficava a arca da aliança. Foi ele quem viu Ana orando em silêncio com os lábios se movendo, pensou que estivesse embriagada e, ao entender o que acontecia, a despediu com uma bênção: "vai em paz, e o Deus de Israel te conceda a petição que lhe fizeste" (1 Samuel 1:12-17).

Quando Samuel foi entregue ao santuário ainda menino, Eli o criou ali. Foi ele quem percebeu que a voz que chamava o menino de noite era de Deus e o instruiu a responder: "fala, Senhor, porque o teu servo ouve" (1 Samuel 3:1-10).

Seus filhos Hofni e Fineias, também sacerdotes, se corrompiam com as ofertas e abusavam das mulheres que serviam à entrada da tenda. Eli os repreendeu, mas sem detê-los, e um homem de Deus veio anunciar o juízo sobre sua casa (1 Samuel 2:12-36). A primeira palavra que Samuel recebeu do Senhor foi justamente essa sentença, que o menino teve de comunicar ao próprio Eli.

Na guerra contra os filisteus, a arca foi levada ao campo de batalha e capturada, e os dois filhos morreram. Ao receber a notícia, Eli, já com noventa e oito anos e cego, caiu para trás de sua cadeira, quebrou o pescoço e morreu. Havia julgado Israel por quarenta anos (1 Samuel 4:12-18).',
  published = true
where slug = 'eli';

update public.lexicon_entries set
  aliases = array['Elias', 'Elijah'],
  title = 'Elias, o profeta do Monte Carmelo',
  description = 'Profeta natural de Tisbe, em Gileade, que atuou durante o reinado de Acabe e Jezabel, num período de forte idolatria a Baal em Israel. Anunciou ao rei uma seca prolongada como julgamento divino, e durante esse tempo foi sustentado por corvos junto ao ribeiro de Querite e, depois, por uma viúva em Sarepta, cuja farinha e azeite nunca se esgotaram enquanto o hospedou (1 Reis 17).

O momento mais marcante de seu ministério foi o confronto no Monte Carmelo contra quatrocentos e cinquenta profetas de Baal. Diante de todo o povo, Elias propôs um teste: cada lado prepararia um sacrifício, e o deus que respondesse com fogo do céu seria reconhecido como o verdadeiro Deus. O fogo do Senhor consumiu a oferta de Elias, e o povo reconheceu que ele era Deus (1 Reis 18).

Apesar dessa vitória, Elias fugiu com medo da ira de Jezabel e chegou à beira do desespero no deserto. Foi então que teve um encontro com Deus no Monte Horebe, não num terremoto ou num vento forte, mas num "cicio suave e delicado" (1 Reis 19). Ali recebeu a missão de ungir Eliseu como seu sucessor, além de futuros reis de Israel e Arã.

Sua vida terrena terminou de forma extraordinária: foi levado ao céu num redemoinho, com uma carruagem e cavalos de fogo, diante dos olhos de Eliseu (2 Reis 2:11). Elias reaparece séculos depois na transfiguração de Jesus, ao lado de Moisés (Mateus 17:1-3), e o profeta Malaquias anuncia seu retorno antes do grande dia do Senhor, texto que os evangelhos associam ao ministério de João Batista.',
  published = true
where slug = 'elias';

update public.lexicon_entries set
  aliases = array['Eliseu', 'Elisha', 'Elisseu'],
  title = 'Eliseu, o profeta sucessor de Elias',
  description = 'Filho de Safate, foi chamado enquanto arava com doze juntas de bois. Elias passou por ele e lançou sobre seus ombros a própria capa; Eliseu sacrificou os bois, queimou os instrumentos de lavoura para cozinhar a carne, despediu-se dos pais e o seguiu (1 Reis 19:19-21).

Quando Elias foi levado ao céu num redemoinho, Eliseu pediu porção dobrada de seu espírito. Recebeu a capa que caiu, feriu com ela as águas do Jordão, que se dividiram, e os profetas reconheceram que o espírito de Elias repousava sobre ele (2 Reis 2:9-15).

Seu ministério é o mais denso em milagres do Antigo Testamento: purificou as águas de Jericó com sal, multiplicou o azeite da viúva endividada, anunciou e depois ressuscitou o filho da sunamita, curou o veneno da panela com farinha, alimentou cem homens com vinte pães, fez flutuar o machado emprestado que caíra no rio e curou a lepra do sírio Naamã mandando que se lavasse sete vezes no Jordão (2 Reis 2-6).

Também atuou politicamente, denunciando ao rei de Israel os planos do exército sírio, cercado em Dotã por um exército de cavalos e carros de fogo visível apenas ao servo cujos olhos foram abertos (2 Reis 6:8-17). Ungiu indiretamente Jeú como rei e, já no leito de morte, deu ao rei Joás a profecia das flechas da vitória (2 Reis 13:14-19).',
  published = true
where slug = 'eliseu';

update public.lexicon_entries set
  aliases = array['Enoque', 'Enoc', 'Henoc', 'Enoch'],
  title = 'Enoque, o homem que andou com Deus',
  description = 'Descendente de Sete na sétima geração desde Adão, filho de Jarede e pai de Matusalém. Sua breve menção em Gênesis é uma das mais notáveis das genealogias: em vez da fórmula repetida "e morreu", o texto diz que Enoque "andou com Deus, e já não era, porque Deus o tomou para si" (Gênesis 5:21-24).

Viveu 365 anos, número muito inferior ao dos patriarcas ao seu redor, porque não morreu: foi levado por Deus. Ao lado de Elias, é uma das duas figuras das Escrituras que deixam esta vida sem passar pela morte.

A carta aos Hebreus o apresenta entre os heróis da fé, afirmando que "pela fé Enoque foi transladado para não ver a morte" e que antes disso recebeu testemunho de haver agradado a Deus (Hebreus 11:5). A carta de Judas cita uma profecia atribuída a ele sobre a vinda do Senhor com seus santos milhares para julgar os ímpios (Judas 14-15).

Há outro Enoque nas Escrituras, filho de Caim, que deu nome à primeira cidade construída (Gênesis 4:17), pessoa distinta desta.',
  published = true
where slug = 'enoque';

update public.lexicon_entries set
  aliases = array['Esaú', 'Esau'],
  title = 'Esaú, o irmão que vendeu o direito de primogenitura',
  description = 'Filho mais velho de Isaque e Rebeca, irmão gêmeo de Jacó, do qual nasceu momentos antes. Era ruivo e peludo, caçador e homem do campo, preferido do pai, enquanto Jacó era preferido da mãe (Gênesis 25:24-28).

Voltando exausto de uma caçada, vendeu ao irmão seu direito de primogenitura por um prato de lentilhas, episódio que o texto encerra com a observação: "assim Esaú desprezou a sua primogenitura" (Gênesis 25:29-34). Mais tarde, Jacó, orientado por Rebeca, tomou também a bênção que Isaque pretendia lhe dar. Esaú chorou amargamente diante do pai e passou a odiar o irmão, planejando matá-lo depois da morte de Isaque (Gênesis 27).

Jacó fugiu para Harã e ali permaneceu vinte anos. No reencontro, décadas depois, Esaú veio ao seu encontro com quatrocentos homens, mas correu, abraçou o irmão, lançou-se ao seu pescoço e o beijou, e os dois choraram. Recusou inicialmente os presentes dizendo "tenho bastante, meu irmão" (Gênesis 33:1-11).

Esaú é apresentado como pai dos edomitas, povo estabelecido na região montanhosa de Seir, ao sul do mar Morto (Gênesis 36). O Novo Testamento o cita como advertência contra a troca do que é eterno pelo imediato (Hebreus 12:16-17).',
  published = true
where slug = 'esau';

update public.lexicon_entries set
  aliases = array['Esdras', 'Ezra', 'Ezrá'],
  title = 'Esdras, o escriba que ensinou a Lei',
  description = 'Sacerdote e escriba versado na lei de Moisés, descendente de Arão. Subiu da Babilônia a Jerusalém no sétimo ano do rei Artaxerxes, cerca de oitenta anos depois da primeira volta do exílio, levando consigo um novo grupo de repatriados e uma carta real que lhe dava autoridade e recursos para o serviço do templo (Esdras 7).

O texto resume seu propósito numa frase que se tornou definição de vocação: "Esdras tinha preparado o seu coração para buscar a lei do Senhor, e para cumpri-la, e para ensinar em Israel os seus estatutos e os seus juízos" (Esdras 7:10).

Antes de partir, proclamou um jejum junto ao rio Aava, por ter se envergonhado de pedir ao rei uma escolta de soldados depois de afirmar que a mão de Deus estava sobre os que o buscam (Esdras 8:21-23).

Em Jerusalém, ao saber que muitos haviam se casado com os povos da terra, rasgou as vestes, arrancou os cabelos e fez uma longa oração de confissão em nome do povo, o que levou a uma reforma dolorosa (Esdras 9-10).

O livro de Neemias registra o momento em que Esdras leu a Lei em voz alta diante de todo o povo reunido na praça, de madrugada até o meio-dia, com levitas explicando o sentido, e o povo chorou ao ouvi-la. Foi então que se declarou: "a alegria do Senhor é a vossa força" (Neemias 8).',
  published = true
where slug = 'esdras';

update public.lexicon_entries set
  aliases = array['Ester', 'Esther', 'Hadassa'],
  title = 'Ester, a rainha que salvou seu povo',
  description = 'Judia da tribo de Benjamim, chamada também Hadassa, órfã criada por seu primo Mardoqueu na cidade de Susã, capital do império persa. Quando o rei Assuero destituiu a rainha Vasti, jovens de todo o império foram reunidas no palácio, e Ester foi escolhida rainha, mantendo em segredo sua origem judaica por orientação de Mardoqueu (Ester 2).

Hamã, o principal ministro do rei, irritado porque Mardoqueu se recusava a se curvar diante dele, obteve de Assuero um decreto para exterminar todos os judeus do império num único dia. Mardoqueu pediu que Ester intercedesse, e diante da hesitação dela, já que aproximar-se do rei sem ser chamada podia custar a vida, enviou-lhe a frase que resume o livro: "quem sabe se para tal tempo como este chegaste a este reino?" (Ester 4:14).

Ester pediu que todos jejuassem três dias e declarou: "se perecer, pereci". Apresentou-se ao rei, que estendeu o cetro de ouro, e em vez de fazer o pedido de imediato convidou-o com Hamã a dois banquetes. No segundo, revelou sua identidade e denunciou o plano (Ester 5-7).

Hamã foi enforcado na mesma forca que preparara para Mardoqueu, e um novo decreto autorizou os judeus a se defenderem. A vitória passou a ser celebrada na festa de Purim, ainda hoje observada (Ester 8-9). O livro de Ester é o único da Bíblia que não menciona o nome de Deus.',
  published = true
where slug = 'ester';

update public.lexicon_entries set
  aliases = array['Estêvão', 'Estevao'],
  title = 'Estêvão, o primeiro mártir cristão',
  description = 'Um dos sete homens escolhidos pela igreja em Jerusalém para cuidar da distribuição diária de alimentos às viúvas, liberando os apóstolos para se dedicarem à pregação. Descrito como cheio de fé e do Espírito Santo, Estêvão também realizava grandes sinais e maravilhas entre o povo (Atos 6:1-8).

Sua sabedoria e a força de suas palavras atraíram a oposição de membros de uma sinagoga local, que não conseguiam refutá-lo em debate. Sem argumentos, levaram falsas testemunhas contra ele, acusando-o de blasfêmia, e o arrastaram diante do Sinédrio, o tribunal religioso judaico (Atos 6:9-15).

Diante do tribunal, Estêvão fez um longo discurso percorrendo a história de Israel, desde Abraão até Salomão, e concluiu acusando os líderes religiosos de resistirem ao Espírito Santo como seus antepassados haviam feito, e de terem agora traído e matado o Messias (Atos 7:1-53). Enfurecidos, os membros do conselho o arrastaram para fora da cidade e o apedrejaram.

Antes de morrer, Estêvão teve uma visão do céu aberto e de Jesus em pé à direita de Deus, e orou pedindo perdão para seus algozes, ecoando as últimas palavras de Jesus na cruz (Atos 7:54-60). As testemunhas da execução depositaram seus mantos aos pés de um jovem chamado Saulo, que mais tarde se tornaria o apóstolo Paulo. A morte de Estêvão, o primeiro mártir cristão, deu início a uma forte perseguição que espalhou os primeiros discípulos e, com eles, o evangelho, para além de Jerusalém.',
  published = true
where slug = 'estevao';

update public.lexicon_entries set
  aliases = array['Eva'],
  title = 'Eva, a primeira mulher',
  description = 'Criada por Deus a partir de uma costela de Adão, para ser sua companheira, depois que nenhum dos animais nomeados por ele se mostrou semelhante o bastante. Adão a recebeu como "osso dos meus ossos e carne da minha carne" (Gênesis 2:21-23), e os dois viviam livremente no Jardim do Éden.

Foi Eva quem primeiro ouviu a proposta enganosa da serpente para comer do fruto da árvore do conhecimento do bem e do mal, a única proibida por Deus no jardim. Convencida de que o fruto traria sabedoria, comeu dele e também deu a Adão, que comeu junto com ela (Gênesis 3:1-6).

Esse ato de desobediência trouxe consequências para ambos e para toda a humanidade: expulsão do Éden, dor no parto e uma relação marcada por dificuldades entre o casal, além da entrada do pecado e da morte no mundo (Gênesis 3:16-24). Apesar disso, seu nome, Eva, dado por Adão após a queda, significa "mãe de todos os viventes" (Gênesis 3:20), e ela se tornou mãe de Caim, Abel, Sete e outros filhos (Gênesis 5:4).',
  published = true
where slug = 'eva';

update public.lexicon_entries set
  aliases = array['Ezequias', 'Hezekiah', 'Ezekias'],
  title = 'Ezequias, o rei que confiou no Senhor diante da Assíria',
  description = 'Filho de Acaz, reinou em Judá e é apresentado como um dos melhores reis do Sul: "confiou no Senhor Deus de Israel, de modo que depois dele não houve seu semelhante entre todos os reis de Judá" (2 Reis 18:5).

Promoveu uma ampla reforma religiosa: removeu os altares idólatras, cortou os postes sagrados e quebrou a serpente de bronze feita por Moisés, que o povo havia transformado em objeto de culto e chamava de Neustã (2 Reis 18:4). Reabriu e purificou o templo e celebrou uma Páscoa com convite estendido até às tribos do Norte (2 Crônicas 29-30).

No seu reinado, Senaqueribe, rei da Assíria, invadiu Judá e cercou Jerusalém. O comandante assírio zombou publicamente diante dos muros, e Ezequias levou a carta da ameaça ao templo e a estendeu diante do Senhor em oração. Isaías lhe enviou a resposta, e naquela noite o exército assírio foi ferido, e Senaqueribe voltou para Nínive, onde foi morto por seus próprios filhos (2 Reis 18-19).

Adoeceu mortalmente e recebeu de Isaías a ordem de pôr sua casa em ordem. Chorou e orou voltado para a parede, e Deus lhe acrescentou quinze anos de vida, dando como sinal a sombra que retrocedeu dez graus no relógio de Acaz (2 Reis 20:1-11). Também construiu o túnel que trouxe as águas de Giom para dentro da cidade (2 Reis 20:20). Recebeu emissários da Babilônia e lhes mostrou todos os seus tesouros, e Isaías anunciou que tudo aquilo um dia seria levado para lá.',
  published = true
where slug = 'ezequias';

update public.lexicon_entries set
  aliases = array['Ezequiel', 'Ezekiel', 'Yehezkel'],
  title = 'Ezequiel, o profeta do exílio',
  description = 'Sacerdote levado cativo à Babilônia com o rei Joaquim, cerca de onze anos antes da queda de Jerusalém. Profetizou entre os exilados junto ao rio Quebar, e seu livro é o mais visual do Antigo Testamento.

Seu chamado se dá numa visão grandiosa de quatro seres viventes, rodas dentro de rodas cheias de olhos e um trono com a semelhança de um homem cercado de fogo e arco-íris. Recebeu a ordem de comer um rolo escrito por dentro e por fora, que em sua boca foi doce como mel (Ezequiel 1-3).

Suas profecias vinham frequentemente em atos: deitou-se sobre um lado por trezentos e noventa dias e sobre o outro por quarenta, desenhou o cerco de Jerusalém num tijolo, raspou cabelo e barba e os dividiu em três partes, cavou um buraco no muro para sair com bagagem de exílio. Quando sua mulher morreu, foi proibido de manifestar luto, como sinal do que aconteceria ao povo diante da destruição do templo (Ezequiel 4-5, 12, 24).

É dele a visão do vale de ossos secos que se juntam, recebem carne e fôlego e se erguem como um grande exército, imagem da restauração de Israel (Ezequiel 37), e a promessa de um coração novo em lugar do coração de pedra (Ezequiel 36:26). Os últimos capítulos descrevem em minúcias um novo templo, de onde sai um rio que cura tudo por onde passa (Ezequiel 40-47).',
  published = true
where slug = 'ezequiel';

update public.lexicon_entries set
  aliases = array['Faraó', 'Farao'],
  title = 'Faraó',
  description = 'Faraó não é um nome próprio, mas o título usado para designar o rei do Egito, algo como "grande casa", em referência ao palácio real. A Bíblia usa esse título para diversos governantes egípcios ao longo de séculos, sem sempre identificá-los individualmente.

Um dos primeiros a aparecer é o Faraó da época de Abraão, que chegou a levar Sara para seu harém, pensando ser ela apenas irmã de Abraão, até ser advertido por Deus e devolvê-la (Gênesis 12:10-20). Mais tarde, outro Faraó eleva José, um escravo hebreu, à posição de governador do Egito, depois que ele interpreta seus sonhos e organiza o país para enfrentar uma grande fome (Gênesis 41).

O Faraó mais conhecido é o da época do Êxodo, que escravizou os israelitas e endureceu o coração diversas vezes diante dos pedidos de Moisés e Arão para libertar o povo, resistindo mesmo após as dez pragas, até a saída definitiva de Israel do Egito (Êxodo 5-14).

Em livros históricos posteriores, alguns faraós aparecem já identificados por nome próprio, como Faraó Neco, que matou o rei Josias em batalha (2 Reis 23:29), e Faraó Hofra, mencionado no tempo do profeta Jeremias (Jeremias 44:30).',
  published = true
where slug = 'farao';

update public.lexicon_entries set
  aliases = array['Febe', 'Phoebe', 'Phebe'],
  title = 'Febe, a diaconisa de Cencreia',
  description = 'Cristã da igreja de Cencreia, um dos portos de Corinto, mencionada por Paulo no capítulo final da carta aos romanos. Sua aparição é breve, dois versículos, mas densa em informação (Romanos 16:1-2).

Paulo a recomenda com uma expressão formal de apresentação, o que sugere que ela era portadora da própria carta: quem levava um documento daquele porte a Roma, atravessando o mar, era pessoa de confiança, e cabia a ela responder às primeiras perguntas dos destinatários sobre o conteúdo.

É chamada de "serva da igreja de Cencreia", termo que no grego é o mesmo traduzido em outros lugares por diácono, e é a única mulher no Novo Testamento a receber esse título ligado a uma igreja específica.

Paulo pede que a recebam no Senhor "como convém aos santos" e que a ajudem em qualquer coisa que necessitar dele, acrescentando a razão: ela mesma havia sido protetora de muitos, e dele próprio. A palavra usada, prostatis, designava quem oferecia patrocínio e proteção, função que pressupõe recursos e posição social, o que indica que Febe sustentava materialmente a obra.

O Novo Testamento não volta a mencioná-la, mas sua presença ao lado de nomes como Priscila, Júnia, Trifena e Trifosa na mesma lista de saudações mostra a participação feminina nas primeiras comunidades cristãs.',
  published = true
where slug = 'febe';

update public.lexicon_entries set
  aliases = array['Filemom', 'Filemon', 'Philemon'],
  title = 'Filemom, o destinatário da carta mais curta de Paulo',
  description = 'Cristão de Colossos, provavelmente convertido pelo próprio Paulo, a quem o apóstolo chama de "amado, e nosso cooperador". Era homem de posses: tinha escravos e uma casa grande o bastante para abrigar a igreja que ali se reunia (Filemom 1-2).

A carta que leva seu nome é o escrito mais curto de Paulo e trata de um único assunto. Onésimo, escravo de Filemom, havia fugido e ido parar em Roma, onde encontrou Paulo na prisão e se tornou cristão. Paulo o envia de volta com uma carta na mão.

Antes de fazer o pedido, o apóstolo elogia sinceramente o que ouvira sobre a fé e o amor de Filemom, dizendo que por ele os corações dos santos haviam sido reanimados. Só então apresenta o assunto, e não como ordem: "ainda que tenha grande confiança em Cristo para te mandar o que te convém, todavia antes te rogo por amor" (Filemom 4-9).

Pede que receba Onésimo como receberia o próprio Paulo, não mais como escravo, mas como irmão amado. Compromete-se a pagar qualquer dívida deixada pelo fugitivo, escrevendo a garantia de próprio punho, e acrescenta a observação de que Filemom lhe devia a si mesmo (Filemom 17-19).

Encerra pedindo que lhe prepare pousada, na esperança de ser libertado e visitá-lo, o que acrescenta à carta uma discreta expectativa de verificação pessoal do resultado.',
  published = true
where slug = 'filemom';

update public.lexicon_entries set
  aliases = array['Filipe', 'Philip', 'Felipe'],
  title = 'Filipe',
  description = 'Há dois Filipes de destaque no Novo Testamento.

O primeiro é Filipe, um dos doze apóstolos, natural de Betsaida, a mesma cidade de André e Pedro. Foi encontrado por Jesus com um simples "segue-me", e logo foi buscar Natanael com a notícia de que haviam achado aquele de quem Moisés e os profetas escreveram; à objeção de que nada de bom podia vir de Nazaré, respondeu: "vem e vê" (João 1:43-46). Foi a ele que Jesus perguntou onde comprariam pão para alimentar a multidão, e ele calculou que duzentos denários não bastariam (João 6:5-7). Levou a Jesus, com André, alguns gregos que queriam vê-lo (João 12:20-22), e no discurso da última ceia fez o pedido que provocou uma das respostas mais citadas: "mostra-nos o Pai", ao que Jesus disse "quem me vê a mim vê o Pai" (João 14:8-9).

O segundo é Filipe, o evangelista, um dos sete escolhidos para servir às mesas na igreja de Jerusalém (Atos 6:5). Pregou em Samaria com grande repercussão e depois foi enviado por um anjo à estrada deserta de Gaza, onde encontrou o eunuco etíope lendo Isaías em sua carruagem, explicou-lhe o texto e o batizou (Atos 8). Morava em Cesareia com quatro filhas que profetizavam, e hospedou Paulo a caminho de Jerusalém (Atos 21:8-9).',
  published = true
where slug = 'filipe';

update public.lexicon_entries set
  aliases = array['Gamaliel', 'Gamaliél', 'Rabban Gamaliel'],
  title = 'Gamaliel, o mestre da lei que aconselhou prudência',
  description = 'Fariseu e doutor da lei, respeitado por todo o povo e membro do Sinédrio. A tradição judaica o conhece como um dos mestres mais influentes de sua geração, neto do célebre rabino Hillel.

Aparece no livro de Atos numa cena decisiva. Depois que os apóstolos foram presos, libertados por um anjo e encontrados de novo ensinando no templo, o conselho se enfureceu e queria matá-los. Gamaliel mandou que os homens fossem retirados por um momento e falou aos presentes (Atos 5:33-35).

Seu argumento foi histórico: lembrou de Teudas, que se dizia alguém e reuniu cerca de quatrocentos homens, e de Judas, o galileu, que arrastou muito povo nos dias do recenseamento; ambos pereceram, e seus seguidores se dispersaram. Concluiu com o conselho que ficou conhecido: "dai de mão a estes homens, e deixai-os, porque, se este conselho ou esta obra é de homens, se desfará, mas se é de Deus, não podereis desfazê-la, para que não sejais achados combatendo contra Deus" (Atos 5:38-39).

O conselho aceitou a sugestão, mas ainda assim açoitou os apóstolos e lhes proibiu falar no nome de Jesus.

É mencionado uma segunda vez pelo próprio Paulo, ao se defender diante da multidão em Jerusalém, dizendo ter sido "instruído aos pés de Gamaliel, conforme a verdade da lei de nossos pais" (Atos 22:3).',
  published = true
where slug = 'gamaliel';

update public.lexicon_entries set
  aliases = array['Gideão', 'Gideao', 'Gedeão', 'Gideon', 'Jerubaal'],
  title = 'Gideão, o juiz dos trezentos homens',
  description = 'Filho de Joás, da tribo de Manassés, foi chamado por Deus enquanto malhava trigo escondido num lagar para não ser visto pelos midianitas, que saqueavam Israel havia sete anos. O anjo do Senhor o saudou como "homem valente", ao que ele respondeu apontando a própria insignificância: sua família era a mais pobre de Manassés, e ele, o menor da casa (Juízes 6:11-15).

Sua primeira ação foi derrubar de noite o altar de Baal do próprio pai e o poste de Aserá ao lado, o que lhe rendeu o apelido de Jerubaal, "que Baal contenda com ele" (Juízes 6:25-32). Antes da batalha, pediu dois sinais com a lã estendida na eira: primeiro orvalho só na lã e o chão seco, depois o contrário (Juízes 6:36-40).

Dos trinta e dois mil homens reunidos, Deus reduziu o exército a trezentos, dispensando primeiro os medrosos e depois os que se ajoelharam para beber, "para que Israel não se glorie contra mim dizendo: a minha mão me livrou" (Juízes 7:1-8). Os trezentos cercaram o acampamento de noite com trombetas, cântaros e tochas, e o pânico fez os midianitas se voltarem uns contra os outros (Juízes 7:16-22).

Recusou a coroa que o povo lhe ofereceu, dizendo que o Senhor dominaria sobre eles, mas fez uma estola sacerdotal de ouro que se tornou motivo de idolatria em Israel (Juízes 8:22-27).',
  published = true
where slug = 'gideao';

update public.lexicon_entries set
  aliases = array['Golias', 'Goliath', 'Goliate'],
  title = 'Golias, o gigante filisteu derrotado por Davi',
  description = 'Campeão dos filisteus, natural de Gate, descrito como tendo seis côvados e um palmo de altura, cerca de dois metros e noventa. Vestia um capacete de bronze, uma couraça de escamas que pesava cinco mil siclos, e a ponta de sua lança pesava seiscentos siclos de ferro (1 Samuel 17:4-7).

Durante quarenta dias, manhã e tarde, apresentou-se no vale de Elá desafiando Israel a escolher um homem para o combate singular, com a condição de que o povo do perdedor se tornasse servo do vencedor. Saul e todo o exército ficaram "espantados e grandemente temerosos" (1 Samuel 17:8-11).

Davi, ainda jovem, chegou ao acampamento levando mantimentos aos irmãos, ouviu o desafio e se ofereceu para enfrentá-lo. Recusou a armadura de Saul por não estar acostumado a ela e desceu ao ribeiro, de onde escolheu cinco pedras lisas. Ao gigante que o desprezou por ser um rapaz com cajado, respondeu: "tu vens a mim com espada, e com lança, e com escudo; porém eu venho a ti em nome do Senhor dos Exércitos" (1 Samuel 17:38-47).

A pedra da funda atingiu a testa de Golias, que caiu de bruços. Davi correu, tomou a espada do próprio gigante e lhe cortou a cabeça, e os filisteus fugiram (1 Samuel 17:48-51). A espada de Golias ficou guardada no santuário de Nobe e foi entregue a Davi anos depois, quando ele fugia de Saul (1 Samuel 21:9).',
  published = true
where slug = 'golias';

update public.lexicon_entries set
  aliases = array['Gômer', 'Gomer'],
  title = 'Gômer, a mulher de Oseias',
  description = 'Filha de Diblaim e esposa do profeta Oseias, com quem se casou por ordem direta de Deus, que a descreveu de antemão como mulher de prostituições, para que o casamento fosse sinal da infidelidade de Israel (Oseias 1:2-3).

Teve três filhos cujos nomes foram determinados como mensagem profética. Jezreel, em memória do sangue derramado naquele vale; Lo-Ruama, "não compadecida" ou "não amada", porque Deus não mais se compadeceria da casa de Israel; e Lo-Ami, "não meu povo", a sentença mais dura, a inversão da fórmula da aliança (Oseias 1:4-9).

O livro registra o afastamento dela em busca de seus amantes, atribuindo a eles o pão, a água, a lã, o linho, o azeite e a bebida que na verdade vinham do marido, imagem transparente da idolatria do povo (Oseias 2:5-8).

O capítulo 3 traz a ordem de resgatá-la: o profeta a comprou por quinze peças de prata e uma carga e meia de cevada, preço baixo, e a colocou sob um período de espera antes de restaurá-la plenamente. É a partir dessa história pessoal que o livro anuncia a reversão dos nomes dos filhos: aos que eram Lo-Ami se diria "vós sois filhos do Deus vivo" (Oseias 1:10), palavras que Paulo e Pedro retomam no Novo Testamento (Romanos 9:25-26, 1 Pedro 2:10).',
  published = true
where slug = 'gomer';

update public.lexicon_entries set
  aliases = array['Habacuque', 'Habakkuk', 'Abacuque'],
  title = 'Habacuque, o profeta que discutiu com Deus',
  description = 'Profeta que atuou em Judá pouco antes da invasão babilônica, provavelmente no reinado de Jeoaquim. Seu livro é diferente dos demais profetas: em vez de falar ao povo em nome de Deus, ele fala a Deus em nome do povo.

Começa com uma queixa: "até quando, Senhor, clamarei eu, e tu não me escutarás?", diante da violência, da contenda e da lei que se afrouxava em Judá (Habacuque 1:2-4). A resposta divina é ainda mais perturbadora: Deus levantaria os caldeus, nação amarga e apressada, para executar o juízo.

Segue a segunda queixa, mais difícil que a primeira: como pode aquele cujos olhos são puros demais para ver o mal usar um povo ainda mais ímpio para castigar um menos ímpio? O profeta então se posta na guarda e sobre a torre para esperar a resposta (Habacuque 1:12-2:1).

A resposta é a ordem de escrever a visão em tábuas, de modo legível para quem passa correndo, e a declaração que se tornaria decisiva na história do cristianismo: "o justo viverá pela sua fé" (Habacuque 2:4), citada por Paulo em Romanos e Gálatas e pela carta aos Hebreus.

O livro termina com uma oração em forma de salmo, que descreve Deus vindo em majestade e culmina numa das confissões mais notáveis das Escrituras: ainda que a figueira não floresça, nem haja fruto na vide, nem ovelhas no curral, "todavia eu me alegrarei no Senhor" (Habacuque 3:17-19).',
  published = true
where slug = 'habacuque';

update public.lexicon_entries set
  aliases = array['Hagar', 'Agar'],
  title = 'Hagar, a serva egípcia e mãe de Ismael',
  description = 'Serva egípcia de Sara. Como Sara não tinha filhos, entregou Hagar a Abraão para que gerasse descendência por meio dela, costume conhecido no antigo Oriente Próximo. Grávida, Hagar passou a desprezar a senhora, e o conflito entre as duas a levou a fugir para o deserto (Gênesis 16:1-6).

Junto a uma fonte no caminho de Sur, o anjo do Senhor a encontrou, mandou que voltasse e lhe prometeu uma descendência incontável, anunciando o nascimento de Ismael. Hagar deu a Deus o nome de "El-Roí", o Deus que vê, e o poço passou a se chamar Beer-Laai-Roi (Gênesis 16:7-14). É a primeira pessoa nas Escrituras a dar um nome a Deus.

Anos depois, já nascido Isaque, Sara pediu que Hagar e o menino Ismael fossem mandados embora. Abraão a despediu com pão e um odre de água, e no deserto de Berseba a água acabou. Hagar deixou o filho sob um arbusto para não vê-lo morrer, mas Deus ouviu o choro do menino, abriu os olhos dela para um poço próximo e repetiu a promessa de fazer dele uma grande nação (Gênesis 21:8-21).

Paulo a usa como alegoria na carta aos Gálatas, associando Hagar ao monte Sinai e ao pacto da lei, em contraste com a liberdade da promessa (Gálatas 4:21-31).',
  published = true
where slug = 'hagar';

update public.lexicon_entries set
  aliases = array['Herodes', 'Herod', 'Herodes o Grande', 'Herodes Antipas'],
  title = 'Herodes',
  description = 'O nome Herodes designa vários governantes de uma mesma dinastia idumeia que aparecem no Novo Testamento, o que costuma gerar confusão.

Herodes, o Grande, é o rei da Judeia no nascimento de Jesus. Conhecido pelas grandes construções, entre elas a ampliação do templo de Jerusalém, recebeu os magos do Oriente que perguntavam pelo rei dos judeus recém-nascido, consultou os escribas sobre Belém e pediu que voltassem a lhe informar. Avisados em sonho, os magos partiram por outro caminho, e Herodes mandou matar todos os meninos de Belém de dois anos para baixo (Mateus 2).

Herodes Antipas, seu filho, foi tetrarca da Galileia durante o ministério de Jesus. Prendeu e decapitou João Batista por causa de Herodias (Marcos 6:14-29). Jesus se referiu a ele como "aquela raposa" (Lucas 13:32), e durante o julgamento foi enviado a ele por Pilatos, mas não lhe respondeu palavra alguma (Lucas 23:6-12).

Herodes Agripa I, neto do primeiro, mandou matar à espada o apóstolo Tiago e prender Pedro, e morreu ferido por um anjo depois de aceitar a aclamação do povo que o chamava de deus (Atos 12).

Herodes Agripa II é o rei diante de quem Paulo se defendeu em Cesareia, respondendo à famosa observação "por pouco me persuades a me fazer cristão" (Atos 26).',
  published = true
where slug = 'herodes';

update public.lexicon_entries set
  aliases = array['Isabel', 'Elisabete', 'Elizabeth', 'Elisabet'],
  title = 'Isabel, mãe de João Batista',
  description = 'Descendente de Arão e esposa do sacerdote Zacarias. O evangelho de Lucas apresenta o casal como justos diante de Deus, andando irrepreensíveis em todos os mandamentos, mas sem filhos, porque Isabel era estéril e ambos já eram de idade avançada (Lucas 1:5-7).

Durante o serviço de Zacarias no templo, o anjo Gabriel lhe anunciou que Isabel daria à luz um filho chamado João, que seria grande diante do Senhor e iria adiante dele no espírito e virtude de Elias. Zacarias duvidou e ficou mudo até o nascimento (Lucas 1:8-20).

Isabel concebeu e se recolheu por cinco meses, dizendo que assim o Senhor havia tirado o seu opróbrio entre os homens. No sexto mês de sua gravidez, o mesmo anjo visitou Maria em Nazaré e lhe deu a notícia da parenta como sinal (Lucas 1:24-25, 36).

Quando Maria chegou à sua casa na região montanhosa de Judá e a saudou, a criança saltou no ventre de Isabel, que, cheia do Espírito Santo, exclamou em alta voz: "bendita és tu entre as mulheres, e bendito é o fruto do teu ventre", e chamou Maria de "a mãe do meu Senhor" (Lucas 1:39-45). Maria permaneceu com ela cerca de três meses.

No nascimento, parentes queriam chamar o menino de Zacarias, mas Isabel insistiu: "não, porém se chamará João", confirmado pelo pai numa tabuinha (Lucas 1:57-63).',
  published = true
where slug = 'isabel';

update public.lexicon_entries set
  aliases = array['Isaías', 'Isaias', 'Isaiah'],
  title = 'Isaías, o profeta',
  description = 'Filho de Amoz, foi um dos maiores profetas do Antigo Testamento, atuando em Judá durante os reinados de Uzias, Jotão, Acaz e Ezequias, no século 8 a.C. Sua vocação profética começou com uma visão impressionante do Senhor assentado em seu trono no templo, quando ouviu o chamado divino e respondeu prontamente: "Eis-me aqui, envia-me" (Isaías 6).

Boa parte de seu ministério envolveu anunciar julgamento sobre a infidelidade de Judá e das nações vizinhas, mas também trouxe mensagens de esperança e restauração futura para o povo de Deus. Isaías aconselhou diretamente o rei Ezequias em momentos críticos, como durante o cerco assírio a Jerusalém, quando garantiu a libertação da cidade, e durante a doença grave do rei, quando anunciou sua cura e quinze anos a mais de vida (2 Reis 19-20, Isaías 37-38).

O livro de Isaías é especialmente lembrado pelas profecias messiânicas, como o anúncio de que uma virgem conceberia um filho chamado Emanuel (Isaías 7:14), a descrição de um menino que traria governo e paz eternos (Isaías 9:6), e os textos sobre o Servo Sofredor, que carregaria as dores e transgressões do povo (Isaías 53), passagens amplamente associadas por cristãos a Jesus.

A tradição judaica e cristã posterior sustenta que Isaías foi martirizado durante o reinado do rei Manassés, serrado ao meio, um episódio possivelmente referido em Hebreus 11:37, embora não esteja narrado diretamente no livro que leva seu nome.',
  published = true
where slug = 'isaias';

update public.lexicon_entries set
  aliases = array['Isaque', 'Isaac'],
  title = 'Isaque, o filho da promessa',
  description = 'Filho de Abraão e Sara, nascido quando ambos já tinham idade muito avançada, um nascimento entendido como cumprimento direto da promessa que Deus havia feito a Abraão anos antes. Seu nome significa "riso", em referência ao riso de incredulidade de Sara ao ouvir que teria um filho àquela altura da vida (Gênesis 18:10-15, 21:1-7).

O episódio mais marcante envolvendo Isaque ainda jovem é o pedido de Deus a Abraão para que o oferecesse em sacrifício no Monte Moriá, como teste extremo de fé. No último instante, um anjo deteve Abraão, e um carneiro preso num arbusto foi oferecido em lugar do filho (Gênesis 22:1-14).

Já adulto, Isaque se casou com Rebeca, encontrada por um servo de Abraão enviado à terra de onde a família havia partido (Gênesis 24). O casal teve dificuldade para conceber, até que Isaque orou por Rebeca, que engravidou de gêmeos, Esaú e Jacó, cuja rivalidade já começou ainda no ventre (Gênesis 25:19-26).

Na velhice, já cego, Isaque pretendia abençoar Esaú, seu filho preferido, mas foi enganado por Rebeca e Jacó, que se disfarçou do irmão para receber a bênção em seu lugar, um episódio que gerou profunda divisão na família (Gênesis 27). Isaque viveu cento e oitenta anos e foi sepultado por Esaú e Jacó na caverna de Macpela, junto a seus pais.',
  published = true
where slug = 'isaque';

update public.lexicon_entries set
  aliases = array['Ismael', 'Ishmael'],
  title = 'Ismael, filho de Abraão e Agar',
  description = 'Primeiro filho de Abraão, nascido de Agar, serva egípcia de Sara. Como Sara ainda não havia conseguido ter filhos, seguindo um costume da época, ela deu Agar a Abraão para que tivesse um herdeiro por meio dela, e assim nasceu Ismael, quando Abraão tinha oitenta e seis anos (Gênesis 16).

Depois do nascimento milagroso de Isaque, filho de Sara, surgiram tensões entre as duas famílias, e Sara pediu que Abraão expulsasse Agar e Ismael. Abraão hesitou, mas atendeu ao pedido depois que Deus o assegurou de que também faria de Ismael uma grande nação (Gênesis 21:8-13).

Enviados ao deserto, Agar e Ismael quase morreram de sede, mas Deus abriu seus olhos para um poço de água e reafirmou a promessa de proteção e descendência sobre o menino (Gênesis 21:14-21). Ismael cresceu no deserto de Parã, tornou-se um exímio arqueiro e teve doze filhos, que se tornaram líderes de doze tribos (Gênesis 25:12-16).

Apesar do afastamento, Ismael e Isaque se reencontraram para sepultar juntos o pai, Abraão, quando este morreu (Gênesis 25:9). Ismael é tradicionalmente apontado como ancestral dos povos árabes.',
  published = true
where slug = 'ismael';

update public.lexicon_entries set
  aliases = array['Jacó', 'Jaco', 'Jacob'],
  title = 'Jacó, o pai das doze tribos de Israel',
  description = 'Filho de Isaque e Rebeca, irmão gêmeo de Esaú, nasceu segurando o calcanhar do irmão, o que deu origem ao seu nome, associado à ideia de "suplantador" ou "enganador". Ainda jovem, comprou de Esaú o direito de primogenitura em troca de um prato de comida, e mais tarde, com a ajuda da mãe, enganou o pai já cego para receber a bênção que caberia ao irmão mais velho (Gênesis 25:29-34, 27).

Temendo a vingança de Esaú, Jacó fugiu para a casa de seu tio Labão, em Padã-Arã. No caminho, teve um sonho em Betel com uma escada ligando a terra ao céu, e recebeu de Deus a confirmação da aliança feita com seu avô Abraão e seu pai Isaque (Gênesis 28:10-22).

Trabalhou anos para Labão, sendo enganado a se casar primeiro com Lia antes de poder se casar com Raquel, a mulher que amava. Com as duas irmãs e suas servas, Zilpa e Bila, teve doze filhos e uma filha, Diná, cujos filhos homens se tornariam as doze tribos de Israel (Gênesis 29-30).

Ao retornar para Canaã, na véspera de reencontrar Esaú, Jacó lutou a noite toda com uma figura identificada como um anjo ou o próprio Deus, junto ao ribeiro de Jaboque, e recebeu ali um novo nome (Gênesis 32:22-32). O reencontro com Esaú se deu de forma pacífica, encerrando décadas de conflito entre os irmãos.

Já idoso, Jacó sofreu profundamente com o suposto desaparecimento do filho preferido, José, mas foi reunido com ele anos depois no Egito, durante uma grande fome, para onde levou toda a sua família. Antes de morrer, abençoou individualmente cada um dos doze filhos (Gênesis 49), e foi sepultado na caverna de Macpela, junto aos demais patriarcas.',
  published = true
where slug = 'jaco';

update public.lexicon_entries set
  aliases = array['Jafé', 'Jafe', 'Japhet', 'Yefet'],
  title = 'Jafé, filho de Noé',
  description = 'Um dos três filhos de Noé, irmão de Sem e Cam. Entrou na arca com a família e sobreviveu ao dilúvio (Gênesis 7:13).

Quando Noé ficou embriagado e descoberto na tenda, Jafé e Sem cobriram o pai caminhando de costas, sem olhar para ele, atitude oposta à de Cam. Ao acordar, Noé abençoou os dois, dizendo que Deus alargaria os limites de Jafé e que ele habitaria nas tendas de Sem (Gênesis 9:23-27).

A Tábua das Nações lista seus descendentes, entre eles Gômer, Magogue, Madai, Javã, Tubal, Meseque e Tirás, associados por tradição às populações que se espalharam pelo norte e oeste, em direção à Ásia Menor e à Europa, "cada um segundo a sua língua, segundo as suas famílias, nas suas nações" (Gênesis 10:2-5).',
  published = true
where slug = 'jafe';

update public.lexicon_entries set
  aliases = array['Jefté', 'Jefte', 'Jephthah', 'Jeftá'],
  title = 'Jefté, o juiz do voto precipitado',
  description = 'Gileadita, filho de uma prostituta, foi expulso de casa pelos meios-irmãos para não ter parte na herança do pai. Refugiou-se na terra de Tobe, onde reuniu ao seu redor um bando de homens (Juízes 11:1-3).

Quando os amonitas atacaram Israel, os anciãos de Gileade foram buscá-lo justamente por sua fama de guerreiro valente, e ele aceitou liderá-los com a condição de permanecer como chefe depois da vitória. Antes do combate, enviou mensageiros ao rei de Amom com um longo argumento histórico sobre a posse da terra (Juízes 11:4-27).

Fez então um voto: se Deus lhe desse a vitória, ofereceria em holocausto o que primeiro saísse da porta de sua casa ao recebê-lo de volta. Venceu, e quem saiu ao seu encontro, com tamboris e danças, foi sua única filha. Ele rasgou as vestes, e ela pediu apenas dois meses para lamentar nos montes com as companheiras. A passagem é uma das mais duras e debatidas do livro (Juízes 11:29-40).

Depois disso, enfrentou os efraimitas, que se ofenderam por não terem sido convocados. Nos vaus do Jordão, seus homens identificavam os fugitivos pedindo que dissessem a palavra "chibolete", que os efraimitas pronunciavam "sibolete" (Juízes 12:1-6). Julgou Israel por seis anos, e Hebreus o inclui entre os heróis da fé (Hebreus 11:32).',
  published = true
where slug = 'jefte';

update public.lexicon_entries set
  aliases = array['Jeremias', 'Jeremiah', 'Yirmeyahu'],
  title = 'Jeremias, o profeta que chorou por Jerusalém',
  description = 'Sacerdote de Anatote, na terra de Benjamim, chamado ainda jovem com as palavras: "antes que te formasse no ventre te conheci, e antes que saísses da madre te santifiquei; às nações te dei por profeta". Alegou não saber falar por ser uma criança, e Deus tocou sua boca (Jeremias 1:4-9).

Profetizou por cerca de quarenta anos, do reinado de Josias até a queda de Jerusalém em 586 a.C., anunciando insistentemente que a cidade seria entregue a Nabucodonosor e que o exílio duraria setenta anos. Essa mensagem o tornou odiado: foi posto no tronco pelo sacerdote Pasur, preso, e lançado numa cisterna de lama de onde foi retirado com cordas e trapos velhos pelo etíope Ebede-Meleque (Jeremias 20, 37-38).

Sua vida foi feita sinal da mensagem: não se casou nem teve filhos, quebrou uma botija diante dos anciãos, usou um jugo de madeira no pescoço e comprou um campo em Anatote justamente quando a cidade estava sitiada, como sinal de que ainda se comprariam casas e campos naquela terra (Jeremias 32).

O rei Jeoaquim cortou e queimou o rolo de suas profecias, que foi reescrito por Baruque (Jeremias 36). Depois da queda da cidade, foi levado à força para o Egito por judeus que desobedeceram à sua palavra (Jeremias 43). É tradicionalmente associado ao livro das Lamentações, e Jeremias 31:31-34 anuncia a nova aliança escrita no coração.',
  published = true
where slug = 'jeremias';

update public.lexicon_entries set
  aliases = array['Jeroboão', 'Jeroboao', 'Jeroboam'],
  title = 'Jeroboão, primeiro rei do reino do Norte',
  description = 'Filho de Nebate, efraimita, era um dos oficiais encarregados das obras de Salomão quando o profeta Aías o encontrou no caminho, rasgou a própria capa nova em doze pedaços e lhe entregou dez, anunciando que Deus rasgaria o reino da mão da casa de Davi e lhe daria dez tribos (1 Reis 11:26-40). Salomão tentou matá-lo, e ele fugiu para o Egito.

Voltou na coroação de Roboão e encabeçou o pedido de alívio dos trabalhos forçados. Com a recusa do novo rei, as dez tribos se separaram e o proclamaram rei do Norte (1 Reis 12).

Temendo que o povo voltasse a Jerusalém para os sacrifícios no templo e sua lealdade se transferisse de volta a Roboão, mandou fazer dois bezerros de ouro e os instalou em Betel e em Dã, dizendo: "eis aqui teus deuses, ó Israel, que te fizeram subir da terra do Egito". Instituiu sacerdotes fora da tribo de Levi e uma festa própria (1 Reis 12:25-33).

Esse ato marcou sua memória: dezenas de vezes os livros dos Reis descrevem os monarcas seguintes como quem andou "nos pecados de Jeroboão, filho de Nebate, que fez pecar a Israel". Um homem de Deus profetizou contra o altar de Betel, e a mão de Jeroboão secou quando ele mandou prendê-lo, sendo restaurada a pedido seu (1 Reis 13:1-6).',
  published = true
where slug = 'jeroboao';

update public.lexicon_entries set
  aliases = array['Jetro', 'Jethro', 'Reuel', 'Ragüel'],
  title = 'Jetro, sogro de Moisés',
  description = 'Sacerdote de Midiã e pai de Zípora, também chamado Reuel no texto bíblico. Acolheu Moisés quando este fugiu do Egito após matar um egípcio, deu-lhe a filha em casamento e o empregou como pastor de seu rebanho. Foi enquanto apascentava as ovelhas de Jetro, perto do monte Horebe, que Moisés viu a sarça ardente (Êxodo 2:16-21, 3:1).

Depois do êxodo, Jetro veio ao encontro de Moisés no deserto trazendo Zípora e os dois netos. Ouviu o relato de tudo o que o Senhor havia feito ao Egito, alegrou-se e declarou: "agora sei que o Senhor é maior que todos os deuses", oferecendo holocaustos e sacrifícios (Êxodo 18:1-12).

É lembrado sobretudo pelo conselho administrativo que deu ao genro. Vendo Moisés julgando o povo sozinho da manhã à noite, advertiu-o de que aquilo o esgotaria e sugeriu escolher homens capazes e tementes a Deus para chefiar grupos de mil, cem, cinquenta e dez, deixando a Moisés apenas as causas mais difíceis. Moisés acatou o conselho, e o modelo passou a organizar a justiça em Israel (Êxodo 18:13-26).',
  published = true
where slug = 'jetro';

update public.lexicon_entries set
  aliases = array['Jezabel', 'Jesabel', 'Jezebel'],
  title = 'Jezabel, a rainha que perseguiu os profetas',
  description = 'Filha de Etbaal, rei dos sidônios, casou-se com Acabe, rei de Israel, e trouxe consigo o culto a Baal e a Aserá. Sustentava à sua mesa centenas de profetas dessas divindades e mandou matar os profetas do Senhor, dos quais cem foram escondidos por Obadias em duas cavernas (1 Reis 18:4,13,19).

Após o confronto no monte Carmelo, em que Elias venceu os profetas de Baal, ela mandou dizer ao profeta que no dia seguinte faria com a vida dele o mesmo que fora feito com a deles. Elias fugiu para o deserto e pediu a morte debaixo de um zimbro (1 Reis 19:1-4).

O episódio que mais define sua figura é o da vinha de Nabote. Como Acabe se recusava a comer por não conseguir comprar a propriedade do vizinho, Jezabel escreveu cartas em nome do rei convocando um jejum e instruindo dois homens ímpios a acusar Nabote de blasfêmia, para que fosse apedrejado e a vinha ficasse livre. Elias confrontou o casal e anunciou o fim de ambos (1 Reis 21).

Morreu anos depois, quando Jeú entrou em Jezreel. Ela pintou os olhos, enfeitou a cabeça e o desafiou da janela; os eunucos a lançaram para fora, e os cães devoraram seu corpo, cumprindo a palavra de Elias (2 Reis 9:30-37). O Apocalipse usa seu nome como símbolo de sedução doutrinária na igreja de Tiatira (Apocalipse 2:20).',
  published = true
where slug = 'jezabel';

update public.lexicon_entries set
  aliases = array['Jó', 'Job', 'Iyov'],
  title = 'Jó, o homem que perdeu tudo',
  description = 'Homem da terra de Uz, descrito como íntegro, reto, temente a Deus e que se desviava do mal, o maior de todos os do Oriente, com sete filhos, três filhas e grandes rebanhos (Jó 1:1-3).

O livro começa com uma cena celestial em que Satanás questiona se Jó teme a Deus sem interesse, e recebe permissão para atingi-lo. Num único dia, Jó perdeu bois, jumentos, ovelhas, camelos, os servos e os dez filhos, mortos quando a casa onde banqueteavam desabou. Sua reação foi rasgar o manto, rapar a cabeça e adorar, dizendo: "o Senhor deu, e o Senhor tomou; bendito seja o nome do Senhor" (Jó 1:13-21). Depois foi ferido de chagas da planta do pé ao alto da cabeça, sentou-se na cinza e se raspava com um caco (Jó 2:7-8).

Três amigos, Elifaz, Bildade e Zofar, vieram consolá-lo e ficaram sete dias em silêncio, mas depois passaram a argumentar que tanto sofrimento só podia ser castigo por pecado oculto. Jó sustentou sua integridade e questionou a Deus diretamente ao longo de dezenas de capítulos, chegando a afirmar: "ainda que ele me mate, nele esperarei" e "eu sei que o meu Redentor vive" (Jó 13:15, 19:25).

Depois do discurso do jovem Eliú, o Senhor respondeu do meio de um redemoinho, não com explicações, mas com perguntas sobre a criação. Jó se retratou e Deus o restaurou em dobro, repreendendo os três amigos (Jó 38-42).',
  published = true
where slug = 'jo';

update public.lexicon_entries set
  aliases = array['João', 'Joao', 'John', 'João Evangelista', 'discípulo amado'],
  title = 'João, o discípulo amado',
  description = 'Filho de Zebedeu e irmão de Tiago, pescador da Galileia chamado por Jesus enquanto consertava as redes com o pai. Com o irmão, recebeu o apelido de Boanerges, "filhos do trovão" (Marcos 1:19-20, 3:17).

Fez parte do círculo mais íntimo, com Pedro e Tiago, presente na transfiguração, na ressurreição da filha de Jairo e na agonia do Getsêmani. O quarto evangelho o identifica como "o discípulo a quem Jesus amava", que se reclinou sobre o peito dele na última ceia, esteve ao pé da cruz e recebeu a incumbência de cuidar de Maria: "eis aí a tua mãe" (João 13:23, 19:26-27).

Correu com Pedro ao sepulcro vazio na manhã da ressurreição, chegando primeiro mas deixando o outro entrar antes (João 20:2-8). Em Atos aparece sempre ao lado de Pedro: na cura do coxo à porta Formosa, diante do Sinédrio e na missão a Samaria (Atos 3-4, 8:14).

É tradicionalmente reconhecido como autor do evangelho de João, das três cartas joaninas e do Apocalipse, escrito na ilha de Patmos, onde estava por causa da palavra de Deus (Apocalipse 1:9). Seus escritos são marcados pelos temas da luz, da verdade, da vida e sobretudo do amor: "Deus é amor" (1 João 4:8).',
  published = true
where slug = 'joao';

update public.lexicon_entries set
  aliases = array['João Batista', 'Joao Batista', 'João o Batista', 'John the Baptist'],
  title = 'João Batista, o precursor',
  description = 'Filho de Zacarias e Isabel, teve o nascimento anunciado pelo anjo Gabriel a um casal idoso e sem filhos, com a declaração de que iria adiante do Senhor no espírito e virtude de Elias (Lucas 1:5-17). Nasceu cerca de seis meses antes de Jesus, de quem era parente.

Viveu nos desertos e apareceu pregando no deserto da Judeia, vestido de pelos de camelo com um cinto de couro, alimentando-se de gafanhotos e mel silvestre. Sua mensagem era: "arrependei-vos, porque é chegado o reino dos céus", e batizava no rio Jordão os que confessavam seus pecados. Os evangelhos o identificam com a voz que clama no deserto, de Isaías 40 (Mateus 3:1-6).

Falou com dureza aos fariseus e saduceus, chamando-os de raça de víboras, e respondeu com instruções práticas às multidões, aos publicanos e aos soldados que perguntavam o que fazer (Lucas 3:7-14). Batizou Jesus, hesitando por se considerar indigno, e viu o Espírito descer sobre ele. Depois o apontou dizendo: "eis o Cordeiro de Deus, que tira o pecado do mundo" (João 1:29).

Ao ser informado do crescimento de Jesus, resumiu sua missão: "é necessário que ele cresça e que eu diminua" (João 3:30). Foi preso por repreender Herodes Antipas pelo casamento com Herodias, mulher de seu irmão, e decapitado a pedido da filha dela durante um banquete (Marcos 6:17-29). Jesus disse dele que entre os nascidos de mulher não havia ninguém maior (Lucas 7:28).',
  published = true
where slug = 'joao-batista';

update public.lexicon_entries set
  aliases = array['Joel', 'Yoel'],
  title = 'Joel, o profeta do derramamento do Espírito',
  description = 'Filho de Petuel, autor do segundo dos doze profetas menores. A data de sua atuação é incerta, e o livro não menciona reis, o que o distingue da maioria dos escritos proféticos.

Seu ponto de partida é uma praga de gafanhotos de proporções devastadoras, descrita em quatro ondas sucessivas que consumiram a colheita e secaram a terra. Joel lê a catástrofe como sinal e convoca sacerdotes, anciãos, lavradores e todo o povo a um jejum solene, com o apelo: "rasgai o vosso coração, e não as vossas vestes" (Joel 1-2:13).

A praga se transforma em imagem do "dia do Senhor", tema central do livro, descrito como grande e terrível, com um exército que avança como cavalaria e diante do qual a terra treme.

A promessa que se segue tornou o livro conhecido bem além dele: "derramarei o meu Espírito sobre toda a carne, e vossos filhos e vossas filhas profetizarão, vossos velhos sonharão sonhos, vossos jovens terão visões", e "todo aquele que invocar o nome do Senhor será salvo" (Joel 2:28-32). Pedro cita exatamente essa passagem no sermão do dia de Pentecostes para explicar o que acontecia diante da multidão em Jerusalém (Atos 2:16-21). O livro termina com o juízo das nações no vale de Josafá e a restauração de Judá.',
  published = true
where slug = 'joel';

update public.lexicon_entries set
  aliases = array['Jonas', 'Jonah', 'Yonah'],
  title = 'Jonas, o profeta engolido pelo grande peixe',
  description = 'Filho de Amitai, profeta de Gate-Hefer, na Galileia, mencionado também em 2 Reis 14:25 como quem anunciou a ampliação das fronteiras de Israel no reinado de Jeroboão II.

Recebeu a ordem de ir a Nínive, capital assíria, e pregar contra a maldade da cidade. Fugiu na direção oposta, embarcando em Jope rumo a Társis. No mar, uma grande tempestade ameaçou o navio, e Jonas foi achado dormindo no porão. Lançadas as sortes, ele se identificou como culpado e pediu que o atirassem ao mar, o que acalmou as águas (Jonas 1).

Foi engolido por um grande peixe preparado por Deus, e ali permaneceu três dias e três noites, orando do ventre do peixe uma oração feita quase toda de expressões dos salmos, até ser vomitado em terra seca (Jonas 2).

Da segunda vez obedeceu. Pregou em Nínive que em quarenta dias a cidade seria destruída, e o resultado foi a conversão mais ampla registrada no Antigo Testamento: do rei ao gado, todos jejuaram, e Deus se arrependeu do mal anunciado (Jonas 3).

O livro termina com o profeta irritado justamente por isso, confessando que fugira por saber que Deus era misericordioso. Sentou-se fora da cidade, e Deus fez crescer uma aboboreira para lhe dar sombra e no dia seguinte a fez secar, terminando com uma pergunta sobre os cento e vinte mil habitantes que não sabiam discernir entre a mão direita e a esquerda (Jonas 4). Jesus se refere ao "sinal de Jonas" (Mateus 12:39-41).',
  published = true
where slug = 'jonas';

update public.lexicon_entries set
  aliases = array['Jônatas', 'Jonatas', 'Jonathan', 'Jonatã'],
  title = 'Jônatas, o amigo de Davi',
  description = 'Filho mais velho do rei Saul e herdeiro natural do trono de Israel. Guerreiro corajoso, atacou a guarnição filisteia em Micmás acompanhado apenas de seu escudeiro, dizendo que "para o Senhor nenhum impedimento há de livrar com muitos ou com poucos", e a confusão que provocou no acampamento inimigo decidiu a batalha (1 Samuel 14:1-23).

No mesmo dia, comeu mel do favo sem saber do juramento imprudente que o pai havia imposto ao exército, e quase foi executado por isso, sendo salvo pela intervenção do povo (1 Samuel 14:24-45).

Sua amizade com Davi é uma das mais conhecidas das Escrituras. Depois da vitória sobre Golias, "a alma de Jônatas se ligou à alma de Davi", e ele fez um pacto com o amigo, entregando-lhe sua túnica, sua espada, seu arco e seu cinto, símbolos de sua própria condição de príncipe (1 Samuel 18:1-4).

Quando Saul passou a perseguir Davi, Jônatas o avisou e intercedeu pelo amigo diante do pai, mesmo sabendo que aquilo custaria o trono à sua casa. O sinal combinado das flechas atiradas no campo e a despedida chorosa dos dois estão em 1 Samuel 20. Morreu ao lado de Saul na batalha do monte Gilboa, e Davi o lamentou no cântico do arco: "angustiado estou por ti, meu irmão Jônatas" (2 Samuel 1:17-27).',
  published = true
where slug = 'jonatas';

update public.lexicon_entries set
  aliases = array['José', 'Jose', 'Joseph', 'Yosef'],
  title = 'José',
  description = 'Há dois Josés de grande destaque nas Escrituras.

O primeiro é José, filho de Jacó e Raquel, no Antigo Testamento. Predileto do pai, que lhe deu uma túnica distinta, e sonhador de sonhos em que os irmãos se curvavam diante dele, foi vendido por eles a mercadores por vinte moedas de prata e levado ao Egito (Gênesis 37). Servo na casa de Potifar, foi acusado falsamente pela mulher dele e preso. Na prisão interpretou os sonhos do copeiro e do padeiro, e depois foi chamado a interpretar os sonhos do Faraó sobre sete anos de fartura e sete de fome, sendo elevado ao posto de segundo homem do Egito (Gênesis 39-41). Quando a fome levou seus irmãos ao Egito em busca de mantimento, ele os reconheceu, pôs à prova e por fim se revelou chorando, resumindo tudo na frase: "vós bem intentastes mal contra mim, porém Deus o tornou em bem" (Gênesis 45, 50:20).

O segundo é José de Nazaré, no Novo Testamento, carpinteiro descendente de Davi e esposo de Maria. Ao saber da gravidez dela, decidiu deixá-la secretamente para não expô-la, mas um anjo lhe apareceu em sonho explicando a origem do menino, e ele a recebeu como esposa (Mateus 1:18-25). Levou a família ao Egito para escapar de Herodes e depois se estabeleceu em Nazaré (Mateus 2:13-23).

Aparecem ainda José de Arimateia, membro do Sinédrio que pediu o corpo de Jesus a Pilatos e o sepultou em seu próprio túmulo novo (Mateus 27:57-60), e José chamado Barsabás, cotado com Matias para ocupar o lugar de Judas entre os doze (Atos 1:23).',
  published = true
where slug = 'jose';

update public.lexicon_entries set
  aliases = array['Josias', 'Josiah', 'Yoshiyahu'],
  title = 'Josias, o rei menino que reformou Judá',
  description = 'Filho de Amom, tornou-se rei de Judá aos oito anos de idade e reinou trinta e um anos em Jerusalém. O texto diz que andou nos caminhos de Davi, seu pai, sem se desviar nem para a direita nem para a esquerda (2 Reis 22:1-2).

No décimo oitavo ano de seu reinado, mandou reparar o templo, e durante as obras o sumo sacerdote Hilquias encontrou o livro da Lei. Quando o escrivão Safã o leu diante do rei, Josias rasgou as vestes, reconhecendo que os pais não haviam obedecido àquelas palavras, e mandou consultar a profetisa Hulda, que confirmou o juízo sobre a nação mas prometeu que ele não o veria (2 Reis 22:8-20).

A partir daí conduziu a reforma mais radical da história de Judá: reuniu o povo, leu publicamente o livro da aliança, destruiu os altares e os ídolos de Baal e Aserá, aboliu os sacerdotes idólatras, profanou Tofete no vale de Hinom, onde se sacrificavam crianças, e estendeu a limpeza até Betel, derrubando o altar erguido por Jeroboão (2 Reis 23:1-20).

Celebrou uma Páscoa como não se fazia desde os dias dos juízes (2 Reis 23:21-23). Morreu em batalha em Megido, ao tentar interceptar o faraó Neco, que subia em auxílio da Assíria, e foi pranteado por todo o povo, inclusive por Jeremias (2 Crônicas 35:20-25).',
  published = true
where slug = 'josias';

update public.lexicon_entries set
  aliases = array['Josué', 'Josue', 'Joshua', 'Yehoshua'],
  title = 'Josué, o sucessor de Moisés',
  description = 'Filho de Num, da tribo de Efraim, foi servo de Moisés desde a juventude. Comandou a primeira batalha de Israel depois do Egito, contra os amalequitas em Refidim, enquanto Moisés mantinha as mãos erguidas no alto do monte, amparado por Arão e Hur (Êxodo 17:8-13).

Acompanhou Moisés na subida ao Sinai e permanecia na tenda da congregação quando o mestre voltava ao arraial (Êxodo 24:13, 33:11). Foi um dos doze espias enviados a Canaã e, com Calebe, o único a defender a entrada na terra, pelo que os dois foram as únicas pessoas de sua geração a sobreviver aos quarenta anos no deserto (Números 14:6-9, 30).

Designado sucessor de Moisés por imposição de mãos, recebeu a ordem que abre o livro que leva seu nome: "esforça-te e tem bom ânimo; não temas nem te espantes, porque o Senhor teu Deus é contigo por onde quer que andares" (Josué 1:9).

Conduziu a travessia do Jordão, cujas águas se detiveram diante da arca, a queda de Jericó após sete dias de volta aos muros, e a conquista progressiva da terra, inclusive o dia em que pediu que o sol se detivesse sobre Gibeom (Josué 3-10). Dividiu o território entre as tribos e, já velho, reuniu o povo em Siquém para renovar a aliança, com o desafio final: "escolhei hoje a quem sirvais; porém eu e a minha casa serviremos ao Senhor" (Josué 24:15).',
  published = true
where slug = 'josue';

update public.lexicon_entries set
  aliases = array['Judá', 'Juda', 'Yehudah', 'Judah'],
  title = 'Judá, o filho de quem veio a linhagem real',
  description = 'Quarto filho de Jacó e Lia. Foi ele quem propôs aos irmãos vender José aos mercadores em vez de matá-lo, argumentando que não havia proveito em derramar o sangue do irmão (Gênesis 37:26-27).

Gênesis 38 narra o episódio com Tamar, sua nora: depois da morte de dois filhos dele casados com ela, Judá deixou de lhe dar o terceiro conforme o costume, e Tamar se disfarçou para conceber dele. Confrontado com as provas, reconheceu publicamente: "ela é mais justa do que eu". Do casal nasceu Perez, que entra na linhagem de Davi.

No Egito, foi Judá quem ofereceu a própria liberdade em troca da de Benjamim diante de José, discurso que precipitou a revelação da identidade do irmão (Gênesis 44:18-34).

Na bênção final de Jacó, Judá recebe a promessa mais notável: "o cetro não se arredará de Judá", e é comparado a um leão (Gênesis 49:8-12). Sua tribo ocupou o sul de Canaã, deu origem ao reino de Judá após a divisão, e dela vieram Davi, Salomão e a linhagem que os evangelhos ligam a Jesus, chamado no Apocalipse de "o Leão da tribo de Judá" (Apocalipse 5:5).',
  published = true
where slug = 'juda';

update public.lexicon_entries set
  aliases = array['Judas', 'Jude', 'Judas Tadeu', 'Tadeu'],
  title = 'Judas',
  description = 'O nome Judas era comum entre os judeus do primeiro século, e vários homens o levam no Novo Testamento, o que exige atenção para não confundi-los.

Judas, também chamado Tadeu, é um dos doze apóstolos, identificado por Lucas como "Judas, irmão de Tiago", e por João distinguido explicitamente com a observação "não o Iscariotes". Sua única fala registrada é a pergunta feita na última ceia: "Senhor, por que te hás de manifestar a nós, e não ao mundo?" (João 14:22, Lucas 6:16, Atos 1:13).

Judas, irmão do Senhor, mencionado ao lado de Tiago, José e Simão entre os irmãos de Jesus (Marcos 6:3). É tradicionalmente reconhecido como autor da carta de Judas, que se apresenta como "servo de Jesus Cristo e irmão de Tiago", um escrito curto e vigoroso contra falsos mestres, encerrado com uma das doxologias mais citadas: "àquele que é poderoso para vos guardar de tropeçar" (Judas 24-25).

Judas Barsabás, profeta enviado de Jerusalém a Antioquia com Silas para entregar a carta do concílio (Atos 15:22-32). E Judas de Damasco, em cuja casa, na rua chamada Direita, Saulo de Tarso estava hospedado quando Ananias foi buscá-lo (Atos 9:11).

O mais conhecido, Judas Iscariotes, tem entrada própria.',
  published = true
where slug = 'judas';

update public.lexicon_entries set
  aliases = array['Judas Iscariotes', 'Judas Iscariote', 'Iscariotes', 'Judas Iscariot'],
  title = 'Judas Iscariotes, o que traiu Jesus',
  description = 'Um dos doze apóstolos, sempre citado por último nas listas, com a observação "o que o traiu". Era o encarregado da bolsa do grupo, e João registra que tirava dela para si (João 12:6).

Sua objeção ao perfume derramado por Maria de Betânia sobre os pés de Jesus, alegando que poderia ter sido vendido por trezentos denários em favor dos pobres, é o último episódio antes da traição (João 12:4-6).

Procurou os principais sacerdotes e combinou entregar Jesus por trinta moedas de prata, o preço de um escravo na lei de Moisés (Mateus 26:14-16). Na última ceia, Jesus anunciou que um dos que comiam com ele o entregaria, e ao molho do pão identificou o traidor. Judas saiu, e o evangelho de João acrescenta a frase mais sombria da narrativa: "e era noite" (João 13:26-30).

No Getsêmani, chegou acompanhado de uma multidão com espadas e varapaus e deu o sinal combinado, um beijo, ao que Jesus respondeu: "amigo, a que vieste?" (Mateus 26:47-50).

Ao ver a condenação, arrependeu-se, devolveu as moedas dizendo ter traído sangue inocente e, diante da indiferença dos sacerdotes, lançou a prata no templo e se enforcou. Com o dinheiro, que não podia entrar no tesouro por ser preço de sangue, compraram o campo do oleiro para sepultura de estrangeiros (Mateus 27:3-10, Atos 1:18-19).',
  published = true
where slug = 'judas-iscariotes';

update public.lexicon_entries set
  aliases = array['Labão', 'Labao', 'Laban'],
  title = 'Labão, sogro de Jacó',
  description = 'Irmão de Rebeca e morador de Harã, na Mesopotâmia. Aparece primeiro na história do casamento de Isaque, quando recebe o servo de Abraão em sua casa (Gênesis 24:29-31).

Anos depois, recebeu o sobrinho Jacó, que fugia da ira de Esaú. Jacó se apaixonou por Raquel, filha mais nova de Labão, e concordou em trabalhar sete anos por ela. Na noite do casamento, porém, Labão lhe entregou Lia, a filha mais velha, justificando-se com o costume local de não casar a mais nova antes da primogênita. Jacó teve de servir outros sete anos por Raquel (Gênesis 29:15-30).

A relação entre os dois foi marcada por disputas sobre salário e rebanhos: Labão mudou o acordo repetidas vezes, e Jacó respondeu com estratégias próprias de criação, prosperando às custas do sogro (Gênesis 30:25-43).

Jacó acabou partindo às escondidas com as esposas, os filhos e o gado, e Raquel levou consigo os ídolos domésticos do pai. Labão os perseguiu por sete dias, foi advertido por Deus em sonho a não fazer mal a Jacó, e os dois firmaram um pacto em Galeede, erguendo um monte de pedras como testemunho de que nenhum passaria dali para prejudicar o outro (Gênesis 31).',
  published = true
where slug = 'labao';

update public.lexicon_entries set
  aliases = array['Lázaro', 'Lazaro', 'Lazarus'],
  title = 'Lázaro',
  description = 'Há dois Lázaros no Novo Testamento, ambos no contexto da morte.

O primeiro é Lázaro de Betânia, irmão de Marta e Maria, a quem o texto chama de amigo de Jesus. Quando adoeceu, as irmãs mandaram avisar: "aquele a quem amas está enfermo". Jesus, no entanto, permaneceu dois dias onde estava, e Lázaro morreu (João 11:1-6).

Ao chegar, já havia quatro dias que estava no sepulcro. Marta e Maria o receberam com a mesma frase: "Senhor, se tu estivesses aqui, meu irmão não teria morrido". Diante do túmulo, Jesus chorou, o versículo mais curto da Bíblia em muitas traduções, e depois mandou tirar a pedra, apesar do aviso de Marta sobre o mau cheiro. Clamou em alta voz: "Lázaro, vem para fora", e o morto saiu com as mãos e os pés ligados com faixas (João 11:17-44).

O milagre teve consequência política: muitos creram, e o Sinédrio decidiu não só matar Jesus, mas também Lázaro, por causa de quem muitos judeus criam (João 11:45-53, 12:10-11). Depois disso, ele aparece à mesa num jantar em Betânia.

O segundo é o Lázaro da parábola contada por Jesus, um mendigo coberto de chagas que jazia à porta de um homem rico e, ao morrer, foi levado pelos anjos ao seio de Abraão, enquanto o rico foi para o tormento (Lucas 16:19-31). É a única personagem de parábola a receber nome.',
  published = true
where slug = 'lazaro';

update public.lexicon_entries set
  aliases = array['Levi', 'Levy'],
  title = 'Levi',
  description = 'Terceiro filho de Jacó e Lia, e pai da tribo sacerdotal de Israel. Junto com o irmão Simeão, vingou com violência a desonra da irmã Diná, matando os homens de Siquém, ato que Jacó condenou e que rendeu aos dois uma palavra dura na bênção final: seriam divididos em Jacó e espalhados em Israel (Gênesis 34, 49:5-7).

Essa dispersão acabou tomando forma singular: a tribo de Levi não recebeu território próprio na partilha de Canaã, mas cidades espalhadas entre as demais tribos, porque "o Senhor é a sua herança" (Josué 13:33). Os levitas ficaram responsáveis pelo serviço do tabernáculo e depois do templo, e de Levi, por meio de Coate e Anrão, vieram Moisés, Arão e Miriã. A linhagem sacerdotal propriamente dita passou a Arão e seus descendentes (Êxodo 6:16-20).

No Novo Testamento, Levi é também o nome pelo qual Marcos e Lucas apresentam o cobrador de impostos chamado por Jesus à beira do mar da Galileia, o mesmo que Mateus identifica por seu próprio nome (Marcos 2:14, Lucas 5:27, Mateus 9:9).',
  published = true
where slug = 'levi';

update public.lexicon_entries set
  aliases = array['Lia', 'Leah', 'Léia'],
  title = 'Lia, a primeira mulher de Jacó',
  description = 'Filha mais velha de Labão e irmã de Raquel. Foi entregue por seu pai a Jacó na noite de núpcias, no lugar de Raquel, com quem Jacó havia combinado o casamento após sete anos de trabalho. Descoberto o engano pela manhã, Jacó serviu mais sete anos por Raquel, e Lia passou a viver como a esposa menos amada (Gênesis 29:21-30).

O texto registra que, vendo-a preterida, Deus a fez fértil enquanto Raquel permanecia estéril. Deu a Jacó seis filhos e uma filha: Rúben, Simeão, Levi, Judá, Issacar, Zebulom e Diná. Os nomes que escolheu para eles guardam sua história pessoal, do lamento por não ser amada até o louvor no nascimento de Judá, cujo nome significa "louvor" (Gênesis 29:31-35, 30:17-21).

De Lia vieram duas das linhagens mais decisivas de Israel: a tribo de Levi, dos sacerdotes, e a tribo de Judá, da qual descendem Davi e, segundo os evangelhos, Jesus.

Foi sepultada na caverna de Macpela, em Hebrom, junto a Abraão, Sara, Isaque e Rebeca, e o próprio Jacó pediu para ser enterrado ali ao lado dela (Gênesis 49:31).',
  published = true
where slug = 'lia';

update public.lexicon_entries set
  aliases = array['Lídia', 'Lidia', 'Lydia'],
  title = 'Lídia, a primeira convertida na Europa',
  description = 'Natural de Tiatira, cidade da Ásia Menor conhecida pela indústria de tinturaria, era vendedora de púrpura, tecido caro associado à realeza, o que indica que tinha meios próprios e negócio estabelecido.

Vivia em Filipos, colônia romana da Macedônia, onde Paulo chegou depois da visão do homem macedônio que o chamava. Como a cidade não tinha sinagoga, no sábado os missionários foram à beira do rio, onde se costumava fazer oração, e falaram às mulheres ali reunidas (Atos 16:11-13).

O texto diz que ela "temia a Deus", ou seja, era uma gentia simpatizante do judaísmo, e registra o momento de sua conversão com uma frase simples e precisa: "o Senhor lhe abriu o coração para atender às coisas que Paulo dizia" (Atos 16:14). Foi batizada com toda a sua casa.

Em seguida insistiu com os missionários para que se hospedassem em sua residência, com um argumento que o próprio texto registra como constrangimento amistoso: "se haveis julgado que eu seja fiel ao Senhor, entrai em minha casa e ficai" (Atos 16:15). Sua casa se tornou base da igreja em Filipos: depois da prisão e da libertação no cárcere, Paulo e Silas voltaram a ela para ver e consolar os irmãos antes de partir (Atos 16:40).

É a primeira pessoa registrada como convertida ao evangelho em solo europeu.',
  published = true
where slug = 'lidia';

update public.lexicon_entries set
  aliases = array['Ló', 'Lo', 'Lot'],
  title = 'Ló, o sobrinho de Abraão que morava em Sodoma',
  description = 'Filho de Harã e sobrinho de Abraão, acompanhou o tio desde Ur dos caldeus e depois de Harã até Canaã. Quando os rebanhos dos dois cresceram e os pastores começaram a brigar por pastagem, Abraão lhe ofereceu a escolha da terra, e Ló escolheu a planície bem irrigada do Jordão, armando suas tendas em direção a Sodoma (Gênesis 13:5-13).

Foi levado cativo na guerra dos reis da região e resgatado por Abraão, que reuniu trezentos e dezoito homens de sua casa para persegui-los (Gênesis 14).

Morando já dentro de Sodoma, recebeu dois anjos em sua casa e os protegeu da multidão que cercou a porta. Os visitantes anunciaram a destruição da cidade e o retiraram dali pela mão, junto com a esposa e as duas filhas, com a ordem de não olhar para trás. Enquanto enxofre e fogo caíam sobre Sodoma e Gomorra, a mulher de Ló olhou para trás e se tornou uma coluna de sal (Gênesis 19).

Refugiado numa caverna com as filhas, foi embriagado por elas, que conceberam dele os antepassados de Moabe e de Amom (Gênesis 19:30-38). No Novo Testamento, Pedro o chama de "justo", atormentado pela conduta dos que o cercavam (2 Pedro 2:7-8), e Jesus adverte: "Lembrem-se da mulher de Ló" (Lucas 17:32).',
  published = true
where slug = 'lo';

update public.lexicon_entries set
  aliases = array['Lucas', 'Luke', 'Lucas o médico'],
  title = 'Lucas, o médico amado',
  description = 'Companheiro de Paulo e autor do terceiro evangelho e do livro de Atos, duas obras dedicadas a Teófilo que juntas formam a maior contribuição individual ao Novo Testamento em volume de texto.

Paulo o chama de "Lucas, o médico amado" (Colossenses 4:14) e, ao listá-lo separadamente dos que eram "da circuncisão", sugere que era gentio, o que faria dele o único autor não judeu das Escrituras cristãs.

Sua presença ao lado de Paulo é detectável em Atos pelas seções em que a narrativa passa da terceira para a primeira pessoa do plural, as chamadas passagens do "nós", que começam em Trôade, na segunda viagem missionária, e reaparecem na viagem a Jerusalém e na travessia até Roma, inclusive no naufrágio em Malta (Atos 16:10, 20:5, 27-28).

O prólogo de seu evangelho explica o método: tendo investigado tudo desde o princípio, depois de ouvir os que desde o começo foram testemunhas oculares, resolveu escrever um relato em ordem, para que Teófilo conhecesse a certeza das coisas que lhe haviam sido ensinadas (Lucas 1:1-4). São exclusivas dele as parábolas do bom samaritano e do filho pródigo, os cânticos de Maria, Zacarias e Simeão, e o episódio de Emaús.

É mencionado por último numa das frases mais solitárias de Paulo: "só Lucas está comigo" (2 Timóteo 4:11).',
  published = true
where slug = 'lucas';

update public.lexicon_entries set
  aliases = array['Malaquias', 'Malachi', 'Malaquías'],
  title = 'Malaquias, o último profeta do Antigo Testamento',
  description = 'Autor do último livro do Antigo Testamento, provavelmente contemporâneo de Neemias, num tempo em que o templo já estava reconstruído mas o entusiasmo havia esfriado.

O livro é construído como uma sequência de disputas: Deus faz uma afirmação, o povo responde com uma pergunta cética, e a acusação vem detalhada. "Eu vos tenho amado", e a resposta: "em que nos tens amado?" (Malaquias 1:2). O padrão se repete sobre o desprezo pelo nome de Deus, o cansaço com o culto e a infidelidade.

As denúncias são concretas. Os sacerdotes ofereciam animais cegos, coxos e enfermos, que não apresentariam ao governador da província (1:8). Os homens abandonavam as mulheres da mocidade, e a resposta é a frase "porque o Senhor odeia o repúdio" (2:16). E o povo era acusado de roubar a Deus nos dízimos e ofertas, com o convite a prová-lo nisso e ver se ele não abriria as janelas do céu (3:8-10).

O livro registra que os que temiam ao Senhor falavam uns aos outros e que um livro de memórias foi escrito diante dele (3:16). Termina anunciando o dia que virá ardente como fornalha e o sol da justiça que trará cura em suas asas, com a promessa do envio de Elias antes daquele dia grande e terrível, para converter o coração dos pais aos filhos (4:5-6), palavra que os evangelhos associam a João Batista.',
  published = true
where slug = 'malaquias';

update public.lexicon_entries set
  aliases = array['Manassés', 'Manasses', 'Menashe', 'Manasseh'],
  title = 'Manassés',
  description = 'Há dois Manassés de destaque no Antigo Testamento.

O primeiro é Manassés, filho mais velho de José com Asenate, no Egito. Seu nome significa "o que faz esquecer", porque, segundo José, Deus o fez esquecer todo o seu trabalho e a casa de seu pai (Gênesis 41:51). Quando Jacó abençoou os netos, cruzou os braços e colocou a mão direita sobre Efraim, o mais novo, invertendo a ordem esperada apesar da tentativa de José de corrigi-lo (Gênesis 48:13-20). A tribo de Manassés foi dividida: metade se estabeleceu a leste do Jordão, em Basã e Gileade, e metade a oeste, entre Efraim e Issacar.

O segundo é Manassés, rei de Judá, filho de Ezequias. Subiu ao trono aos doze anos e reinou cinquenta e cinco, o reinado mais longo da história do reino do Sul. É lembrado como o mais ímpio dos reis de Judá: reconstruiu os altares que o pai havia destruído, ergueu imagens no próprio templo, praticou feitiçaria e sacrificou o próprio filho (2 Reis 21:1-9). Segundo 2 Crônicas, foi levado acorrentado à Babilônia pelos assírios e ali se humilhou e orou, sendo devolvido ao trono e promovendo reformas tardias (2 Crônicas 33:10-16).',
  published = true
where slug = 'manasses';

update public.lexicon_entries set
  aliases = array['Marcos', 'Mark', 'João Marcos', 'Joao Marcos'],
  title = 'Marcos, autor do segundo evangelho',
  description = 'Chamado também João Marcos, era filho de uma Maria de Jerusalém em cuja casa a igreja se reunia em oração na noite em que Pedro foi libertado da prisão por um anjo (Atos 12:12). Era primo de Barnabé (Colossenses 4:10).

Acompanhou Paulo e Barnabé no início da primeira viagem missionária como auxiliar, mas os deixou em Perge e voltou a Jerusalém (Atos 13:5,13). Esse abandono causou depois uma discordância séria: quando Barnabé quis levá-lo novamente, Paulo se recusou, e a divergência foi tão forte que os dois se separaram, seguindo Barnabé com Marcos para Chipre (Atos 15:36-39).

A história não terminou ali. Nas cartas posteriores, Marcos aparece de novo entre os cooperadores de Paulo (Colossenses 4:10, Filemom 24), e a última menção é um pedido explícito: "toma Marcos e traze-o contigo, porque me é muito útil para o ministério" (2 Timóteo 4:11). Pedro, por sua vez, o chama de "meu filho" ao enviar saudações da Babilônia (1 Pedro 5:13).

A tradição cristã antiga o identifica como autor do segundo evangelho, escrito a partir da pregação de Pedro. É o mais curto e direto dos quatro, marcado pelo advérbio "imediatamente" e pela ênfase na ação. Muitos leem em Marcos 14:51-52, o jovem que fugiu nu deixando o lençol nas mãos dos soldados, uma assinatura discreta do próprio autor.',
  published = true
where slug = 'marcos';

update public.lexicon_entries set
  aliases = array['Mardoqueu', 'Mordecai', 'Mordechai'],
  title = 'Mardoqueu, o primo de Ester',
  description = 'Judeu da tribo de Benjamim, morador de Susã, descendente dos que foram levados no exílio de Jerusalém. Criou sua prima órfã Hadassa, conhecida como Ester, como se fosse filha, e a orientou a não revelar sua origem quando foi levada ao palácio (Ester 2:5-11).

Sentado à porta do rei, descobriu a conspiração de dois eunucos que planejavam matar Assuero, avisou por meio de Ester, e o caso foi registrado nas crônicas reais sem que ele recebesse qualquer recompensa na ocasião (Ester 2:21-23).

Recusou-se a se curvar diante de Hamã, o que motivou o decreto de extermínio contra todos os judeus. Vestiu-se de saco e cinza, clamou em alta voz pela cidade, e enviou a Ester o apelo decisivo, lembrando-lhe que, se calasse, o livramento viria de outra parte, mas que talvez tivesse chegado ao trono exatamente para aquele momento (Ester 3-4).

Numa noite de insônia, o rei mandou ler as crônicas, descobriu o feito não recompensado e perguntou a Hamã o que se deveria fazer ao homem a quem o rei desejava honrar. Hamã, supondo tratar-se de si mesmo, descreveu uma cerimônia grandiosa, e acabou tendo de conduzir pessoalmente o cavalo de Mardoqueu pelas ruas (Ester 6).

Após a queda de Hamã, assumiu seu lugar como segundo homem do reino, e junto com Ester instituiu a festa de Purim (Ester 8-10).',
  published = true
where slug = 'mardoqueu';

update public.lexicon_entries set
  aliases = array['Maria', 'Mary', 'Miriam', 'Maria de Nazaré'],
  title = 'Maria',
  description = 'Há várias mulheres chamadas Maria no Novo Testamento, e a principal é Maria de Nazaré, mãe de Jesus.

Jovem prometida em casamento a José, recebeu a visita do anjo Gabriel, que a saudou como "agraciada" e lhe anunciou que conceberia um filho pelo Espírito Santo. Perguntou como aquilo seria possível e respondeu com a frase que a define: "eis aqui a serva do Senhor, cumpra-se em mim conforme a tua palavra" (Lucas 1:26-38). Visitou a parenta Isabel e entoou o cântico conhecido como Magnificat, que ecoa o cântico de Ana (Lucas 1:46-55).

Deu à luz em Belém e depositou o menino numa manjedoura. Guardava todas as coisas, meditando-as no coração (Lucas 2:19). Ouviu de Simeão, no templo, que uma espada traspassaria a sua própria alma. Aparece nas bodas de Caná, quando diz aos serventes "fazei tudo quanto ele vos disser" (João 2:5), e ao pé da cruz, onde Jesus a confia ao discípulo amado (João 19:25-27). Está entre os que perseveravam em oração no cenáculo antes do Pentecostes (Atos 1:14).

Outras Marias do Novo Testamento incluem Maria Madalena, Maria de Betânia, irmã de Marta e Lázaro, Maria mãe de Tiago e José, e Maria mãe de João Marcos, em cuja casa a igreja se reunia em oração quando Pedro foi libertado da prisão (Atos 12:12).',
  published = true
where slug = 'maria';

update public.lexicon_entries set
  aliases = array['Maria Madalena', 'Madalena', 'Maria de Magdala', 'Mary Magdalene'],
  title = 'Maria Madalena, a primeira a ver o Ressurreto',
  description = 'Natural de Magdala, cidade à margem do mar da Galileia, de onde vem seu sobrenome. Lucas a apresenta entre as mulheres que acompanhavam Jesus e o serviam com seus bens, e registra que dela haviam saído sete demônios (Lucas 8:1-3).

Esteve ao pé da cruz, quando quase todos os discípulos já haviam fugido, e acompanhou de longe o sepultamento, observando onde o corpo era posto (Marcos 15:40,47).

No primeiro dia da semana, foi ao sepulcro ainda escuro e encontrou a pedra removida. Correu a avisar Pedro e o outro discípulo, e depois ficou junto ao túmulo chorando. Ao olhar para dentro, viu dois anjos, e ao se voltar viu Jesus sem reconhecê-lo, supondo que fosse o jardineiro. Bastou que ele dissesse seu nome, "Maria", para que ela respondesse "Rabôni", que quer dizer Mestre (João 20:1-16).

Recebeu então a incumbência de anunciar aos discípulos a ressurreição, o que fez com as palavras "vi o Senhor" (João 20:17-18). Por isso é chamada na tradição antiga de apóstola dos apóstolos.

É frequentemente confundida na cultura popular com a pecadora que ungiu os pés de Jesus em Lucas 7 e com Maria de Betânia, identificações que o texto bíblico não faz em nenhum momento.',
  published = true
where slug = 'maria-madalena';

update public.lexicon_entries set
  aliases = array['Marta', 'Martha'],
  title = 'Marta, a irmã que se preocupava com muitas coisas',
  description = 'Moradora de Betânia, irmã de Maria e de Lázaro. Aparece em três cenas, e em todas com a mesma personalidade prática e direta.

Na primeira, recebeu Jesus em sua casa e andava ocupada em muitos serviços, enquanto a irmã se sentava aos pés dele para ouvi-lo. Aproximou-se e reclamou: "Senhor, não se te dá que minha irmã me deixe servir só? Dize-lhe que me ajude". A resposta, dita com o nome repetido, ficou entre as mais conhecidas dos evangelhos: "Marta, Marta, estás ansiosa e afadigada com muitas coisas, mas uma só é necessária; e Maria escolheu a boa parte, que não lhe será tirada" (Lucas 10:38-42).

Na segunda, com o irmão morto havia quatro dias, foi ela quem saiu ao encontro de Jesus enquanto Maria ficou em casa. Disse-lhe que, se ele estivesse ali, o irmão não teria morrido, mas acrescentou que mesmo agora Deus lhe daria tudo o que pedisse. No diálogo que se segue, ouviu a declaração "eu sou a ressurreição e a vida" e respondeu com uma confissão comparável à de Pedro: "sim, Senhor, creio que tu és o Cristo, o Filho de Deus" (João 11:20-27). Diante do túmulo, foi também ela quem observou que já cheirava mal.

Na terceira, num jantar em Betânia seis dias antes da Páscoa, o texto registra em poucas palavras: "Marta servia" (João 12:2).',
  published = true
where slug = 'marta';

update public.lexicon_entries set
  aliases = array['Mateus', 'Matthew', 'Levi cobrador', 'Matheus'],
  title = 'Mateus, o cobrador de impostos que virou apóstolo',
  description = 'Cobrador de impostos em Cafarnaum, função desprezada pelos judeus por servir a Roma e por dar margem a extorsões. Jesus passou e o viu sentado na coletoria, dizendo-lhe apenas "segue-me". Ele se levantou e o seguiu (Mateus 9:9). Marcos e Lucas narram o mesmo chamado, mas o nomeiam Levi, filho de Alfeu (Marcos 2:14, Lucas 5:27).

Ofereceu em sua casa um grande banquete a Jesus, com muitos publicanos e pecadores à mesa, o que escandalizou os fariseus. A resposta de Jesus foi: "os sãos não necessitam de médico, mas sim os doentes", e "não vim chamar os justos, mas os pecadores, ao arrependimento" (Lucas 5:29-32).

Seu nome aparece nas quatro listas dos apóstolos, e no evangelho que leva seu nome ele se identifica como "Mateus, o publicano", detalhe que os outros evangelistas omitem (Mateus 10:3).

A tradição cristã lhe atribui a autoria do primeiro evangelho, escrito com atenção especial a leitores judeus: é o que mais cita o Antigo Testamento, organiza o ensino de Jesus em cinco grandes discursos, entre eles o Sermão do Monte, e abre com uma genealogia que apresenta Jesus como filho de Davi e filho de Abraão.',
  published = true
where slug = 'mateus';

update public.lexicon_entries set
  aliases = array['Matias', 'Matthias', 'Mathias'],
  title = 'Matias, o apóstolo escolhido no lugar de Judas',
  description = 'Discípulo escolhido para completar o número dos doze após a morte de Judas Iscariotes. Sua eleição é narrada no primeiro capítulo de Atos, antes do dia de Pentecostes, com cerca de cento e vinte pessoas reunidas em Jerusalém.

Pedro se levantou e explicou a necessidade da substituição citando os salmos, e definiu o critério: era preciso escolher entre os homens que haviam acompanhado o grupo durante todo o tempo em que Jesus andou entre eles, desde o batismo de João até o dia da ascensão, para que fosse com eles testemunha da ressurreição (Atos 1:21-22).

Dois nomes atenderam ao critério: José, chamado Barsabás e apelidado Justo, e Matias. Os discípulos oraram pedindo que Deus mostrasse qual dos dois havia escolhido, lançaram sortes, e a sorte caiu sobre Matias, que foi então contado com os onze apóstolos (Atos 1:23-26).

É a última vez que o lançamento de sortes aparece nas Escrituras como método de decisão; a partir do capítulo seguinte, com o Pentecostes, a direção passa a ser atribuída ao Espírito Santo.

O Novo Testamento não volta a mencioná-lo. A tradição posterior associa sua pregação à Judeia e à região do mar Negro.',
  published = true
where slug = 'matias';

update public.lexicon_entries set
  aliases = array['Matusalém', 'Matusalem', 'Metusela', 'Methuselah'],
  title = 'Matusalém, o homem que viveu mais tempo',
  description = 'Filho de Enoque e avô de Noé, é a pessoa de maior longevidade registrada na Bíblia: viveu 969 anos (Gênesis 5:21-27). Seu nome se tornou sinônimo popular de vida longa, e a expressão "mais velho que Matusalém" é usada até hoje fora de qualquer contexto religioso.

O texto bíblico não narra nenhum episódio de sua vida além da genealogia: teve Lameque aos 187 anos, e Lameque foi pai de Noé. Somando os números de Gênesis 5, sua morte coincide com o ano do dilúvio, detalhe que intérpretes antigos costumavam ler como sinal da paciência de Deus, que teria adiado o julgamento enquanto ele vivesse.

Seu nome reaparece na genealogia de Jesus registrada por Lucas, que remonta a linhagem até Adão (Lucas 3:37).',
  published = true
where slug = 'matusalem';

update public.lexicon_entries set
  aliases = array['Melquisedeque', 'Melchisedeque', 'Melchizedek'],
  title = 'Melquisedeque, rei e sacerdote de Salém',
  description = 'Rei de Salém e sacerdote do Deus Altíssimo. Aparece uma única vez no Gênesis, em três versículos: quando Abraão voltava da vitória sobre os reis que haviam levado Ló cativo, Melquisedeque saiu ao seu encontro trazendo pão e vinho, abençoou-o, e Abraão lhe deu o dízimo de tudo (Gênesis 14:18-20).

Seu nome significa "rei de justiça", e Salém, a cidade que governava, é associada a Jerusalém (Salmos 76:2). É a única figura do Antigo Testamento a reunir os ofícios de rei e sacerdote, que em Israel eram deliberadamente separados.

O Salmo 110, um dos mais citados no Novo Testamento, declara ao rei messiânico: "tu és sacerdote para sempre, segundo a ordem de Melquisedeque" (Salmos 110:4).

A carta aos Hebreus desenvolve longamente essa figura nos capítulos 5 a 7, destacando que o texto do Gênesis não menciona seu pai, sua mãe, seu nascimento nem sua morte, e usando isso para apresentá-lo como retrato de um sacerdócio que não depende de genealogia nem é interrompido pela morte, superior ao sacerdócio levítico e cumprido em Jesus.',
  published = true
where slug = 'melquisedeque';

update public.lexicon_entries set
  aliases = array['Mesaque', 'Meshach', 'Misael'],
  title = 'Mesaque, um dos três lançados na fornalha',
  description = 'Jovem israelita levado cativo à Babilônia com Daniel, Sadraque e Abede-Nego. Seu nome hebraico era Misael, trocado para Mesaque na corte de Nabucodonosor, prática comum de assimilação dos que eram preparados para servir ao rei (Daniel 1:6-7).

Junto com os companheiros, recusou a comida e o vinho da mesa real para não se contaminar, e pediu ao encarregado uma prova de dez dias só com legumes e água. Ao final, os quatro estavam de melhor aparência que todos os outros jovens, e foram admitidos ao serviço do rei com sabedoria dez vezes superior à dos magos e astrólogos do reino (Daniel 1:8-20).

Quando Nabucodonosor ergueu na planície de Dura uma estátua de ouro de sessenta côvados e ordenou que todos se prostrassem ao som dos instrumentos, alguns caldeus denunciaram os três judeus que não obedeciam. Diante do rei furioso, que perguntou qual deus poderia livrá-los de suas mãos, responderam que não precisavam responder sobre aquele assunto: o Deus deles podia livrá-los, e mesmo que não livrasse, não serviriam aos deuses do rei (Daniel 3:16-18).

Amarrados e lançados na fornalha superaquecida, saíram ilesos, e Nabucodonosor decretou honra ao Deus deles e os promoveu na província da Babilônia (Daniel 3:19-30).',
  published = true
where slug = 'mesaque';

update public.lexicon_entries set
  aliases = array['Miqueias', 'Miquéias', 'Micah', 'Miqueas'],
  title = 'Miqueias, o profeta que anunciou Belém',
  description = 'Natural de Moresete, cidade pequena da Judeia, profetizou nos dias de Jotão, Acaz e Ezequias, contemporâneo de Isaías, e dirigiu sua mensagem tanto a Samaria quanto a Jerusalém.

Suas denúncias são sobretudo sociais: acusou os que cobiçam campos e os tomam, os chefes que odeiam o bem e amam o mal, os juízes que julgam por suborno, os sacerdotes que ensinam por interesse e os profetas que adivinham por dinheiro, anunciando que por causa deles Sião seria lavrada como um campo e Jerusalém se tornaria montões de ruínas (Miqueias 2-3).

O livro contém dois textos muito conhecidos. O primeiro é a profecia sobre o lugar do nascimento do Messias: "e tu, Belém Efrata, posto que pequena entre os milhares de Judá, de ti me sairá o que governará em Israel, e cujas saídas são desde os tempos antigos" (Miqueias 5:2), citada pelos escribas quando Herodes perguntou onde nasceria o Cristo (Mateus 2:5-6).

O segundo resume em uma frase o que Deus requer: "que pratiques a justiça, e ames a misericórdia, e andes humildemente com o teu Deus" (Miqueias 6:8).

O capítulo 4 traz a visão das espadas transformadas em arados e das lanças em foices, quase idêntica à de Isaías 2. Jeremias 26:18 registra que a profecia de Miqueias contra Jerusalém foi lembrada um século depois para defender Jeremias da pena de morte.',
  published = true
where slug = 'miqueias';

update public.lexicon_entries set
  aliases = array['Miriã', 'Miria', 'Míriam', 'Maria irmã de Moisés'],
  title = 'Miriã, irmã de Moisés e profetisa',
  description = 'Irmã mais velha de Moisés e Arão, da tribo de Levi. Aparece primeiro como a menina que vigia de longe o cesto com o bebê Moisés nas águas do Nilo e, com presença de espírito, se oferece à filha do Faraó para chamar uma ama hebreia, trazendo assim a própria mãe do menino para amamentá-lo (Êxodo 2:4-8).

Após a travessia do Mar Vermelho, é chamada de profetisa e conduz as mulheres com tamboris e danças no cântico de vitória: "cantai ao Senhor, porque gloriosamente triunfou" (Êxodo 15:20-21). É a primeira mulher chamada de profetisa nas Escrituras.

Em Números 12, ela e Arão criticaram Moisés por causa da mulher cuxita com quem ele havia se casado, questionando se Deus falava apenas por meio dele. Miriã foi ferida de lepra e isolada por sete dias fora do arraial, voltando depois que Moisés intercedeu por ela com o pedido mais curto das Escrituras: "ó Deus, rogo-te que a cures".

Morreu em Cades, no deserto de Zim, e foi sepultada ali (Números 20:1). O profeta Miqueias a menciona ao lado de Moisés e Arão como um dos três enviados diante do povo na saída do Egito (Miqueias 6:4).',
  published = true
where slug = 'miria';

update public.lexicon_entries set
  aliases = array['Moisés', 'Moises', 'Moses'],
  title = 'Moisés, o libertador de Israel',
  description = 'Nascido no Egito, filho de pais levitas, numa época em que o Faraó havia ordenado a morte de todo recém-nascido hebreu do sexo masculino. Para salvá-lo, sua mãe o colocou numa cesta no rio Nilo, onde foi encontrado e criado pela filha do Faraó, crescendo na corte egípcia. Já adulto, matou um egípcio que espancava um hebreu e precisou fugir para a terra de Midiã, onde se casou com Zípora e passou anos como pastor.

Foi em Midiã que Deus o chamou por meio de uma sarça ardente no Monte Horebe, ordenando que voltasse ao Egito para libertar o povo de Israel da escravidão. Junto com seu irmão Arão, confrontou o Faraó diversas vezes, e a resistência do rei egípcio resultou nas dez pragas, até a instituição da Páscoa e a saída definitiva do povo do Egito, incluindo a travessia do Mar Vermelho (Êxodo 3-14).

Durante os quarenta anos seguintes, liderou o povo pelo deserto até a Terra Prometida. No Monte Sinai, recebeu de Deus os Dez Mandamentos e as demais leis que organizariam a vida religiosa e social de Israel, além das instruções para a construção do tabernáculo. Enfrentou repetidas rebeliões e reclamações do povo ao longo da jornada.

Por um ato de desobediência, quando feriu a rocha em vez de apenas falar a ela para tirar água, Moisés foi impedido por Deus de entrar na Terra Prometida (Números 20:1-12). Ele avistou a terra do alto do Monte Nebo antes de morrer, e foi sucedido na liderança por Josué. É tradicionalmente reconhecido como autor dos cinco primeiros livros da Bíblia, o Pentateuco.',
  published = true
where slug = 'moises';

update public.lexicon_entries set
  aliases = array['Naamã', 'Naama', 'Naaman'],
  title = 'Naamã, o general sírio curado da lepra',
  description = 'Comandante do exército do rei da Síria, homem valente e respeitado, por quem o Senhor dera livramento à Síria, mas que era leproso (2 Reis 5:1).

A notícia da cura chegou até ele pela boca de uma menina israelita levada cativa numa das incursões sírias, serva de sua mulher, que disse desejar que seu senhor estivesse diante do profeta que havia em Samaria. Naamã partiu com cartas do rei, dez talentos de prata, seis mil peças de ouro e dez mudas de roupa (2 Reis 5:2-6).

Chegando à casa de Eliseu com cavalos e carros, não foi recebido pessoalmente: o profeta mandou apenas um recado para que se lavasse sete vezes no Jordão. Naamã se indignou, dizendo que esperava um gesto solene e que os rios de Damasco eram melhores que todas as águas de Israel. Seus servos o convenceram com um argumento simples: se o profeta lhe tivesse mandado algo difícil, ele teria feito; quanto mais algo tão simples (2 Reis 5:9-13).

Mergulhou sete vezes e sua carne voltou a ser como a de um menino. Voltou a Eliseu declarando que não havia Deus em toda a terra senão em Israel, e o profeta recusou qualquer presente. Geazi, seu servo, correu atrás de Naamã e pediu em segredo prata e roupas, e por isso a lepra passou para ele (2 Reis 5:14-27). Jesus cita o episódio na sinagoga de Nazaré (Lucas 4:27).',
  published = true
where slug = 'naama';

update public.lexicon_entries set
  aliases = array['Nabucodonosor', 'Nebuchadnezzar', 'Nabucodonosor II'],
  title = 'Nabucodonosor, o rei da Babilônia que destruiu Jerusalém',
  description = 'Rei do império neobabilônico, um dos monarcas mais poderosos do mundo antigo. Conquistou Jerusalém em três etapas, levando cativos em 605, 597 e finalmente destruindo a cidade e o templo em 586 a.C., o marco do exílio babilônico (2 Reis 24-25).

No primeiro cativeiro, mandou selecionar jovens da nobreza judaica para servir em seu palácio, entre eles Daniel, Sadraque, Mesaque e Abede-Nego (Daniel 1).

Teve um sonho perturbador que exigiu que os sábios adivinhassem sem que ele o contasse, sob pena de morte. Daniel o revelou: uma estátua com cabeça de ouro, peito de prata, ventre de bronze, pernas de ferro e pés de barro, despedaçada por uma pedra cortada sem auxílio de mãos, figura dos impérios que se sucederiam (Daniel 2).

Mandou erguer uma estátua de ouro e lançou na fornalha os três jovens que se recusaram a adorá-la, reconhecendo o poder de Deus ao vê-los sair ilesos (Daniel 3). Depois de um segundo sonho, o da grande árvore cortada, foi advertido por Daniel a romper com os pecados, mas um ano depois, contemplando do terraço a "grande Babilônia que eu edifiquei", perdeu a razão e viveu entre os animais do campo por sete tempos, até que, erguendo os olhos ao céu, o entendimento lhe voltou e ele louvou o Altíssimo, cujo domínio é sempiterno (Daniel 4).',
  published = true
where slug = 'nabucodonosor';

update public.lexicon_entries set
  aliases = array['Natã', 'Nata', 'Nathan', 'Natan'],
  title = 'Natã, o profeta que confrontou Davi',
  description = 'Profeta na corte de Davi e um dos conselheiros mais próximos do rei. Quando Davi manifestou o desejo de construir uma casa para a arca, Natã primeiro aprovou, mas na mesma noite recebeu do Senhor uma palavra diferente: não seria Davi a construir o templo, e sim seu filho; em compensação, Deus faria de Davi uma casa, e seu trono seria estabelecido para sempre (2 Samuel 7:1-17). Essa promessa é uma das mais decisivas do Antigo Testamento.

Seu momento mais conhecido é o confronto após o caso com Bate-Seba e a morte de Urias. Natã contou ao rei a parábola do homem rico que, tendo muitos rebanhos, tomou a única cordeirinha do vizinho pobre para servir a um visitante. Davi se indignou e sentenciou a morte do culpado, ao que o profeta respondeu com quatro palavras: "tu és este homem" (2 Samuel 12:1-7). Davi reconheceu o pecado, e desse episódio nasceu o Salmo 51.

No fim da vida de Davi, foi Natã quem percebeu a manobra de Adonias para tomar o trono e articulou com Bate-Seba a intervenção junto ao rei, participando depois da unção de Salomão em Giom (1 Reis 1).

As Crônicas mencionam registros escritos por ele sobre os atos de Davi e de Salomão (1 Crônicas 29:29, 2 Crônicas 9:29).',
  published = true
where slug = 'nata';

update public.lexicon_entries set
  aliases = array['Natanael', 'Nathanael', 'Nataniel'],
  title = 'Natanael, o israelita em quem não havia dolo',
  description = 'Natural de Caná da Galileia, aparece apenas no evangelho de João. Foi levado a Jesus por Filipe, que lhe disse ter achado aquele de quem Moisés e os profetas escreveram, Jesus de Nazaré. Natanael respondeu com a objeção que ficou célebre: "pode vir alguma coisa boa de Nazaré?", e ouviu de Filipe o convite "vem e vê" (João 1:45-46).

Ao vê-lo se aproximar, Jesus disse: "eis um verdadeiro israelita, em quem não há dolo". Natanael perguntou de onde ele o conhecia, e a resposta foi que o vira debaixo da figueira antes de Filipe o chamar. Aquilo bastou: "Rabi, tu és o Filho de Deus, tu és o Rei de Israel". Jesus então lhe prometeu que veria coisas maiores, os céus abertos e os anjos de Deus subindo e descendo sobre o Filho do homem, alusão à escada de Jacó (João 1:47-51).

Reaparece no último capítulo do evangelho, entre os discípulos que estavam pescando no mar de Tiberíades quando Jesus ressuscitado apareceu na praia, e ali é identificado como "Natanael, de Caná da Galileia" (João 21:2).

Como seu nome não figura nas listas dos doze apóstolos nos evangelhos sinóticos, a tradição cristã costuma identificá-lo com Bartolomeu, que por sua vez não é mencionado em João.',
  published = true
where slug = 'natanael';

update public.lexicon_entries set
  aliases = array['Naum', 'Nahum'],
  title = 'Naum, o profeta da queda de Nínive',
  description = 'Chamado "o elcosita", dedicou todo o seu livro a um único tema: a destruição de Nínive, capital do império assírio. Profetizou em algum momento entre a queda da cidade egípcia de Nô-Amom, mencionada no livro, e a queda da própria Nínive em 612 a.C.

Seu livro é o contraponto de Jonas. Cerca de um século depois do arrependimento narrado ali, a cidade havia voltado à violência que a tornara temida em todo o mundo antigo, e Naum anuncia que dessa vez o julgamento viria sem adiamento.

Abre com um poema sobre o caráter de Deus que mantém as duas pontas juntas: "o Senhor é tardio em irar-se, mas grande em força, e ao culpado não tem por inocente", e logo adiante "o Senhor é bom, uma fortaleza no dia da angústia, e conhece os que confiam nele" (Naum 1:3,7).

A descrição da queda é uma das mais vívidas das Escrituras: o estalar dos açoites, o ruído das rodas, os cavalos que corcoveiam, os carros que saltam, a espada que devora, as portas dos rios que se abrem e o palácio que se dissolve (Naum 2-3). Nínive é comparada a uma cova de leões e a uma prostituta, e o livro termina com a pergunta: "sobre quem não passou continuamente a tua maldade?" (Naum 3:19). A cidade caiu diante de babilônios e medos e nunca mais foi reconstruída.',
  published = true
where slug = 'naum';

update public.lexicon_entries set
  aliases = array['Neemias', 'Nehemiah', 'Nehemias'],
  title = 'Neemias, o copeiro que reconstruiu os muros de Jerusalém',
  description = 'Judeu na corte persa, era copeiro do rei Artaxerxes em Susã. Ao receber de seu irmão Hanani a notícia de que os muros de Jerusalém continuavam derrubados e as portas queimadas, sentou-se, chorou, jejuou e orou por dias (Neemias 1).

O rei notou sua tristeza, coisa arriscada diante de um monarca, e Neemias aproveitou para pedir permissão de ir reconstruir a cidade, além de cartas para os governadores e madeira das florestas reais. Chegando a Jerusalém, inspecionou os muros de noite, sozinho, antes de revelar seu plano a quem quer que fosse (Neemias 2).

Organizou a obra dividindo o muro em trechos por famílias e corporações, de modo que cada grupo trabalhasse diante de sua própria casa (Neemias 3). Enfrentou a oposição de Sambalate, Tobias e Gesém, que zombaram, ameaçaram atacar e tentaram atraí-lo a uma armadilha. A resposta ficou célebre: metade dos homens trabalhava e metade ficava armada, e os construtores carregavam a espada à cintura enquanto edificavam (Neemias 4). A cada convite para negociar, respondia: "estou fazendo uma grande obra, de modo que não poderei descer" (Neemias 6:3).

O muro ficou pronto em cinquenta e dois dias. Neemias também enfrentou a usura praticada entre os próprios judeus, abriu mão dos direitos de governador, organizou a leitura pública da Lei com Esdras e conduziu reformas quanto ao sábado e aos casamentos mistos (Neemias 5, 8, 13).',
  published = true
where slug = 'neemias';

update public.lexicon_entries set
  aliases = array['Nicodemos', 'Nicodemus', 'Nicodemo'],
  title = 'Nicodemos, o fariseu que veio de noite',
  description = 'Fariseu e membro do Sinédrio, descrito por Jesus como "mestre de Israel". Aparece três vezes, sempre no evangelho de João.

Na primeira, procurou Jesus de noite e começou reconhecendo que ele era um mestre vindo da parte de Deus, pelos sinais que fazia. A resposta desviou completamente o rumo da conversa: "quem não nascer de novo não pode ver o reino de Deus". Nicodemos perguntou como um homem pode nascer sendo velho, se pode tornar a entrar no ventre da mãe, e o diálogo prossegue sobre o nascimento da água e do Espírito e sobre o vento que sopra onde quer. É nessa conversa que está o versículo mais citado da Bíblia, João 3:16 (João 3:1-21).

Na segunda, quando os guardas voltaram sem prender Jesus e os fariseus zombaram da multidão que não conhecia a lei, foi Nicodemos quem levantou uma objeção de procedimento: "porventura a nossa lei julga um homem sem primeiro o ouvir e saber o que faz?". A resposta foi um escárnio sobre sua origem galileia (João 7:50-52).

Na terceira, depois da crucificação, apareceu publicamente ao lado de José de Arimateia, trazendo cerca de trinta e três quilos de mirra e aloés para o sepultamento de Jesus, uma quantidade digna de funeral real (João 19:39-42).',
  published = true
where slug = 'nicodemos';

update public.lexicon_entries set
  aliases = array['Noé', 'Noe', 'Noah'],
  title = 'Noé, o homem que construiu a arca',
  description = 'Descendente de Sete, filho de Adão, viveu numa geração descrita como profundamente corrompida pela violência e pela maldade. Diante disso, Deus decidiu destruir a humanidade com um dilúvio, mas Noé encontrou graça diante dele por ser um homem justo e íntegro em meio ao seu tempo (Gênesis 6:8-9).

Deus instruiu Noé a construir uma arca de dimensões específicas e a reunir casais de cada espécie de animal, além de sete pares dos animais considerados puros, para preservar a vida quando as águas cobrissem a terra. Noé obedeceu, e ele, sua família e os animais entraram na arca pouco antes de o dilúvio começar (Gênesis 6:14-22, 7:1-16).

A chuva durou quarenta dias e quarenta noites, e as águas cobriram toda a terra por meses, até baixarem o suficiente para a arca repousar sobre os montes de Ararate. Noé soltou um corvo e depois uma pomba para verificar se havia terra seca, até finalmente poder deixar a arca com toda a sua família (Gênesis 7-8).

Ao sair, Noé construiu um altar e ofereceu sacrifícios a Deus, que fez então uma aliança com ele, prometendo nunca mais destruir a terra por um dilúvio, tendo o arco-íris como sinal dessa promessa (Gênesis 9:8-17). Seus três filhos, Sem, Cão e Jafé, tornaram-se os ancestrais a partir dos quais a terra foi repovoada.',
  published = true
where slug = 'noe';

update public.lexicon_entries set
  aliases = array['Noemi', 'Naomi', 'Mara'],
  title = 'Noemi, sogra de Rute',
  description = 'Mulher de Elimeleque, de Belém de Judá. Por causa da fome, a família migrou para os campos de Moabe, onde os dois filhos, Malom e Quiliom, se casaram com moabitas, Orfa e Rute. Em cerca de dez anos, Noemi perdeu o marido e os dois filhos, ficando sozinha em terra estrangeira (Rute 1:1-5).

Ouvindo que o Senhor havia visitado seu povo dando-lhe pão, decidiu voltar a Belém e insistiu para que as noras permanecessem em Moabe. Orfa voltou; Rute se recusou a deixá-la (Rute 1:6-18).

Ao chegar a Belém, as mulheres da cidade a reconheceram, e ela respondeu: "não me chameis Noemi", que significa agradável, "chamai-me Mara", amarga, "porque grande amargura me tem dado o Todo-Poderoso" (Rute 1:19-21).

Foi ela quem orientou Rute a respigar nos campos de Boaz e depois a se apresentar a ele na eira, reconhecendo nele um resgatador da família. Quando Obede nasceu, as vizinhas disseram que "nasceu um filho a Noemi", e ela o tomou ao colo como criador do menino que seria avô de Davi (Rute 4:14-17).',
  published = true
where slug = 'noemi';

update public.lexicon_entries set
  aliases = array['Obadias', 'Abdias', 'Obadiah'],
  title = 'Obadias, o profeta do livro mais curto do Antigo Testamento',
  description = 'Autor do menor livro do Antigo Testamento, com apenas vinte e um versículos num único capítulo. Nada se sabe com certeza sobre sua vida, e o nome significa "servo do Senhor".

Toda a profecia é dirigida contra Edom, a nação descendente de Esaú, estabelecida na região montanhosa a sudeste do mar Morto, com habitações escavadas na rocha. O oráculo começa denunciando a soberba de quem se julgava inalcançável: "a soberba do teu coração te enganou, tu que habitas nas fendas das rochas, e dizes no teu coração: quem me derribará em terra?" (Obadias 3).

A acusação central é o comportamento de Edom no dia da queda de Jerusalém. Em vez de socorrer os parentes, ficou de longe olhando, alegrou-se com a desgraça, entrou pelas portas da cidade no dia da calamidade, lançou mão dos bens e ainda deteve os fugitivos nas encruzilhadas para entregá-los (Obadias 11-14).

O livro anuncia que o dia do Senhor está perto sobre todas as nações e que a medida usada voltará sobre a própria cabeça de Edom: "como tu fizeste, assim se fará contigo" (Obadias 15). Termina com a restauração da casa de Jacó, que possuiria as suas heranças, e com a declaração final de que "o reino será do Senhor".

Há outros homens chamados Obadias nas Escrituras, entre eles o mordomo de Acabe que escondeu cem profetas em duas cavernas (1 Reis 18:3-4).',
  published = true
where slug = 'obadias';

update public.lexicon_entries set
  aliases = array['Onésimo', 'Onesimo', 'Onesimus'],
  title = 'Onésimo, o escravo fugitivo que voltou como irmão',
  description = 'Escravo de Filemom, cristão da cidade de Colossos. Fugiu da casa de seu senhor, aparentemente levando consigo algo que não lhe pertencia, e acabou em Roma, onde encontrou Paulo preso e se converteu pelo ministério dele (Filemom 10).

É o motivo da carta a Filemom, o escrito mais curto e mais pessoal de Paulo. Nela, o apóstolo o devolve ao senhor, mas pede que seja recebido "não já como servo, antes, mais do que servo, como irmão amado" (Filemom 16).

A carta é construída com delicadeza notável. Paulo diz que poderia ordenar, mas prefere rogar por amor; faz um trocadilho com o nome, que significa "útil", dizendo que Onésimo, antes inútil a Filemom, agora era útil aos dois; oferece-se a pagar pessoalmente qualquer prejuízo, escrevendo isso de próprio punho, e lembra discretamente que Filemom lhe devia a própria vida; e termina dizendo confiar que ele faria ainda mais do que o pedido (Filemom 8-21).

O texto nunca pede explicitamente a alforria, mas coloca a relação entre senhor e escravo num lugar de onde ela dificilmente sai intacta.

Onésimo é mencionado também na carta aos colossenses, enviada na mesma ocasião, como "o fiel e amado irmão, que é dos vossos", enviado com Tíquico para contar tudo o que se passava com Paulo (Colossenses 4:9).',
  published = true
where slug = 'onesimo';

update public.lexicon_entries set
  aliases = array['Oseias', 'Oséias', 'Hosea', 'Osé'],
  title = 'Oseias, o profeta que se casou com Gômer',
  description = 'Filho de Beeri, profetizou no reino do Norte nas décadas anteriores à queda de Samaria em 722 a.C., nos dias de Jeroboão II e dos reis que se sucederam rapidamente no trono de Israel.

Sua vida é o centro da sua mensagem. Deus lhe ordenou que tomasse por mulher Gômer, filha de Diblaim, e tivesse com ela filhos, cujos nomes anunciavam juízo: Jezreel, Lo-Ruama ("não amada") e Lo-Ami ("não meu povo"). O casamento infeliz se tornou figura da relação entre Deus e Israel, um povo que ia atrás de outros deuses (Oseias 1).

Mais tarde recebeu a ordem de amar de novo a mulher adúltera e resgatá-la por quinze peças de prata e uma carga e meia de cevada, gesto que dramatiza a fidelidade divina diante da infidelidade humana (Oseias 3).

O livro alterna acusações duras contra a idolatria, a corrupção dos sacerdotes e as alianças políticas com Assíria e Egito, e algumas das expressões mais ternas do Antigo Testamento: "quando Israel era menino, eu o amei", "eu os atraí com cordas humanas, com laços de amor", "misericórdia quero, e não sacrifício" (Oseias 11:1-4, 6:6), esta última citada duas vezes por Jesus nos evangelhos. Termina com a promessa de cura da infidelidade e amor gratuito (Oseias 14:4).',
  published = true
where slug = 'oseias';

update public.lexicon_entries set
  aliases = array['Saulo', 'Saulo de Tarso', 'Paulo de Tarso', 'Apóstolo Paulo'],
  title = 'Paulo, o apóstolo dos gentios',
  description = 'Judeu nascido em Tarso, na Cilícia, da tribo de Benjamim, fariseu formado aos pés de Gamaliel e cidadão romano de nascimento (At 22:3, 22:28). Trabalhava como fabricante de tendas (At 18:3). Usava dois nomes: Saulo, o hebraico, e Paulo, o romano (At 13:9). O nome não foi trocado na conversão, como muitos pensam.

Perseguidor zeloso da igreja, aprovou a morte de Estêvão (At 7:58; 8:1). A caminho de Damasco, teve um encontro com Jesus ressuscitado, ficou cego por três dias e foi recebido por Ananias (At 9). A partir daí tornou-se o grande missionário aos gentios.

Fez três viagens missionárias pela Ásia Menor, Macedônia e Grécia, ao lado de companheiros como Barnabé, Silas, Timóteo e Lucas, fundando igrejas em cidades como Filipos, Tessalônica, Corinto e Éfeso. Defendeu no Concílio de Jerusalém que os gentios não precisavam se submeter à Lei para serem salvos (At 15).

Preso em Jerusalém, apelou a César e foi levado a Roma, sobrevivendo a um naufrágio em Malta. Viveu dois anos em prisão domiciliar, pregando livremente (At 28). Segundo a tradição, foi martirizado em Roma sob Nero, entre 64 e 67 d.C.; a Bíblia não narra sua morte.

São atribuídas a ele 13 cartas do Novo Testamento, de Romanos a Filemom, centrais para a doutrina cristã da graça e da justificação pela fé.',
  published = true
where slug = 'paulo';

update public.lexicon_entries set
  aliases = array['Pedro', 'Simão Pedro', 'Simao Pedro', 'Cefas', 'Peter'],
  title = 'Pedro, o apóstolo que negou e foi restaurado',
  description = 'Pescador de Betsaida, filho de Jonas e irmão de André, que o levou a Jesus. Chamava-se Simão, e Jesus lhe deu o nome de Cefas, em aramaico, ou Pedro, em grego, que significa pedra (João 1:40-42).

É o mais citado dos discípulos e o primeiro em todas as listas dos doze. Andou sobre as águas até duvidar e começar a afundar (Mateus 14:28-31), confessou em Cesareia de Filipe "tu és o Cristo, o Filho do Deus vivo" e logo depois foi repreendido duramente por rejeitar o anúncio da cruz (Mateus 16:16-23). Esteve com Tiago e João na transfiguração e no Getsêmani.

Na última ceia, jurou que jamais o negaria, e na mesma noite, no pátio do sumo sacerdote, negou três vezes conhecê-lo, até o galo cantar. Saiu dali e chorou amargamente (Lucas 22:54-62). Depois da ressurreição, junto ao mar da Galileia, foi restaurado por três perguntas de Jesus sobre seu amor, e três vezes recebeu a ordem de apascentar as ovelhas (João 21:15-19).

No dia de Pentecostes pregou o sermão que levou cerca de três mil pessoas ao batismo (Atos 2). Curou o coxo à porta do templo, enfrentou o Sinédrio, foi libertado da prisão por um anjo, e teve a visão do lençol com animais que abriu a porta do evangelho aos gentios na casa de Cornélio (Atos 10). É autor das duas cartas que levam seu nome.',
  published = true
where slug = 'pedro';

update public.lexicon_entries set
  aliases = array['Pilatos', 'Pôncio Pilatos', 'Poncio Pilatos', 'Pilate'],
  title = 'Pilatos, o governador que entregou Jesus',
  description = 'Prefeito romano da Judeia entre cerca de 26 e 36 d.C., com residência oficial em Cesareia e presença em Jerusalém durante as grandes festas. Como governador, detinha o poder de aplicar a pena capital, que o Sinédrio não possuía.

Recebeu Jesus na manhã seguinte à prisão, acusado pelas autoridades judaicas. Interrogou-o em particular, ouviu a declaração de que seu reino não era deste mundo e fez a pergunta que ficou célebre: "que é a verdade?" (João 18:33-38). Declarou por três vezes não achar nele crime algum.

Tentou várias saídas: enviou-o a Herodes Antipas por ser galileu, ofereceu à multidão a escolha entre Jesus e Barrabás na soltura tradicional da Páscoa, e mandou açoitá-lo na esperança de que aquilo bastasse, apresentando-o com a coroa de espinhos e a frase "eis o homem" (João 19:1-5).

Sua mulher lhe mandou um recado durante o julgamento, pedindo que nada tivesse com aquele justo, por ter sofrido muito em sonho por causa dele (Mateus 27:19).

Diante da ameaça de que soltá-lo seria não ser amigo de César, cedeu. Lavou as mãos diante da multidão dizendo-se inocente do sangue daquele justo (Mateus 27:24) e o entregou para ser crucificado. Mandou escrever a inscrição "Jesus Nazareno, Rei dos Judeus" e, contestado, respondeu: "o que escrevi, escrevi" (João 19:19-22). Depois autorizou a José de Arimateia levar o corpo e mandou selar o sepulcro com guarda.',
  published = true
where slug = 'pilatos';

update public.lexicon_entries set
  aliases = array['Priscila', 'Prisca', 'Priscilla'],
  title = 'Priscila, mestra e cooperadora de Paulo',
  description = 'Esposa de Áquila, é sempre mencionada em par com ele, e chama a atenção que na maioria das vezes seu nome venha primeiro, o que era incomum e sugere posição de destaque na igreja.

O casal vivia em Roma e teve de deixar a cidade quando o imperador Cláudio expulsou os judeus. Estabeleceram-se em Corinto, onde conheceram Paulo, que era do mesmo ofício de fabricante de tendas, e passaram a trabalhar e conviver com ele (Atos 18:1-3).

Acompanharam Paulo até Éfeso e permaneceram ali. Foi nessa cidade que aconteceu o episódio mais lembrado sobre ela: ao ouvirem Apolo, pregador eloquente que conhecia apenas o batismo de João, Priscila e Áquila o levaram à parte e lhe expuseram "mais exatamente o caminho de Deus" (Atos 18:24-26).

Paulo os saúda em Romanos como seus cooperadores em Cristo Jesus, que arriscaram a própria vida por ele, e a quem não só ele mas todas as igrejas dos gentios eram gratas, mencionando a igreja que se reunia na casa deles (Romanos 16:3-5). A mesma referência a uma igreja doméstica aparece em 1 Coríntios 16:19, quando o casal estava em Éfeso.

A última menção a eles está em 2 Timóteo 4:19, já de volta à região de Éfeso.',
  published = true
where slug = 'priscila';

update public.lexicon_entries set
  aliases = array['Raabe', 'Raab', 'Rahab'],
  title = 'Raabe, a mulher de Jericó que escondeu os espias',
  description = 'Moradora de Jericó, prostituta cuja casa ficava sobre o muro da cidade. Quando Josué enviou dois homens para espiar a terra, ela os recebeu e os escondeu sob os talos de linho no terraço, despistando os enviados do rei que vieram procurá-los (Josué 2:1-7).

Disse aos espias que o povo da cidade estava aterrorizado desde que ouvira falar da travessia do Mar Vermelho e das vitórias de Israel, e fez a confissão que a distingue no relato: "o Senhor vosso Deus é Deus em cima nos céus e embaixo na terra". Pediu em troca que sua família fosse poupada (Josué 2:8-13).

Os espias desceram por uma corda pela janela e combinaram o sinal: um cordão de fio de escarlata amarrado à mesma janela. Quando os muros de Jericó caíram, Raabe e todos os seus parentes reunidos na casa foram poupados, e ela passou a habitar no meio de Israel (Josué 6:22-25).

O Novo Testamento a menciona três vezes: na genealogia de Jesus, como mãe de Boaz (Mateus 1:5), entre os heróis da fé (Hebreus 11:31) e como exemplo de fé demonstrada por obras (Tiago 2:25).',
  published = true
where slug = 'raabe';

update public.lexicon_entries set
  aliases = array['Raquel', 'Rachel', 'Rahel'],
  title = 'Raquel, a mulher amada de Jacó',
  description = 'Filha mais nova de Labão e irmã de Lia. Jacó a encontrou junto a um poço em Harã, quando ela chegava com o rebanho do pai, e se apaixonou imediatamente, concordando em trabalhar sete anos por ela, anos que "lhe pareceram poucos dias, pelo muito que a amava" (Gênesis 29:9-20).

Enganado por Labão, recebeu Lia primeiro e serviu outros sete anos por Raquel. Ela permaneceu estéril por muito tempo, e a rivalidade com a irmã marca boa parte do relato: entregou sua serva Bila a Jacó para ter filhos por meio dela e disputou com Lia até as mandrágoras colhidas no campo (Gênesis 30:1-16).

Deus enfim lhe deu um filho, e ela o chamou de José, pedindo mais um. Morreu no parto do segundo, a caminho de Efrata, e ao expirar o chamou de Benoni, "filho da minha dor", nome que Jacó trocou para Benjamim. Foi sepultada no caminho de Belém, e Jacó levantou ali uma coluna sobre sua sepultura (Gênesis 35:16-20).

Jeremias evoca sua figura chorando pelos filhos levados ao exílio, passagem que Mateus retoma ao narrar a matança dos meninos de Belém ordenada por Herodes (Jeremias 31:15, Mateus 2:18).',
  published = true
where slug = 'raquel';

update public.lexicon_entries set
  aliases = array['Rebeca', 'Rivka', 'Rebekah'],
  title = 'Rebeca, mulher de Isaque',
  description = 'Filha de Betuel e irmã de Labão, era da família de Naor, irmão de Abraão. Foi encontrada pelo servo que Abraão enviou a Harã para buscar uma esposa para Isaque: junto ao poço, ela deu água ao servo e se ofereceu para tirar água também para os camelos, exatamente o sinal que ele havia pedido a Deus. Consultada sobre partir, respondeu apenas "eu irei" (Gênesis 24).

Permaneceu estéril por vinte anos, até que Isaque orou por ela e concebeu gêmeos. Durante a gravidez difícil, recebeu de Deus a palavra de que duas nações estavam em seu ventre e que o mais velho serviria ao mais novo. Nasceram Esaú e Jacó (Gênesis 25:21-26).

Rebeca tinha predileção por Jacó, e foi ela quem planejou o engano que garantiu a ele a bênção de Isaque: cobriu seus braços com peles de cabrito e preparou a comida que o marido cego esperava receber de Esaú (Gênesis 27:1-29). Descoberto o ardil, mandou Jacó fugir para a casa de Labão, em Harã, para escapar da ira do irmão (Gênesis 27:41-46).

Foi sepultada na caverna de Macpela, em Hebrom, ao lado de Abraão, Sara e Isaque (Gênesis 49:31).',
  published = true
where slug = 'rebeca';

update public.lexicon_entries set
  aliases = array['Roboão', 'Roboao', 'Rehoboam'],
  title = 'Roboão, o rei em cujo reinado Israel se dividiu',
  description = 'Filho de Salomão e sucessor no trono. Foi a Siquém para ser proclamado rei por todo o Israel, e ali o povo, liderado por Jeroboão, apresentou um pedido: que aliviasse o jugo pesado de trabalhos forçados imposto por Salomão, e todos o serviriam (1 Reis 12:1-4).

Roboão pediu três dias e consultou dois grupos. Os anciãos que haviam servido a seu pai recomendaram ceder e falar boas palavras ao povo; os jovens que cresceram com ele aconselharam o contrário. Ele seguiu os jovens e respondeu com a frase que partiu o reino: "meu pai vos carregou de um jugo pesado, mas eu ainda aumentarei o vosso jugo; meu pai vos castigou com açoites, porém eu vos castigarei com escorpiões" (1 Reis 12:6-14).

Dez tribos se separaram e seguiram Jeroboão, formando o reino do Norte. Restaram a Roboão apenas Judá e Benjamim, o reino do Sul, com capital em Jerusalém. Ele reuniu um exército para reconquistar o Norte, mas foi impedido pela palavra do profeta Semaías (1 Reis 12:16-24).

Em seu quinto ano de reinado, Sisaque, rei do Egito, atacou Jerusalém e levou os tesouros do templo e do palácio, inclusive os escudos de ouro feitos por Salomão, que Roboão substituiu por escudos de bronze (1 Reis 14:25-28).',
  published = true
where slug = 'roboao';

update public.lexicon_entries set
  aliases = array['Rúben', 'Ruben', 'Rúbem', 'Reuben'],
  title = 'Rúben, o primogênito de Jacó',
  description = 'Filho mais velho de Jacó e Lia. Seu nome carrega o lamento da mãe preterida: "o Senhor viu a minha aflição" (Gênesis 29:32).

Perdeu a posição de primogênito por ter se deitado com Bila, concubina do pai, falta que Jacó não esqueceu e que reaparece na bênção final: "instável como a água, não serás o mais excelente" (Gênesis 35:22, 49:3-4). O direito de primogenitura passou aos filhos de José.

No episódio de José, foi Rúben quem impediu que os irmãos o matassem, sugerindo que o lançassem numa cisterna com a intenção secreta de resgatá-lo depois; ao voltar e encontrar o poço vazio, rasgou as vestes em desespero (Gênesis 37:21-30). Anos mais tarde, ofereceu a vida dos próprios filhos como garantia para que Jacó deixasse Benjamim ir ao Egito (Gênesis 42:37).

A tribo de Rúben se estabeleceu a leste do Jordão, em terra apropriada para o gado, junto com Gade e a meia tribo de Manassés (Números 32). O cântico de Débora mais tarde repreende os rubenitas por terem permanecido "entre os apriscos" em vez de se unirem à batalha (Juízes 5:15-16).',
  published = true
where slug = 'ruben';

update public.lexicon_entries set
  aliases = array['Rute', 'Ruth', 'Rutt'],
  title = 'Rute, a moabita bisavó de Davi',
  description = 'Mulher de Moabe, casou-se com um dos filhos de Noemi e Elimeleque, família de Belém que havia migrado para a terra moabita por causa da fome. Em dez anos morreram o sogro e os dois filhos, deixando três viúvas (Rute 1:1-5).

Quando Noemi decidiu voltar a Belém e insistiu para que as noras ficassem com suas famílias, Orfa se despediu, mas Rute se apegou a ela e respondeu com as palavras que tornaram o livro conhecido: "aonde quer que fores, irei eu; o teu povo é o meu povo, o teu Deus é o meu Deus" (Rute 1:16-17).

Em Belém, saiu a respigar nos campos para sustentar a sogra, e por acaso foi parar na propriedade de Boaz, parente de Elimeleque. Boaz a protegeu, mandou que deixassem cair feixes de propósito para ela, e elogiou sua lealdade a Noemi (Rute 2).

Orientada por Noemi, apresentou-se a Boaz na eira durante a noite da malhação da cevada e lhe pediu que exercesse o direito de resgatador. Boaz resolveu a questão diante dos anciãos à porta da cidade, casou-se com ela, e nasceu Obede, pai de Jessé e avô de Davi (Rute 3-4). Rute é uma das quatro mulheres citadas na genealogia de Jesus em Mateus 1:5.',
  published = true
where slug = 'rute';

update public.lexicon_entries set
  aliases = array['Sadraque', 'Shadrach', 'Ananias de Babilônia'],
  title = 'Sadraque, um dos três lançados na fornalha',
  description = 'Jovem israelita da nobreza de Judá, levado ao cativeiro na Babilônia junto com Daniel, Mesaque e Abede-Nego. Seu nome hebraico era Hananias, mudado para Sadraque pelo chefe dos eunucos de Nabucodonosor como parte da integração à corte (Daniel 1:6-7).

Com os companheiros, recusou-se a comer da porção de alimentos e do vinho do rei, propondo uma prova de dez dias apenas com legumes e água. Ao fim do período, os quatro estavam mais sadios que os demais, e Deus lhes deu entendimento em toda ciência e sabedoria (Daniel 1:8-20).

Quando Daniel interpretou o sonho da estátua e foi elevado, pediu ao rei que Sadraque, Mesaque e Abede-Nego fossem postos sobre os negócios da província da Babilônia (Daniel 2:49).

O episódio que os tornou conhecidos está em Daniel 3: diante da estátua de ouro que todos deviam adorar ao som da música, os três permaneceram de pé. Levados ao rei, responderam que o Deus a quem serviam podia livrá-los da fornalha, "e se não", ainda assim não adorariam a estátua. Lançados no fogo aquecido sete vezes mais, que matou os soldados que os levaram, foram vistos andando soltos no meio das chamas com uma quarta figura, e saíram sem que o cheiro de fogo tivesse passado às suas roupas.',
  published = true
where slug = 'sadraque';

update public.lexicon_entries set
  aliases = array['Safira', 'Sapphira', 'Safyra'],
  title = 'Safira, mulher de Ananias',
  description = 'Esposa de Ananias, integrava a comunidade cristã de Jerusalém nos primeiros dias da igreja, quando os crentes tinham tudo em comum e os que possuíam terras ou casas as vendiam e traziam o preço aos pés dos apóstolos para ser distribuído conforme a necessidade de cada um (Atos 4:32-37).

O casal vendeu uma propriedade e combinou reter parte do valor, entregando o restante como se fosse o total. O texto sublinha que não havia obrigação de vender nem de dar tudo: Pedro pergunta a Ananias por que Satanás lhe encheu o coração para mentir ao Espírito Santo, lembrando que, enquanto o campo era dele, era seu, e depois de vendido o dinheiro estava em seu poder. A falta não era o valor retido, mas a mentira (Atos 5:1-4).

Ananias caiu morto ao ouvir a repreensão, e os moços o levaram e sepultaram. Cerca de três horas depois, Safira entrou sem saber do que havia acontecido. Pedro lhe perguntou se haviam vendido o campo por aquele preço, dando-lhe a oportunidade de dizer a verdade, e ela confirmou a mentira. Ele então anunciou que os pés dos que acabavam de sepultar seu marido estavam à porta e a levariam também. Ela caiu e expirou (Atos 5:7-10).

O episódio encerra com a observação de que veio grande temor sobre toda a igreja e sobre todos os que ouviram essas coisas.',
  published = true
where slug = 'safira';

update public.lexicon_entries set
  aliases = array['Salomão', 'Salomao', 'Solomon'],
  title = 'Salomão, o rei da sabedoria',
  description = 'Filho de Davi e Bate-Seba, tornou-se o terceiro rei de Israel, sucedendo o pai ainda jovem. Logo no início do reinado, quando Deus lhe ofereceu qualquer coisa que pedisse, Salomão escolheu sabedoria para governar o povo em vez de riqueza ou longa vida, e Deus lhe concedeu não só a sabedoria pedida, mas também riqueza e honra (1 Reis 3:5-14). Sua fama de sábio se espalhou, ilustrada pelo célebre julgamento em que descobriu a verdadeira mãe de um bebê disputado por duas mulheres (1 Reis 3:16-28).

Seu reinado é marcado pela construção do templo de Jerusalém, um projeto grandioso que levou sete anos e consolidou a cidade como centro religioso de Israel (1 Reis 6-8). O período também foi de grande prosperidade econômica e prestígio internacional, simbolizado pela visita da Rainha de Sabá, impressionada com sua sabedoria e riqueza (1 Reis 10:1-13).

Tradicionalmente é apontado como autor de Provérbios, Eclesiastes e Cântico dos Cânticos. Apesar de toda a sabedoria, Salomão teve centenas de esposas e concubinas, muitas estrangeiras, que em sua velhice o desviaram para o culto de outros deuses (1 Reis 11:1-8). Os excessos e a pesada carga de impostos de seu governo geraram tensões que, após sua morte, levaram à divisão do reino entre seu filho Roboão e Jeroboão (1 Reis 12).',
  published = true
where slug = 'salomao';

update public.lexicon_entries set
  aliases = array['Samuel', 'Shemuel'],
  title = 'Samuel, o profeta que ungiu os primeiros reis',
  description = 'Filho de Elcana e Ana, que o dedicou ao Senhor ainda antes de nascer, em resposta a uma oração feita no santuário de Siló. Cresceu servindo sob os cuidados do sacerdote Eli naquele mesmo santuário, e foi ainda menino que ouviu pela primeira vez a voz de Deus o chamando durante a noite (1 Samuel 1-3).

Samuel se tornou o último dos juízes de Israel e o primeiro grande profeta depois de Moisés, exercendo liderança espiritual e civil sobre o povo numa época de instabilidade. Quando os israelitas pediram um rei para serem como as demais nações, foi Samuel quem, sob orientação de Deus, ungiu Saul como o primeiro rei de Israel (1 Samuel 8-10).

Mais tarde, diante da desobediência de Saul, especialmente por poupar o rei amalequita Agague e os despojos da guerra contra Amaleque, Samuel anunciou a rejeição de Saul como rei e foi enviado a Belém para ungir em seu lugar o jovem Davi, filho de Jessé (1 Samuel 15-16). Samuel é também autor tradicionalmente associado aos livros que levam seu nome, embora sua morte seja narrada ainda em 1 Samuel 25:1.',
  published = true
where slug = 'samuel';

update public.lexicon_entries set
  aliases = array['Sansão', 'Sansao', 'Samson', 'Shimshon'],
  title = 'Sansão, o juiz de força descomunal',
  description = 'Filho de Manoá, da tribo de Dã, teve o nascimento anunciado por um anjo à mãe estéril, com a instrução de que o menino seria nazireu desde o ventre: não beberia vinho nem cortaria o cabelo (Juízes 13).

Sua força é o traço que o define. Despedaçou um leão com as mãos, matou trinta homens em Asquelom, derrubou mil filisteus com uma queixada de jumento e arrancou as portas da cidade de Gaza, carregando-as até o alto de um monte (Juízes 14-16). Entre esses feitos estão também o enigma da festa de casamento, as trezentas raposas com tochas atadas às caudas soltas nas searas filisteias, e uma série de vinganças pessoais que acabaram servindo ao propósito de livrar Israel.

Sua ruína veio por Dalila, subornada pelos príncipes dos filisteus para descobrir a origem de sua força. Depois de três respostas falsas, Sansão lhe revelou o segredo do cabelo. Dormindo, foi rapado, capturado, teve os olhos vazados e passou a moer no cárcere de Gaza (Juízes 16:4-21).

No templo de Dagom, exibido diante de uma multidão, pediu forças a Deus uma última vez, apoiou-se nas duas colunas centrais e derrubou o edifício, matando mais no fim de sua vida do que em toda ela (Juízes 16:23-30). Julgou Israel por vinte anos e é citado entre os heróis da fé (Hebreus 11:32).',
  published = true
where slug = 'sansao';

update public.lexicon_entries set
  aliases = array['Sara', 'Sarai', 'Sarah'],
  title = 'Sara, a mulher de Abraão',
  description = 'Esposa e meia-irmã de Abraão, saiu com ele de Ur dos caldeus rumo a Canaã. Seu nome original era Sarai, mudado por Deus para Sara, "princesa", quando o pacto foi confirmado e ela foi declarada mãe de nações (Gênesis 17:15-16).

Estéril durante quase toda a vida, entregou sua serva Hagar a Abraão para que a descendência viesse por meio dela, decisão que gerou conflito dentro da casa (Gênesis 16). Por duas vezes, Abraão a apresentou como irmã por medo dos reis das terras por onde passavam, primeiro no Egito e depois em Gerar, e nas duas ocasiões Deus interveio para protegê-la (Gênesis 12:10-20, 20).

Quando três visitantes anunciaram a Abraão que ela teria um filho no ano seguinte, Sara riu por trás da entrada da tenda, já com idade avançada. O Senhor perguntou: "Existe alguma coisa impossível para o Senhor?". Isaque, cujo nome significa "ele ri", nasceu quando Sara tinha noventa anos (Gênesis 18:9-15, 21:1-7).

Morreu aos cento e vinte e sete anos em Quiriate-Arba, a atual Hebrom, e foi sepultada na caverna de Macpela, que Abraão comprou para esse fim (Gênesis 23). O Novo Testamento a apresenta como exemplo de fé (Hebreus 11:11) e de mulher que confiou em Deus (1 Pedro 3:6).',
  published = true
where slug = 'sara';

update public.lexicon_entries set
  aliases = array['Saul', 'Sha''ul'],
  title = 'Saul, o primeiro rei de Israel',
  description = 'Filho de Quis, da tribo de Benjamim, foi escolhido e ungido por Samuel como o primeiro rei de Israel, atendendo ao pedido do povo por um rei como as demais nações. Descrito como um homem de estatura impressionante, começou seu reinado com humildade e obteve vitórias militares importantes, como a libertação da cidade de Jabes-Gileade (1 Samuel 9-11).

Sua queda começou com atos de desobediência: ofereceu pessoalmente um sacrifício sem esperar a chegada de Samuel, contrariando a instrução recebida, e mais tarde poupou o rei amalequita Agague e o melhor dos despojos de guerra, indo contra a ordem explícita de destruir tudo (1 Samuel 13, 15). Por causa disso, Samuel anunciou que Deus o havia rejeitado como rei.

A partir daí, Saul foi tomado por um espírito de angústia, e o jovem Davi passou a servi-lo tocando harpa para acalmá-lo. Mas o sucesso e a popularidade crescente de Davi despertaram ciúme e ódio em Saul, que passou boa parte do restante do reinado perseguindo Davi para matá-lo (1 Samuel 16-26).

Antes da batalha final contra os filisteus, já sem a orientação de Samuel, que havia morrido, Saul recorreu secretamente a uma médium em Endor para consultar o espírito de Samuel, que lhe confirmou a derrota iminente (1 Samuel 28). Ferido em batalha no Monte Gilboa e prestes a ser capturado, Saul se matou com a própria espada, encerrando seu reinado e abrindo caminho para a ascensão de Davi ao trono (1 Samuel 31).',
  published = true
where slug = 'saul';

update public.lexicon_entries set
  aliases = array['Silas', 'Silvano', 'Silvanus'],
  title = 'Silas, companheiro de viagem de Paulo',
  description = 'Líder respeitado na igreja de Jerusalém, chamado também Silvano nas cartas. Foi escolhido com Judas Barsabás para acompanhar Paulo e Barnabé a Antioquia levando a carta do concílio que dispensava os gentios da circuncisão, e ambos são descritos como profetas que exortaram e confirmaram os irmãos com muitas palavras (Atos 15:22-32).

Quando Paulo e Barnabé se separaram por causa de João Marcos, Paulo escolheu Silas como companheiro para a segunda viagem missionária, atravessando a Síria e a Cilícia (Atos 15:40-41).

Em Filipos, depois de Paulo expulsar o espírito de adivinhação de uma jovem escrava, os dois foram arrastados à praça, açoitados com varas e lançados no cárcere interior com os pés no tronco. À meia-noite, oravam e cantavam louvores a Deus, e os outros presos os escutavam, quando um terremoto abriu as portas e soltou as cadeias. O carcereiro, prestes a se matar, foi impedido por Paulo e acabou batizado com toda a sua casa naquela mesma noite (Atos 16:19-34).

Esteve com Paulo em Tessalônica, Bereia e Corinto (Atos 17-18). Aparece como remetente, junto com Paulo e Timóteo, das duas cartas aos tessalonicenses, é citado por Paulo em 2 Coríntios 1:19, e Pedro o menciona no fim de sua primeira carta como o irmão fiel por meio de quem escreveu (1 Pedro 5:12).',
  published = true
where slug = 'silas';

update public.lexicon_entries set
  aliases = array['Simeão', 'Simeao', 'Shimon', 'Simeon'],
  title = 'Simeão',
  description = 'Há dois Simeões de destaque nas Escrituras.

O primeiro é Simeão, segundo filho de Jacó e Lia. Junto com o irmão Levi, atacou a cidade de Siquém para vingar a irmã Diná, matando seus homens enquanto se recuperavam da circuncisão, episódio que Jacó repreendeu duramente e que marcou a bênção final dada aos dois (Gênesis 34, 49:5-7). No Egito, foi Simeão quem José reteve como refém enquanto os irmãos voltavam a Canaã para buscar Benjamim (Gênesis 42:24). A tribo de Simeão recebeu um território dentro dos limites de Judá, no sul, e com o tempo foi absorvida por ela (Josué 19:1-9).

O segundo é Simeão, o ancião do templo, no Novo Testamento. Homem justo e piedoso de Jerusalém, havia recebido do Espírito Santo a revelação de que não morreria antes de ver o Messias. Quando Maria e José levaram o menino Jesus ao templo para a apresentação, ele o tomou nos braços e entoou o cântico conhecido como Nunc Dimittis: "agora, Senhor, podes despedir em paz o teu servo, porque os meus olhos já viram a tua salvação". A seguir, advertiu Maria de que uma espada traspassaria a sua própria alma (Lucas 2:25-35).',
  published = true
where slug = 'simeao';

update public.lexicon_entries set
  aliases = array['Sofonias', 'Zephaniah', 'Zefanias'],
  title = 'Sofonias, o profeta do dia do Senhor',
  description = 'Filho de Cuxi e descendente de Ezequias, profetizou em Judá nos dias do rei Josias, provavelmente antes da grande reforma religiosa promovida por ele, o que explica as denúncias contra o culto a Baal e aos astros que o livro registra.

Seu tema central é o dia do Senhor, descrito em termos que se tornaram clássicos na literatura ocidental: "dia de indignação aquele dia, dia de angústia e de ânsia, dia de alvoroço e de assolação, dia de trevas e de escuridão, dia de nuvens e de densas trevas" (Sofonias 1:15). O texto latino dessas palavras deu origem ao hino Dies Irae.

Denuncia os que se acomodaram "sobre as suas fezes", dizendo no coração que o Senhor não faz bem nem mal, e adverte que nem a prata nem o ouro poderão livrá-los naquele dia (Sofonias 1:12-18). Os oráculos se estendem depois às nações vizinhas, de Filístia a Moabe, Etiópia e Assíria, e voltam a Jerusalém, cujos príncipes são leões e cujos profetas são levianos.

O fim do livro muda completamente de tom. Anuncia a purificação dos lábios dos povos, a preservação de um povo humilde e pobre que confia no nome do Senhor, e termina com uma das imagens mais surpreendentes do Antigo Testamento: Deus no meio do seu povo, que "se regozijará sobre ti com alegria; calar-se-á por seu amor, exultará sobre ti com júbilo" (Sofonias 3:17).',
  published = true
where slug = 'sofonias';

update public.lexicon_entries set
  aliases = array['Tiago', 'James', 'Jacó apóstolo', 'Santiago'],
  title = 'Tiago',
  description = 'Há três homens chamados Tiago com destaque no Novo Testamento.

Tiago, filho de Zebedeu, irmão do apóstolo João, pescador chamado por Jesus junto com o irmão enquanto consertavam as redes. Os dois receberam o apelido de Boanerges, "filhos do trovão" (Marcos 3:17). Pertencia, com Pedro e João, ao círculo mais próximo, presente na transfiguração, na ressurreição da filha de Jairo e no Getsêmani. Com o irmão, pediu a Jesus os lugares à direita e à esquerda no reino, e ouviu a pergunta sobre o cálice (Marcos 10:35-40). Foi o primeiro dos doze a ser martirizado, morto à espada por Herodes Agripa (Atos 12:2).

Tiago, filho de Alfeu, também um dos doze, às vezes chamado "o menor", sobre quem os evangelhos nada mais registram (Marcos 15:40).

Tiago, irmão do Senhor, que não cria nele durante seu ministério (João 7:5), mas o viu ressuscitado (1 Coríntios 15:7) e se tornou líder da igreja de Jerusalém. Foi ele quem pronunciou a decisão final no concílio que dispensou os gentios convertidos da circuncisão (Atos 15:13-21), e Paulo o chama de uma das colunas da igreja (Gálatas 2:9). É tradicionalmente identificado como autor da carta de Tiago, conhecida pela afirmação de que a fé sem obras é morta.',
  published = true
where slug = 'tiago';

update public.lexicon_entries set
  aliases = array['Timoteo', 'Timóteo'],
  title = 'Timóteo, o filho na fé de Paulo',
  description = 'Discípulo natural de Listra, na Licaônia, filho de mãe judia crente e pai grego (At 16:1). Aprendeu as Escrituras desde a infância com a mãe, Eunice, e a avó, Loide, cuja fé sincera Paulo elogia (2Tm 1:5; 3:15). Seu nome, de origem grega, significa "aquele que honra a Deus".

Bem recomendado pelos irmãos de Listra e Icônio, foi escolhido por Paulo para acompanhá-lo na segunda viagem missionária. Por ser filho de judia, Paulo o circuncidou para não criar obstáculos entre os judeus da região (At 16:2-3).

Tornou-se o colaborador mais próximo do apóstolo, que o chamava de "filho amado" (2Tm 1:2). Foi enviado em missões delicadas a Tessalônica, Corinto e Filipos (1Ts 3:2; 1Co 4:17; Fp 2:19-22) e aparece como coautor de seis cartas paulinas: 2 Coríntios, Filipenses, Colossenses, 1 e 2 Tessalonicenses e Filemom.

Paulo o deixou em Éfeso para cuidar da igreja e combater falsos ensinos (1Tm 1:3). As duas cartas que levam seu nome, dirigidas a ele, orientam sobre liderança, doutrina e perseverança. Nelas Paulo o encoraja a não deixar que ninguém despreze sua juventude (1Tm 4:12) e recomenda um pouco de vinho por causa de problemas no estômago (1Tm 5:23). A segunda carta, escrita pouco antes da morte do apóstolo, pede que Timóteo venha logo encontrá-lo (2Tm 4:9).

Hebreus 13:23 menciona que ele foi preso e depois libertado. Segundo a tradição, foi o primeiro bispo de Éfeso e morreu mártir no fim do século I.',
  published = true
where slug = 'timoteo';

update public.lexicon_entries set
  aliases = array['Tito', 'Titus'],
  title = 'Tito, o grego enviado a Creta',
  description = 'Cristão de origem grega, convertido pelo ministério de Paulo, que o chama de "meu verdadeiro filho, segundo a fé comum" (Tito 1:4). Curiosamente, seu nome não aparece no livro de Atos, apenas nas cartas.

Foi levado por Paulo a Jerusalém junto com Barnabé, e ali se tornou um caso de princípio: sendo grego, não foi obrigado a se circuncidar, e Paulo usa esse fato como argumento de que o evangelho não impõe a lei aos gentios (Gálatas 2:1-5).

Teve papel importante na relação tensa entre Paulo e a igreja de Corinto. Foi enviado com uma carta severa e voltou com boas notícias, o que trouxe grande alívio ao apóstolo, que estava sem descanso na Macedônia esperando por ele: "Deus, que consola os abatidos, nos consolou com a vinda de Tito" (2 Coríntios 7:5-7). Depois voltou a Corinto para organizar a coleta em favor dos santos de Jerusalém (2 Coríntios 8:6,16-24).

A carta que leva seu nome o encontra em Creta, onde Paulo o deixou para "pôr em boa ordem as coisas que ainda restam" e constituir presbíteros em cada cidade (Tito 1:5). O escrito trata de qualificações de líderes, do comportamento dos diversos grupos na igreja e da graça de Deus que ensina a viver de modo sóbrio, justo e piedoso.

A última menção o coloca na Dalmácia (2 Timóteo 4:10).',
  published = true
where slug = 'tito';

update public.lexicon_entries set
  aliases = array['Tomé', 'Tome', 'Thomas', 'Dídimo', 'Tomás'],
  title = 'Tomé, o que duvidou',
  description = 'Um dos doze apóstolos, chamado Dídimo, que significa gêmeo. Aparece nas listas dos evangelhos sinóticos, mas é em João que ganha personalidade própria, em três cenas.

Quando Jesus decidiu voltar à Judeia, onde pouco antes tinham tentado apedrejá-lo, para ir ver Lázaro, foi Tomé quem disse aos outros discípulos: "vamos nós também, para morrermos com ele" (João 11:16).

No discurso da última ceia, quando Jesus disse que ia preparar lugar e que eles sabiam o caminho, Tomé objetou: "Senhor, não sabemos para onde vais, e como podemos saber o caminho?". A resposta foi uma das frases mais conhecidas dos evangelhos: "eu sou o caminho, e a verdade, e a vida" (João 14:5-6).

Sua cena mais lembrada vem depois da ressurreição. Ausente quando Jesus apareceu aos discípulos, recusou-se a aceitar o testemunho deles: só creria se visse o sinal dos cravos e pusesse a mão no lado dele. Oito dias depois, Jesus voltou com as portas fechadas, chamou-o e ofereceu exatamente o que ele havia pedido. Tomé respondeu com a confissão mais direta do evangelho: "Senhor meu, e Deus meu". Jesus então disse: "bem-aventurados os que não viram e creram" (João 20:24-29).

A expressão "Tomé, o incrédulo" nasceu dessa passagem, embora o texto não registre que ele chegou a tocar as feridas.',
  published = true
where slug = 'tome';

update public.lexicon_entries set
  aliases = array['Zacarias', 'Zechariah', 'Zacharias'],
  title = 'Zacarias',
  description = 'Há dois Zacarias de grande destaque nas Escrituras.

O primeiro é Zacarias, o profeta, filho de Baraquias, que junto com Ageu despertou o povo a retomar a reconstrução do templo depois do exílio, por volta de 520 a.C. Seu livro é feito de oito visões noturnas, entre elas os cavalos entre as murtas, o candeeiro de ouro com as duas oliveiras, o rolo voante e as quatro carruagens, seguidas de oráculos sobre o futuro de Jerusalém. É dele a palavra "não por força nem por poder, mas pelo meu Espírito" (Zacarias 4:6). O livro é um dos mais citados pelos evangelhos na narrativa da paixão: o rei que entra em Jerusalém humilde, montado num jumentinho (9:9), as trinta moedas de prata lançadas na casa do Senhor (11:12-13), o pastor ferido e as ovelhas dispersas (13:7), e aquele a quem traspassaram (12:10).

O segundo é Zacarias, o sacerdote, pai de João Batista, no Novo Testamento. Casado com Isabel, ambos já idosos e sem filhos, servia no templo quando lhe coube queimar o incenso. O anjo Gabriel lhe apareceu anunciando o nascimento de um filho, e por duvidar ficou mudo até o dia em que escreveu numa tabuinha que o menino se chamaria João. Recuperada a fala, pronunciou o cântico conhecido como Benedictus (Lucas 1:5-25, 57-79).

Jesus menciona ainda um Zacarias morto entre o templo e o altar (Mateus 23:35).',
  published = true
where slug = 'zacarias';

update public.lexicon_entries set
  aliases = array['Zaqueu', 'Zacchaeus', 'Zaqueo'],
  title = 'Zaqueu, o publicano que subiu na árvore',
  description = 'Chefe dos publicanos em Jericó e homem rico, o que significa que administrava a cobrança de impostos para Roma numa cidade de passagem importante, função que o tornava desprezado entre os judeus.

Quando Jesus atravessava a cidade, Zaqueu procurava vê-lo, mas não conseguia por causa da multidão, porque era de pequena estatura. Correu adiante e subiu numa figueira brava para conseguir olhá-lo quando passasse (Lucas 19:1-4).

Ao chegar àquele lugar, Jesus olhou para cima, chamou-o pelo nome e disse: "Zaqueu, desce depressa, porque hoje me convém pousar em tua casa". Ele desceu a toda pressa e o recebeu com alegria, enquanto todos murmuravam por ele ter entrado na casa de um pecador (Lucas 19:5-7).

A resposta de Zaqueu veio de pé, diante de todos: daria metade de seus bens aos pobres e restituiria quatro vezes mais a quem tivesse defraudado em alguma coisa. A restituição em quádruplo era a pena prevista na lei para o roubo de ovelha, e ele a aplicou voluntariamente a si mesmo (Lucas 19:8, Êxodo 22:1).

Jesus então declarou: "hoje veio a salvação a esta casa, pois também este é filho de Abraão", e encerrou com a frase que resume o episódio e boa parte do evangelho de Lucas: "porque o Filho do homem veio buscar e salvar o que se havia perdido" (Lucas 19:9-10).',
  published = true
where slug = 'zaqueu';

update public.lexicon_entries set
  aliases = array['Zípora', 'Zipora', 'Séfora', 'Zipporah'],
  title = 'Zípora, mulher de Moisés',
  description = 'Filha de Jetro, sacerdote de Midiã, e esposa de Moisés. Conheceu-o quando ele, fugido do Egito, defendeu ela e as irmãs dos pastores que as impediam de dar água ao rebanho junto ao poço. Jetro o acolheu e lhe deu Zípora em casamento (Êxodo 2:16-21).

Teve com Moisés dois filhos, Gérson e Eliézer. Gérson, cujo nome evoca a condição de estrangeiro, nasceu enquanto Moisés ainda vivia em Midiã (Êxodo 2:22, 18:3-4).

Protagoniza um dos episódios mais enigmáticos do Pentateuco: na estalagem, a caminho do Egito, quando a vida de Moisés foi ameaçada, Zípora tomou uma pedra afiada, circuncidou o filho e tocou com ela os pés do marido, dizendo "esposo de sangue és tu para mim", e o perigo passou (Êxodo 4:24-26).

Moisés a enviou de volta à casa do pai em algum momento da jornada, e Jetro a trouxe de novo, com os dois filhos, ao encontro dele no deserto perto do monte de Deus (Êxodo 18:2-6).',
  published = true
where slug = 'zipora';

update public.lexicon_entries set
  aliases = array['Zorobabel', 'Zerubabel', 'Zerubbabel'],
  title = 'Zorobabel, o governador que reconstruiu o templo',
  description = 'Descendente da casa real de Davi, neto do rei Joaquim, liderou o primeiro grupo de judeus que voltou do exílio na Babilônia após o decreto de Ciro, rei da Pérsia, por volta de 538 a.C., acompanhado do sumo sacerdote Josué (Esdras 2:1-2).

Sua primeira ação foi reerguer o altar e restabelecer os sacrifícios, mesmo antes de lançar os alicerces do templo. Quando os fundamentos foram postos, o povo prorrompeu em gritos de alegria, enquanto os anciãos que haviam visto o primeiro templo choravam alto, e não se distinguia um som do outro (Esdras 3).

A obra foi embargada pela oposição dos povos vizinhos e ficou parada por anos, até que os profetas Ageu e Zacarias despertaram Zorobabel e Josué a retomá-la (Esdras 5:1-2). O templo foi concluído no sexto ano de Dario.

Ageu lhe dirige a promessa de que Deus o tomaria como "selo", por tê-lo escolhido (Ageu 2:23), e Zacarias registra a palavra que se tornou uma das mais citadas do Antigo Testamento: "não por força nem por poder, mas pelo meu Espírito, diz o Senhor dos Exércitos", junto à promessa de que as mãos de Zorobabel, que lançaram os fundamentos, também acabariam a casa (Zacarias 4:6-9). Seu nome aparece nas genealogias de Jesus em Mateus e em Lucas.',
  published = true
where slug = 'zorobabel';


-- LUGARES BÍBLICOS (66) -------------------------------------------------------

update public.lexicon_entries set
  aliases = array['Acaia', 'Achaia'],
  title = 'Acaia, província romana no sul da Grécia',
  description = 'Província romana que ocupava a região sul da Grécia, incluindo o Peloponeso, com Corinto como sua capital e sede do governo proconsular. No Novo Testamento, aparece com frequência nas viagens missionárias de Paulo e na correspondência às igrejas gregas.

Durante sua segunda viagem missionária, Paulo passou um longo período em Corinto, capital da Acaia, onde foi levado ao tribunal do procônsul Gálio por acusação dos judeus locais, mas teve o caso rejeitado (Atos 18:12-17).

A região é mencionada em várias cartas paulinas, como quando Paulo se refere à igreja de Corinto "com todos os santos que estão em toda a Acaia" (2 Coríntios 1:1), ou ao elogiar a generosidade dos cristãos da Macedônia e da Acaia na oferta para os santos de Jerusalém (Romanos 15:26, 1 Coríntios 16:15).',
  published = true
where slug = 'acaia';

update public.lexicon_entries set
  aliases = array['Antioquia', 'Antioch', 'Antiochia', 'Antioquia da Síria', 'Antioquia da Pisídia'],
  title = 'Antioquia',
  description = 'Há duas cidades chamadas Antioquia no Novo Testamento. A mais importante é Antioquia da Síria, uma das maiores cidades do mundo antigo, situada às margens do rio Orontes e capital da província romana da Síria. Depois da perseguição que espalhou os cristãos de Jerusalém, alguns deles começaram a pregar também a gentios em Antioquia, e uma igreja floresceu ali. Foi nessa cidade que os discípulos de Jesus foram chamados de "cristãos" pela primeira vez (Atos 11:19-26). Antioquia da Síria se tornou a base a partir da qual Barnabé e Paulo foram enviados em suas viagens missionárias (Atos 13:1-3).

A outra é Antioquia da Pisídia, cidade no interior da Ásia Menor (atual Turquia), na região da Galácia. Paulo e Barnabé pregaram ali durante a primeira viagem missionária, e o discurso de Paulo na sinagoga local é um dos sermões mais longos registrados em Atos (Atos 13:14-41). Muitos gentios creram, mas a oposição de líderes judeus levou à expulsão dos dois missionários da região (Atos 13:50-51).',
  published = true
where slug = 'antioquia';

update public.lexicon_entries set
  aliases = array['Assíria', 'Assiria', 'Assyria'],
  title = 'Assíria, império que destruiu o reino do Norte',
  description = 'Antigo império situado no norte da Mesopotâmia, com cidades importantes como Assur e, mais tarde, Nínive como capital. Foi uma das potências mais poderosas e temidas do mundo antigo, conhecida pela força militar e pela crueldade com os povos conquistados.

Em 722 a.C., a Assíria conquistou Samaria, capital do reino do Norte de Israel, e deportou boa parte da população para outras regiões do império, um episódio que levou ao desaparecimento das dez tribos do Norte como entidade nacional (2 Reis 17:5-6).

Mais tarde, o rei assírio Senaqueribe cercou Jerusalém durante o reinado de Ezequias, em Judá, mas a cidade foi poupada de forma que a Bíblia descreve como intervenção divina (2 Reis 18-19, Isaías 36-37).

Nínive, a capital assíria, também é o cenário do livro de Jonas, enviado por Deus para pregar arrependimento à cidade, que se converteu e evitou o julgamento imediato. Décadas depois, porém, o profeta Naum anunciou a destruição definitiva de Nínive, cumprida em 612 a.C., quando babilônios e medos derrubaram o império assírio.',
  published = true
where slug = 'assiria';

update public.lexicon_entries set
  aliases = array['Atenas', 'Athens', 'Atena'],
  title = 'Atenas, onde Paulo pregou no Areópago',
  description = 'Centro cultural e filosófico do mundo antigo, já em declínio político no primeiro século mas ainda referência em pensamento, com as escolas epicureia e estoica em atividade.

Paulo chegou ali sozinho, enviado de Bereia, esperando Silas e Timóteo. O texto registra o que o afetou: "o seu espírito se comovia em si mesmo, vendo a cidade tão entregue à idolatria" (Atos 17:16).

Discutia na sinagoga com os judeus e diariamente na praça com quem encontrasse. Filósofos epicureus e estoicos travaram contato com ele, e alguns o chamaram de "palrador", enquanto outros supunham que anunciava deuses estranhos, por pregar Jesus e a ressurreição. Levaram-no ao Areópago, e Lucas acrescenta a observação de que os atenienses e os estrangeiros que ali moravam não se ocupavam de outra coisa senão de dizer e ouvir alguma novidade (Atos 17:17-21).

O discurso no Areópago é um caso à parte no livro. Em vez de partir das Escrituras, Paulo começa por um altar que vira na cidade com a inscrição "ao Deus desconhecido", cita poetas gregos ao dizer "nele vivemos, e nos movemos, e existimos" e "somos também sua geração", e só então chega ao arrependimento, ao juízo e à ressurreição (Atos 17:22-31).

A reação foi mista: uns zombaram ao ouvir falar em ressurreição dos mortos, outros quiseram ouvi-lo de novo, e alguns creram, entre eles Dionísio, o areopagita, e uma mulher chamada Dâmaris (Atos 17:32-34).',
  published = true
where slug = 'atenas';

update public.lexicon_entries set
  aliases = array['Babilônia', 'Babilonia', 'Babylon', 'Babel'],
  title = 'Babilônia, o império do exílio',
  description = 'Antiga cidade da Mesopotâmia, às margens do Eufrates, capital do império neobabilônico sob Nabucodonosor. Nas Escrituras, é ao mesmo tempo um lugar real e o símbolo maior do poder humano que se levanta contra Deus.

Sua primeira aparição é como Babel, onde os homens quiseram construir uma torre cujo cume chegasse aos céus para fazerem um nome, e tiveram a língua confundida e foram espalhados sobre a terra (Gênesis 11:1-9).

Foi Nabucodonosor, rei da Babilônia, quem cercou Jerusalém, destruiu o templo e levou o povo cativo em 586 a.C., iniciando o exílio que marcou a história de Israel (2 Reis 25). Ali viveram Daniel e seus três companheiros, Ezequiel profetizou entre os exilados junto ao rio Quebar, e foi de lá que os judeus voltaram por decreto de Ciro.

O Salmo 137 registra o luto daquele período: "junto aos rios da Babilônia nos assentamos e choramos, quando nos lembramos de Sião", com as harpas penduradas nos salgueiros diante do pedido dos que os levaram cativos por um dos cânticos de Sião.

Isaías e Jeremias dedicam longos oráculos à sua queda, e Daniel narra a noite em que a escrita apareceu na parede durante o banquete de Belsazar e a cidade caiu diante dos medos e persas (Daniel 5).

No Novo Testamento, o nome se torna símbolo. Pedro envia saudações "da que está na Babilônia" (1 Pedro 5:13), e o Apocalipse descreve a grande Babilônia, mãe das prostituições, cuja queda é anunciada e celebrada (Apocalipse 17-18).',
  published = true
where slug = 'babilonia';

update public.lexicon_entries set
  aliases = array['Belém', 'Belem', 'Bethlehem', 'Efrata', 'Belém de Judá'],
  title = 'Belém, onde Jesus nasceu',
  description = 'Cidade pequena da Judeia, a cerca de nove quilômetros ao sul de Jerusalém, chamada também Efrata. O nome significa "casa do pão".

Foi perto dali que Raquel morreu no parto de Benjamim e foi sepultada no caminho (Gênesis 35:19). É o cenário do livro de Rute: a família de Noemi saiu de Belém por causa da fome e voltou na época da ceifa da cevada, e nos campos de Boaz Rute respigou até se tornar sua esposa e bisavó de Davi (Rute 1-4).

É, por isso, a cidade de Davi. Samuel foi enviado a Belém para ungir um dos filhos de Jessé, e depois de sete recusas mandou buscar o mais novo, que apascentava as ovelhas (1 Samuel 16:1-13). Num episódio da guerra contra os filisteus, Davi manifestou o desejo de beber água do poço de Belém, e três de seus valentes romperam o arraial inimigo para trazê-la, mas ele a derramou diante do Senhor por considerá-la o sangue daqueles homens (2 Samuel 23:15-17).

Miqueias profetizou que dali sairia aquele que governaria em Israel, apesar de a cidade ser pequena entre os milhares de Judá (Miqueias 5:2), texto citado pelos escribas quando Herodes perguntou onde nasceria o Cristo.

José e Maria subiram a Belém por causa do recenseamento, e ali Jesus nasceu e foi deitado numa manjedoura por não haver lugar na hospedaria. Pastores nos arredores receberam o anúncio dos anjos (Lucas 2:1-20). Foi em Belém que Herodes mandou matar os meninos de dois anos para baixo (Mateus 2:16).',
  published = true
where slug = 'belem';

update public.lexicon_entries set
  aliases = array['Bereia', 'Beroea', 'Beréia', 'Beroia'],
  title = 'Bereia, a cidade dos que examinavam as Escrituras',
  description = 'Cidade da Macedônia, ao sul de Tessalônica, afastada da via principal. Paulo e Silas foram enviados para lá de noite pelos irmãos, para escapar do tumulto em Tessalônica (Atos 17:10).

Sua fama vem de um único versículo, que se tornou um dos mais citados sobre o estudo da Bíblia. Chegando, foram à sinagoga dos judeus, e o texto observa: "ora, estes foram mais nobres do que os que estavam em Tessalônica, porque de bom grado receberam a palavra, examinando cada dia nas Escrituras se estas coisas eram assim" (Atos 17:11).

O elogio reúne duas atitudes que costumam ser tratadas como opostas: receberam a mensagem de boa vontade e ao mesmo tempo a verificaram diariamente contra o texto. Não foi a desconfiança nem a credulidade que os distinguiu, mas a combinação das duas disposições.

O resultado foi que muitos deles creram, e também não poucas mulheres gregas de distinção e homens (Atos 17:12).

A paz durou pouco: quando os judeus de Tessalônica souberam que a palavra de Deus era anunciada também em Bereia, foram até lá agitar as multidões. Os irmãos então enviaram Paulo em direção ao mar, enquanto Silas e Timóteo ficaram na cidade, e ele seguiu para Atenas (Atos 17:13-15).

Sópatro, um dos companheiros de Paulo na viagem final a Jerusalém, era bereense (Atos 20:4).',
  published = true
where slug = 'bereia';

update public.lexicon_entries set
  aliases = array['Berseba', 'Beerseba', 'Beersheba', 'Bersabeia'],
  title = 'Berseba, o extremo sul de Israel',
  description = 'Cidade na borda do Neguebe, no extremo sul do território de Israel. Seu nome é associado a "poço do juramento" ou "poço dos sete", e ela dá origem à expressão que delimita o país inteiro nas Escrituras: "desde Dã até Berseba".

Foi ali que Abraão firmou um pacto com Abimeleque, rei de Gerar, entregando-lhe sete cordeiras como testemunho de que havia cavado aquele poço, e plantou um bosque, invocando o nome do Senhor, o Deus eterno (Gênesis 21:22-33).

Depois da expulsão de Hagar e Ismael, foi no deserto de Berseba que a água do odre acabou, que ela deixou o menino sob um arbusto e que Deus lhe mostrou um poço (Gênesis 21:14-19).

Isaque também viveu na região, cavou poços disputados com os filisteus e recebeu ali uma aparição noturna do Senhor, na noite em que chegou (Gênesis 26:23-25). Foi de Berseba que Jacó partiu para o Egito, oferecendo antes sacrifícios ao Deus de seu pai (Gênesis 46:1-5).

Samuel constituiu ali seus filhos como juízes, e eles se desviaram atrás do lucro, o que levou o povo a pedir um rei (1 Samuel 8:1-5).

Foi também a Berseba que Elias fugiu da ameaça de Jezabel, deixando ali o seu servo antes de seguir um dia de caminho pelo deserto e pedir a morte debaixo de um zimbro (1 Reis 19:3-4).',
  published = true
where slug = 'berseba';

update public.lexicon_entries set
  aliases = array['Betânia', 'Betania', 'Bethany'],
  title = 'Betânia, a casa de Marta, Maria e Lázaro',
  description = 'Aldeia na encosta oriental do Monte das Oliveiras, a cerca de três quilômetros de Jerusalém. Era o lugar onde Jesus se hospedava quando subia à cidade, e funcionava como uma espécie de refúgio nos últimos dias de seu ministério.

Ali moravam Marta, Maria e Lázaro. Foi na casa delas que Marta se queixou por servir sozinha enquanto a irmã ouvia Jesus, ocasião em que ele disse que Maria escolhera a boa parte (Lucas 10:38-42).

Foi também em Betânia que Lázaro adoeceu e morreu. Jesus chegou quatro dias depois do sepultamento, chorou diante do túmulo e o chamou para fora, milagre que precipitou a decisão do Sinédrio de matá-lo (João 11).

Seis dias antes da Páscoa, num jantar na casa de Simão, o leproso, Maria ungiu Jesus com um vaso de nardo puro de grande valor, enxugando-lhe os pés com os cabelos, enquanto a casa se encheu do cheiro do perfume. Judas protestou pelo desperdício, e Jesus disse que ela o havia guardado para o dia do seu sepultamento (João 12:1-8, Marcos 14:3-9).

Foi de Betânia e Betfagé que partiu a entrada triunfal em Jerusalém (Marcos 11:1), e para lá que Jesus voltava a cada noite daquela semana (Marcos 11:11).

Lucas situa a ascensão nas imediações da aldeia: Jesus conduziu os discípulos até junto de Betânia e, enquanto os abençoava, foi elevado ao céu (Lucas 24:50-51).',
  published = true
where slug = 'betania';

update public.lexicon_entries set
  aliases = array['Betel', 'Bethel'],
  title = 'Betel, a casa de Deus',
  description = 'Cidade na região montanhosa a norte de Jerusalém, chamada antes de Luz. Seu nome significa "casa de Deus", e foi dado por Jacó.

Abraão armou sua tenda entre Betel e Ai e ali levantou um altar ao Senhor, voltando ao mesmo lugar depois da passagem pelo Egito (Gênesis 12:8, 13:3-4).

O episódio que fixou o nome está em Gênesis 28. Fugindo de Esaú a caminho de Harã, Jacó passou a noite no lugar, tomou uma pedra por travesseiro e sonhou com uma escada que ligava a terra ao céu, com anjos subindo e descendo, e o Senhor no alto renovando a promessa feita a Abraão. Ao acordar disse: "na verdade o Senhor está neste lugar, e eu não o sabia", e ungiu a pedra com azeite, chamando o lugar de Betel. Voltou ali anos depois, por ordem divina, para edificar um altar (Gênesis 35:1-15).

No tempo dos juízes, a arca esteve em Betel, e Samuel a incluía em seu circuito anual de julgamento (Juízes 20:27, 1 Samuel 7:16).

A cidade mudou de significado com a divisão do reino. Jeroboão instalou ali um dos dois bezerros de ouro, para que o povo do Norte não subisse a Jerusalém, e Betel se tornou santuário real do reino do Norte (1 Reis 12:28-33). Foi lá que Amós enfrentou o sacerdote Amasias, que mandou o profeta voltar para Judá (Amós 7:10-13), e ali Josias destruiu o altar séculos depois (2 Reis 23:15).',
  published = true
where slug = 'betel';

update public.lexicon_entries set
  aliases = array['Betsaida', 'Bethsaida', 'Betsaída'],
  title = 'Betsaida, a cidade de Pedro, André e Filipe',
  description = 'Povoado de pescadores na margem norte do mar da Galileia, perto da foz do Jordão. O nome é geralmente entendido como "casa de pesca".

João a identifica como a cidade de André e de Pedro e, no chamado de Filipe, registra que ele era "de Betsaida, cidade de André e de Pedro" (João 1:44).

Foi nas imediações da cidade que ocorreu a multiplicação dos pães para cinco mil homens, segundo Lucas, que situa ali a retirada de Jesus com os discípulos e a multidão que o seguiu (Lucas 9:10-17).

Marcos narra em Betsaida uma cura singular: trouxeram-lhe um cego, e Jesus o tomou pela mão, levou-o para fora da aldeia, cuspiu-lhe nos olhos e perguntou se via alguma coisa. O homem respondeu que via os homens como árvores que andavam, e só depois de uma segunda imposição de mãos passou a ver tudo claramente. É o único milagre dos evangelhos realizado em duas etapas (Marcos 8:22-26).

Apesar dos sinais realizados ali, a cidade aparece entre as repreendidas por Jesus: "ai de ti, Corazim, ai de ti, Betsaida, porque, se em Tiro e em Sidom fossem feitos os prodígios que em vós se fizeram, há muito que se teriam arrependido com saco e com cinza" (Mateus 11:21).

O local exato é debatido, e escavações na região apontam mais de um candidato possível.',
  published = true
where slug = 'betsaida';

update public.lexicon_entries set
  aliases = array['Cades-Barneia', 'Cades Barneia', 'Cades', 'Kadesh-Barnea'],
  title = 'Cades-Barneia, onde Israel se recusou a entrar',
  description = 'Oásis no deserto de Zim, ao sul de Canaã, na fronteira do Neguebe. Foi a base de Israel durante boa parte dos quarenta anos de peregrinação e o palco de dois episódios decisivos.

O primeiro é a recusa de entrar na terra. Foi de Cades-Barneia que Moisés enviou os doze espias, um de cada tribo, para reconhecer Canaã. Voltaram depois de quarenta dias trazendo frutos, mas dez deles espalharam um relatório desanimador sobre cidades fortificadas e gigantes. O povo chorou a noite toda, falou em escolher um chefe e voltar ao Egito, e não deu ouvidos a Josué e Calebe. A sentença foi um ano de deserto por cada dia de espionagem: aquela geração morreria fora da terra (Números 13-14).

O segundo é a falta de Moisés. De volta a Cades anos depois, o povo contendeu por falta de água. Deus mandou que Moisés falasse à rocha, mas ele reuniu a assembleia e disse: "ouvi agora, rebeldes, porventura tiraremos água desta rocha?", ferindo-a duas vezes com a vara. A água saiu, mas ele e Arão foram impedidos de entrar na terra por não terem santificado a Deus diante do povo. O lugar foi chamado águas de Meribá (Números 20:1-13).

Foi ali que Miriã morreu e foi sepultada, e de Cades que Moisés enviou mensageiros ao rei de Edom pedindo passagem, que foi negada (Números 20:14-21).',
  published = true
where slug = 'cades-barneia';

update public.lexicon_entries set
  aliases = array['Cafarnaum', 'Capernaum', 'Cafarnaúm'],
  title = 'Cafarnaum, a base do ministério de Jesus',
  description = 'Cidade à margem norte do mar da Galileia, situada numa rota comercial importante, com posto alfandegário e uma guarnição romana. Mateus, o publicano, foi chamado justamente na coletoria da cidade.

Depois de ser rejeitado em Nazaré, Jesus deixou a aldeia natal e foi habitar em Cafarnaum, e Mateus lê essa mudança como cumprimento de Isaías sobre a terra de Zebulom e Naftali, onde o povo assentado em trevas viu uma grande luz (Mateus 4:13-16). A cidade é chamada de "sua cidade" (Mateus 9:1).

Foi ali que ensinou na sinagoga com autoridade e expulsou um espírito imundo diante de todos; que curou a sogra de Pedro com febre; que os quatro amigos abriram o telhado para descer o paralítico à sua frente; e que o servo do centurião foi curado à distância, depois que o oficial disse não ser digno de recebê-lo sob seu teto, arrancando de Jesus o elogio de não ter achado fé igual em Israel (Marcos 1-2, Lucas 7:1-10).

Na sinagoga de Cafarnaum foi proferido o discurso do pão da vida, que fez muitos discípulos se afastarem (João 6:24-66).

Apesar de tudo isso, a cidade recebeu uma das palavras mais duras dos evangelhos, ao lado de Corazim e Betsaida: "e tu, Cafarnaum, que te ergues até aos céus, serás abatida até aos infernos", com a observação de que Sodoma teria permanecido se tivesse visto os mesmos milagres (Mateus 11:23-24).',
  published = true
where slug = 'cafarnaum';

update public.lexicon_entries set
  aliases = array['Caná', 'Cana', 'Caná da Galileia', 'Cana of Galilee'],
  title = 'Caná, onde a água virou vinho',
  description = 'Aldeia da Galileia, mencionada apenas no evangelho de João, identificada como a terra natal de Natanael (João 21:2). Sua localização exata é discutida entre alguns sítios ao norte de Nazaré.

Foi ali que Jesus realizou o que João chama de "princípio dos sinais". Durante uma festa de casamento, em que estavam presentes Maria, Jesus e os discípulos, o vinho acabou, situação socialmente constrangedora para os anfitriões. Maria comunicou o fato ao filho, e diante da resposta de que a hora dele ainda não havia chegado, disse simplesmente aos serventes: "fazei tudo quanto ele vos disser" (João 2:1-5).

Havia ali seis talhas de pedra para a purificação dos judeus, com capacidade de duas ou três metretas cada uma. Jesus mandou enchê-las de água até a borda e depois tirar e levar ao mestre-sala, que provou a água tornada em vinho sem saber de onde vinha, e chamou o noivo para observar que todos servem primeiro o bom vinho e deixam o inferior para o fim, mas ele guardara o bom até então (João 2:6-10).

O evangelista conclui que assim Jesus manifestou a sua glória, e seus discípulos creram nele (João 2:11).

Caná reaparece quando um oficial do rei foi de Cafarnaum até lá para pedir a cura do filho que estava à morte, e Jesus o curou à distância, apenas com a palavra "vai, o teu filho vive" (João 4:46-54).',
  published = true
where slug = 'cana';

update public.lexicon_entries set
  aliases = array['Canaã', 'Canaa', 'Canaan', 'Terra Prometida'],
  title = 'Canaã, a terra prometida',
  description = 'Região entre o rio Jordão e o mar Mediterrâneo, com fronteiras aproximadas no Líbano ao norte e no deserto do Neguebe ao sul. É a terra que Deus prometeu a Abraão e à sua descendência, e o destino de praticamente toda a primeira metade do Antigo Testamento.

A promessa é feita quando Abraão chega ali vindo de Harã: "à tua semente darei esta terra" (Gênesis 12:7), e repetida a Isaque e a Jacó. Os patriarcas viveram nela como estrangeiros e peregrinos, possuindo apenas um túmulo comprado, a caverna de Macpela.

A família de Jacó a deixou por causa da fome e desceu ao Egito, onde os descendentes se multiplicaram e foram escravizados. O êxodo é o movimento de volta: Moisés conduziu o povo até as fronteiras, enviou doze espias que voltaram com um cacho de uvas carregado por dois homens e com o relato de uma terra "que mana leite e mel", mas também de cidades fortificadas e homens de grande estatura (Números 13).

A recusa do povo custou quarenta anos de deserto. Sob Josué, a travessia do Jordão, a queda de Jericó e uma série de campanhas levaram à ocupação, e a terra foi dividida entre as doze tribos (Josué 3-21).

O nome vem de Canaã, filho de Cam, e os povos que a habitavam são descritos como cananeus, heteus, amorreus, ferezeus, heveus e jebuseus.',
  published = true
where slug = 'canaa';

update public.lexicon_entries set
  aliases = array['Cesareia', 'Cesaréia', 'Caesarea', 'Cesareia Marítima'],
  title = 'Cesareia, a capital romana da Judeia',
  description = 'Cidade portuária construída por Herodes, o Grande, na costa do Mediterrâneo, em homenagem a César Augusto. Dotada de um porto artificial monumental, teatro, hipódromo e aqueduto, era a sede administrativa dos governadores romanos da Judeia, o que faz dela uma cidade de perfil bem mais greco-romano que judaico.

Não deve ser confundida com Cesareia de Filipe, ao norte, onde Pedro fez sua confissão (Mateus 16:13-16).

É cenário de vários episódios de Atos. Filipe, o evangelista, se estabeleceu ali com quatro filhas que profetizavam (Atos 8:40, 21:8-9). Foi na casa do centurião Cornélio, em Cesareia, que Pedro pregou aos gentios e viu o Espírito Santo descer sobre eles, abrindo a porta da igreja aos não judeus (Atos 10).

Foi também ali que Herodes Agripa I, vestido de trajes reais e aclamado como deus pelo povo, foi ferido e morreu por não ter dado glória a Deus (Atos 12:19-23).

Paulo passou por Cesareia diversas vezes em suas viagens, e foi para lá que o levaram sob escolta de duzentos soldados depois da conspiração para matá-lo em Jerusalém. Permaneceu preso na cidade por dois anos, defendendo-se diante do governador Félix, depois de Festo, e por fim do rei Agripa, a quem disse desejar que todos os ouvintes se tornassem como ele, exceto pelas cadeias. Foi ali que apelou para César, o que determinou sua viagem a Roma (Atos 23-26).',
  published = true
where slug = 'cesareia';

update public.lexicon_entries set
  aliases = array['Chipre', 'Cyprus', 'Cipre'],
  title = 'Chipre, a ilha de Barnabé',
  description = 'Grande ilha do Mediterrâneo oriental, província senatorial romana governada por um procônsul, conhecida na Antiguidade por suas minas de cobre.

Era a terra natal de Barnabé, descrito como "levita, natural de Chipre", que vendeu um campo e trouxe o valor aos pés dos apóstolos (Atos 4:36-37). Depois da perseguição que se seguiu à morte de Estêvão, cristãos dispersos chegaram até a ilha pregando, embora a princípio só a judeus, e alguns cipriotas estiveram entre os primeiros a anunciar o evangelho a gregos em Antioquia (Atos 11:19-20).

Foi o primeiro destino da primeira viagem missionária. Barnabé e Saulo, enviados pela igreja de Antioquia, embarcaram em Selêucia e chegaram a Salamina, anunciando a palavra nas sinagogas, com João Marcos como auxiliar (Atos 13:4-5).

Atravessaram a ilha até Pafos, onde estava o procônsul Sérgio Paulo, homem prudente que quis ouvir a palavra de Deus. Um mágico judeu chamado Elimas tentou impedi-lo de crer, e Paulo, cheio do Espírito Santo, fitou nele os olhos e o repreendeu duramente, anunciando cegueira temporária, que veio de imediato. O procônsul creu, admirado da doutrina (Atos 13:6-12). É nessa passagem que o texto passa a chamá-lo de Paulo em vez de Saulo.

A ilha reaparece depois: quando Paulo e Barnabé se separaram por causa de Marcos, foi para Chipre que Barnabé navegou com o primo (Atos 15:39).',
  published = true
where slug = 'chipre';

update public.lexicon_entries set
  aliases = array['Colossos', 'Colossas', 'Colossae'],
  title = 'Colossos, destinatária da carta aos colossenses',
  description = 'Cidade do vale do rio Lico, na província romana da Ásia, próxima de Laodiceia e Hierápolis. Havia sido importante em séculos anteriores pela produção de lã tingida, mas no primeiro século já era a menor das três cidades vizinhas.

Não há registro de que Paulo tenha estado ali. Ele escreve dizendo que muitos não haviam visto o seu rosto em carne (Colossenses 2:1), e o texto indica que a igreja foi fundada por Epafras, natural da cidade, que aprendeu o evangelho com o apóstolo, provavelmente durante os anos em Éfeso, e o levou para casa (Colossenses 1:7, 4:12-13).

A carta aos colossenses foi escrita da prisão para responder a um ensino que combinava ascetismo, observâncias de comidas, festas e luas novas, culto de anjos e pretensões de visões, ameaçando reduzir Cristo a um entre muitos poderes espirituais.

A resposta de Paulo não é uma refutação ponto a ponto, mas uma exposição da supremacia de Cristo: nele foram criadas todas as coisas, ele é antes de tudo, nele tudo subsiste, nele habita corporalmente toda a plenitude da divindade, e nele estão escondidos todos os tesouros da sabedoria e da ciência (Colossenses 1:15-20, 2:3,9).

A carta foi enviada por Tíquico junto com Onésimo, o escravo que voltava a Filemom, morador da mesma cidade (Colossenses 4:7-9). Paulo pede ainda que ela seja lida na igreja de Laodiceia e vice-versa (Colossenses 4:16). Um terremoto atingiu a região poucos anos depois.',
  published = true
where slug = 'colossos';

update public.lexicon_entries set
  aliases = array['Corinto', 'Corinth'],
  title = 'Corinto, a cidade das duas cartas de Paulo',
  description = 'Cidade grega situada no istmo que liga o Peloponeso ao continente, com dois portos, um para cada mar, o que a tornava um dos maiores entrepostos comerciais do Mediterrâneo. Capital da província romana da Acaia, era conhecida pela riqueza, pela população mista e pela reputação de devassidão.

Paulo chegou ali vindo de Atenas e se hospedou com Áquila e Priscila, judeus expulsos de Roma pelo decreto de Cláudio, trabalhando com eles na fabricação de tendas (Atos 18:1-3).

Diante da oposição na sinagoga, sacudiu as vestes e passou a ensinar na casa vizinha, de Tito Justo, e o próprio chefe da sinagoga, Crispo, creu com toda a sua casa. Numa visão noturna, ouviu: "não temas, mas fala, e não te cales, porque eu sou contigo, e ninguém lançará mão de ti para te fazer mal, pois tenho muito povo nesta cidade". Permaneceu um ano e seis meses (Atos 18:6-11).

Os judeus o levaram ao tribunal do procônsul Gálio, que rejeitou o caso por se tratar de questão de palavras e de nomes da lei deles (Atos 18:12-17). A inscrição que menciona esse procônsul é uma das âncoras cronológicas mais firmes da vida de Paulo.

A igreja de Corinto deu origem às duas cartas mais longas do apóstolo a uma comunidade, que tratam de divisões, imoralidade, processos entre irmãos, ceia do Senhor, dons espirituais, ressurreição e a coleta para Jerusalém, e contêm o capítulo do amor (1 Coríntios 13).',
  published = true
where slug = 'corinto';

update public.lexicon_entries set
  aliases = array['Damasco', 'Damascus'],
  title = 'Damasco, onde Paulo foi convertido',
  description = 'Antiga cidade da Síria, uma das mais continuamente habitadas do mundo, situada num oásis regado pelos rios Abana e Farfar, mencionados por Naamã ao reclamar da ordem de se lavar no Jordão (2 Reis 5:12).

Aparece já no tempo de Abraão, cujo servo Eliézer era de Damasco (Gênesis 15:2). Foi capital do reino arameu que guerreou repetidas vezes com Israel, sob reis como Ben-Hadade e Hazael, e caiu diante da Assíria em 732 a.C., conforme anunciado por Isaías e Amós.

Seu lugar no Novo Testamento vem de um único episódio. Saulo de Tarso, ainda respirando ameaças e morte contra os discípulos, pediu ao sumo sacerdote cartas para as sinagogas de Damasco, a fim de trazer presos a Jerusalém os que seguissem o Caminho. Aproximando-se da cidade, uma luz do céu o cercou, caiu por terra e ouviu: "Saulo, Saulo, por que me persegues?" (Atos 9:1-5).

Cego, foi levado pela mão e permaneceu três dias sem comer nem beber, na casa de Judas, na rua chamada Direita. Ananias foi enviado a ele, apesar do receio, impôs-lhe as mãos, e caíram-lhe dos olhos como que escamas (Atos 9:8-19).

Passou a pregar imediatamente nas sinagogas da cidade, o que gerou uma conspiração para matá-lo. Os discípulos o desceram de noite pelo muro, num cesto, e ele escapou (Atos 9:20-25, 2 Coríntios 11:32-33).',
  published = true
where slug = 'damasco';

update public.lexicon_entries set
  aliases = array['Derbe'],
  title = 'Derbe, o ponto final da primeira viagem',
  description = 'Cidade da Licaônia, na Ásia Menor, próxima da fronteira oriental da província da Galácia. É a menos documentada das cidades visitadas por Paulo naquela região, e sua localização exata só foi proposta com segurança a partir de achados arqueológicos modernos.

Paulo e Barnabé chegaram ali vindos de Listra, no dia seguinte ao apedrejamento que quase matou o apóstolo (Atos 14:20).

O relato sobre a cidade é breve e, ao contrário do que aconteceu nas anteriores, inteiramente tranquilo: anunciaram o evangelho àquela cidade e fizeram muitos discípulos (Atos 14:21). Não há registro de oposição, tumulto ou expulsão, o que faz de Derbe uma exceção naquele trecho da viagem.

Foi o ponto mais distante alcançado na primeira viagem missionária. Dali, em vez de seguirem adiante pela estrada que os levaria facilmente de volta a Antioquia da Síria pelo interior, os dois decidiram refazer o caminho por Listra, Icônio e Antioquia da Pisídia, justamente as cidades onde haviam sido perseguidos, para confirmar os discípulos e constituir presbíteros em cada igreja (Atos 14:21-23).

Paulo passou novamente por Derbe no início da segunda viagem, vindo pela Síria e Cilícia, antes de chegar a Listra e encontrar Timóteo (Atos 16:1).

Gaio, um dos companheiros que o acompanharam na viagem a Jerusalém com a coleta, era natural de Derbe (Atos 20:4).',
  published = true
where slug = 'derbe';

update public.lexicon_entries set
  aliases = array['Éden', 'Eden', 'Jardim do Éden'],
  title = 'Éden, o jardim da criação',
  description = 'Jardim plantado por Deus "da banda do oriente", onde foi colocado o primeiro homem para o cultivar e o guardar. O nome é associado a delícia ou prazer, e o texto descreve a terra como lugar onde brotava toda árvore agradável à vista e boa para comer (Gênesis 2:8-9).

No meio do jardim estavam duas árvores: a da vida e a do conhecimento do bem e do mal. De todas as árvores Adão podia comer livremente, exceto desta última, sob pena de morte (Gênesis 2:16-17).

Um rio saía do Éden para regar o jardim e dali se dividia em quatro braços, chamados Pisom, Giom, Tigre e Eufrates, os dois últimos identificáveis com rios reais da Mesopotâmia, o que situa a narrativa numa geografia reconhecível sem permitir localização precisa (Gênesis 2:10-14).

Foi ali que a serpente questionou a ordem divina, que a mulher e o homem comeram do fruto proibido, e que Deus os procurou na viragem do dia. A consequência foi a expulsão: querubins e uma espada flamejante foram postos ao oriente do jardim para guardar o caminho da árvore da vida (Gênesis 3:24).

Os profetas voltam a mencioná-lo como imagem de fartura perdida (Isaías 51:3, Ezequiel 36:35), e o Apocalipse fecha a Bíblia devolvendo a árvore da vida, agora dando fruto todos os meses, com folhas para a saúde das nações (Apocalipse 22:2).',
  published = true
where slug = 'eden';

update public.lexicon_entries set
  aliases = array['Edom', 'Seir', 'Idumeia'],
  title = 'Edom, a terra dos descendentes de Esaú',
  description = 'Região montanhosa ao sul do mar Morto, entre o Zerede e o golfo de Ácaba, conhecida pelas rochas avermelhadas e pelas habitações escavadas em penhascos. Também chamada Seir, e mais tarde Idumeia.

Seus habitantes descendiam de Esaú, irmão gêmeo de Jacó, que recebeu o apelido de Edom, "vermelho", por causa do guisado pelo qual vendeu a primogenitura (Gênesis 25:30, 36:8). Essa origem faz de Israel e Edom nações irmãs, o que explica a aspereza particular com que os profetas tratam a inimizade entre elas.

Quando Israel vinha do deserto, Moisés enviou mensageiros pedindo passagem pela estrada real, com promessa de não pisar campos nem beber das águas, e o rei de Edom saiu ao encontro com muita gente e mão forte, negando o pedido (Números 20:14-21). A lei, ainda assim, mandava não abominar o edomita, "porque é teu irmão" (Deuteronômio 23:7).

Edom foi subjugado por Davi, recuperou a independência sob Jorão e voltou a ser atacado por reis posteriores de Judá.

O livro de Obadias é inteiramente dedicado ao juízo sobre Edom, acusando-o de ter ficado de longe olhando no dia da queda de Jerusalém, de ter se alegrado com a desgraça e de ter entregado os fugitivos (Obadias 10-14). Temas semelhantes aparecem no Salmo 137 e em Ezequiel 35. Herodes, o Grande, era de ascendência idumeia.',
  published = true
where slug = 'edom';

update public.lexicon_entries set
  aliases = array['Éfeso', 'Efeso', 'Ephesus'],
  title = 'Éfeso, a cidade do templo de Diana',
  description = 'Principal cidade da província romana da Ásia, na costa oeste da atual Turquia, famosa pelo templo de Ártemis, chamada Diana pelos romanos, uma das sete maravilhas do mundo antigo. Era grande centro comercial e religioso.

Paulo passou ali brevemente no fim da segunda viagem e voltou na terceira, permanecendo cerca de três anos, o período mais longo em uma só cidade. Ensinou três meses na sinagoga e depois por dois anos na escola de um certo Tirano, de modo que todos os que habitavam na Ásia ouviram a palavra (Atos 19:8-10).

Deus fazia milagres extraordinários por suas mãos, e a tentativa de alguns exorcistas judeus de usar o nome de Jesus terminou com o espírito respondendo "conheço a Jesus, e sei quem é Paulo, mas vós quem sois?" e atacando-os. O episódio levou muitos que praticavam artes mágicas a queimar publicamente seus livros, cujo valor foi calculado em cinquenta mil moedas de prata (Atos 19:13-19).

O fim da estadia veio com o tumulto provocado por Demétrio, ourives que fazia nichos de prata de Diana e viu o negócio ameaçado. A multidão encheu o teatro gritando por duas horas "grande é a Diana dos efésios", até ser dispersada pelo escrivão da cidade (Atos 19:23-41).

A caminho de Jerusalém, Paulo se despediu dos presbíteros de Éfeso em Mileto, num dos discursos mais emocionados de Atos (Atos 20:17-38). A cidade recebeu a carta aos efésios e é a primeira das sete igrejas do Apocalipse (Apocalipse 2:1-7).',
  published = true
where slug = 'efeso';

update public.lexicon_entries set
  aliases = array['Egito', 'Egypt', 'Mizraim'],
  title = 'Egito',
  description = 'Uma das grandes potências do mundo antigo, situada ao longo do rio Nilo, e um dos cenários mais recorrentes da Bíblia. Abraão já havia buscado refúgio ali durante uma fome em Canaã (Gênesis 12:10), e mais tarde foi para o Egito que José, vendido como escravo pelos próprios irmãos, chegou a ocupar uma posição de grande poder, chegando a governar ao lado do Faraó e salvando a região de uma fome severa (Gênesis 37-45).

Por causa de José, toda a família de Jacó se estabeleceu no Egito, na região de Gósen, e ali os israelitas se multiplicaram ao longo de gerações. Com o tempo, porém, um novo Faraó que não conhecia José escravizou o povo, submetendo-o a trabalhos forçados (Êxodo 1).

Foi desse cativeiro que Moisés liderou a saída de Israel, depois de confrontar o Faraó com as dez pragas e da instituição da Páscoa. A travessia do Mar Vermelho marcou o fim da opressão egípcia sobre o povo e deu início à jornada rumo à Terra Prometida (Êxodo 3-14), um evento que se tornou a lembrança central da identidade de Israel como povo libertado por Deus.

No Novo Testamento, o Egito volta a aparecer quando José e Maria fogem para lá com o menino Jesus, para escapar da perseguição de Herodes, cumprindo a profecia "do Egito chamei o meu filho" (Mateus 2:13-15, citando Oséias 11:1).',
  published = true
where slug = 'egito';

update public.lexicon_entries set
  aliases = array['Emaús', 'Emaus', 'Emmaus'],
  title = 'Emaús',
  description = 'Vilarejo situado a cerca de onze quilômetros de Jerusalém, cuja localização exata ainda é discutida por estudiosos, já que existem alguns candidatos possíveis identificados com o nome bíblico. É conhecido principalmente por um episódio ocorrido no dia da ressurreição de Jesus.

Dois discípulos caminhavam de Jerusalém para Emaús, conversando tristes sobre os acontecimentos recentes, quando Jesus ressuscitado se juntou a eles no caminho, mas seus olhos estavam impedidos de reconhecê-lo. Ao longo do trajeto, ele explicou as Escrituras, mostrando como tudo apontava para o Messias sofredor e depois glorificado (Lucas 24:13-27).

Já perto de Emaús, os discípulos convidaram o estranho para ficar e jantar com eles. Foi no momento em que Jesus partiu o pão que seus olhos finalmente se abriram e o reconheceram, mas ele desapareceu diante deles logo em seguida. Cheios de alegria, os dois voltaram imediatamente a Jerusalém para contar aos demais discípulos que haviam visto o Senhor ressuscitado (Lucas 24:28-35).',
  published = true
where slug = 'emaus';

update public.lexicon_entries set
  aliases = array['Filipos', 'Philippi'],
  title = 'Filipos, a primeira igreja na Europa',
  description = 'Cidade da Macedônia, colônia romana com privilégios especiais, fundada por Filipe II, pai de Alexandre, e depois célebre pela batalha em que Otávio e Antônio derrotaram os assassinos de César.

Paulo chegou ali na segunda viagem missionária, depois da visão noturna de um homem macedônio que suplicava: "passa à Macedônia e ajuda-nos" (Atos 16:9-12). É o marco da entrada do evangelho na Europa.

Como não havia sinagoga, no sábado foram à beira do rio, onde se costumava orar, e falaram às mulheres reunidas. Lídia, vendedora de púrpura, teve o coração aberto pelo Senhor, foi batizada com a sua casa e os hospedou (Atos 16:13-15).

O conflito veio quando Paulo expulsou o espírito de adivinhação de uma jovem escrava que rendia muito lucro aos seus senhores. Perdida a fonte de renda, eles arrastaram os missionários à praça, e os magistrados os mandaram açoitar com varas e prender no cárcere interior, com os pés no tronco. À meia-noite, Paulo e Silas oravam e cantavam louvores, e um terremoto abriu as portas; o carcereiro, prestes a se matar, perguntou o que devia fazer para ser salvo e foi batizado com toda a sua casa naquela noite (Atos 16:16-34).

No dia seguinte, Paulo se recusou a sair às escondidas, invocando a cidadania romana que fora violada pelo açoite público (Atos 16:37-39). A igreja dali foi a que mais sustentou o apóstolo, e a carta aos filipenses é a mais afetuosa de suas cartas.',
  published = true
where slug = 'filipos';

update public.lexicon_entries set
  aliases = array['Galácia', 'Galacia', 'Galatia'],
  title = 'Galácia, destinatária da carta aos gálatas',
  description = 'Região central da Ásia Menor, na atual Turquia, que dá nome a uma das cartas mais decisivas de Paulo. O nome vem de tribos gaulesas que se estabeleceram ali no século 3 a.C., e Roma depois criou uma província do mesmo nome que abrangia também cidades ao sul, como Antioquia da Pisídia, Icônio, Listra e Derbe.

Essa dupla extensão do nome gera uma discussão antiga sobre quem eram exatamente os destinatários da carta: as igrejas do sul, fundadas na primeira viagem missionária e narradas em Atos 13-14, ou comunidades do norte, sobre as quais o livro de Atos é praticamente silencioso, mencionando apenas a passagem pela "região da Galácia" (Atos 16:6, 18:23).

A carta aos gálatas foi escrita contra mestres que exigiam a circuncisão e a observância da lei dos convertidos gentios. É o texto mais veemente de Paulo: começa sem nenhuma palavra de elogio, o que é único entre suas cartas, e passa direto ao espanto de que eles estivessem passando tão depressa a outro evangelho (Gálatas 1:6).

Nela ele narra o confronto público com Pedro em Antioquia, que se afastara da mesa dos gentios por medo dos que vinham de Jerusalém (Gálatas 2:11-14), argumenta a partir de Abraão que a promessa antecede a lei, e apresenta a liberdade cristã com a advertência de que ela não sirva de ocasião à carne. É dali a lista do fruto do Espírito (Gálatas 5:22-23).',
  published = true
where slug = 'galacia';

update public.lexicon_entries set
  aliases = array['Galileia', 'Galiléia', 'Galilee', 'Galileia dos gentios'],
  title = 'Galileia, a região onde Jesus cresceu',
  description = 'Região ao norte da Palestina, entre o mar da Galileia e a costa do Mediterrâneo. Era terra fértil, densamente povoada e atravessada por rotas comerciais, o que lhe deu uma população misturada e o apelido antigo de "Galileia dos gentios", usado por Isaías e retomado por Mateus (Isaías 9:1, Mateus 4:15-16).

Essa mistura rendia aos galileus certo desprezo por parte dos habitantes da Judeia, visível em frases como "de Nazaré pode vir alguma coisa boa?" e na acusação feita a Pedro no pátio: "a tua fala te denuncia" (João 1:46, Mateus 26:73).

Foi ali que Jesus cresceu, em Nazaré, e foi ali que começou e transcorreu a maior parte de seu ministério público. Cafarnaum, à beira do lago, funcionou como base. Na Galileia chamou os primeiros discípulos, pescadores do lago, pregou o Sermão do Monte, realizou a maioria dos milagres registrados e alimentou as multidões.

Quase todos os doze apóstolos eram galileus, e o grupo era identificado por isso: no dia de Pentecostes, a multidão se admirou perguntando se não eram galileus todos os que falavam (Atos 2:7).

Depois da ressurreição, o anjo mandou avisar aos discípulos que ele iria adiante deles para a Galileia, e foi ali, num monte designado, que Jesus lhes deu a ordem de fazer discípulos de todas as nações (Mateus 28:7,16-20).',
  published = true
where slug = 'galileia';

update public.lexicon_entries set
  aliases = array['Getsêmani', 'Getsemani', 'Gethsemane'],
  title = 'Getsêmani, onde Jesus orou antes de ser preso',
  description = 'Jardim situado no sopé do Monte das Oliveiras, próximo a Jerusalém, para onde Jesus foi com os discípulos logo após a Última Ceia, na noite em que seria traído e preso. É um dos lugares mais associados ao sofrimento pessoal de Jesus antes da crucificação.

Ali, Jesus pediu a Pedro, Tiago e João que ficassem vigiando enquanto ele se afastava um pouco para orar, angustiado diante do que estava por vir. Sua oração culmina na entrega "não seja como eu quero, mas como tu queres", expressando submissão à vontade do Pai apesar da angústia extrema, descrita por Lucas como um suor semelhante a gotas de sangue (Mateus 26:36-39, Lucas 22:44).

Por três vezes Jesus voltou para encontrar os discípulos dormindo, incapazes de vigiar com ele nem por uma hora (Mateus 26:40-45). Foi justamente em Getsêmani que Judas Iscariotes chegou acompanhado de soldados e guardas do templo para entregar Jesus, identificando-o com um beijo, o que levou à sua prisão (Mateus 26:47-50).',
  published = true
where slug = 'getsemani';

update public.lexicon_entries set
  aliases = array['Gólgota', 'Golgota', 'Calvário', 'Calvario', 'Golgotha', 'Lugar da Caveira'],
  title = 'Gólgota, o lugar da crucificação',
  description = 'Lugar fora dos muros de Jerusalém onde Jesus foi crucificado. O nome vem do aramaico e significa "lugar da caveira", traduzido em latim como Calvariae, de onde vem a palavra Calvário. Os quatro evangelhos registram o nome e sua tradução.

O motivo do nome não é explicado no texto. As explicações tradicionais apontam para o formato do terreno ou para a função do local como sítio de execuções públicas, junto a uma via de passagem, já que o efeito dissuasivo dependia de ser visto.

Jesus saiu carregando a própria cruz, e no caminho os soldados constrangeram Simão Cireneu a levá-la (João 19:17, Marcos 15:21). Chegando ali, ofereceram-lhe vinho com fel, que ele não quis beber.

Foi crucificado entre dois malfeitores, e sobre a cruz Pilatos mandou pôr a inscrição em hebraico, grego e latim: "Jesus Nazareno, Rei dos Judeus". Os soldados repartiram suas vestes lançando sortes, e sobre a túnica sem costura decidiram não a dividir (João 19:19-24).

Das três às seis da tarde houve trevas sobre toda a terra, e ao expirar o véu do templo se rasgou em dois, de alto a baixo, a terra tremeu e o centurião que estava defronte declarou: "verdadeiramente este era o Filho de Deus" (Marcos 15:33-39).

O evangelho de João observa que no lugar onde foi crucificado havia um horto, e nele um sepulcro novo, onde o corpo foi posto por ser véspera do sábado (João 19:41-42).',
  published = true
where slug = 'golgota';

update public.lexicon_entries set
  aliases = array['Gomorra', 'Gomorrah'],
  title = 'Gomorra, a cidade irmã de Sodoma',
  description = 'Cidade da planície do Jordão, sempre mencionada junto com Sodoma, das quais formava, com Admá, Zeboim e Zoar, o grupo conhecido como as cidades da planície.

Seu rei, Birsa, aparece entre os cinco monarcas derrotados por Quedorlaomer e seus aliados na batalha do vale de Sidim, cheio de poços de betume, onde os exércitos de Sodoma e Gomorra fugiram e caíram (Gênesis 14:8-11).

O clamor contra as duas cidades chegou a Deus, que anunciou a Abraão sua decisão de descer e ver se procediam conforme aquele clamor. Seguiu-se a intercessão do patriarca, que negociou a poupança da cidade por cinquenta, quarenta e cinco, quarenta, trinta, vinte e finalmente dez justos (Gênesis 18:20-32).

Na manhã seguinte à saída de Ló, o Senhor fez chover enxofre e fogo sobre Sodoma e Gomorra, e Abraão, olhando do lugar onde havia estado diante do Senhor, viu subir da terra uma fumaça como a de uma fornalha (Gênesis 19:24-28).

A dupla se tornou a imagem padrão de destruição nas Escrituras, usada por Isaías, Jeremias, Amós e Sofonias para descrever o juízo sobre outras nações. No Novo Testamento, Jesus diz que haverá menos rigor para a terra de Sodoma e Gomorra no dia do juízo do que para as cidades que rejeitarem seus mensageiros (Mateus 10:15), e Pedro e Judas as citam como exemplo posto diante dos que vivem impiamente (2 Pedro 2:6, Judas 7).',
  published = true
where slug = 'gomorra';

update public.lexicon_entries set
  aliases = array['Gósen', 'Gosen', 'Goshen', 'Terra de Gósen'],
  title = 'Gósen, onde Israel viveu no Egito',
  description = 'Região do delta oriental do Nilo, entregue por Faraó à família de Jacó quando esta desceu ao Egito por causa da fome. José orientou os irmãos a se apresentarem como pastores de ovelhas, ofício que os egípcios tinham em abominação, de modo que fossem alojados separadamente naquela terra (Gênesis 46:31-34).

O Faraó a descreveu como "o melhor da terra do Egito", apropriada para o gado, e foi ali que Jacó reencontrou o filho depois de vinte e dois anos, abraçando-o e chorando longamente (Gênesis 45:18, 46:28-30).

Os israelitas habitaram Gósen por gerações, tomaram posse dela, frutificaram e se multiplicaram muito (Gênesis 47:27). Com o tempo, um novo rei que não conhecia José os escravizou e os pôs a fazer tijolos e a construir as cidades-celeiros de Pitom e Ramessés.

Durante as pragas do Egito, a região passou a ser explicitamente distinguida: a partir da quarta praga, o texto registra que Deus separou a terra de Gósen, onde estava o seu povo, para que ali não houvesse enxames de moscas, nem morte do gado, nem saraiva, nem as trevas que cobriram o restante do país (Êxodo 8:22, 9:26, 10:23).

Foi de Gósen, a partir de Ramessés, que o povo partiu na noite da Páscoa (Êxodo 12:37).',
  published = true
where slug = 'gosen';

update public.lexicon_entries set
  aliases = array['Harã', 'Hara', 'Haran', 'Carrã'],
  title = 'Harã, a parada no caminho de Canaã',
  description = 'Cidade do norte da Mesopotâmia, na região conhecida como Padã-Arã, importante entroncamento de rotas comerciais. Não deve ser confundida com Harã, irmão de Abraão, cujo nome em português coincide.

Foi ali que Terá interrompeu a viagem que havia iniciado em Ur dos caldeus rumo a Canaã, estabelecendo-se com a família. Terá morreu em Harã aos duzentos e cinco anos (Gênesis 11:31-32).

Depois da morte do pai, Abraão recebeu a ordem que abre sua história: "sai da tua terra, da tua parentela e da casa de teu pai, para a terra que eu te mostrarei". Partiu de Harã aos setenta e cinco anos, levando Sarai, Ló e todos os bens que haviam adquirido (Gênesis 12:1-5).

A cidade permaneceu como referência familiar. Foi para lá que Abraão enviou seu servo em busca de uma esposa para Isaque, e de lá veio Rebeca (Gênesis 24). Foi também para Harã que Jacó fugiu da ira de Esaú, indo à casa de seu tio Labão, onde trabalhou vinte anos, casou-se com Lia e Raquel e teve a maior parte de seus filhos (Gênesis 27:43, 28:10, 29-31).

Harã aparece ainda muito depois, entre as cidades citadas pelo comandante assírio ao zombar de Jerusalém, como exemplo de lugar que seus deuses não conseguiram livrar (2 Reis 19:12).',
  published = true
where slug = 'hara';

update public.lexicon_entries set
  aliases = array['Hebrom', 'Hebron', 'Quiriate-Arba'],
  title = 'Hebrom, cidade dos patriarcas e primeira capital de Davi',
  description = 'Uma das cidades mais antigas continuamente habitadas do mundo, situada nas montanhas de Judá. Abraão viveu boa parte de sua vida nas proximidades, junto aos carvalhos de Manre, e foi ali que comprou a caverna de Macpela como local de sepultamento para sua esposa Sara (Gênesis 23).

Com o tempo, a caverna de Macpela se tornou o túmulo da família patriarcal: além de Sara, foram sepultados ali Abraão, Isaque, Rebeca, Jacó e Lia, o que fez de Hebrom um lugar de forte significado para a identidade de Israel.

Depois da conquista de Canaã, Hebrom foi entregue como herança a Calebe, um dos dois espias que, junto com Josué, haviam confiado na promessa de Deus décadas antes (Josué 14:6-14). Mais tarde, foi em Hebrom que Davi foi ungido rei sobre a tribo de Judá, e ali reinou por cerca de sete anos e meio antes de se tornar rei de todo o Israel e transferir a capital para Jerusalém (2 Samuel 2:1-4, 5:1-5).

A cidade voltou a ter papel de destaque durante a rebelião de Absalão contra Davi, quando o filho se proclamou rei justamente em Hebrom, dando início ao conflito (2 Samuel 15:7-10).',
  published = true
where slug = 'hebrom';

update public.lexicon_entries set
  aliases = array['Horebe', 'Horeb', 'Monte Horebe', 'monte de Deus'],
  title = 'Horebe, o monte de Deus',
  description = 'Monte chamado no texto bíblico de "o monte de Deus", usado em boa parte das passagens como outro nome para o Sinai, especialmente no livro de Deuteronômio e nos escritos que dependem dele. Alguns intérpretes distinguem os dois nomes como picos ou partes distintas do mesmo maciço, mas a leitura mais corrente os identifica.

Foi ali que Moisés, apascentando o rebanho de seu sogro Jetro, viu a sarça que ardia sem se consumir, ouviu seu nome chamado duas vezes, recebeu a ordem de tirar as sandálias por estar em terra santa e foi enviado ao Faraó. É nessa cena que Deus revela o nome "EU SOU O QUE SOU" (Êxodo 3:1-14).

No deserto, diante do povo sedento, Moisés feriu a rocha em Horebe por ordem divina, e dela saiu água (Êxodo 17:6).

Deuteronômio usa o nome de forma constante ao recapitular a entrega da Lei: "o Senhor nosso Deus fez conosco aliança em Horebe", e lembra que o povo não viu figura alguma no dia em que o Senhor falou do meio do fogo (Deuteronômio 4:15, 5:2).

Foi também o destino da fuga de Elias, que caminhou quarenta dias e quarenta noites até o monte de Deus depois da ameaça de Jezabel. Numa caverna ali, ouviu a pergunta "que fazes aqui, Elias?" e, depois do vento impetuoso, do terremoto e do fogo, a voz mansa e delicada (1 Reis 19:8-13). O livro de Malaquias encerra o Antigo Testamento mandando lembrar a lei dada em Horebe (Malaquias 4:4).',
  published = true
where slug = 'horebe';

update public.lexicon_entries set
  aliases = array['Icônio', 'Iconio', 'Iconium', 'Icônia'],
  title = 'Icônio, cidade da primeira viagem missionária',
  description = 'Cidade da região central da Ásia Menor, na planície da Licaônia, correspondente à atual Konya, na Turquia. Situava-se numa importante rota comercial e tinha população mista, com uma comunidade judaica estabelecida.

Paulo e Barnabé chegaram ali vindos de Antioquia da Pisídia, de onde haviam sido expulsos. Entraram juntos na sinagoga e falaram de tal modo que creu uma grande multidão, tanto de judeus como de gregos (Atos 14:1).

Os judeus incrédulos, porém, incitaram e irritaram os ânimos dos gentios contra os irmãos. Os dois permaneceram ali muito tempo, falando ousadamente no Senhor, que dava testemunho à palavra da sua graça por meio de sinais e prodígios (Atos 14:2-3).

A cidade acabou dividida: uns eram a favor dos judeus, outros dos apóstolos. Quando se formou um plano conjunto de autoridades e populares para os ultrajar e apedrejar, eles perceberam e fugiram para Listra e Derbe (Atos 14:4-6).

O episódio teve desdobramento imediato: judeus vindos de Antioquia e de Icônio persuadiram a multidão em Listra, e Paulo foi apedrejado e arrastado para fora da cidade, dado por morto (Atos 14:19).

Ainda assim, os missionários voltaram por Icônio na viagem de retorno, confirmando os discípulos e exortando-os a permanecer na fé, com o aviso de que por muitas tribulações é necessário entrar no reino de Deus (Atos 14:21-22). Paulo a menciona ao lembrar as perseguições que sofreu (2 Timóteo 3:11).',
  published = true
where slug = 'iconio';

update public.lexicon_entries set
  aliases = array['Israel', 'terra de Israel', 'povo de Israel', 'reino de Israel'],
  title = 'Israel, o nome que é povo, terra e nação',
  description = 'Antes de ser terra ou nação, Israel é um nome de pessoa. Foi dado a Jacó na noite em que lutou até o amanhecer com um homem junto ao vau de Jaboque e não o deixou ir sem ser abençoado. Ferido no encaixe da coxa, ouviu: "não te chamarás mais Jacó, mas Israel, pois como príncipe lutaste com Deus e com os homens, e prevaleceste" (Gênesis 32:22-28). Por isso, quando a Bíblia fala dos "filhos de Israel", está falando literalmente dos descendentes dele.

Daí o nome se estendeu ao povo formado pelas doze tribos que vieram de seus filhos, e depois à terra que esse povo ocupou em Canaã, entre o Jordão e o Mediterrâneo.

Após o reinado de Saul, Davi e Salomão, o reino se dividiu. As dez tribos do Norte ficaram com o nome de Israel, capital em Samaria, e caíram diante da Assíria em 722 a.C.; o Sul se chamou Judá, com capital em Jerusalém, e caiu diante da Babilônia em 586 a.C. Por isso, em muitos textos proféticos, "Israel" designa especificamente o reino do Norte, em contraste com Judá.

No Novo Testamento, o nome volta a abranger o povo inteiro, e Paulo o discute longamente em Romanos 9 a 11, distinguindo os que são de Israel dos que são verdadeiramente israelitas e afirmando que a raiz sustenta os ramos.

Jerusalém, Judeia, Galileia e Samaria são regiões dentro dessa mesma terra, e têm entradas próprias.',
  published = true
where slug = 'israel';

update public.lexicon_entries set
  aliases = array['Jericó', 'Jerico', 'Jericho', 'Cidade das Palmeiras'],
  title = 'Jericó, a cidade dos muros que caíram',
  description = 'Cidade do vale do Jordão, perto do mar Morto, cerca de duzentos e cinquenta metros abaixo do nível do mar. É considerada uma das cidades mais antigas do mundo e é chamada nas Escrituras de cidade das palmeiras.

Foi o primeiro alvo de Israel na conquista de Canaã. Dois espias enviados por Josué foram escondidos por Raabe, moradora cuja casa ficava sobre o muro, e desceram por uma corda pela janela, prometendo poupar sua família (Josué 2).

O cerco não teve batalha. Por ordem divina, o povo rodeou a cidade uma vez por dia durante seis dias, em silêncio, com sete sacerdotes tocando trombetas diante da arca. No sétimo dia deram sete voltas, e ao toque prolongado das trombetas todo o povo gritou, e o muro caiu abaixo. A cidade foi destruída e consagrada à destruição, poupando-se apenas Raabe e os seus (Josué 6).

Josué pronunciou uma maldição sobre quem a reedificasse, cumprida séculos depois em Hiel, de Betel (Josué 6:26, 1 Reis 16:34). A cidade voltou a ser habitada, e foi ali que Eliseu purificou as águas com sal (2 Reis 2:19-22).

No Novo Testamento, Jesus passou por Jericó e curou o cego Bartimeu à saída da cidade (Marcos 10:46-52) e hospedou-se na casa de Zaqueu, que subira numa figueira brava para vê-lo (Lucas 19:1-10). A estrada entre Jerusalém e Jericó é o cenário da parábola do bom samaritano (Lucas 10:30).',
  published = true
where slug = 'jerico';

update public.lexicon_entries set
  aliases = array['Jerusalém', 'Jerusalem', 'Cidade de Davi', 'Cidade Santa'],
  title = 'Jerusalém, a cidade santa',
  description = 'Cidade nos montes da Judeia, a cerca de 750 metros de altitude, cercada pelo vale do Cedrom a leste e tendo em frente o Monte das Oliveiras. É o lugar mais citado da Bíblia e o centro da história de Israel.

Aparece primeiro como Salém, cidade do rei e sacerdote Melquisedeque (Gn 14:18; Sl 76:2). Mais tarde foi Jebus, fortaleza dos jebuseus (Jz 19:10), até ser conquistada por Davi por volta de 1000 a.C. Davi fez dela sua capital, chamou a fortaleza de Sião de Cidade de Davi e levou para lá a arca da aliança (2Sm 5:6-9; 6).

Salomão construiu o templo no Monte Moriá (2Cr 3:1), tornando a cidade o centro religioso da nação. Após a divisão do reino, foi a capital de Judá. Em 586 a.C., Nabucodonosor, rei da Babilônia, destruiu a cidade e o templo e levou o povo ao exílio (2Rs 25). Com a volta do cativeiro, o templo foi reconstruído sob Zorobabel, e os muros, sob Neemias.

No Novo Testamento, Jesus foi apresentado no templo ainda bebê, voltou lá aos doze anos, entrou na cidade aclamado como rei e ali foi crucificado, fora dos muros, e ressuscitou. Em Jerusalém o Espírito Santo desceu no Pentecostes (At 2) e reuniu-se o primeiro concílio da igreja (At 15). Jesus chorou sobre ela e anunciou sua destruição (Lc 19:41-44), cumprida pelos romanos sob Tito em 70 d.C.

O Apocalipse encerra a Bíblia com a visão da Nova Jerusalém descendo do céu, onde Deus habitará com seu povo (Ap 21).',
  published = true
where slug = 'jerusalem';

update public.lexicon_entries set
  aliases = array['Jope', 'Jaffa', 'Joppa', 'Jafa'],
  title = 'Jope, o porto do Mediterrâneo',
  description = 'Cidade portuária na costa do Mediterrâneo, um dos poucos ancoradouros naturais daquele litoral, correspondente à atual Jafa, hoje parte de Tel Aviv.

Foi por Jope que passou a madeira de cedro do Líbano enviada em jangadas por Hirão para a construção do templo de Salomão, e novamente na reconstrução no tempo de Esdras (2 Crônicas 2:16, Esdras 3:7).

É também o porto de onde Jonas embarcou ao fugir da ordem de ir a Nínive: desceu a Jope, achou um navio que ia para Társis, pagou a passagem e entrou nele para se afastar da presença do Senhor (Jonas 1:3).

No livro de Atos, a cidade aparece em dois episódios ligados. No primeiro, vivia ali uma discípula chamada Tabita, ou Dorcas, conhecida pelas boas obras e pelas esmolas, que adoeceu e morreu. As viúvas mostraram a Pedro as túnicas e vestes que ela fazia, e ele, depois de mandar sair a todos e orar, disse: "Tabita, levanta-te". A notícia se espalhou por toda Jope, e muitos creram (Atos 9:36-42).

Pedro permaneceu muitos dias na cidade, hospedado na casa de Simão, o curtidor, junto ao mar. Foi no terraço dessa casa, por volta do meio-dia e com fome, que teve a visão do lençol descido do céu com toda sorte de animais e ouviu a ordem de matar e comer, preparando-o para ir à casa do centurião Cornélio, em Cesareia (Atos 10:9-23).',
  published = true
where slug = 'jope';

update public.lexicon_entries set
  aliases = array['Jordão', 'Jordao', 'Rio Jordão', 'Jordan'],
  title = 'Jordão, o rio que Israel atravessou',
  description = 'Principal rio da Palestina, corre do norte ao sul desde as encostas do monte Hermom até o mar Morto, passando pelo mar da Galileia. Seu nome é associado ao verbo descer, apropriado a um curso que termina no ponto mais baixo da superfície terrestre.

Foi a fronteira que Israel atravessou para entrar na terra prometida. Na época da colheita, quando o rio transbordava por todas as suas ribanceiras, os sacerdotes que levavam a arca entraram na água, e as águas que vinham de cima se detiveram e se ergueram num montão, enquanto o povo passava em seco. Doze pedras tiradas do leito foram erguidas em Gilgal como memorial para que os filhos perguntassem o seu significado (Josué 3-4).

Foi nos vaus do Jordão que Jefté identificou os efraimitas pela pronúncia da palavra "chibolete" (Juízes 12:5-6). Elias e Eliseu atravessaram o rio ferindo as águas com a capa, pouco antes de Elias ser levado num redemoinho (2 Reis 2:8-14), e foi nele que Naamã, o sírio, se lavou sete vezes e foi curado da lepra, depois de reclamar que os rios de Damasco eram melhores (2 Reis 5:10-14).

No Novo Testamento, é o rio onde João batizava e onde Jesus foi batizado, ocasião em que os céus se abriram e o Espírito desceu como pomba (Mateus 3:13-17). Jesus voltou à região do outro lado do Jordão antes da última ida a Jerusalém (João 10:40).',
  published = true
where slug = 'jordao';

update public.lexicon_entries set
  aliases = array['Judeia', 'Judéia', 'Judea'],
  title = 'Judeia, a região ao redor de Jerusalém',
  description = 'Região montanhosa do sul da Palestina, tendo Jerusalém como centro. O nome vem da tribo de Judá e do reino do Sul, e passou a designar a província administrativa nos períodos persa, grego e romano.

Após o exílio, a área devolvida aos repatriados era bem menor que o antigo reino, e o termo passou a indicar o distrito ao redor da capital reconstruída. No tempo do Novo Testamento, era província romana governada por um prefeito, subordinada à legação da Síria, com residência oficial em Cesareia.

É nela que se concentram os episódios decisivos dos evangelhos. Jesus nasceu em Belém da Judeia, e os magos foram informados pelos escribas de que ali nasceria o Cristo (Mateus 2:1-6). João Batista pregou no deserto da Judeia e batizava no Jordão (Mateus 3:1).

O ministério de Jesus alternou entre a Galileia e a Judeia, e o evangelho de João registra várias subidas a Jerusalém para as festas. A tensão com as autoridades era maior ali, a ponto de os discípulos estranharem sua decisão de voltar para ver Lázaro, lembrando que pouco antes procuravam apedrejá-lo (João 11:7-8).

Depois de Pentecostes, a Judeia aparece na sequência que organiza o livro de Atos: as testemunhas seriam em Jerusalém, em toda a Judeia e Samaria, e até aos confins da terra (Atos 1:8). Perseguida a igreja, os crentes se espalharam justamente pelas regiões da Judeia e de Samaria (Atos 8:1).',
  published = true
where slug = 'judeia';

update public.lexicon_entries set
  aliases = array['Listra', 'Lystra'],
  title = 'Listra, onde Paulo foi apedrejado',
  description = 'Cidade da região da Licaônia, na Ásia Menor, colônia romana de população rural que falava o dialeto licaônico. Paulo e Barnabé chegaram ali fugindo da ameaça de apedrejamento em Icônio (Atos 14:6).

Ali ocorreu um dos episódios mais estranhos de Atos. Havia na cidade um homem aleijado dos pés desde o ventre da mãe, que nunca havia andado. Ouvindo Paulo falar, e vendo este que ele tinha fé para ser curado, disse-lhe em alta voz que se levantasse direito, e o homem saltou e andou (Atos 14:8-10).

A multidão, ao ver aquilo, levantou a voz em licaônico dizendo que os deuses haviam descido em forma de homens. Chamaram Barnabé de Júpiter e Paulo de Mercúrio, por ser ele o que falava, e o sacerdote de Júpiter trouxe touros e grinaldas às portas, querendo sacrificar. Os dois rasgaram as vestes, saltaram para o meio do povo e protestaram que eram homens sujeitos às mesmas paixões, mal conseguindo impedir o sacrifício (Atos 14:11-18).

Logo depois, judeus vindos de Antioquia e Icônio persuadiram a multidão, e a mesma cidade que queria adorá-lo apedrejou Paulo e o arrastou para fora, supondo-o morto. Cercado pelos discípulos, ele se levantou e no dia seguinte partiu com Barnabé para Derbe (Atos 14:19-20).

Listra era a cidade de Timóteo, filho de mãe judia crente e pai grego, que tinha bom testemunho entre os irmãos e se juntou a Paulo na viagem seguinte (Atos 16:1-3).',
  published = true
where slug = 'listra';

update public.lexicon_entries set
  aliases = array['Macedônia', 'Macedonia', 'Macedon'],
  title = 'Macedônia, a província do chamado noturno',
  description = 'Província romana no norte da Grécia, com cidades como Filipos, Tessalônica e Bereia. Havia sido o reino de Filipe II e de Alexandre, o Grande, e no primeiro século era território romano atravessado pela Via Egnácia.

Sua entrada na história do cristianismo se dá por uma visão. Impedidos pelo Espírito de pregar na Ásia e na Bitínia, Paulo e seus companheiros desceram a Trôade, e ali ele viu de noite um homem macedônio de pé, rogando: "passa à Macedônia e ajuda-nos". Concluíram imediatamente que Deus os chamava a evangelizar aquela região (Atos 16:6-10). É nesse ponto que a narrativa de Atos passa a usar a primeira pessoa do plural, sinal de que Lucas se juntou ao grupo.

A travessia levou o evangelho ao continente europeu. Em Filipos surgiu a primeira igreja, em torno de Lídia e do carcereiro; em Tessalônica e Bereia, outras duas, ambas em meio a tumultos (Atos 16-17).

Paulo voltou à província mais de uma vez e a menciona com frequência nas cartas. É dali que escreve aliviado depois de reencontrar Tito (2 Coríntios 7:5-6), e são as igrejas macedônias que ele apresenta como exemplo na coleta para os santos de Jerusalém: em muita prova de tribulação e profunda pobreza, deram acima de suas posses, de forma espontânea, pedindo insistentemente para participar (2 Coríntios 8:1-5).',
  published = true
where slug = 'macedonia';

update public.lexicon_entries set
  aliases = array['Malta', 'Melita', 'Militene'],
  title = 'Malta, a ilha do naufrágio de Paulo',
  description = 'Pequena ilha do Mediterrâneo central, ao sul da Sicília, chamada Melita no texto grego. Foi onde Paulo naufragou a caminho de Roma, como prisioneiro que havia apelado a César.

O navio enfrentou por catorze dias um vento tempestuoso chamado Euroclidon, perdendo o rumo, a carga e a esperança de salvação, até que Paulo anunciou a mensagem de um anjo: nenhuma vida se perderia, apenas o navio, e seria numa ilha que iriam dar (Atos 27:14-26).

Encalhados num banco de areia, a proa ficou presa e a popa se desfez. Os soldados quiseram matar os presos para que nenhum fugisse, mas o centurião, querendo salvar Paulo, impediu, e ordenou que os que soubessem nadar se lançassem primeiro. Todas as duzentas e setenta e seis pessoas chegaram à terra, umas em tábuas, outras em pedaços do navio (Atos 27:41-44).

Os habitantes da ilha acenderam uma fogueira e os receberam com rara humanidade. Enquanto Paulo ajuntava um feixe de gravetos, uma víbora saltou do calor e se prendeu à sua mão. Os locais concluíram que era um homicida a quem a justiça não deixava viver; ele sacudiu o bicho no fogo sem sofrer mal algum, e eles mudaram de ideia e passaram a dizer que era um deus (Atos 28:1-6).

Paulo curou o pai de Públio, o principal da ilha, e depois muitos outros doentes. Ficaram ali três meses antes de seguir viagem num navio de Alexandria (Atos 28:7-11).',
  published = true
where slug = 'malta';

update public.lexicon_entries set
  aliases = array['Mar da Galileia', 'Lago de Genesaré', 'Mar de Tiberíades', 'Sea of Galilee', 'lago de Tiberíades'],
  title = 'Mar da Galileia, o lago do ministério de Jesus',
  description = 'Lago de água doce ao norte da Palestina, alimentado pelo rio Jordão, com cerca de vinte e um quilômetros de comprimento e situado bem abaixo do nível do mar. Aparece com vários nomes: mar da Galileia, lago de Genesaré e mar de Tiberíades.

Sua posição encaixada entre colinas produz tempestades súbitas, detalhe que explica dois episódios dos evangelhos. No primeiro, Jesus dormia na popa sobre uma almofada quando se levantou grande temporal; despertado pelos discípulos, repreendeu o vento e disse ao mar "cala-te, aquieta-te", e houve grande bonança (Marcos 4:35-41). No segundo, caminhou sobre as águas na quarta vigília da noite, e Pedro pediu para ir ao seu encontro, começando a afundar quando reparou no vento forte (Mateus 14:22-33).

Em suas margens ficavam Cafarnaum, Betsaida, Magdala e Tiberíades, e dali vieram vários dos apóstolos, pescadores de profissão. Foi ali que Jesus chamou Pedro, André, Tiago e João, prometendo fazê-los pescadores de homens (Marcos 1:16-20), e que ensinou de dentro de um barco enquanto a multidão ficava na praia (Lucas 5:1-3).

A pesca que encheu duas barcas a ponto de quase afundarem levou Pedro a cair de joelhos dizendo-se pecador (Lucas 5:4-8).

Na última cena do evangelho de João, é à beira desse lago que Jesus ressuscitado prepara brasas com peixe e pão e restaura Pedro com três perguntas (João 21).',
  published = true
where slug = 'mar-da-galileia';

update public.lexicon_entries set
  aliases = array['Mar Vermelho', 'Mar de Juncos', 'Red Sea'],
  title = 'Mar Vermelho, onde as águas se abriram',
  description = 'Braço de mar entre a África e a península arábica. O termo hebraico usado no relato do êxodo, yam suf, significa literalmente "mar de juncos", e há discussão entre estudiosos sobre o ponto exato da travessia.

É o cenário do episódio mais lembrado da saída do Egito. Depois de deixar o povo partir, Faraó mudou de ideia e o perseguiu com seiscentos carros escolhidos. Os israelitas, encurralados entre o exército e a água, reclamaram com Moisés perguntando se faltavam sepulcros no Egito, e ouviram a resposta: "o Senhor pelejará por vós, e vós vos calareis" (Êxodo 14:5-14).

A coluna de nuvem passou para trás do arraial, separando os dois campos durante a noite. Moisés estendeu a mão sobre o mar, e o Senhor fez soprar um forte vento oriental toda a noite, que tornou o mar em terra seca, e as águas se dividiram. Israel passou pelo meio, com as águas como muro à direita e à esquerda (Êxodo 14:21-22).

Os egípcios entraram atrás e tiveram as rodas dos carros embaraçadas. Ao amanhecer, Moisés estendeu de novo a mão e as águas voltaram, cobrindo carros e cavaleiros, e nem um sequer restou (Êxodo 14:23-28).

A travessia se tornou o evento fundador da identidade de Israel, celebrado no cântico de Moisés e de Miriã (Êxodo 15) e lembrado em salmos e profetas sempre que se fala do poder de Deus para livrar.',
  published = true
where slug = 'mar-vermelho';

update public.lexicon_entries set
  aliases = array['Mileto', 'Miletus', 'Mileto da Ásia'],
  title = 'Mileto, onde Paulo se despediu dos presbíteros',
  description = 'Antiga cidade portuária da costa oeste da Ásia Menor, ao sul de Éfeso. Havia sido um dos maiores centros da Grécia jônica, berço de filósofos como Tales, e no primeiro século ainda funcionava como porto, embora o assoreamento já a afastasse do mar.

Paulo parou ali na viagem de volta da terceira jornada missionária, indo a Jerusalém com a coleta. Decidiu passar ao largo de Éfeso para não se demorar na Ásia, pois se apressava para estar em Jerusalém no dia de Pentecostes, e de Mileto mandou chamar os presbíteros da igreja efésia (Atos 20:16-17).

O discurso que lhes dirigiu é o único de Atos endereçado a líderes cristãos, e por isso o mais próximo do tom de suas cartas. Ele recapitula sua conduta entre eles, lembra que não se furtou a anunciar nada que fosse proveitoso, ensinando publicamente e de casa em casa, e que servia ao Senhor com lágrimas e provações (Atos 20:18-21).

Anuncia que vai preso a Jerusalém, sem saber o que o espera, e diz não fazer caso da própria vida, contanto que cumpra a carreira com alegria. Adverte que depois de sua partida entrarão lobos cruéis no meio deles, e que dentre eles mesmos se levantarão homens falando coisas perversas (Atos 20:22-31).

Encerra citando uma palavra de Jesus que não aparece em nenhum evangelho: "mais bem-aventurada coisa é dar do que receber" (Atos 20:35). Ajoelharam-se todos e oraram, chorando sobretudo por ele ter dito que não veriam mais o seu rosto (Atos 20:36-38).',
  published = true
where slug = 'mileto';

update public.lexicon_entries set
  aliases = array['Moabe', 'Moab'],
  title = 'Moabe, a nação a leste do mar Morto',
  description = 'Região montanhosa a leste do mar Morto, entre o ribeiro de Arnom ao norte e o Zerede ao sul. Seus habitantes descendiam de Moabe, filho da filha mais velha de Ló, segundo o relato do capítulo que se segue à destruição de Sodoma (Gênesis 19:37).

Foi nas planícies de Moabe, diante de Jericó, que Israel acampou ao fim dos quarenta anos no deserto. O rei Balaque, temendo a multidão, contratou Balaão para amaldiçoar o povo, e por quatro vezes saiu bênção em lugar de maldição (Números 22-24). Pouco depois, Israel se corrompeu com as moabitas em Baal-Peor (Números 25).

Foi também em Moabe, no monte Nebo, que Moisés viu a terra prometida de longe, morreu e foi sepultado num vale sem que ninguém soubesse do seu sepulcro até hoje (Deuteronômio 34).

A relação com Israel foi quase sempre hostil: Eglom, rei de Moabe, oprimiu o povo e foi morto pelo juiz canhoto Eúde (Juízes 3:12-30), e Mesa, outro rei moabita, se rebelou contra Israel depois da morte de Acabe (2 Reis 3).

O livro de Rute, porém, dá outra medida à região. Foi para os campos de Moabe que a família de Noemi migrou por causa da fome, e foi de lá que veio Rute, a moabita que se tornou bisavó de Davi e entrou na genealogia de Jesus. Isaías e Jeremias dedicam longos oráculos ao juízo sobre Moabe (Isaías 15-16, Jeremias 48).',
  published = true
where slug = 'moabe';

update public.lexicon_entries set
  aliases = array['Monte das Oliveiras', 'Montanha das Oliveiras', 'Mount of Olives', 'Olivete'],
  title = 'Monte das Oliveiras, diante de Jerusalém',
  description = 'Elevação a leste de Jerusalém, separada da cidade pelo vale do Cedrom, coberta de oliveiras que lhe dão o nome. Do alto, avista-se o monte do templo.

No Antigo Testamento, Davi subiu por ele chorando, descalço e com a cabeça coberta, ao fugir da rebelião de Absalão (2 Samuel 15:30). Ezequiel registra a glória do Senhor deixando a cidade e parando sobre o monte que está ao oriente dela (Ezequiel 11:23), e Zacarias anuncia que os pés do Senhor se porão sobre ele naquele dia (Zacarias 14:4).

Nos evangelhos, é cenário constante da última semana. Foi dali que partiu a entrada triunfal, com Jesus montado num jumentinho descendo a encosta enquanto a multidão estendia os mantos e agitava ramos (Lucas 19:28-38). Foi também na descida do monte, à vista da cidade, que ele chorou sobre Jerusalém e anunciou sua destruição (Lucas 19:41-44).

Sentado no monte, defronte do templo, proferiu o longo discurso sobre o fim, conhecido como discurso das Oliveiras, em resposta à pergunta dos discípulos sobre quando aquelas coisas aconteceriam (Mateus 24-25).

Em sua encosta ficava o Getsêmani, para onde foi depois da última ceia e onde foi preso. Lucas registra que era seu costume passar as noites ali durante aquela semana (Lucas 21:37).

O livro de Atos situa nele a ascensão, informando que fica perto de Jerusalém, à distância da jornada de um sábado (Atos 1:9-12).',
  published = true
where slug = 'monte-das-oliveiras';

update public.lexicon_entries set
  aliases = array['Nazaré', 'Nazare', 'Nazareth', 'nazareno'],
  title = 'Nazaré, a cidade de Jesus',
  description = 'Pequena aldeia da baixa Galileia, sem nenhuma menção no Antigo Testamento nem em fontes judaicas antigas, o que ajuda a explicar a reação de Natanael ao ouvir falar dela: "de Nazaré pode vir alguma coisa boa?" (João 1:46).

Foi ali que o anjo Gabriel apareceu a Maria e lhe anunciou o nascimento de Jesus (Lucas 1:26-38). Depois do nascimento em Belém e da fuga para o Egito, José se estabeleceu de volta na cidade, e Jesus cresceu nela, sendo por isso chamado nazareno (Mateus 2:23).

O episódio mais marcante ocorreu no início do ministério público. No sábado, entrou na sinagoga como era seu costume, levantou-se para ler, recebeu o livro de Isaías e leu a passagem sobre o Espírito do Senhor que o ungira para evangelizar os pobres. Fechou o livro e disse: "hoje se cumpriu esta Escritura em vossos ouvidos" (Lucas 4:16-21).

A admiração inicial virou hostilidade quando ele lembrou que Elias foi enviado a uma viúva de Sarepta e que Eliseu curou apenas o sírio Naamã. Os presentes se encheram de ira, o expulsaram da cidade e o levaram ao cume do monte para precipitá-lo, mas ele passou pelo meio deles (Lucas 4:22-30).

Marcos registra que ali não pôde fazer nenhum milagre notável por causa da incredulidade, e que disse: "não há profeta sem honra senão na sua pátria" (Marcos 6:4-6).',
  published = true
where slug = 'nazare';

update public.lexicon_entries set
  aliases = array['Nínive', 'Ninive', 'Nineveh'],
  title = 'Nínive, a capital assíria',
  description = 'Capital do império assírio, situada às margens do rio Tigre, na região do atual norte do Iraque. Foi uma das maiores cidades do mundo antigo, cercada por muros imensos, e é descrita no livro de Jonas como "cidade mui grande, de três dias de caminho".

Sua fundação é atribuída em Gênesis a Ninrode, o poderoso caçador (Gênesis 10:11).

É o destino que Jonas recebeu e do qual fugiu, embarcando em Jope rumo ao extremo oposto. Depois do episódio do grande peixe, obedeceu e entrou na cidade proclamando que dentro de quarenta dias ela seria destruída. O resultado foi a conversão mais ampla registrada no Antigo Testamento: os habitantes creram em Deus, proclamaram jejum, e o próprio rei se levantou do trono, tirou o manto, cobriu-se de saco e se assentou sobre a cinza, ordenando que homens e animais jejuassem. Deus viu as obras deles e se arrependeu do mal anunciado (Jonas 3).

O livro termina com Jonas contrariado justamente por isso, e com Deus perguntando se não deveria poupar uma cidade com mais de cento e vinte mil pessoas que não sabiam discernir entre a mão direita e a esquerda (Jonas 4:11).

Cerca de um século depois, Naum anunciou a destruição definitiva da cidade, descrevendo o cerco com imagens vívidas e chamando-a de cova de leões (Naum 2-3). Nínive caiu em 612 a.C. diante de babilônios e medos, e Sofonias a descreve reduzida a lugar de manadas (Sofonias 2:13-15). Jesus cita os ninivitas como testemunhas no juízo (Mateus 12:41).',
  published = true
where slug = 'ninive';

update public.lexicon_entries set
  aliases = array['Patmos', 'ilha de Patmos'],
  title = 'Patmos, onde João escreveu o Apocalipse',
  description = 'Pequena ilha rochosa do mar Egeu, ao largo da costa da Ásia Menor, perto de Mileto. É mencionada uma única vez em toda a Bíblia, mas essa menção basta para que seu nome seja conhecido em qualquer lugar onde o cristianismo chegou.

João se apresenta no começo do Apocalipse como irmão e companheiro na aflição, no reino e na paciência de Jesus Cristo, e diz: "estava na ilha chamada Patmos, por causa da palavra de Deus e do testemunho de Jesus Cristo" (Apocalipse 1:9). O texto não explica as circunstâncias, mas a formulação e a tradição antiga apontam para exílio imposto pelas autoridades romanas.

Foi ali que ele foi "arrebatado em espírito no dia do Senhor" e ouviu atrás de si uma grande voz como de trombeta, mandando que escrevesse num livro o que visse e o enviasse às sete igrejas da Ásia: Éfeso, Esmirna, Pérgamo, Tiatira, Sardes, Filadélfia e Laodiceia (Apocalipse 1:10-11).

Ao se voltar, viu sete candeeiros de ouro e no meio deles alguém semelhante ao Filho do homem, cuja aparência o fez cair como morto aos seus pés, ouvindo então: "não temas, eu sou o primeiro e o último, e o que vivo; fui morto, mas eis aqui estou vivo para todo o sempre" (Apocalipse 1:12-18).

Dessa ilha saíram as visões dos selos, das trombetas, das taças, da queda da Babilônia e da nova Jerusalém que encerra as Escrituras.',
  published = true
where slug = 'patmos';

update public.lexicon_entries set
  aliases = array['Pérsia', 'Persia', 'Império Persa'],
  title = 'Pérsia, o império que permitiu o retorno',
  description = 'Império fundado por Ciro, o Grande, que derrotou a Babilônia em 539 a.C. e passou a dominar do Egito à Índia. Sua política com os povos submetidos era bem diferente da assíria e da babilônica: em vez de deportações em massa, permitia o retorno dos exilados e a restauração de seus cultos locais.

Por isso, a Pérsia aparece nas Escrituras sobretudo em relação ao fim do exílio. Ciro publicou um decreto autorizando os judeus a voltar e reconstruir a casa do Senhor em Jerusalém, devolvendo inclusive os utensílios do templo que Nabucodonosor havia levado (Esdras 1). Isaías o menciona pelo nome com décadas de antecedência, chamando-o de "meu pastor" e até de "ungido" (Isaías 44:28, 45:1).

A obra do templo foi embargada e retomada sob Dario, que mandou procurar o decreto original nos arquivos e o confirmou, ordenando que as despesas saíssem das rendas reais (Esdras 6). Mais tarde, Artaxerxes enviou Esdras com autoridade e recursos, e depois autorizou Neemias, seu copeiro, a reconstruir os muros da cidade (Esdras 7, Neemias 2).

O livro de Ester se passa inteiramente na corte persa, em Susã, sob Assuero, e narra a ameaça de extermínio dos judeus no império e o livramento que originou a festa de Purim.

Daniel serviu sob Dario e viveu até o reinado de Ciro, e suas visões descrevem a sucessão dos impérios, com o carneiro de dois chifres explicitamente identificado como os reis da Média e da Pérsia (Daniel 8:20).',
  published = true
where slug = 'persia';

update public.lexicon_entries set
  aliases = array['Roma', 'Rome'],
  title = 'Roma, a capital do império',
  description = 'Capital do império que dominava todo o mundo mediterrâneo no primeiro século. Sua presença atravessa o Novo Testamento desde o recenseamento de César Augusto que levou José e Maria a Belém, até a crucificação, forma romana de execução.

Havia ali uma comunidade cristã antes de qualquer apóstolo a visitar. Judeus e prosélitos de Roma estavam entre os que ouviram o sermão de Pentecostes (Atos 2:10), e o decreto de Cláudio que expulsou os judeus da cidade levou Áquila e Priscila a Corinto (Atos 18:2).

Paulo escreveu à igreja de Roma sua carta mais extensa e sistemática, dizendo desejar visitá-los havia muito tempo e pretender seguir dali para a Espanha (Romanos 1:10-13, 15:23-24).

Chegou à cidade em circunstâncias diferentes das que imaginava: como prisioneiro, depois de apelar a César, tendo o Senhor lhe dito em Jerusalém que era necessário que também ali desse testemunho (Atos 23:11). Os irmãos saíram a encontrá-lo na Praça de Ápio e nas Três Vendas, e ao vê-los ele deu graças e tomou ânimo (Atos 28:15).

O livro de Atos termina com ele dois anos inteiros numa casa alugada, recebendo a todos que o procuravam e pregando com toda a liberdade, sem impedimento algum (Atos 28:30-31).

As cartas escritas da prisão enviam saudações dos que eram da casa de César (Filipenses 4:22). O Apocalipse fala da Babilônia, a cidade sentada sobre sete montes, imagem lida desde a antiguidade como referência a Roma (Apocalipse 17:9).',
  published = true
where slug = 'roma';

update public.lexicon_entries set
  aliases = array['Samaria', 'Samarie'],
  title = 'Samaria, capital do reino do Norte',
  description = 'Cidade fundada por Onri, rei de Israel, que comprou o monte de Semer por dois talentos de prata e ali edificou a nova capital do reino do Norte (1 Reis 16:24). O nome passou a designar também toda a região central da Palestina, entre a Galileia e a Judeia.

Sob Acabe e Jezabel, tornou-se centro do culto a Baal, com um templo erguido para o deus na própria cidade (1 Reis 16:32). Foi palco de boa parte do ministério de Elias e Eliseu, inclusive do cerco em que a fome levou a cenas extremas e que terminou com a fuga inexplicada do exército sírio, descoberta por quatro leprosos à entrada da porta (2 Reis 6-7).

Em 722 a.C., depois de três anos de cerco, Samaria caiu diante da Assíria. A população foi deportada, e povos de outras regiões do império foram trazidos para habitar a terra, misturando-se aos que ficaram e adotando um culto híbrido (2 Reis 17:5-6, 24-33).

Dessa origem vem a hostilidade entre judeus e samaritanos, que atravessa o Novo Testamento. Jesus atravessou a região, conversou com a mulher junto ao poço de Jacó, em Sicar, e muitos creram por causa dela (João 4). Contou também a parábola em que o samaritano é o único a socorrer o ferido na estrada (Lucas 10:30-37).

Depois da perseguição em Jerusalém, Filipe pregou em Samaria com grande aceitação, e Pedro e João foram enviados para lá (Atos 8:5-17).',
  published = true
where slug = 'samaria';

update public.lexicon_entries set
  aliases = array['Sião', 'Siao', 'Zion', 'Monte Sião'],
  title = 'Sião, o monte da cidade de Davi',
  description = 'Originalmente o nome da fortaleza dos jebuseus tomada por Davi, que passou a ser chamada Cidade de Davi (2 Samuel 5:6-9). Com o tempo, o nome se estendeu ao monte do templo, depois à cidade inteira de Jerusalém e, por fim, ao próprio povo de Deus.

A transferência da arca para Sião marcou o começo dessa carga de sentido: ali estava o lugar escolhido, e os salmos passam a falar do monte com afeto e superlativo, chamando-o de "alegria de toda a terra" e "a perfeição da formosura" (Salmos 48:2, 50:2).

Os cânticos de romaria, ou salmos dos degraus, foram cantados pelos que subiam a Jerusalém nas festas, e o Salmo 137 registra a dor oposta, a dos exilados que se assentaram junto aos rios da Babilônia e choraram ao lembrar de Sião, pendurando as harpas nos salgueiros.

Os profetas usam o nome tanto para a acusação quanto para a promessa: "Sião será lavrada como um campo" (Miqueias 3:12), mas também "de Sião sairá a lei, e a palavra do Senhor de Jerusalém" (Isaías 2:3), e o anúncio da entrada do rei humilde montado num jumentinho é dirigido à "filha de Sião" (Zacarias 9:9).

O Novo Testamento desloca o termo: a carta aos Hebreus diz que os crentes chegaram "ao monte Sião, e à cidade do Deus vivo, à Jerusalém celestial" (Hebreus 12:22), e o Apocalipse mostra o Cordeiro de pé sobre o monte Sião (Apocalipse 14:1).',
  published = true
where slug = 'siao';

update public.lexicon_entries set
  aliases = array['Sidom', 'Sidon', 'Sídon', 'Sidônia'],
  title = 'Sidom, a cidade fenícia ao norte de Tiro',
  description = 'Antiga cidade fenícia na costa do Mediterrâneo, ao norte de Tiro, com quem quase sempre aparece em par. Era porto e centro comercial, e seu nome já figura na Tábua das Nações como o primogênito de Canaã (Gênesis 10:15).

Os sidônios são mencionados entre os povos que Israel não expulsou da terra, e seus deuses estão entre os que seduziram o povo. Astarote, a deusa dos sidônios, aparece entre os cultos adotados por Salomão na velhice (Juízes 10:6, 1 Reis 11:5,33).

Jezabel era filha de Etbaal, rei dos sidônios, e ao se casar com Acabe levou para o reino do Norte o culto a Baal e a perseguição aos profetas do Senhor (1 Reis 16:31).

Foi justamente ao território de Sidom, em Sarepta, que Elias foi enviado durante a seca, para ser sustentado por uma viúva pobre cuja farinha e azeite não se acabaram, e cujo filho ele depois ressuscitou (1 Reis 17:8-24). Jesus cita esse episódio na sinagoga de Nazaré para dizer que nenhum profeta é bem recebido em sua terra (Lucas 4:25-26).

Ezequiel e Isaías incluem Sidom em seus oráculos contra as nações (Ezequiel 28:21-23, Isaías 23).

Nos evangelhos, multidões de Tiro e Sidom vinham ouvir Jesus (Marcos 3:8), e foi naquela região que ele atendeu a mulher siro-fenícia. Em Atos, Paulo aportou ali a caminho de Roma, e o centurião Júlio o tratou com humanidade, permitindo que visitasse os amigos (Atos 27:3).',
  published = true
where slug = 'sidom';

update public.lexicon_entries set
  aliases = array['Siló', 'Silo', 'Shiloh'],
  title = 'Siló, onde ficava o tabernáculo',
  description = 'Cidade na região montanhosa de Efraim, ao norte de Betel. Foi ali que Josué e a congregação de Israel armaram a tenda da congregação depois de a terra estar sujeitada, e foi de Siló que se fez o restante da partilha do território entre as tribos (Josué 18:1-10).

Permaneceu por cerca de trezentos anos como o principal centro religioso de Israel, o lugar para onde o povo subia às festas anuais e onde a arca da aliança era guardada.

Foi em Siló que Ana, estéril e angustiada, orou em silêncio movendo apenas os lábios, ao ponto de o sacerdote Eli a julgar embriagada, e ali fez o voto de dedicar ao Senhor o filho que pedia. Cumprido o voto, entregou Samuel ainda menino para servir no santuário, e foi naquele lugar que o menino ouviu a voz que o chamava pela noite (1 Samuel 1-3).

O declínio veio com os filhos de Eli. Na guerra contra os filisteus, a arca foi levada de Siló ao campo de batalha como talismã, e acabou capturada. Hofni e Fineias morreram, e a notícia matou Eli (1 Samuel 4).

A arca nunca mais voltou para lá, e o santuário parece ter sido destruído. Séculos depois, Jeremias usou a cidade como advertência aos que confiavam no templo de Jerusalém: "ide agora ao meu lugar, que estava em Siló, e vede o que lhe fiz, por causa da maldade do meu povo" (Jeremias 7:12-14).',
  published = true
where slug = 'silo';

update public.lexicon_entries set
  aliases = array['Sinai', 'Monte Sinai', 'Sinaí'],
  title = 'Sinai, o monte da Lei',
  description = 'Monte no deserto entre o Egito e Canaã, onde Israel acampou por cerca de um ano depois do êxodo, e onde a aliança foi firmada. É chamado também Horebe, "o monte de Deus", e a identificação do pico exato é discutida, com a tradição mais antiga apontando o Jebel Musa, no sul da península que leva o mesmo nome.

Três meses depois da saída do Egito, o povo acampou diante do monte, e Moisés subiu para receber a proposta da aliança: se obedecessem, seriam para Deus "um reino sacerdotal e uma nação santa" (Êxodo 19:1-6).

O povo se santificou por três dias, e ao terceiro houve trovões, relâmpagos, uma espessa nuvem, o som fortíssimo de uma trombeta e o monte todo fumegante, porque o Senhor havia descido sobre ele em fogo. O povo tremeu e pediu que Moisés falasse com eles no lugar de Deus (Êxodo 19:16-19, 20:18-19).

Ali foram dados os Dez Mandamentos e o restante da legislação, e Moisés permaneceu quarenta dias e quarenta noites no monte, recebendo as instruções do tabernáculo e as duas tábuas escritas pelo dedo de Deus (Êxodo 24:18, 31:18). Ao descer e encontrar o bezerro de ouro, quebrou as tábuas ao pé do monte (Êxodo 32:19).

O Sinai reaparece na história de Elias, que ali se refugiou e ouviu a voz mansa e delicada depois do vento, do terremoto e do fogo (1 Reis 19:8-13). Paulo o usa como figura da aliança da lei (Gálatas 4:24-25).',
  published = true
where slug = 'sinai';

update public.lexicon_entries set
  aliases = array['Sodoma', 'Sodom'],
  title = 'Sodoma, a cidade destruída por fogo',
  description = 'Cidade da planície do Jordão, mencionada quase sempre em par com Gomorra. Quando Abraão e Ló se separaram, Ló escolheu aquela região por ser bem regada, "como o jardim do Senhor", e armou suas tendas até Sodoma, cujos habitantes o texto já descreve como "maus e grandes pecadores contra o Senhor" (Gênesis 13:10-13).

Foi saqueada na guerra dos quatro reis contra os cinco, quando Ló foi levado cativo e depois resgatado por Abraão (Gênesis 14).

O episódio central está em Gênesis 18 e 19. Deus anuncia a Abraão o que pretende fazer, e o patriarca intercede numa negociação que desce de cinquenta justos até dez, com a pergunta: "não fará justiça o Juiz de toda a terra?". Dois anjos chegam à cidade ao anoitecer e são hospedados por Ló; os homens da cidade cercam a casa exigindo que lhes fossem entregues, e são feridos de cegueira.

Os visitantes retiram Ló, a mulher e as duas filhas pela mão, com a ordem de não olhar para trás. O Senhor fez chover enxofre e fogo sobre Sodoma e Gomorra, destruindo as cidades e toda a região, e a mulher de Ló, olhando para trás, tornou-se coluna de sal (Gênesis 19:23-26).

O nome virou sinônimo de julgamento em todo o resto das Escrituras. Ezequiel resume a culpa da cidade como soberba, fartura de pão e ociosidade sem socorro ao pobre (Ezequiel 16:49).',
  published = true
where slug = 'sodoma';

update public.lexicon_entries set
  aliases = array['Tarso', 'Tarsus', 'Tarso da Cilícia'],
  title = 'Tarso, a cidade natal de Paulo',
  description = 'Cidade da Cilícia, no sudeste da Ásia Menor, atual Turquia, situada junto ao rio Cidno e próxima da passagem montanhosa conhecida como Portas da Cilícia. Era um centro importante de comércio e sobretudo de estudo, com escolas de filosofia comparadas às de Atenas e Alexandria por escritores da época.

É mencionada nas Escrituras apenas em ligação com Paulo. Ele se apresenta como "judeu, natural de Tarso, cidade da Cilícia, cidadão de uma cidade não insignificante" ao pedir permissão ao tribuno para falar à multidão em Jerusalém (Atos 21:39).

Em sua defesa, acrescenta o dado decisivo da formação: nasceu em Tarso, mas foi criado em Jerusalém e instruído aos pés de Gamaliel conforme a exatidão da lei dos pais (Atos 22:3). Sua cidadania romana, que invocou mais de uma vez para escapar de açoites e para apelar a César, era de nascimento (Atos 22:28).

Depois da conversão em Damasco e da pregação em Jerusalém, uma conspiração contra sua vida levou os irmãos a conduzi-lo até Cesareia e de lá enviá-lo a Tarso (Atos 9:29-30). Ele passou alguns anos na região, um período sobre o qual o texto é quase inteiramente silencioso.

Foi ali que Barnabé foi buscá-lo, quando a igreja de Antioquia precisava de ajuda para ensinar os muitos gentios que haviam crido, o que deu início à trajetória missionária de Paulo (Atos 11:25-26).',
  published = true
where slug = 'tarso';

update public.lexicon_entries set
  aliases = array['Tessalônica', 'Tessalonica', 'Thessalonica', 'Salônica'],
  title = 'Tessalônica, capital da Macedônia',
  description = 'Principal cidade da província romana da Macedônia, porto importante situado sobre a Via Egnácia, a estrada que ligava o Adriático a Bizâncio. Corresponde à atual Salônica, na Grécia.

Paulo chegou ali vindo de Filipos, na segunda viagem missionária, acompanhado de Silas. Havia uma sinagoga, e por três sábados ele discutiu com os judeus a partir das Escrituras, expondo e demonstrando que era necessário que o Cristo padecesse e ressuscitasse. Alguns creram, e grande multidão de gregos religiosos e não poucas mulheres principais se juntaram a eles (Atos 17:1-4).

Os judeus que não creram ajuntaram homens da praça, formaram um tumulto e cercaram a casa de Jasom procurando os missionários. Não os achando, arrastaram Jasom aos magistrados com a acusação que ficou registrada: "estes que têm transtornado o mundo chegaram também aqui", e ainda "todos estes procedem contra os decretos de César, dizendo que há outro rei, Jesus" (Atos 17:5-7).

Os irmãos enviaram Paulo e Silas de noite para Bereia. Mesmo ali, judeus vindos de Tessalônica foram atrás para agitar as multidões (Atos 17:10-13).

Preocupado com a igreja que deixara tão cedo, Paulo enviou Timóteo e, ao receber boas notícias, escreveu as duas cartas aos tessalonicenses, entre os primeiros escritos do Novo Testamento, que tratam sobretudo da volta de Cristo e do trabalho cotidiano.',
  published = true
where slug = 'tessalonica';

update public.lexicon_entries set
  aliases = array['Tiro', 'Tyre', 'Tyro'],
  title = 'Tiro, a cidade fenícia do comércio',
  description = 'Cidade fenícia na costa do Mediterrâneo, ao norte de Israel, construída em parte sobre uma ilha fortificada. Foi a maior potência comercial marítima do mundo antigo, com colônias espalhadas pelo Mediterrâneo, e era conhecida pela púrpura extraída de moluscos e pelos navios de cedro.

No tempo de Davi e Salomão, a relação foi de aliança. Hirão, rei de Tiro, enviou cedros, carpinteiros e pedreiros para o palácio de Davi, e depois madeira e artífices para o templo, recebendo trigo e azeite em troca (2 Samuel 5:11, 1 Reis 5). O principal artesão em bronze do templo era um homem de Tiro, também chamado Hirão (1 Reis 7:13-14).

A aliança se estragou quando Acabe se casou com Jezabel, filha do rei de Sidom, cidade irmã, introduzindo o culto a Baal em Israel.

Ezequiel dedica três capítulos ao juízo sobre Tiro, com uma descrição detalhada de seu comércio, comparando-a a um navio perfeito em formosura que naufraga no coração dos mares, e um lamento sobre o príncipe de Tiro que se fez deus no seu coração (Ezequiel 26-28). Isaías e Amós também anunciam sua queda.

Nos evangelhos, Jesus se retirou para as regiões de Tiro e Sidom, onde atendeu ao pedido insistente da mulher siro-fenícia pela cura da filha (Marcos 7:24-30). Citou as duas cidades ao repreender Corazim e Betsaida, dizendo que elas teriam se arrependido com saco e cinza diante dos mesmos milagres (Mateus 11:21-22). Paulo passou por Tiro e ficou sete dias com os discípulos, que se despediram dele de joelhos na praia (Atos 21:3-6).',
  published = true
where slug = 'tiro';

update public.lexicon_entries set
  aliases = array['Ur dos Caldeus', 'Ur', 'Ur dos caldeus'],
  title = 'Ur dos Caldeus, a cidade de onde saiu Abraão',
  description = 'Cidade da baixa Mesopotâmia, na região que hoje corresponde ao sul do Iraque, perto do antigo curso do rio Eufrates. Foi um dos grandes centros urbanos do mundo antigo, conhecido pelo culto ao deus-lua Nanar e pelo grande zigurate que ainda se ergue no local.

É apresentada como a terra natal de Abraão e de sua família. Harã, irmão de Abraão e pai de Ló, morreu ali, "na terra do seu nascimento, em Ur dos caldeus" (Gênesis 11:28).

Terá tomou o filho Abrão, o neto Ló e a nora Sarai e saiu de Ur com destino a Canaã, mas parou em Harã, no norte da Mesopotâmia, e ali morreu (Gênesis 11:31-32). A jornada foi retomada depois, por ordem direta de Deus a Abraão.

Josué, ao recapitular a história do povo em Siquém, lembra que os pais habitavam antigamente além do rio e serviam a outros deuses, e que dali Deus tomou Abraão (Josué 24:2-3). A saída de Ur é, portanto, ruptura tanto geográfica quanto religiosa: deixar uma cidade grande e um culto estabelecido para viver em tendas numa terra prometida.

Neemias evoca o episódio em oração: "tu és o Senhor, o Deus que elegeste Abrão, e o tiraste de Ur dos caldeus" (Neemias 9:7), e Estêvão o retoma em seu discurso diante do Sinédrio (Atos 7:2-4).',
  published = true
where slug = 'ur-dos-caldeus';
