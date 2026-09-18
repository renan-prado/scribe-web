-- O LÉXICO sai do código e vira cadastro: os nomes que o resumo marca, com o
-- cartão que se abre ao tocar neles.
--
-- ONDE ELE MORAVA. `src/lib/domain/lexicon.ts` era um array de ~330 strings
-- compilado no bundle, varrido por `annotateText` a cada parágrafo. Funcionava
-- para o que ele fazia (pintar uma faixa embaixo de "Habacuque"), e não fazia
-- mais nada: um nome marcado não levava a lugar nenhum, porque não HAVIA lugar
-- nenhum. Acrescentar um nome era um deploy.
--
-- A MARCAÇÃO PASSOU A SIGNIFICAR UMA COISA SÓ: existe cartão aqui.
-- É a decisão central desta migração, e ela é a razão de `published` existir.
-- Antes, todo nome do array era marcado; agora só é marcado o que está
-- publicado, e publicado quer dizer "tem título, tem descrição, tem para onde
-- ir". A alternativa era marcar tudo e deixar metade dos nomes surdos ao
-- toque, que é a pior das três opções: promete e não entrega. O preço,
-- consciente, é que no dia desta migração NADA fica marcado, as 258 linhas do
-- fim deste arquivo nascem como rascunho, e cada uma acende quando alguém
-- escrever o cartão dela.
--
-- OS APELIDOS EXISTEM PORQUE O CARTÃO É UM SÓ. O array de hoje tinha
-- "Martinho Lutero" e "Lutero" como entradas irmãs, "Abraão" e "Abrão",
-- "Simão Pedro" e "Pedro": trinta e cinco pares que são a mesma pessoa escrita
-- de dois jeitos. Como lista de strings isso não custava nada; como cadastro
-- custaria escrever o mesmo cartão duas vezes e mantê-lo em dois lugares. O
-- seed já os funde, ver a coluna `aliases`. O que NÃO foi fundido é o que só
-- PARECE o mesmo nome: "João", "João Batista" e "João Crisóstomo" são três
-- pessoas, "Judas" e "Judas Iscariotes" são uma pergunta editorial, e "Sinai"
-- e "Horebe" são uma afirmação que esta migração não tem por que fazer.
--
-- QUEM LÊ O QUÊ. Publicado é conteúdo público do produto, da mesma natureza do
-- texto bíblico: o índice desce para a tela de quem lê um resumo, e o cartão é
-- buscado no toque. Por isso a policy de select é aberta a `anon` e presa a
-- `published`. O RASCUNHO não sai daqui: ele é trabalho em andamento, e o que
-- está escrito pela metade num campo de descrição não é coisa que se publique
-- por descuido de uma policy. Escrita, nenhuma: só o service_role, atrás de
-- `requireAdmin()`.

create table if not exists public.lexicon_entries (
  id          uuid primary key default gen_random_uuid(),
  -- O que vai na URL do cartão (`/api/lexicon/<slug>`) e o que o Biblo escreve
  -- quando quer apontar uma entrada. ASCII de propósito: derivado de `term` sem
  -- acento, ele é digitável e sobrevive a copiar e colar em qualquer lugar.
  slug        text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$'),
  -- A forma que o anotador procura no texto. Casamento EXATO, acento e
  -- maiúscula inclusive: é o que separa "Jó" de "jó" e "Marcos" (o
  -- evangelista) de "marcos" (as balizas). Ver `lib/domain/annotate.ts`.
  term        text not null unique check (length(btrim(term)) between 2 and 80),
  -- As outras formas do MESMO nome. Todas levam a este cartão.
  aliases     text[] not null default '{}',
  category    text not null check (category in ('person', 'place', 'figure')),
  -- O cabeçalho do cartão. Pode dizer mais que o termo ("Abraão, o pai da fé").
  title       text check (title is null or length(btrim(title)) <= 120),
  -- O corpo do cartão, e a MESMA coisa que o Biblo recebe como fonte quando a
  -- conversa toca esta entrada. Um campo só, e não um para ler e outro para o
  -- modelo: dois campos é a mesma informação mantida em dois lugares antes de
  -- alguém ter sentido falta do segundo.
  description text check (description is null or length(btrim(description)) <= 2000),
  -- Caminho dentro do bucket `lexicon` (ver o fim do arquivo), nunca a URL
  -- inteira: a URL carrega o domínio do projeto Supabase, e ele é diferente em
  -- dev e em produção. Guardar o caminho deixa a mesma linha válida nos dois.
  image_path  text,
  -- Marcado no texto, clicável, e visível ao Biblo. As três coisas de uma vez,
  -- porque as três são a mesma pergunta: existe conteúdo aqui?
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

comment on table public.lexicon_entries is
  'Os nomes que o resumo marca e o cartao de cada um. So `published` chega ao cliente. Ver 0063.';

-- O índice que a tela de leitura baixa: os publicados, e nada mais. Parcial
-- porque a consulta é sempre essa, e porque o rascunho é a maior parte da
-- tabela no dia em que ela nasce.
create index if not exists lexicon_entries_published_idx
  on public.lexicon_entries (term)
  where published;

-- A fila do admin: rascunho primeiro, e dentro dele por categoria.
create index if not exists lexicon_entries_admin_idx
  on public.lexicon_entries (published, category, term);

create or replace function public.touch_lexicon_entry()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists lexicon_entries_touch on public.lexicon_entries;
create trigger lexicon_entries_touch
  before update on public.lexicon_entries
  for each row execute function public.touch_lexicon_entry();

-- RLS -------------------------------------------------------------------------
-- Leitura do publicado para todo mundo, inclusive anônimo: é conteúdo do
-- produto, não dado de usuário, e a tabela não tem `user_id` justamente por
-- isso. A regra do `supabase/AGENTS.md` ("toda tabela de domínio tem user_id")
-- vale para o que é DE ALGUÉM; esta é um catálogo, como a Bíblia em disco.
-- Escrita não tem policy nenhuma: quem escreve é o service_role, que não passa
-- por RLS.

alter table public.lexicon_entries enable row level security;

drop policy if exists lexicon_entries_read_published on public.lexicon_entries;
create policy lexicon_entries_read_published
  on public.lexicon_entries
  for select
  to anon, authenticated
  using (published);

-- GRANT: o grant diz QUAIS COLUNAS, e a policy acima já disse quais linhas.
-- `created_by`, `created_at` e `published` ficam de fora: o primeiro é rastro
-- interno e os outros dois não têm o que fazer numa tela de leitura (a policy
-- já garantiu que toda linha que chega está publicada).
revoke all on public.lexicon_entries from anon, authenticated;
grant select (id, slug, term, aliases, category, title, description, image_path, updated_at)
  on public.lexicon_entries to anon, authenticated;

-- A IMAGEM ---------------------------------------------------------------------
-- Primeiro arquivo que o produto guarda. Bucket PÚBLICO: o cartão é conteúdo
-- aberto, e uma URL assinada por imagem transformaria um cartão estático numa
-- ida ao servidor a cada abertura, com data de validade para expirar no meio de
-- uma leitura. O teto de 2 MB e a lista de tipos são a tranca do lado do banco;
-- a rota de upload confere os mesmos dois antes, para dar mensagem em vez de
-- erro. Escrita só pelo service_role, que é o único caminho até ela.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lexicon', 'lexicon', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- O SEED ------------------------------------------------------------------------
-- As 258 entradas que estavam em `src/lib/domain/lexicon.ts`, todas como
-- RASCUNHO. Elas não marcam nada enquanto ninguém escrever o cartão; o que elas
-- preservam é a curadoria, que não é pouca coisa: aquele arquivo documentava
-- por que "Sete" e "Sem" ficaram de fora (em início de frase são o numeral e a
-- preposição) e por que Jesus, Cristo, Deus, Senhor e Espírito Santo nunca
-- entraram (são o sujeito de toda frase de um sermão; marcá-los pintaria o
-- parágrafo inteiro). Essas ausências continuam sendo decisões, e continuam
-- valendo para quem for cadastrar a próxima.
insert into public.lexicon_entries (slug, term, aliases, category) values
  ('adao', 'Adão', '{}', 'person'),
  ('eva', 'Eva', '{}', 'person'),
  ('caim', 'Caim', '{}', 'person'),
  ('abel', 'Abel', '{}', 'person'),
  ('enoque', 'Enoque', '{}', 'person'),
  ('matusalem', 'Matusalém', '{}', 'person'),
  ('noe', 'Noé', '{}', 'person'),
  ('cam', 'Cam', '{}', 'person'),
  ('jafe', 'Jafé', '{}', 'person'),
  ('abraao', 'Abraão', array['Abrão'], 'person'),
  ('sara', 'Sara', array['Sarai'], 'person'),
  ('lo', 'Ló', '{}', 'person'),
  ('hagar', 'Hagar', '{}', 'person'),
  ('ismael', 'Ismael', '{}', 'person'),
  ('isaque', 'Isaque', '{}', 'person'),
  ('rebeca', 'Rebeca', '{}', 'person'),
  ('esau', 'Esaú', '{}', 'person'),
  ('jaco', 'Jacó', '{}', 'person'),
  ('labao', 'Labão', '{}', 'person'),
  ('lia', 'Lia', '{}', 'person'),
  ('raquel', 'Raquel', '{}', 'person'),
  ('jose', 'José', '{}', 'person'),
  ('benjamim', 'Benjamim', '{}', 'person'),
  ('juda', 'Judá', '{}', 'person'),
  ('levi', 'Levi', '{}', 'person'),
  ('ruben', 'Rúben', '{}', 'person'),
  ('simeao', 'Simeão', '{}', 'person'),
  ('manasses', 'Manassés', '{}', 'person'),
  ('efraim', 'Efraim', '{}', 'person'),
  ('moises', 'Moisés', '{}', 'person'),
  ('arao', 'Arão', '{}', 'person'),
  ('miria', 'Miriã', '{}', 'person'),
  ('zipora', 'Zípora', '{}', 'person'),
  ('jetro', 'Jetro', '{}', 'person'),
  ('farao', 'Faraó', '{}', 'person'),
  ('balaao', 'Balaão', '{}', 'person'),
  ('core', 'Coré', '{}', 'person'),
  ('josue', 'Josué', '{}', 'person'),
  ('calebe', 'Calebe', '{}', 'person'),
  ('melquisedeque', 'Melquisedeque', '{}', 'person'),
  ('raabe', 'Raabe', '{}', 'person'),
  ('debora', 'Débora', '{}', 'person'),
  ('baraque', 'Baraque', '{}', 'person'),
  ('gideao', 'Gideão', '{}', 'person'),
  ('jefte', 'Jefté', '{}', 'person'),
  ('sansao', 'Sansão', '{}', 'person'),
  ('dalila', 'Dalila', '{}', 'person'),
  ('rute', 'Rute', '{}', 'person'),
  ('noemi', 'Noemi', '{}', 'person'),
  ('boaz', 'Boaz', '{}', 'person'),
  ('ana', 'Ana', '{}', 'person'),
  ('samuel', 'Samuel', '{}', 'person'),
  ('eli', 'Eli', '{}', 'person'),
  ('saul', 'Saul', '{}', 'person'),
  ('davi', 'Davi', '{}', 'person'),
  ('jonatas', 'Jônatas', '{}', 'person'),
  ('golias', 'Golias', '{}', 'person'),
  ('bate-seba', 'Bate-Seba', '{}', 'person'),
  ('absalao', 'Absalão', '{}', 'person'),
  ('nata', 'Natã', '{}', 'person'),
  ('salomao', 'Salomão', '{}', 'person'),
  ('roboao', 'Roboão', '{}', 'person'),
  ('jeroboao', 'Jeroboão', '{}', 'person'),
  ('acabe', 'Acabe', '{}', 'person'),
  ('jezabel', 'Jezabel', '{}', 'person'),
  ('elias', 'Elias', '{}', 'person'),
  ('eliseu', 'Eliseu', '{}', 'person'),
  ('naama', 'Naamã', '{}', 'person'),
  ('ezequias', 'Ezequias', '{}', 'person'),
  ('josias', 'Josias', '{}', 'person'),
  ('zorobabel', 'Zorobabel', '{}', 'person'),
  ('esdras', 'Esdras', '{}', 'person'),
  ('neemias', 'Neemias', '{}', 'person'),
  ('ester', 'Ester', '{}', 'person'),
  ('mardoqueu', 'Mardoqueu', '{}', 'person'),
  ('assuero', 'Assuero', '{}', 'person'),
  ('jo', 'Jó', '{}', 'person'),
  ('isaias', 'Isaías', '{}', 'person'),
  ('jeremias', 'Jeremias', '{}', 'person'),
  ('baruque', 'Baruque', '{}', 'person'),
  ('ezequiel', 'Ezequiel', '{}', 'person'),
  ('daniel', 'Daniel', '{}', 'person'),
  ('sadraque', 'Sadraque', '{}', 'person'),
  ('mesaque', 'Mesaque', '{}', 'person'),
  ('abede-nego', 'Abede-Nego', '{}', 'person'),
  ('nabucodonosor', 'Nabucodonosor', '{}', 'person'),
  ('belsazar', 'Belsazar', '{}', 'person'),
  ('dario', 'Dario', '{}', 'person'),
  ('oseias', 'Oseias', '{}', 'person'),
  ('gomer', 'Gômer', '{}', 'person'),
  ('joel', 'Joel', '{}', 'person'),
  ('amos', 'Amós', '{}', 'person'),
  ('obadias', 'Obadias', '{}', 'person'),
  ('jonas', 'Jonas', '{}', 'person'),
  ('miqueias', 'Miqueias', '{}', 'person'),
  ('naum', 'Naum', '{}', 'person'),
  ('habacuque', 'Habacuque', '{}', 'person'),
  ('sofonias', 'Sofonias', '{}', 'person'),
  ('ageu', 'Ageu', '{}', 'person'),
  ('zacarias', 'Zacarias', '{}', 'person'),
  ('malaquias', 'Malaquias', '{}', 'person'),
  ('maria', 'Maria', '{}', 'person'),
  ('isabel', 'Isabel', '{}', 'person'),
  ('joao-batista', 'João Batista', '{}', 'person'),
  ('herodes', 'Herodes', '{}', 'person'),
  ('pilatos', 'Pilatos', array['Pôncio Pilatos'], 'person'),
  ('caifas', 'Caifás', '{}', 'person'),
  ('nicodemos', 'Nicodemos', '{}', 'person'),
  ('pedro', 'Pedro', array['Simão Pedro'], 'person'),
  ('andre', 'André', '{}', 'person'),
  ('tiago', 'Tiago', '{}', 'person'),
  ('joao', 'João', '{}', 'person'),
  ('filipe', 'Filipe', '{}', 'person'),
  ('bartolomeu', 'Bartolomeu', '{}', 'person'),
  ('natanael', 'Natanael', '{}', 'person'),
  ('mateus', 'Mateus', '{}', 'person'),
  ('tome', 'Tomé', '{}', 'person'),
  ('judas-iscariotes', 'Judas Iscariotes', '{}', 'person'),
  ('judas', 'Judas', '{}', 'person'),
  ('matias', 'Matias', '{}', 'person'),
  ('estevao', 'Estêvão', '{}', 'person'),
  ('paulo', 'Paulo', array['Saulo', 'Saulo de Tarso'], 'person'),
  ('barnabe', 'Barnabé', '{}', 'person'),
  ('silas', 'Silas', '{}', 'person'),
  ('timoteo', 'Timóteo', '{}', 'person'),
  ('tito', 'Tito', '{}', 'person'),
  ('lucas', 'Lucas', '{}', 'person'),
  ('marcos', 'Marcos', '{}', 'person'),
  ('apolo', 'Apolo', '{}', 'person'),
  ('aquila', 'Áquila', '{}', 'person'),
  ('priscila', 'Priscila', '{}', 'person'),
  ('lidia', 'Lídia', '{}', 'person'),
  ('cornelio', 'Cornélio', '{}', 'person'),
  ('ananias', 'Ananias', '{}', 'person'),
  ('safira', 'Safira', '{}', 'person'),
  ('gamaliel', 'Gamaliel', '{}', 'person'),
  ('lazaro', 'Lázaro', '{}', 'person'),
  ('marta', 'Marta', '{}', 'person'),
  ('maria-madalena', 'Maria Madalena', '{}', 'person'),
  ('zaqueu', 'Zaqueu', '{}', 'person'),
  ('bartimeu', 'Bartimeu', '{}', 'person'),
  ('onesimo', 'Onésimo', '{}', 'person'),
  ('filemom', 'Filemom', '{}', 'person'),
  ('febe', 'Febe', '{}', 'person'),
  ('demas', 'Demas', '{}', 'person'),
  ('eden', 'Éden', '{}', 'place'),
  ('ur-dos-caldeus', 'Ur dos Caldeus', '{}', 'place'),
  ('hara', 'Harã', '{}', 'place'),
  ('canaa', 'Canaã', '{}', 'place'),
  ('sodoma', 'Sodoma', '{}', 'place'),
  ('gomorra', 'Gomorra', '{}', 'place'),
  ('egito', 'Egito', '{}', 'place'),
  ('gosen', 'Gósen', '{}', 'place'),
  ('mar-vermelho', 'Mar Vermelho', '{}', 'place'),
  ('sinai', 'Sinai', '{}', 'place'),
  ('horebe', 'Horebe', '{}', 'place'),
  ('cades-barneia', 'Cades-Barneia', '{}', 'place'),
  ('moabe', 'Moabe', '{}', 'place'),
  ('edom', 'Edom', '{}', 'place'),
  ('jordao', 'Jordão', '{}', 'place'),
  ('jerico', 'Jericó', '{}', 'place'),
  ('silo', 'Siló', '{}', 'place'),
  ('betel', 'Betel', '{}', 'place'),
  ('berseba', 'Berseba', '{}', 'place'),
  ('hebrom', 'Hebrom', '{}', 'place'),
  ('jerusalem', 'Jerusalém', '{}', 'place'),
  ('siao', 'Sião', '{}', 'place'),
  ('samaria', 'Samaria', '{}', 'place'),
  ('judeia', 'Judeia', '{}', 'place'),
  ('galileia', 'Galileia', '{}', 'place'),
  ('nazare', 'Nazaré', '{}', 'place'),
  ('belem', 'Belém', '{}', 'place'),
  ('cafarnaum', 'Cafarnaum', '{}', 'place'),
  ('betania', 'Betânia', '{}', 'place'),
  ('betsaida', 'Betsaida', '{}', 'place'),
  ('cana', 'Caná', '{}', 'place'),
  ('mar-da-galileia', 'Mar da Galileia', '{}', 'place'),
  ('monte-das-oliveiras', 'Monte das Oliveiras', '{}', 'place'),
  ('getsemani', 'Getsêmani', '{}', 'place'),
  ('golgota', 'Gólgota', array['Calvário'], 'place'),
  ('emaus', 'Emaús', '{}', 'place'),
  ('jope', 'Jope', '{}', 'place'),
  ('cesareia', 'Cesareia', '{}', 'place'),
  ('damasco', 'Damasco', '{}', 'place'),
  ('antioquia', 'Antioquia', '{}', 'place'),
  ('tarso', 'Tarso', '{}', 'place'),
  ('chipre', 'Chipre', '{}', 'place'),
  ('iconio', 'Icônio', '{}', 'place'),
  ('listra', 'Listra', '{}', 'place'),
  ('derbe', 'Derbe', '{}', 'place'),
  ('filipos', 'Filipos', '{}', 'place'),
  ('tessalonica', 'Tessalônica', '{}', 'place'),
  ('bereia', 'Bereia', '{}', 'place'),
  ('atenas', 'Atenas', '{}', 'place'),
  ('corinto', 'Corinto', '{}', 'place'),
  ('efeso', 'Éfeso', '{}', 'place'),
  ('colossos', 'Colossos', '{}', 'place'),
  ('mileto', 'Mileto', '{}', 'place'),
  ('malta', 'Malta', '{}', 'place'),
  ('roma', 'Roma', '{}', 'place'),
  ('babilonia', 'Babilônia', '{}', 'place'),
  ('ninive', 'Nínive', '{}', 'place'),
  ('assiria', 'Assíria', '{}', 'place'),
  ('persia', 'Pérsia', '{}', 'place'),
  ('tiro', 'Tiro', '{}', 'place'),
  ('sidom', 'Sidom', '{}', 'place'),
  ('patmos', 'Patmos', '{}', 'place'),
  ('macedonia', 'Macedônia', '{}', 'place'),
  ('acaia', 'Acaia', '{}', 'place'),
  ('galacia', 'Galácia', '{}', 'place'),
  ('israel', 'Israel', '{}', 'place'),
  ('agostinho', 'Agostinho', array['Agostinho de Hipona'], 'figure'),
  ('atanasio', 'Atanásio', '{}', 'figure'),
  ('irineu', 'Irineu', array['Irineu de Lião'], 'figure'),
  ('origenes', 'Orígenes', '{}', 'figure'),
  ('tertuliano', 'Tertuliano', '{}', 'figure'),
  ('joao-crisostomo', 'João Crisóstomo', array['Crisóstomo'], 'figure'),
  ('jeronimo', 'Jerônimo', '{}', 'figure'),
  ('basilio-de-cesareia', 'Basílio de Cesareia', '{}', 'figure'),
  ('gregorio-de-nissa', 'Gregório de Nissa', '{}', 'figure'),
  ('anselmo', 'Anselmo', array['Anselmo de Cantuária'], 'figure'),
  ('bernardo-de-claraval', 'Bernardo de Claraval', '{}', 'figure'),
  ('tomas-de-aquino', 'Tomás de Aquino', array['Aquino'], 'figure'),
  ('martinho-lutero', 'Martinho Lutero', array['Lutero'], 'figure'),
  ('joao-calvino', 'João Calvino', array['Calvino'], 'figure'),
  ('ulrico-zuinglio', 'Ulrico Zuínglio', array['Zuínglio'], 'figure'),
  ('filipe-melanchthon', 'Filipe Melanchthon', array['Melanchthon'], 'figure'),
  ('john-knox', 'John Knox', '{}', 'figure'),
  ('thomas-cranmer', 'Thomas Cranmer', '{}', 'figure'),
  ('john-owen', 'John Owen', '{}', 'figure'),
  ('richard-baxter', 'Richard Baxter', '{}', 'figure'),
  ('thomas-watson', 'Thomas Watson', '{}', 'figure'),
  ('john-bunyan', 'John Bunyan', array['Bunyan'], 'figure'),
  ('jonathan-edwards', 'Jonathan Edwards', '{}', 'figure'),
  ('george-whitefield', 'George Whitefield', array['Whitefield'], 'figure'),
  ('john-wesley', 'John Wesley', array['Wesley'], 'figure'),
  ('charles-spurgeon', 'Charles Spurgeon', array['Spurgeon'], 'figure'),
  ('charles-hodge', 'Charles Hodge', '{}', 'figure'),
  ('abraham-kuyper', 'Abraham Kuyper', array['Kuyper'], 'figure'),
  ('herman-bavinck', 'Herman Bavinck', array['Bavinck'], 'figure'),
  ('b-b-warfield', 'B. B. Warfield', array['Warfield'], 'figure'),
  ('karl-barth', 'Karl Barth', '{}', 'figure'),
  ('dietrich-bonhoeffer', 'Dietrich Bonhoeffer', array['Bonhoeffer'], 'figure'),
  ('c-s-lewis', 'C. S. Lewis', '{}', 'figure'),
  ('francis-schaeffer', 'Francis Schaeffer', array['Schaeffer'], 'figure'),
  ('j-i-packer', 'J. I. Packer', array['Packer'], 'figure'),
  ('john-stott', 'John Stott', array['Stott'], 'figure'),
  ('martyn-lloyd-jones', 'Martyn Lloyd-Jones', array['Lloyd-Jones'], 'figure'),
  ('r-c-sproul', 'R. C. Sproul', array['Sproul'], 'figure'),
  ('john-piper', 'John Piper', '{}', 'figure'),
  ('timothy-keller', 'Timothy Keller', array['Tim Keller', 'Keller'], 'figure'),
  ('d-a-carson', 'D. A. Carson', '{}', 'figure'),
  ('n-t-wright', 'N. T. Wright', '{}', 'figure'),
  ('eugene-peterson', 'Eugene Peterson', '{}', 'figure'),
  ('blaise-pascal', 'Blaise Pascal', array['Pascal'], 'figure'),
  ('soren-kierkegaard', 'Søren Kierkegaard', array['Kierkegaard'], 'figure'),
  ('g-k-chesterton', 'G. K. Chesterton', array['Chesterton'], 'figure'),
  ('fiodor-dostoievski', 'Fiódor Dostoiévski', array['Dostoiévski'], 'figure')
on conflict (slug) do nothing;
